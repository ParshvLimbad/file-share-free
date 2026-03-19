// Auth service - uses Neon Auth (Better Auth REST API) with raw fetch calls
// No SDK needed - just simple HTTP requests + expo-web-browser for OAuth flow

import { NEON_AUTH_URL, SIGNALING_SERVER_URL } from '../lib/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const USER_KEY = '@user_data';
let sessionChallengeCookies: string | null = null;

export interface User {
  id: string;
  email: string;
  name: string;
  image: string;
  plan: 'free' | 'pro';
  planExpiresAt: string | null;
}

// ─── SIGN IN WITH GOOGLE ───

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const hasHttpsCallback =
      SIGNALING_SERVER_URL && SIGNALING_SERVER_URL.startsWith('http');
    const signalingBase = hasHttpsCallback
      ? SIGNALING_SERVER_URL.replace(/\/$/, '')
      : null;

    // Neon Auth only allows http/https callback domains
    const appCallbackUrl = signalingBase
      ? `${signalingBase}/auth/redirect`
      : Linking.createURL('auth-callback');

    const authOrigin = signalingBase
      ? new URL(signalingBase).origin
      : 'dropshare://';

    // POST to Better Auth API to get the Google OAuth redirect URL
    // We use the app's deep link as callbackURL and set Origin header
    // so Better Auth knows this is a trusted origin
    const response = await fetch(`${NEON_AUTH_URL}/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': authOrigin,
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: appCallbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auth] Sign-in API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const googleAuthUrl = data.url || data.redirect;

    if (!googleAuthUrl) {
      console.error('[Auth] No auth URL returned:', JSON.stringify(data));
      return null;
    }

    // Capture Neon Auth challenge cookies (used later with session verifier)
    await captureSessionChallengeCookies(googleAuthUrl);

    // Open Google sign-in in the system browser
    // expo-web-browser will detect when the browser redirects to our app scheme
    const result = await WebBrowser.openAuthSessionAsync(
      googleAuthUrl,
      appCallbackUrl
    );

    if (result.type !== 'success' || !result.url) {
      console.log('[Auth] Auth flow cancelled or failed:', result.type);
      return null;
    }

    // Parse any tokens or session info from the callback URL
    console.log('[Auth] Callback URL:', result.url);
    const parsed = Linking.parse(result.url);
    const queryParams = parsed.queryParams || {};
    let hashParams: Record<string, string> = {};

    try {
      const urlObj = new URL(result.url);
      if (urlObj.hash) {
        const hash = urlObj.hash.replace(/^#/, '');
        hashParams = Object.fromEntries(new URLSearchParams(hash));
      }
    } catch {
      // Ignore URL parse failures for custom schemes
    }

    const getParam = (key: string) =>
      (queryParams[key] as string | undefined) ??
      (hashParams[key] as string | undefined);

    const token = getParam('token');
    const code = getParam('code');
    const sessionVerifier =
      getParam('neon_auth_session_verifier') ||
      getParam('neonAuthSessionVerifier');
    const sessionToken =
      getParam('session_token') ||
      getParam('sessionToken') ||
      getParam('session') ||
      getParam('access_token');

    console.log('[Auth] Callback params:', {
      query: queryParams,
      hash: hashParams,
      tokenPresent: !!token,
      sessionTokenPresent: !!sessionToken,
      codePresent: !!code,
      verifierPresent: !!sessionVerifier,
    });

    // Try to get session from Neon Auth using cookies or token
    const user = await fetchUserFromSession({
      sessionToken: sessionToken || null,
      token: token || null,
      verifier: sessionVerifier || null,
    });
    return user;
  } catch (error) {
    console.error('[Auth] Sign-in error:', error);
    return null;
  }
}

async function captureSessionChallengeCookies(initUrl: string): Promise<void> {
  try {
    const res = await fetch(initUrl, { method: 'GET', redirect: 'manual' as any });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return;

    const stateMatch = setCookie.match(/__Secure-neon-auth\\.state=([^;]+)/);
    const aidMatch = setCookie.match(/__Secure-neon-auth\\.aid=([^;]+)/);
    const cookies: string[] = [];

    if (stateMatch) cookies.push(`__Secure-neon-auth.state=${stateMatch[1]}`);
    if (aidMatch) cookies.push(`__Secure-neon-auth.aid=${aidMatch[1]}`);

    if (cookies.length > 0) {
      sessionChallengeCookies = cookies.join('; ');
    }
  } catch (error) {
    console.log('[Auth] Failed to capture challenge cookies');
  }
}

// ─── FETCH USER FROM SESSION ───

async function fetchUserFromSession(params: {
  sessionToken: string | null;
  token: string | null;
  verifier: string | null;
}): Promise<User | null> {
  try {
    const authToken = params.sessionToken || params.token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const cookieParts: string[] = [];
    if (sessionChallengeCookies) {
      cookieParts.push(sessionChallengeCookies);
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      cookieParts.push(`session_token=${authToken}`);
    }

    if (cookieParts.length > 0) {
      headers['Cookie'] = cookieParts.join('; ');
    }

    const verifierParam = params.verifier
      ? `?neon_auth_session_verifier=${encodeURIComponent(params.verifier)}`
      : '';
    const res = await fetch(`${NEON_AUTH_URL}/get-session${verifierParam}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      console.log('[Auth] No session found, status:', res.status);
      return null;
    }

    const data = await res.json();
    console.log('[Auth] Session response:', data);
    if (!data?.user) {
      console.log('[Auth] Session response has no user');
      return null;
    }

    // Get plan from our worker
    let plan: 'free' | 'pro' = 'free';
    let planExpiresAt: string | null = null;

    if (!SIGNALING_SERVER_URL.startsWith('__')) {
      try {
        const planRes = await fetch(`${SIGNALING_SERVER_URL}/user/${data.user.id}`);
        if (planRes.ok) {
          const planData = await planRes.json();
          plan = planData.user?.plan || 'free';
          planExpiresAt = planData.user?.plan_expires_at || null;
        }
      } catch {
        // Worker might not have user yet
      }
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.name || data.user.email?.split('@')[0] || 'User',
      image: data.user.image || '',
      plan,
      planExpiresAt,
    };

    await storeUser(user);

    // Also sync to our worker DB (fire and forget)
    if (!SIGNALING_SERVER_URL.startsWith('__')) {
      fetch(`${SIGNALING_SERVER_URL}/auth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.image,
        }),
      }).catch(() => {});
    }

    return user;
  } catch (error) {
    console.error('[Auth] Fetch session error:', error);
    return null;
  }
}

// ─── LOCAL STORAGE ───

export async function getStoredUser(): Promise<User | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function updateStoredUserPlan(
  plan: 'free' | 'pro',
  planExpiresAt: string | null = null
): Promise<User | null> {
  const user = await getStoredUser();
  if (!user) return null;

  const updated: User = {
    ...user,
    plan,
    planExpiresAt,
  };

  await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  return updated;
}

async function storeUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ─── SIGN OUT ───

export async function signOut(): Promise<void> {
  try {
    // Tell Neon Auth to invalidate the session
    await fetch(`${NEON_AUTH_URL}/sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } catch {
    // Non-critical
  }
  await AsyncStorage.removeItem(USER_KEY);
}

// ─── CHECK PRO ───

export function isPro(user: User | null): boolean {
  if (!user) return false;
  if (user.plan !== 'pro') return false;
  if (user.planExpiresAt) {
    return new Date(user.planExpiresAt) > new Date();
  }
  return true;
}
