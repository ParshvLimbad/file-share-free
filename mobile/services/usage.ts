// Server-side usage tracking (syncs with Neon via Cloudflare Worker)
import {
  SIGNALING_SERVER_URL,
  FREE_DAILY_LIMIT_BYTES,
  AD_BONUS_BYTES,
  ADS_REQUIRED_FOR_BONUS,
} from '../lib/constants';
import {
  getDailyUsage,
  getBonusBytes,
  addDailyUsage,
  addBonusBytes,
  getAdWatchesToday,
  setAdWatchesToday,
} from '../lib/storage';

export interface UsageInfo {
  bytesUsed: number;
  bonusBytes: number;
  adWatchesToday: number;
  adsRemaining: number;
  canWatchAds: boolean;
  totalLimit: number;
  remaining: number;
  percentUsed: number;
  canTransfer: boolean;
}

// Get current usage (local first, server sync if available)
export async function getCurrentUsage(
  userId: string | null,
  isPro: boolean
): Promise<UsageInfo> {
  let bytesUsed = await getDailyUsage();
  let bonusBytes = await getBonusBytes();
  let adWatchesToday = await getAdWatchesToday();

  // Try to sync with server
  if (userId && !SIGNALING_SERVER_URL.startsWith('__')) {
    try {
      const response = await fetch(
        `${SIGNALING_SERVER_URL}/usage/${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        bytesUsed = Math.max(bytesUsed, data.bytes_transferred || 0);
        bonusBytes = Math.max(bonusBytes, data.bonus_bytes || 0);
        const serverAdWatches = data.ad_watches_today || 0;
        if (serverAdWatches > adWatchesToday) {
          adWatchesToday = serverAdWatches;
          await setAdWatchesToday(serverAdWatches);
        }
      }
    } catch {
      // Fall back to local data
    }
  }

  const totalLimit = isPro
    ? 50 * 1024 * 1024 * 1024 // 50 GB
    : FREE_DAILY_LIMIT_BYTES + bonusBytes;
  const remaining = Math.max(0, totalLimit - bytesUsed);
  const percentUsed =
    totalLimit > 0 ? Math.min(100, Math.round((bytesUsed / totalLimit) * 100)) : 0;
  const adsRemaining = Math.max(0, ADS_REQUIRED_FOR_BONUS - adWatchesToday);
  const canWatchAds = !isPro && adsRemaining > 0;

  return {
    bytesUsed,
    bonusBytes,
    adWatchesToday,
    adsRemaining,
    canWatchAds,
    totalLimit,
    remaining,
    percentUsed,
    canTransfer: remaining > 0 || isPro,
  };
}

// Record file transfer usage
export async function recordTransferUsage(
  bytes: number,
  userId: string | null
): Promise<void> {
  // Always save locally
  await addDailyUsage(bytes);

  // Sync to server if logged in
  if (userId && !SIGNALING_SERVER_URL.startsWith('__')) {
    try {
      await fetch(`${SIGNALING_SERVER_URL}/usage/increment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bytes }),
      });
    } catch {
      // Local is already saved
    }
  }
}

// Add bonus bytes from watching ads
export async function recordAdBonus(userId: string | null): Promise<boolean> {
  const currentAdWatches = await getAdWatchesToday();
  if (currentAdWatches >= ADS_REQUIRED_FOR_BONUS) {
    return false;
  }

  // Save locally
  await addBonusBytes(AD_BONUS_BYTES);
  const newCount = Math.min(
    ADS_REQUIRED_FOR_BONUS,
    currentAdWatches + ADS_REQUIRED_FOR_BONUS
  );
  await setAdWatchesToday(newCount);

  // Sync to server if logged in
  if (userId && !SIGNALING_SERVER_URL.startsWith('__')) {
    try {
      await fetch(`${SIGNALING_SERVER_URL}/usage/add-bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bonusBytes: AD_BONUS_BYTES }),
      });
    } catch {
      // Local is already saved
    }
  }

  return true;
}

// Check if a file can be transferred (size within limits)
export async function canTransferFile(
  fileSize: number,
  userId: string | null,
  isPro: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getCurrentUsage(userId, isPro);

  if (isPro) {
    if (fileSize > 50 * 1024 * 1024 * 1024) {
      return { allowed: false, reason: 'File exceeds 50GB limit' };
    }
    return { allowed: true };
  }

  // Free user
  if (fileSize > FREE_DAILY_LIMIT_BYTES) {
    return {
      allowed: false,
      reason: `File exceeds free tier limit of 1GB. Upgrade to Pro for up to 50GB per file.`,
    };
  }

  if (usage.remaining < fileSize) {
    return {
      allowed: false,
      reason: usage.canWatchAds
        ? `Daily limit reached. Watch ${ADS_REQUIRED_FOR_BONUS} ads to unlock +1GB or upgrade to Pro for unlimited transfers.`
        : 'Daily limit reached. Ad limit reached today. Upgrade to Pro or try again tomorrow.',
    };
  }

  return { allowed: true };
}
