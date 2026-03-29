// RevenueCat subscription management
// Uses react-native-purchases (install when building dev client)

import { Alert } from 'react-native';
import { REVENUECAT_API_KEY, PRO_MONTHLY_PRICE } from '../lib/constants';

let Purchases: any = null;

// Try to load RevenueCat
try {
  Purchases = require('react-native-purchases').default;
} catch {
  console.log('[Subscription] RevenueCat not available, using mocks');
}

export const isSubscriptionAvailable = !!Purchases;

// Track initialization state
let initPromise: Promise<void> | null = null;
let isInitialized = false;

export async function initializeRevenueCat(): Promise<void> {
  if (!Purchases || REVENUECAT_API_KEY.startsWith('__')) {
    console.log('[Subscription] Skipping RevenueCat init (not configured)');
    return;
  }

  if (isInitialized) return;

  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    isInitialized = true;
    console.log('[Subscription] RevenueCat initialized');
  } catch (error) {
    console.error('[Subscription] Init error:', error);
  }
}

// Ensure RevenueCat is initialized before any SDK call
async function ensureInitialized(): Promise<boolean> {
  if (!Purchases || REVENUECAT_API_KEY.startsWith('__')) return false;
  if (!isInitialized) {
    await initializeRevenueCat();
  }
  return isInitialized;
}

export async function logInToRevenueCat(appUserId: string): Promise<void> {
  if (!(await ensureInitialized())) return;

  try {
    await Purchases.logIn(appUserId);
  } catch (error) {
    console.error('[Subscription] logIn error:', error);
  }
}

export async function logOutOfRevenueCat(): Promise<void> {
  if (!(await ensureInitialized())) return;

  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('[Subscription] logOut error:', error);
  }
}

export async function checkSubscriptionStatus(): Promise<{
  isPro: boolean;
  expiresAt: string | null;
}> {
  if (!(await ensureInitialized())) {
    return { isPro: false, expiresAt: null };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const proEntitlement = customerInfo.entitlements.active['pro'];

    if (proEntitlement) {
      return {
        isPro: true,
        expiresAt: proEntitlement.expirationDate || null,
      };
    }

    return { isPro: false, expiresAt: null };
  } catch {
    return { isPro: false, expiresAt: null };
  }
}

export async function purchaseProSubscription(): Promise<boolean> {
  if (!(await ensureInitialized())) {
    // Mock purchase flow when SDK not available
    return new Promise((resolve) => {
      Alert.alert(
        '💎 Upgrade to Pro',
        `${PRO_MONTHLY_PRICE}/month\n\n• 50GB per file\n• No daily limits\n• No ads\n• Priority relay\n\n(Requires RevenueCat setup)`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Subscribe (mock)', onPress: () => resolve(true) },
        ]
      );
    });
  }

  try {
    const offerings = await Purchases.getOfferings();
    const proPackage = offerings.current?.availablePackages?.[0];

    if (!proPackage) {
      Alert.alert('Error', 'No subscription packages available');
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(proPackage);
    return !!customerInfo.entitlements.active['pro'];
  } catch (error: any) {
    if (error.userCancelled) {
      return false;
    }
    console.error('[Subscription] Purchase error:', error);
    Alert.alert('Error', 'Failed to process subscription');
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!(await ensureInitialized())) {
    Alert.alert('Info', 'Subscription restoration requires RevenueCat setup.');
    return false;
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active['pro'];
  } catch {
    Alert.alert('Error', 'Failed to restore purchases');
    return false;
  }
}
