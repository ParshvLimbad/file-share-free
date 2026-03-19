// App-wide constants

// Signaling server URL - update this after deploying the Cloudflare Worker
export const SIGNALING_SERVER_URL = 'https://drop-signaling.drop-share-free.workers.dev';

// App theme colors
export const COLORS = {
  // Primary cyan/teal accent
  primary: '#22d3ee',
  primaryDark: '#0891b2',
  primaryLight: '#67e8f9',
  primaryGlow: 'rgba(34, 211, 238, 0.15)',
  primaryGlowStrong: 'rgba(34, 211, 238, 0.3)',

  // Backgrounds  
  bgDeep: '#050508',
  bgBase: '#0a0a0f',
  bgCard: '#111118',
  bgCardHover: '#16161f',
  bgElevated: '#1a1a24',
  bgInput: '#0d0d14',

  // Borders
  border: '#1e1e2a',
  borderLight: '#2a2a38',
  borderActive: '#22d3ee40',

  // Text
  textPrimary: '#f0f0f5',
  textSecondary: '#8888a0',
  textMuted: '#555568',
  textInverse: '#050508',

  // Status
  success: '#34d399',
  successBg: 'rgba(52, 211, 153, 0.1)',
  warning: '#fbbf24',
  warningBg: 'rgba(251, 191, 36, 0.1)',
  error: '#f87171',
  errorBg: 'rgba(248, 113, 113, 0.1)',

  // Misc
  dotGrid: 'rgba(100, 100, 140, 0.15)',
};

// Transfer limits
export const FREE_DAILY_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
export const PRO_FILE_LIMIT_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
export const AD_BONUS_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB per 3 ads
export const ADS_REQUIRED_FOR_BONUS = 3;

// WebRTC
export const CHUNK_SIZE = 16384; // 16KB chunks
export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Share code config
export const SHARE_CODE_LENGTH = 6;
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I,L,O,0,1

// Subscription
export const PRO_MONTHLY_PRICE = '$5';
export const REVENUECAT_API_KEY = 'test_qhEXfRxPlmEManqXOiRZSWCMhNg';
export const ADMOB_INTERSTITIAL_ID = 'ca-app-pub-3237855763291333/4731609857';
export const ADMOB_REWARDED_ID = 'ca-app-pub-3237855763291333/5751512638';

// Auth (Neon Auth - Better Auth powered)
export const NEON_AUTH_URL = 'https://ep-weathered-rice-agaojseh.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth';
export const NEON_AUTH_JWKS_URL = 'https://ep-weathered-rice-agaojseh.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth/.well-known/jwks.json';
