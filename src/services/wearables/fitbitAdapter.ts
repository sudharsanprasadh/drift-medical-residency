import * as AuthSession from 'expo-auth-session';
import { WearableAdapter, WearableDailyMetrics, WearableTokens } from './types';

// Fitbit devices now sync through Google Health, not api.fitbit.com — Google
// deprecated the legacy Fitbit Web API. Unlike most OAuth providers, Google's
// token endpoint requires client_secret on every request even for native/
// "Desktop app" clients using PKCE. Google's own docs for installed apps say
// this secret isn't meant to be kept confidential the way a web server's is
// — it's expected to ship inside the app — so embedding it here is fine for
// this client type, but it must still be a Desktop-app client, not the
// fitbit-poc project's own Web-application one.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_HEALTH_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_HEALTH_CLIENT_SECRET || '';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const API_BASE = 'https://health.googleapis.com/v4';

const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
];

// Payload shapes vary per Google Health data type and aren't all documented;
// values are collected generically and picked by name pattern below rather
// than hardcoded field paths (mirrors fitbit-poc's MetricsService).
const NON_VALUE_KEYS = new Set([
  'startTime', 'endTime', 'startUtcOffset', 'endUtcOffset',
  'civilStartTime', 'civilEndTime', 'interval', 'sampleTime',
  'date', 'dataSource', 'name', 'metadata', 'createTime', 'updateTime',
]);

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
}

const parseTokenResponse = (
  data: GoogleTokenResponse,
  previousRefreshToken?: string
): WearableTokens => ({
  accessToken: data.access_token,
  // Google only returns refresh_token on initial consent (access_type=offline
  // & prompt=consent below); refresh calls omit it, so keep the prior one.
  refreshToken: data.refresh_token ?? previousRefreshToken ?? '',
  expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  scopes: data.scope,
  // Unlike Fitbit's token response, Google's carries no user id for these
  // scopes, and nothing here keys off provider_user_id functionally.
  providerUserId: '',
});

