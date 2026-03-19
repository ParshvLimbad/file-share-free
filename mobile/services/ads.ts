// AdMob integration
// Uses react-native-google-mobile-ads (install when building dev client)
// For now, provides a mock interface that works in Expo Go

import { Alert } from 'react-native';
import { ADMOB_INTERSTITIAL_ID, ADMOB_REWARDED_ID } from '../lib/constants';

let interstitialLoaded = false;
let rewardedLoaded = false;
let AdMobInterstitial: any = null;
let AdMobRewarded: any = null;

// Try to load the real ad modules
try {
  const admob = require('react-native-google-mobile-ads');
  AdMobInterstitial = admob.InterstitialAd;
  AdMobRewarded = admob.RewardedAd;
} catch {
  // Not available (Expo Go)
  console.log('[Ads] AdMob not available, using mocks');
}

export const isAdsAvailable = !!AdMobInterstitial;

// ─── INTERSTITIAL ADS ───

export async function loadInterstitial(): Promise<void> {
  if (!AdMobInterstitial || ADMOB_INTERSTITIAL_ID.startsWith('__')) {
    return;
  }

  try {
    // Real implementation would use:
    // const interstitial = InterstitialAd.createForAdRequest(ADMOB_INTERSTITIAL_ID);
    // await interstitial.load();
    interstitialLoaded = true;
  } catch (error) {
    console.error('[Ads] Failed to load interstitial:', error);
  }
}

export async function showInterstitial(): Promise<boolean> {
  if (!isAdsAvailable) {
    console.log('[Ads] Showing mock interstitial');
    return new Promise((resolve) => {
      Alert.alert(
        '📺 Ad Placeholder',
        'An interstitial ad would play here during file transfer.\n\n(Requires AdMob setup)',
        [{ text: 'Continue', onPress: () => resolve(true) }]
      );
    });
  }

  try {
    // Real implementation: await interstitial.show();
    interstitialLoaded = false;
    loadInterstitial(); // Preload next one
    return true;
  } catch {
    return false;
  }
}

// ─── REWARDED ADS ───

export async function loadRewarded(): Promise<void> {
  if (!AdMobRewarded || ADMOB_REWARDED_ID.startsWith('__')) {
    return;
  }

  try {
    // Real implementation would use:
    // const rewarded = RewardedAd.createForAdRequest(ADMOB_REWARDED_ID);
    // await rewarded.load();
    rewardedLoaded = true;
  } catch (error) {
    console.error('[Ads] Failed to load rewarded:', error);
  }
}

export async function showRewardedAd(): Promise<boolean> {
  if (!isAdsAvailable) {
    console.log('[Ads] Showing mock rewarded ad');
    return new Promise((resolve) => {
      Alert.alert(
        '🎬 Rewarded Ad Placeholder',
        'A rewarded video ad would play here.\n\n(Requires AdMob setup)',
        [{ text: 'Watch (mock)', onPress: () => resolve(true) }]
      );
    });
  }

  try {
    // Real implementation: await rewarded.show();
    rewardedLoaded = false;
    loadRewarded(); // Preload next one
    return true;
  } catch {
    return false;
  }
}

// Show 3 rewarded ads in sequence, return true if all watched
export async function showThreeRewardedAds(): Promise<boolean> {
  for (let i = 1; i <= 3; i++) {
    const watched = await showRewardedAd();
    if (!watched) return false;
    
    if (i < 3) {
      // Brief pause between ads
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return true;
}
