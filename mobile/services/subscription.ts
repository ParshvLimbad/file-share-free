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
let isInitialized = false;
let initAttempted = false;

export async function initializeRevenueCat(): Promise<void> {
  if (!Purchases || REVENUECAT_API_KEY.startsWith('__')) {
    console.log('[Subscription] Skipping RevenueCat init (not configured)');
    return;
  }

  if (isInitialized || initAttempted) return;
  initAttempted = true;

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
    console.log('[Subscription] Fetching offerings...');
    const offerings = await Purchases.getOfferings();
    console.log('[Subscription] Current offering:', offerings.current?.identifier);
    console.log('[Subscription] Available packages:', offerings.current?.availablePackages?.length);
    
    const proPackage = offerings.current?.availablePackages?.[0];

    if (!proPackage) {
      console.log('[Subscription] No packages found. All offerings:', JSON.stringify(Object.keys(offerings.all || {})));
      Alert.alert('Error', 'No subscription packages available. Please ensure the subscription is active in Google Play Console.');
      return false;
    }

    console.log('[Subscription] Purchasing package:', proPackage.identifier, proPackage.product?.identifier);
    const { customerInfo } = await Purchases.purchasePackage(proPackage);
    return !!customerInfo.entitlements.active['pro'];
  } catch (error: any) {
    if (error.userCancelled) {
      return false;
    }
    console.error('[Subscription] Purchase error:', error);
    const errorMsg = error?.message || error?.underlyingErrorMessage || 'Unknown error';
    Alert.alert('Subscription Error', `Failed to process subscription.\n\n${errorMsg}`);
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