const postForm = async (url: string, body: Record<string, string>): Promise<any> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error_description || data?.error || `Google token request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

const googleHealthGet = async (path: string, accessToken: string): Promise<any> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Google Health API request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

const googleHealthPost = async (path: string, accessToken: string, body: unknown): Promise<any> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Google Health API request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

/** Collects every numeric leaf, skipping time/metadata fields. int64 values
 * arrive as strings (e.g. "3822") and are coerced to numbers. */
const flattenValues = (point: any): Record<string, number> => {
  const values: Record<string, number> = {};
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (NON_VALUE_KEYS.has(key)) continue;
      if (typeof value === 'number') {
        values[key] = value;
      } else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
        values[key] = Number(value);
      } else if (value && typeof value === 'object') {
        walk(value);
      }
    }
  };
  walk(point);
  return values;
};

const pickValue = (values: Record<string, number>, patterns: string[]): number | null => {
  const keys = Object.keys(values);
  for (const pattern of patterns) {
    const key = keys.find((k) => k.toLowerCase().includes(pattern.toLowerCase()));
    if (key !== undefined) return values[key];
  }
  return keys.length ? values[keys[0]] : null;
};

const civilDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
};

/** Deep search for a "date" field — daily-kind payloads nest it under the
 * data type's own key, and it may be a string or a {year,month,day} object. */
const findDate = (node: any): any => {
  if (!node || typeof node !== 'object') return undefined;
  if ('date' in node) return node.date;
  for (const value of Object.values(node)) {
    const found = findDate(value);
    if (found !== undefined) return found;
  }
  return undefined;
};

const matchesDay = (point: any, date: string): boolean => {
  const dateValue = findDate(point);
  if (dateValue == null) return JSON.stringify(point).includes(date);
  if (typeof dateValue === 'string') return dateValue === date;
  const [year, month, day] = date.split('-').map(Number);
  return dateValue.year === year && dateValue.month === month && dateValue.day === day;
};

export const fitbitAdapter: WearableAdapter = {
  provider: 'fitbit',

  discovery: {
    authorizationEndpoint: AUTHORIZATION_ENDPOINT,
    tokenEndpoint: TOKEN_ENDPOINT,
    revocationEndpoint: REVOCATION_ENDPOINT,
  },

  getAuthRequestConfig: (redirectUri: string): AuthSession.AuthRequestConfig => ({
    clientId: GOOGLE_CLIENT_ID,
    scopes: SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      // Required to receive a refresh_token back on this first consent.
      access_type: 'offline',
      prompt: 'consent',
    },
  }),

  exchangeCode: async ({ code, codeVerifier, redirectUri }): Promise<WearableTokens> => {
    const data = await postForm(TOKEN_ENDPOINT, {
      grant_type: 'authorization_code',
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });
    return parseTokenResponse(data);
  },

  refreshToken: async (refreshToken: string): Promise<WearableTokens> => {
    const data = await postForm(TOKEN_ENDPOINT, {
      grant_type: 'refresh_token',
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    });
    return parseTokenResponse(data, refreshToken);
  },

  fetchDailyMetrics: async (accessToken: string, date: string): Promise<WearableDailyMetrics> => {
    const dayRange = {
      start: { date: civilDate(date), time: { hours: 0, minutes: 0, seconds: 0 } },
      end: { date: civilDate(date), time: { hours: 23, minutes: 59, seconds: 59 } },
    };
    // rollUp (unlike dailyRollUp) wants a UTC instant range, not a civil date.
    const [y, m, d] = date.split('-').map(Number);
    const localDayStart = new Date(y, m - 1, d);
    const localDayEnd = new Date(y, m - 1, d + 1);

    const [stepsResult, restingHrResult, sleepResult, heartRateResult] = await Promise.all([
      googleHealthPost('/users/me/dataTypes/steps/dataPoints:dailyRollUp', accessToken, {
        range: dayRange,
        windowSizeDays: 1,
      }).catch(() => null),
      // "Daily ..." kinds only support list/reconcile, not dailyRollUp.
      googleHealthGet(
        `/users/me/dataTypes/daily-resting-heart-rate/dataPoints?filter=${encodeURIComponent(
          `daily_resting_heart_rate.date >= "${date}"`
        )}`,
        accessToken
      ).catch(() => null),
      googleHealthGet(
        `/users/me/dataTypes/sleep/dataPoints?filter=${encodeURIComponent(
          `sleep.interval.civil_end_time >= "${date}"`
        )}`,
        accessToken
      ).catch(() => null),
      // 5-minute buckets for the intraday chart.
      googleHealthPost('/users/me/dataTypes/heart-rate/dataPoints:rollUp', accessToken, {
        range: { startTime: localDayStart.toISOString(), endTime: localDayEnd.toISOString() },
        windowSize: '300s',
      }).catch(() => null),
    ]);

    const steps = pickValue(
      flattenValues(stepsResult?.rollupDataPoints?.[0]),
      ['countSum', 'count', 'steps']
    );

    const restingPoint = (restingHrResult?.dataPoints ?? []).find((p: any) => matchesDay(p, date));
    // Resting heart rate is computed retroactively — it can legitimately be
    // absent for "today"/"yesterday"; treat that as "not yet available".
    const restingHeartRate = restingPoint
      ? pickValue(flattenValues(restingPoint), ['beatsPerMinute', 'resting', 'bpm', 'avg'])
      : null;

    let sleepMinutes: number | null = null;
    let sleepEfficiency: number | null = null;
    for (const point of sleepResult?.dataPoints ?? []) {
      const sleepNode = point?.sleep;
      if (!sleepNode) continue;
      const endTime: string = sleepNode.interval?.endTime ?? '';
      const isMain = sleepNode.metadata?.main ?? true;
      if (!endTime.startsWith(date) || !isMain) continue;

      const summary = sleepNode.summary ?? {};
      sleepMinutes = summary.minutesAsleep ?? null;
      const minutesInPeriod = summary.minutesInSleepPeriod;
      sleepEfficiency =
        sleepMinutes != null && minutesInPeriod
          ? Math.round((sleepMinutes / minutesInPeriod) * 100)
          : null;
      break;
    }

    // rollUp does not guarantee point ordering.
    const heartRateSeries = (heartRateResult?.rollupDataPoints ?? [])
      .map((point: any) => ({
        time: point.startTime,
        bpm: pickValue(flattenValues(point), ['avg', 'bpm', 'mean']),
      }))
      .filter((p: { time: string; bpm: number | null }) => p.time && p.bpm != null)
      .sort((a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time));

    return {
      restingHeartRate,
      sleepMinutes,
      sleepEfficiency,
      steps,
      heartRateSeries,
      rawPayload: {
        steps: stepsResult,
        restingHeartRate: restingHrResult,
        sleep: sleepResult,
        heartRate: heartRateResult,
      },
    };
  },

  revoke: async (token: string): Promise<void> => {
    await postForm(REVOCATION_ENDPOINT, { token });
  },
};
