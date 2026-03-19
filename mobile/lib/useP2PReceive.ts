import { useState, useRef, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import { isValidShareCode } from './codeGenerator';
import {
  createPeerConnection,
  createSessionDescription,
  waitForIceGathering,
  isWebRTCAvailable,
} from './webrtc';
import { getOffer, storeAnswer } from './signaling';

export type ReceiveStatus =
  | 'idle'
  | 'connecting'
  | 'receiving'
  | 'complete'
  | 'error';

export interface ReceivedFileInfo {
  name: string;
  size: number;
  type: string;
  uri: string;
}

interface UseP2PReceiveReturn {
  status: ReceiveStatus;
  progress: number;
  speed: number;
  fileMetadata: { name: string; size: number; type: string } | null;
  receivedFile: ReceivedFileInfo | null;
  error: string | null;
  isWebRTCReady: boolean;
  startReceive: (code: string) => Promise<void>;
  cancel: () => void;
}

export function useP2PReceive(): UseP2PReceiveReturn {
  const [status, setStatus] = useState<ReceiveStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [fileMetadata, setFileMetadata] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [receivedFile, setReceivedFile] = useState<ReceivedFileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const metadataRef = useRef<{ name: string; size: number; type: string } | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    pcRef.current?.close();
    pcRef.current = null;
    chunksRef.current = [];
  }, []);

  const saveFile = useCallback(
    async (meta: { name: string; size: number; type: string }) => {
      try {
        const chunks = chunksRef.current;
        const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const buffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }

        // Save to app's document directory
        const dir = `${FileSystem.documentDirectory}received/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

        const filePath = `${dir}${meta.name}`;

        // Convert to base64 and write
        const base64 = uint8ArrayToBase64(buffer);
        await FileSystem.writeAsStringAsync(filePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileInfo: ReceivedFileInfo = {
          name: meta.name,
          size: meta.size,
          type: meta.type,
          uri: filePath,
        };

        setReceivedFile(fileInfo);
        setStatus('complete');
        setProgress(100);
        console.log('[Receive] File saved:', filePath);

        // Clear chunks from memory
        chunksRef.current = [];

        return fileInfo;
      } catch (err) {
        console.error('[Receive] Failed to save file:', err);
        setError('Failed to save file');
        setStatus('error');
        return null;
      }
    },
    []
  );

  const startReceive = useCallback(
    async (code: string) => {
      if (!isWebRTCAvailable) {
        setError('WebRTC not available. Use a development build for file transfers.');
        setStatus('error');
        return;
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!isValidShareCode(normalizedCode)) {
        setError('Invalid share code');
        setStatus('error');
        return;
      }

      cancelledRef.current = false;
      setError(null);
      setStatus('connecting');
      setProgress(0);
      setSpeed(0);
      setReceivedFile(null);
      chunksRef.current = [];

      try {
        console.log('[Receive] Fetching offer for code:', normalizedCode);

        const data = await getOffer(normalizedCode);
        if (data.error || !data.offer) {
          setError('Share code not found or expired');
          setStatus('error');
          return;
        }

        if (data.fileMetadata) {
          metadataRef.current = data.fileMetadata;
          setFileMetadata(data.fileMetadata);
        }

        const pc = createPeerConnection();
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
          console.log('[Receive] Connection state:', pc.connectionState);
          if (
            pc.connectionState === 'failed' ||
            pc.connectionState === 'disconnected'
          ) {
            if (!cancelledRef.current) {
              setError('Connection lost — sender may have disconnected');
              setStatus('error');
            }
          }
        };

        // Handle incoming data channel
        (pc as any).ondatachannel = (event: any) => {
          console.log('[Receive] Data channel received');
          const dc = event.channel;
          dc.binaryType = 'arraybuffer';
          let metaReceived = false;
          startTimeRef.current = Date.now();

          dc.onmessage = (msgEvent: any) => {
            if (cancelledRef.current) return;

            // Handle string messages (metadata or completion)
            if (typeof msgEvent.data === 'string') {
              try {
                const parsed = JSON.parse(msgEvent.data);

                if (parsed.__complete) {
                  // Transfer complete
                  const meta = metadataRef.current;
                  if (meta) saveFile(meta);
                  return;
                }

                if (!metaReceived) {
                  console.log('[Receive] Got metadata:', parsed);
                  metadataRef.current = parsed;
                  setFileMetadata(parsed);
                  metaReceived = true;
                  setStatus('receiving');
                }
              } catch {
                console.warn('[Receive] Failed to parse message');
              }
              return;
            }

            // Handle binary data (file chunks)
            if (msgEvent.data instanceof ArrayBuffer) {
              chunksRef.current.push(msgEvent.data);

              const totalReceived = chunksRef.current.reduce(
                (sum: number, chunk: ArrayBuffer) => sum + chunk.byteLength,
                0
              );

              const meta = metadataRef.current;
              if (meta) {
                const pct = Math.min(99, Math.round((totalReceived / meta.size) * 100));
                setProgress(pct);

                const elapsed = (Date.now() - startTimeRef.current) / 1000;
                setSpeed(elapsed > 0 ? totalReceived / elapsed : 0);
              }
            }
          };

          dc.onerror = (e: any) => {
            console.error('[Receive] Data channel error:', e);
            if (!cancelledRef.current) {
              setError('Transfer error');
              setStatus('error');
            }
          };
        };

        // Set remote description and create answer
        await pc.setRemoteDescription(createSessionDescription(data.offer));
        const answer = await pc.createAnswer({});
        await pc.setLocalDescription(answer);
        await waitForIceGathering(pc);

        // Store answer
        await storeAnswer(normalizedCode, pc.localDescription!);
        console.log('[Receive] Answer stored');
      } catch (err) {
        console.error('[Receive] Error:', err);
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Connection failed');
          setStatus('error');
        }
      }
    },
    [saveFile]
  );

  return {
    status,
    progress,
    speed,
    fileMetadata,
    receivedFile,
    error,
    isWebRTCReady: isWebRTCAvailable,
    startReceive,
    cancel,
  };
}

// Utility to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
