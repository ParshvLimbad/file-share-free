import { SIGNALING_SERVER_URL } from '../lib/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = '@user_data';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  plan: 'free' | 'pro';
  planExpiresAt: string | null;
}

// Get stored user
export async function getStoredUser(): Promise<User | null> {
  try {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Store user locally
export async function storeUser(user: User): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

// Clear stored user
export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}

// Authenticate with Google ID token
export async function authenticateWithGoogle(idToken: string): Promise<User | null> {
  try {
    const url = SIGNALING_SERVER_URL.startsWith('__')
      ? null
      : `${SIGNALING_SERVER_URL}/auth/google`;
    
    if (!url) {
      console.warn('[Auth] Server URL not configured');
      return null;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.picture,
      plan: data.user.plan || 'free',
      planExpiresAt: data.user.plan_expires_at || null,
    };

    await storeUser(user);
    return user;
  } catch (error) {
    console.error('[Auth] Google auth error:', error);
    return null;
  }
}

// Fetch latest user data from server
export async function refreshUserData(userId: string): Promise<User | null> {
  try {
    const url = SIGNALING_SERVER_URL.startsWith('__')
      ? null
      : `${SIGNALING_SERVER_URL}/user/${userId}`;

    if (!url) return null;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.picture,
      plan: data.user.plan || 'free',
      planExpiresAt: data.user.plan_expires_at || null,
    };

    await storeUser(user);
    return user;
  } catch {
    return null;
  }
}

// Check if user has pro plan
export function isPro(user: User | null): boolean {
  if (!user) return false;
  if (user.plan !== 'pro') return false;
  if (user.planExpiresAt) {
    return new Date(user.planExpiresAt) > new Date();
  }
  return true;
}
