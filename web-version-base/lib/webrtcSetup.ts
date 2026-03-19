// WebRTC setup utilities

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export function createPeerConnection(): RTCPeerConnection {
  const peerConnection = new RTCPeerConnection({
    iceServers: STUN_SERVERS,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });

  return peerConnection;
}

export async function handleRemoteOffer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
}

export async function handleRemoteAnswer(
  peerConnection: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('[v0] Error adding ICE candidate:', error);
  }
}
