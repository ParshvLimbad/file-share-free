// WebRTC setup utilities for React Native
// This module works with react-native-webrtc when available,
// and provides mock implementations for Expo Go testing.

import { STUN_SERVERS } from './constants';

let RTCPeerConnectionImpl: any;
let RTCSessionDescriptionImpl: any;
let RTCIceCandidateImpl: any;

// Try to load react-native-webrtc (won't be available in Expo Go)
try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnectionImpl = webrtc.RTCPeerConnection;
  RTCSessionDescriptionImpl = webrtc.RTCSessionDescription;
  RTCIceCandidateImpl = webrtc.RTCIceCandidate;
} catch {
  // In Expo Go - use globals if available, otherwise we'll mock
  RTCPeerConnectionImpl = (globalThis as any).RTCPeerConnection;
  RTCSessionDescriptionImpl = (globalThis as any).RTCSessionDescription;
  RTCIceCandidateImpl = (globalThis as any).RTCIceCandidate;
}

export const isWebRTCAvailable = !!RTCPeerConnectionImpl;

export function createPeerConnection(): RTCPeerConnection {
  if (!RTCPeerConnectionImpl) {
    throw new Error(
      'WebRTC is not available. Please use a development build (not Expo Go) for file transfers.'
    );
  }

  return new RTCPeerConnectionImpl({
    iceServers: STUN_SERVERS,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });
}

export function createSessionDescription(
  desc: RTCSessionDescriptionInit
): RTCSessionDescription {
  if (RTCSessionDescriptionImpl) {
    return new RTCSessionDescriptionImpl(desc);
  }
  return desc as RTCSessionDescription;
}

export function createIceCandidate(
  candidate: RTCIceCandidateInit
): RTCIceCandidate {
  if (RTCIceCandidateImpl) {
    return new RTCIceCandidateImpl(candidate);
  }
  return candidate as RTCIceCandidate;
}

/**
 * Wait for RTCPeerConnection ICE gathering to complete.
 * Returns immediately if already complete.
 */
export function waitForIceGathering(
  pc: RTCPeerConnection
): Promise<void> {
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
