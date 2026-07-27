import * as AuthSession from 'expo-auth-session';
import { WearableProvider } from '../../types';

export interface WearableTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  scopes: string;
  providerUserId: string;
}

export interface HeartRatePoint {
  time: string; // ISO timestamp
  bpm: number;
}

export interface WearableDailyMetrics {
  restingHeartRate: number | null;
  sleepMinutes: number | null;
  sleepEfficiency: number | null;
  steps: number | null;
  heartRateSeries: HeartRatePoint[];
  rawPayload: Record<string, unknown>;
}

/**
 * Per-vendor implementation surface. Adding a new wearable (Garmin, Oura, ...)
 * means writing one more adapter that satisfies this shape, not touching the
 * schema, screen, or orchestration in wearableApi.ts.
 */
export interface WearableAdapter {
  provider: WearableProvider;
  discovery: AuthSession.DiscoveryDocument;
  getAuthRequestConfig: (redirectUri: string) => AuthSession.AuthRequestConfig;
  exchangeCode: (params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) => Promise<WearableTokens>;
  refreshToken: (refreshToken: string) => Promise<WearableTokens>;
  fetchDailyMetrics: (accessToken: string, date: string) => Promise<WearableDailyMetrics>;
  revoke: (token: string) => Promise<void>;
}
