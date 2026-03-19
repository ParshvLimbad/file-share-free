import { NextRequest, NextResponse } from 'next/server';

// In-memory store for signaling data
// In production, use a real database with cleanup
const signalingStore = new Map<
  string,
  {
    offer?: any;
    answer?: any;
    fileMetadata?: any;
    offerCandidates: any[];
    answerCandidates: any[];
    timestamp: number;
  }
>();

// Cleanup expired entries (older than 1 hour)
function cleanupExpiredEntries() {
  const now = Date.now();
  const expirationTime = 60 * 60 * 1000; // 1 hour

  for (const [code, data] of signalingStore.entries()) {
    if (now - data.timestamp > expirationTime) {
      signalingStore.delete(code);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    cleanupExpiredEntries();

    const body = await request.json();
    const { action, code, offer, answer, fileMetadata } = body;

    if (!code || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'store-offer') {
      signalingStore.set(code, {
        offer,
        fileMetadata,
        offerCandidates: [],
        answerCandidates: [],
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: 'Offer stored',
      });
    }

    if (action === 'get-offer') {
      const data = signalingStore.get(code);

      if (!data) {
        return NextResponse.json(
          { error: 'Offer not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        offer: data.offer,
        fileMetadata: data.fileMetadata,
      });
    }

    if (action === 'store-answer') {
      const data = signalingStore.get(code);

      if (!data) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }

      data.answer = answer;
      data.timestamp = Date.now();

      return NextResponse.json({
        success: true,
        message: 'Answer stored',
      });
    }

    if (action === 'get-answer') {
      const data = signalingStore.get(code);

      if (!data?.answer) {
        return NextResponse.json(
          { error: 'Answer not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        answer: data.answer,
      });
    }

    if (action === 'add-offer-candidate') {
      const data = signalingStore.get(code);
      if (!data) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      const { candidate } = body;
      if (candidate) {
        data.offerCandidates.push(candidate);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'add-answer-candidate') {
      const data = signalingStore.get(code);
      if (!data) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      const { candidate } = body;
      if (candidate) {
        data.answerCandidates.push(candidate);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'get-offer-candidates') {
      const data = signalingStore.get(code);
      return NextResponse.json({ candidates: data?.offerCandidates ?? [] });
    }

    if (action === 'get-answer-candidates') {
      const data = signalingStore.get(code);
      return NextResponse.json({ candidates: data?.answerCandidates ?? [] });
    }

    if (action === 'check-code') {
      const exists = signalingStore.has(code);

      return NextResponse.json({
        exists,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[v0] Signaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
