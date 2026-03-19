'use client';

import { useEffect, useRef, useState } from 'react';
import { createPeerConnection } from './webrtcSetup';
import { isValidShareCode } from './codeGenerator';

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

type ReceiveStatus = 'connecting' | 'receiving' | 'complete' | 'error';

interface UseReceiveFileReturn {
  status: ReceiveStatus;
  downloadProgress: number;
  fileMetadata: FileMetadata | null;
  error: string | null;
}

export function useReceiveFile(code: string): UseReceiveFileReturn {
  const [status, setStatus] = useState<ReceiveStatus>('connecting');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const fileMetadataRef = useRef<FileMetadata | null>(null);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const run = async () => {
      try {
        if (!isValidShareCode(code)) {
          setError('Invalid share code format');
          setStatus('error');
          return;
        }

        console.log('[v0] Fetching offer for code:', code);

        // Fetch offer from API
        const response = await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-offer', code }),
        });

        if (!response.ok) {
          setError('Share code not found or expired');
          setStatus('error');
          return;
        }

        if (cancelled) return;

        const { offer, fileMetadata: meta } = await response.json();

        if (!offer) {
          setError('Share code not found or expired');
          setStatus('error');
          return;
        }

        console.log('[v0] Got offer, setting up connection');

        if (meta) {
          fileMetadataRef.current = meta;
          setFileMetadata(meta);
        }

        await setupConnection(offer);
      } catch (err) {
        if (!cancelled) {
          console.error('[v0] Error in useReceiveFile:', err);
          setError(err instanceof Error ? err.message : 'Connection error');
          setStatus('error');
        }
      }
    };

    const setupConnection = async (offer: RTCSessionDescriptionInit) => {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log('[v0] Receiver connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          if (!cancelled) {
            setError('Connection failed — the sender may have disconnected');
            setStatus('error');
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[v0] Receiver ICE connection state:', pc.iceConnectionState);
      };

      pc.ondatachannel = (event) => {
        console.log('[v0] Data channel received on receiver');
        setupDataChannel(event.channel);
      };

      // Set the remote description (offer already has all ICE embedded)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[v0] Remote description set on receiver');

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete before storing answer
      await waitForIceGathering(pc);

      console.log('[v0] ICE gathering complete on receiver, storing answer');

      // Store the answer (with ICE embedded in localDescription)
      const answerRes = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'store-answer',
          code,
          answer: pc.localDescription,
        }),
      });

      if (!answerRes.ok) {
        console.error('[v0] Failed to store answer');
        if (!cancelled) {
          setError('Failed to complete connection handshake');
          setStatus('error');
        }
        return;
      }

      console.log('[v0] Answer stored successfully');
      setStatus('receiving');
    };

    const setupDataChannel = (dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      receivedChunksRef.current = [];
      let metadataReceived = false;

      dc.onmessage = (event) => {
        if (!metadataReceived && typeof event.data === 'string') {
          // First message is metadata
          try {
            const meta: FileMetadata = JSON.parse(event.data);
            console.log('[v0] Received file metadata:', meta);
            fileMetadataRef.current = meta;
            setFileMetadata(meta);
            metadataReceived = true;
          } catch {
            console.error('[v0] Failed to parse metadata');
          }
        } else if (event.data instanceof ArrayBuffer) {
          receivedChunksRef.current.push(event.data);

          const totalReceived = receivedChunksRef.current.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
          );

          const meta = fileMetadataRef.current;
          if (meta) {
            const pct = Math.min(100, Math.round((totalReceived / meta.size) * 100));
            setDownloadProgress(pct);

            if (totalReceived >= meta.size) {
              downloadFile(meta);
            }
          }
        }
      };

      dc.onerror = (e) => {
        console.error('[v0] Data channel error:', e);
        if (!cancelled) {
          setError('Transfer error');
          setStatus('error');
        }
      };

      dc.onclose = () => {
        console.log('[v0] Data channel closed');
      };
    };

    const downloadFile = (meta: FileMetadata) => {
      try {
        const chunks = receivedChunksRef.current;
        const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const buffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }

        const blob = new Blob([buffer], { type: meta.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = meta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('complete');
        setDownloadProgress(100);
        console.log('[v0] File download triggered:', meta.name);
      } catch (err) {
        console.error('[v0] Failed to save file:', err);
        setError('Failed to save file');
        setStatus('error');
      }
    };

    run();

    return () => {
      cancelled = true;
      peerConnectionRef.current?.close();
    };
    // Only re-run when the code changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return { status, downloadProgress, fileMetadata, error };
}

/**
 * Wait for RTCPeerConnection ICE gathering to complete.
 * Returns immediately if already complete.
 */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // Fallback: resolve after 5 seconds regardless
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 5000);
  });
}
