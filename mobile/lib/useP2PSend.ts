import { useState, useRef, useEffect, useCallback } from 'react';
import { generateShareCode } from './codeGenerator';
import {
  createPeerConnection,
  createSessionDescription,
  waitForIceGathering,
  isWebRTCAvailable,
} from './webrtc';
import { storeOffer, getAnswer } from './signaling';
import { CHUNK_SIZE } from './constants';

export type SendStatus =
  | 'idle'
  | 'preparing'
  | 'waiting'
  | 'connected'
  | 'transferring'
  | 'complete'
  | 'error';

interface FileInfo {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

interface UseP2PSendReturn {
  status: SendStatus;
  code: string | null;
  progress: number;
  speed: number;
  error: string | null;
  isWebRTCReady: boolean;
  startSend: (files: FileInfo[]) => Promise<void>;
  cancel: () => void;
}

export function useP2PSend(): UseP2PSendReturn {
  const [status, setStatus] = useState<SendStatus>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
  }, []);

  const sendFileData = useCallback(
    async (dc: RTCDataChannel, files: FileInfo[]) => {
      startTimeRef.current = Date.now();
      setStatus('transferring');

      // Calculate total size for progress
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      let totalSent = 0;

      for (const file of files) {
        if (cancelledRef.current) return;

        // Send file metadata
        const metadata = {
          name: file.name,
          size: file.size,
          type: file.mimeType,
          isMultiple: files.length > 1,
          totalFiles: files.length,
        };
        dc.send(JSON.stringify(metadata));

        // Read and send file in chunks
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        let offset = 0;
        while (offset < data.length) {
          if (cancelledRef.current) return;

          const chunk = data.slice(offset, offset + CHUNK_SIZE);
          
          // Wait for buffer to drain if needed
          while (dc.bufferedAmount > CHUNK_SIZE * 8) {
            await new Promise((r) => setTimeout(r, 10));
          }

          dc.send(chunk.buffer);
          offset += chunk.length;
          totalSent += chunk.length;

          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setProgress(Math.min(99, Math.round((totalSent / totalSize) * 100)));
          setSpeed(elapsed > 0 ? totalSent / elapsed : 0);
        }
      }

      // Send completion signal
      dc.send(JSON.stringify({ __complete: true }));
      setProgress(100);
      setStatus('complete');
    },
    []
  );

  const startSend = useCallback(
    async (files: FileInfo[]) => {
      if (!isWebRTCAvailable) {
        setError('WebRTC not available. Use a development build for file transfers.');
        setStatus('error');
        return;
      }

      cancelledRef.current = false;
      setError(null);
      setStatus('preparing');
      setProgress(0);
      setSpeed(0);

      try {
        const shareCode = generateShareCode();
        setCode(shareCode);

        const pc = createPeerConnection();
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
          console.log('[Send] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setStatus('connected');
          } else if (
            pc.connectionState === 'failed' ||
            pc.connectionState === 'disconnected'
          ) {
            if (!cancelledRef.current) {
              setError('Connection lost');
              setStatus('error');
            }
          }
        };

        // Create data channel
        const dc = pc.createDataChannel('file-transfer', { ordered: true });
        dcRef.current = dc;

        dc.onopen = () => {
          console.log('[Send] Data channel open — sending files');
          sendFileData(dc, files);
        };

        dc.onerror = (e) => {
          console.error('[Send] Data channel error:', e);
          if (!cancelledRef.current) {
            setError('Transfer error');
            setStatus('error');
          }
        };

        // Create offer
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);

        const fileMetadata = files.length === 1
          ? { name: files[0].name, size: files[0].size, type: files[0].mimeType }
          : {
              name: `${files.length} files`,
              size: files.reduce((s, f) => s + f.size, 0),
              type: 'multiple',
            };

        // Store offer on signaling server
        await storeOffer(shareCode, pc.localDescription!, fileMetadata);
        console.log('[Send] Offer stored for code:', shareCode);

        setStatus('waiting');

        // Poll for answer
        pollRef.current = setInterval(async () => {
          try {
            const data = await getAnswer(shareCode);
            if (data.answer && pc.signalingState === 'have-local-offer') {
              clearInterval(pollRef.current!);
              pollRef.current = null;
              console.log('[Send] Got answer, setting remote description');
              await pc.setRemoteDescription(
                createSessionDescription(data.answer)
              );
            }
          } catch {
            // Answer not ready yet
          }
        }, 1000);

        // Timeout after 10 minutes
        setTimeout(() => {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            if (status === 'waiting') {
              setError('Connection timed out');
              setStatus('error');
            }
          }
        }, 10 * 60 * 1000);
      } catch (err) {
        console.error('[Send] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start transfer');
        setStatus('error');
      }
    },
    [sendFileData, status]
  );

  return {
    status,
    code,
    progress,
    speed,
    error,
    isWebRTCReady: isWebRTCAvailable,
    startSend,
    cancel,
  };
}
