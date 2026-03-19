'use client';

import { useEffect, useRef, useState } from 'react';
import { generateShareCode } from './codeGenerator';
import { createPeerConnection } from './webrtcSetup';

interface UseP2PReturn {
  code: string | null;
  isConnected: boolean;
  uploadProgress: number;
  isUploading: boolean;
  initiateTransfer: (file: File) => Promise<void>;
}

export function useP2P(): UseP2PReturn {
  const [code, setCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const answerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const candidatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedCandidateCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (answerPollRef.current) clearInterval(answerPollRef.current);
      if (candidatePollRef.current) clearInterval(candidatePollRef.current);
      peerConnectionRef.current?.close();
    };
  }, []);

  const initiateTransfer = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    appliedCandidateCountRef.current = 0;

    try {
      const shareCode = generateShareCode();
      setCode(shareCode);

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log('[v0] Sender connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          if (candidatePollRef.current) {
            clearInterval(candidatePollRef.current);
            candidatePollRef.current = null;
          }
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsConnected(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[v0] Sender ICE connection state:', pc.iceConnectionState);
      };

      // Create data channel BEFORE creating offer
      const dataChannel = pc.createDataChannel('file-transfer', { ordered: true });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('[v0] Data channel open — sending file');
        setIsConnected(true);
        sendFile(dataChannel, file);
      };

      dataChannel.onclose = () => {
        console.log('[v0] Data channel closed');
      };

      dataChannel.onerror = (e) => {
        console.error('[v0] Data channel error:', e);
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete before storing offer
      await waitForIceGathering(pc);

      const fileMetadata = { name: file.name, size: file.size, type: file.type };

      // Store offer WITH complete ICE candidates embedded in localDescription
      const storeRes = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'store-offer',
          code: shareCode,
          offer: pc.localDescription,
          fileMetadata,
        }),
      });

      if (!storeRes.ok) {
        throw new Error('Failed to store offer in signaling server');
      }

      console.log('[v0] Offer stored (with ICE) for code:', shareCode);
      setUploadProgress(10);
      setIsUploading(false);

      // Poll for answer
      answerPollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-answer', code: shareCode }),
          });

          if (!res.ok) return; // answer not ready yet

          const data = await res.json();
          const { answer } = data;

          if (answer && pc.signalingState === 'have-local-offer') {
            clearInterval(answerPollRef.current!);
            answerPollRef.current = null;
            console.log('[v0] Received answer, setting remote description');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('[v0] Remote description set on sender');
            // The answer already contains all ICE candidates (gathered before storing)
            // No further polling needed
          }
        } catch (err) {
          console.error('[v0] Answer poll error:', err);
        }
      }, 1000);

      // Stop polling after 10 minutes
      setTimeout(() => {
        if (answerPollRef.current) clearInterval(answerPollRef.current);
        if (candidatePollRef.current) clearInterval(candidatePollRef.current);
      }, 10 * 60 * 1000);

    } catch (error) {
      console.error('[v0] Transfer initiation error:', error);
      setIsUploading(false);
      throw error;
    }
  };

  const sendFile = (dataChannel: RTCDataChannel, file: File) => {
    const CHUNK_SIZE = 16384;
    let offset = 0;

    // Send metadata first
    const metadata = { name: file.name, size: file.size, type: file.type };
    dataChannel.send(JSON.stringify(metadata));

    const reader = new FileReader();

    const readAndSend = () => {
      if (offset >= file.size) {
        console.log('[v0] File transfer complete');
        setUploadProgress(100);
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      reader.onload = (e) => {
        try {
          dataChannel.send(e.target?.result as ArrayBuffer);
          offset += CHUNK_SIZE;
          setUploadProgress(Math.min(99, Math.round((offset / file.size) * 100)));

          if (dataChannel.bufferedAmount < CHUNK_SIZE * 4) {
            readAndSend();
          } else {
            dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE * 2;
            dataChannel.onbufferedamountlow = () => {
              dataChannel.onbufferedamountlow = null;
              readAndSend();
            };
          }
        } catch (err) {
          console.error('[v0] Error sending chunk:', err);
        }
      };
      reader.readAsArrayBuffer(chunk);
    };

    readAndSend();
  };

  return { code, isConnected, uploadProgress, isUploading, initiateTransfer };
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
