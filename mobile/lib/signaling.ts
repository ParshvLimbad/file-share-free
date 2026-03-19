// Signaling service - communicates with the Cloudflare Worker
import { SIGNALING_SERVER_URL } from './constants';

const isConfigured = () => !SIGNALING_SERVER_URL.startsWith('__');

async function signalRequest(body: Record<string, any>): Promise<any> {
  if (!isConfigured()) {
    console.warn('[Signaling] Server URL not configured');
    return null;
  }

  const response = await fetch(`${SIGNALING_SERVER_URL}/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Signal request failed: ${response.status}`);
  }

  return response.json();
}

// Store an offer (sender calls this)
export async function storeOffer(
  code: string,
  offer: RTCSessionDescriptionInit,
  fileMetadata: { name: string; size: number; type: string }
): Promise<void> {
  await signalRequest({
    action: 'store-offer',
    code,
    offer,
    fileMetadata,
  });
}

// Get an offer (receiver calls this)
export async function getOffer(
  code: string
): Promise<{
  offer: RTCSessionDescriptionInit;
  fileMetadata: { name: string; size: number; type: string };
} | null> {
  try {
    return await signalRequest({ action: 'get-offer', code });
  } catch {
    return null;
  }
}

// Store an answer (receiver calls this)
export async function storeAnswer(
  code: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await signalRequest({ action: 'store-answer', code, answer });
}

// Get an answer (sender polls this)
export async function getAnswer(
  code: string
): Promise<{ answer: RTCSessionDescriptionInit } | null> {
  try {
    return await signalRequest({ action: 'get-answer', code });
  } catch {
    return null;
  }
}

// Check if a share code is already in use
export async function checkCode(code: string): Promise<boolean> {
  try {
    const data = await signalRequest({ action: 'check-code', code });
    return data?.exists || false;
  } catch {
    return false;
  }
}

// Poll for answer with timeout
export async function pollForAnswer(
  code: string,
  timeoutMs: number = 120000,
  intervalMs: number = 2000
): Promise<RTCSessionDescriptionInit | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await getAnswer(code);
    if (data?.answer) return data.answer;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Timed out waiting for receiver');
}
