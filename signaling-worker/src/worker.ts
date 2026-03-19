import { neon } from '@neondatabase/serverless';

export interface Env {
  SIGNALING_KV: KVNamespace;
  NEON_DATABASE_URL: string;
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

      // ── Auth sync (from Neon Auth) ──
      if (path === '/auth/sync' && request.method === 'POST') {
        return handleAuthSync(request, env);
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

      // ── Auth redirect (relay from Neon Auth → app deep link) ──
      if (path === '/auth/redirect') {
        return handleAuthRedirect(request);
      }
      if ((path === '/' || path === '/auth/callback') && request.method === 'GET') {
        return handleAuthRedirect(request);
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

// ─── AUTH SYNC (Neon Auth) ───

async function handleAuthSync(request: Request, env: Env): Promise<Response> {
  const { id, email, name, picture } = await request.json() as any;

  if (!id) {
    return json({ error: 'Missing user id' }, 400);
  }

  const sql = neon(env.NEON_DATABASE_URL);

  // Upsert user from Neon Auth data
  const result = await sql`
    INSERT INTO users (id, email, name, picture)
    VALUES (${id}, ${email || ''}, ${name || ''}, ${picture || ''})
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
      name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
      picture = COALESCE(NULLIF(EXCLUDED.picture, ''), users.picture),
      updated_at = NOW()
    RETURNING id, email, name, picture, plan, plan_expires_at, created_at
  `;

  return json({ user: result[0] });
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

// ─── AUTH REDIRECT (relay Neon Auth → mobile app) ───

function handleAuthRedirect(request: Request): Response {
  const url = new URL(request.url);
  // Forward query params from Neon Auth to the app deep link
  const params = url.searchParams.toString();
  const appScheme = 'dropshare';

  // Serve an HTML page that redirects to the app
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting to Drop...</title>
  <style>
    body {
      background: #050508;
      color: #f0f0f5;
      font-family: -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .container { padding: 40px; }
    h2 { margin-bottom: 8px; }
    p { color: #8888a0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>✅ Signed in!</h2>
    <p>Redirecting back to Drop...</p>
  </div>
  <script>
    function getParams() {
      var search = window.location.search.replace(/^\\?/, '');
      if (search) return search;
      var hash = window.location.hash.replace(/^#/, '');
      return hash;
    }

    var params = getParams();
    var statusEl = document.querySelector('#status');

    if (!params) {
      statusEl.textContent = 'Missing auth parameters. Please retry sign-in.';
    } else {
      // Try the custom scheme (dev client / standalone)
      var deepLink = '${appScheme}://auth-callback' + (params ? '?' + params : '');
      // Also try exp:// for Expo Go
      var expoLink = 'exp://192.168.29.188:8081/--/auth-callback' + (params ? '?' + params : '');

      // Try custom scheme first
      window.location.href = deepLink;

      // Fallback to Expo Go scheme after 1s
      setTimeout(function() {
        window.location.href = expoLink;
      }, 1000);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders,
    },
  });
}
