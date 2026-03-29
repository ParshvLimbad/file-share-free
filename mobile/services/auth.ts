// Auth service - uses Neon Auth (Better Auth REST API) with raw fetch calls
// No SDK needed - just simple HTTP requests + expo-web-browser for OAuth flow

import { NEON_AUTH_URL, SIGNALING_SERVER_URL } from '../lib/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const USER_KEY = '@user_data';

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
  const signalingBase = SIGNALING_SERVER_URL?.startsWith('http')
    ? SIGNALING_SERVER_URL.replace(/\/$/, '')
    : null;

  // Use the worker relay as callback (Neon Auth requires https callbacks)
  // The worker at /auth/redirect serves HTML that deep-links back to the app
  const callbackUrl = signalingBase
    ? `${signalingBase}/auth/redirect`
    : Linking.createURL('auth-callback');

  // For openAuthSessionAsync, we listen for the deep link return
  const appReturnUrl = Linking.createURL('auth-callback');

  console.log('[Auth] callbackUrl:', callbackUrl);
  console.log('[Auth] appReturnUrl:', appReturnUrl);

  // Step 1: Get the Google OAuth URL from Neon Auth / Better Auth
  let googleAuthUrl: string;
  try {
    const origin = signalingBase
      ? new URL(signalingBase).origin
      : 'https://drop-signaling.drop-share-free.workers.dev';

    const response = await fetch(`${NEON_AUTH_URL}/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: callbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auth] Sign-in API error:', response.status, errorText);
      throw new Error(`Auth server error (${response.status})`);
    }

    const data = await response.json();
    googleAuthUrl = data.url || data.redirect;

    if (!googleAuthUrl) {
      console.error('[Auth] No auth URL returned:', JSON.stringify(data));
      throw new Error('No OAuth URL received from auth server');
    }
  } catch (error: any) {
    if (error.message?.includes('Auth server') || error.message?.includes('OAuth URL')) {
      throw error;
    }
    console.error('[Auth] Network error:', error);
    throw new Error('Could not reach auth server. Check your internet connection.');
  }

  // Step 2: Open the browser for Google sign-in
  // On Android, openAuthSessionAsync uses Chrome Custom Tabs
  // We listen for the deep link return (dropshare://auth-callback)
  console.log('[Auth] Opening browser for OAuth...');
  const result = await WebBrowser.openAuthSessionAsync(
    googleAuthUrl,
    appReturnUrl
  );

  if (result.type === 'cancel' || result.type === 'dismiss') {
    console.log('[Auth] User cancelled sign-in');
    return null; // User cancelled — not an error
  }

  if (result.type !== 'success' || !result.url) {
    console.log('[Auth] Auth flow failed:', result.type);
    throw new Error('Sign-in was interrupted. Please try again.');
  }

  // Step 3: Parse tokens from the callback URL
  console.log('[Auth] Callback URL:', result.url);

  const allParams = extractAllParams(result.url);
  console.log('[Auth] Extracted params:', Object.keys(allParams));

  const sessionToken =
    allParams['session_token'] ||
    allParams['sessionToken'] ||
    allParams['session'] ||
    allParams['access_token'] ||
    allParams['token'];

  const sessionVerifier =
    allParams['neon_auth_session_verifier'] ||
    allParams['neonAuthSessionVerifier'];

  console.log('[Auth] Token present:', !!sessionToken, 'Verifier present:', !!sessionVerifier);

  // Step 4: Get the user session from Neon Auth
  const user = await fetchUserFromSession({
    sessionToken: sessionToken || null,
    verifier: sessionVerifier || null,
  });

  if (!user) {
    throw new Error('Could not retrieve your account after sign-in. Please try again.');
  }

  return user;
}

// Extract params from both query string and hash fragment
function extractAllParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    // Try standard URL parsing
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
      hashParams.forEach((value, key) => {
        if (!params[key]) params[key] = value;
      });
    }
  } catch {
    // For custom schemes that URL can't parse, use Linking
  }

  // Also try Expo's Linking parser (handles custom schemes)
  try {
    const parsed = Linking.parse(url);
    if (parsed.queryParams) {
      Object.entries(parsed.queryParams).forEach(([key, value]) => {
        if (value && typeof value === 'string' && !params[key]) {
          params[key] = value;
        }
      });
    }
  } catch {
    // Ignore
  }

  return params;
}

// ─── FETCH USER FROM SESSION ───

async function fetchUserFromSession(params: {
  sessionToken: string | null;
  verifier: string | null;
}): Promise<User | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (params.sessionToken) {
      headers['Authorization'] = `Bearer ${params.sessionToken}`;
      headers['Cookie'] = `session_token=${params.sessionToken}`;
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
    console.log('[Auth] Session response keys:', Object.keys(data));

    if (!data?.user) {
      console.log('[Auth] Session response has no user');
      return null;
    }

    // Get plan from our worker
    let plan: 'free' | 'pro' = 'free';
    let planExpiresAt: string | null = null;

    if (SIGNALING_SERVER_URL && !SIGNALING_SERVER_URL.startsWith('__')) {
      try {
        const planRes = await fetch(`${SIGNALING_SERVER_URL}/user/${data.user.id}`);
        if (planRes.ok) {
          const planData = await planRes.json();
          plan = planData.user?.plan || 'free';
          planExpiresAt = planData.user?.plan_expires_at || null;
        }
      } catch {
        // Worker might not have user yet — that's fine
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
    if (SIGNALING_SERVER_URL && !SIGNALING_SERVER_URL.startsWith('__')) {
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
