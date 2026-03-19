import { neon } from '@neondatabase/serverless';

export interface Env {
  SIGNALING_KV: KVNamespace;
  NEON_DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
}

// CORS headers for mobile app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Signaling endpoints ──
      if (path === '/signal' && request.method === 'POST') {
        return handleSignal(request, env);
      }

      // ── Auth endpoints ──
      if (path === '/auth/google' && request.method === 'POST') {
        return handleGoogleAuth(request, env);
      }

      // ── Usage endpoints ──
      if (path.startsWith('/usage/') && request.method === 'GET') {
        const userId = path.split('/usage/')[1];
        return handleGetUsage(userId, env);
      }
      if (path === '/usage/increment' && request.method === 'POST') {
        return handleIncrementUsage(request, env);
      }
      if (path === '/usage/add-bonus' && request.method === 'POST') {
        return handleAddBonus(request, env);
      }

      // ── User endpoints ──
      if (path.startsWith('/user/') && request.method === 'GET') {
        const userId = path.split('/user/')[1];
        return handleGetUser(userId, env);
      }

      // ── Health check ──
      if (path === '/health') {
        return json({ status: 'ok', timestamp: Date.now() });
      }

      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};

// ─── SIGNALING ───

async function handleSignal(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any;
  const { action, code, offer, answer, fileMetadata } = body;

  if (!code || !action) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const kvKey = `signal:${code}`;
  const TTL_SECONDS = 3600; // 1 hour

  switch (action) {
    case 'store-offer': {
      const data = { offer, fileMetadata, timestamp: Date.now() };
      await env.SIGNALING_KV.put(kvKey, JSON.stringify(data), {
        expirationTtl: TTL_SECONDS,
      });
      return json({ success: true, message: 'Offer stored' });
    }

    case 'get-offer': {
      const raw = await env.SIGNALING_KV.get(kvKey);
      if (!raw) {
        return json({ error: 'Offer not found' }, 404);
      }
      const data = JSON.parse(raw);
      return json({ offer: data.offer, fileMetadata: data.fileMetadata });
    }

    case 'store-answer': {
      const raw = await env.SIGNALING_KV.get(kvKey);
      if (!raw) {
        return json({ error: 'Code not found' }, 404);
      }
      const data = JSON.parse(raw);
      data.answer = answer;
      data.timestamp = Date.now();
      await env.SIGNALING_KV.put(kvKey, JSON.stringify(data), {
        expirationTtl: TTL_SECONDS,
      });
      return json({ success: true, message: 'Answer stored' });
    }

    case 'get-answer': {
      const raw = await env.SIGNALING_KV.get(kvKey);
      if (!raw) {
        return json({ error: 'Answer not found' }, 404);
      }
      const data = JSON.parse(raw);
      if (!data.answer) {
        return json({ error: 'Answer not ready' }, 404);
      }
      return json({ answer: data.answer });
    }

    case 'check-code': {
      const exists = (await env.SIGNALING_KV.get(kvKey)) !== null;
      return json({ exists });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
}

// ─── GOOGLE AUTH ───

async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const { idToken } = await request.json() as any;

  if (!idToken) {
    return json({ error: 'Missing idToken' }, 400);
  }

  // Verify Google ID token
  const tokenInfo = await verifyGoogleToken(idToken, env.GOOGLE_CLIENT_ID);
  if (!tokenInfo) {
    return json({ error: 'Invalid token' }, 401);
  }

  const sql = neon(env.NEON_DATABASE_URL);

  // Upsert user
  const result = await sql`
    INSERT INTO users (id, email, name, picture)
    VALUES (${tokenInfo.sub}, ${tokenInfo.email}, ${tokenInfo.name}, ${tokenInfo.picture})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      picture = EXCLUDED.picture,
      updated_at = NOW()
    RETURNING id, email, name, picture, plan, plan_expires_at, created_at
  `;

  return json({ user: result[0] });
}

async function verifyGoogleToken(
  idToken: string,
  clientId: string
): Promise<any | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    if (!response.ok) return null;

    const data = await response.json() as any;

    // Verify the audience matches our client ID
    if (data.aud !== clientId) return null;

    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

// ─── USAGE TRACKING ───

async function handleGetUsage(userId: string, env: Env): Promise<Response> {
  const sql = neon(env.NEON_DATABASE_URL);

  const result = await sql`
    SELECT 
      COALESCE(bytes_transferred, 0) as bytes_transferred,
      COALESCE(bonus_bytes, 0) as bonus_bytes,
      COALESCE(ad_watches_today, 0) as ad_watches_today
    FROM daily_usage
    WHERE user_id = ${userId} AND date = CURRENT_DATE
  `;

  if (result.length === 0) {
    return json({ bytes_transferred: 0, bonus_bytes: 0, ad_watches_today: 0 });
  }

  return json(result[0]);
}

async function handleIncrementUsage(
  request: Request,
  env: Env
): Promise<Response> {
  const { userId, bytes } = await request.json() as any;

  if (!userId || !bytes) {
    return json({ error: 'Missing userId or bytes' }, 400);
  }

  const sql = neon(env.NEON_DATABASE_URL);

  await sql`
    INSERT INTO daily_usage (user_id, date, bytes_transferred)
    VALUES (${userId}, CURRENT_DATE, ${bytes})
    ON CONFLICT (user_id, date) DO UPDATE SET
      bytes_transferred = daily_usage.bytes_transferred + ${bytes}
  `;

  return json({ success: true });
}

async function handleAddBonus(request: Request, env: Env): Promise<Response> {
  const { userId, bonusBytes } = await request.json() as any;

  if (!userId || !bonusBytes) {
    return json({ error: 'Missing userId or bonusBytes' }, 400);
  }

  const sql = neon(env.NEON_DATABASE_URL);

  await sql`
    INSERT INTO daily_usage (user_id, date, bonus_bytes, ad_watches_today)
    VALUES (${userId}, CURRENT_DATE, ${bonusBytes}, 3)
    ON CONFLICT (user_id, date) DO UPDATE SET
      bonus_bytes = daily_usage.bonus_bytes + ${bonusBytes},
      ad_watches_today = daily_usage.ad_watches_today + 3
  `;

  return json({ success: true });
}

// ─── USER DATA ───

async function handleGetUser(userId: string, env: Env): Promise<Response> {
  const sql = neon(env.NEON_DATABASE_URL);

  const result = await sql`
    SELECT id, email, name, picture, plan, plan_expires_at, created_at
    FROM users WHERE id = ${userId}
  `;

  if (result.length === 0) {
    return json({ error: 'User not found' }, 404);
  }

  // Check if pro plan has expired
  const user = result[0] as any;
  if (user.plan === 'pro' && user.plan_expires_at) {
    const expiresAt = new Date(user.plan_expires_at);
    if (expiresAt < new Date()) {
      await sql`UPDATE users SET plan = 'free' WHERE id = ${userId}`;
      user.plan = 'free';
    }
  }

  return json({ user });
}
