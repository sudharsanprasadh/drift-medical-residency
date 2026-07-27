import { supabase } from '../supabase';
import { WearableConnection, WearableProvider, WellnessMetric } from '../../types';
import { fitbitAdapter } from './fitbitAdapter';
import { WearableAdapter, WearableTokens } from './types';

const adaptersByProvider: Record<WearableProvider, WearableAdapter> = {
  fitbit: fitbitAdapter,
};

export const getWearableAdapter = (provider: WearableProvider): WearableAdapter =>
  adaptersByProvider[provider];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local (device) calendar date as YYYY-MM-DD — deliberately not UTC, since
 * "today" should match the resident's own day, not the server/UTC day. */
export const toLocalISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const tokensToRow = (userId: string, provider: WearableProvider, tokens: WearableTokens) => ({
  user_id: userId,
  provider,
  provider_user_id: tokens.providerUserId,
  access_token: tokens.accessToken,
  refresh_token: tokens.refreshToken,
  scopes: tokens.scopes,
  expires_at: tokens.expiresAt,
});

// ============================================
// CONNECTION OPERATIONS
// ============================================

export const getConnection = async (
  userId: string,
  provider: WearableProvider
): Promise<WearableConnection | null> => {
  const { data, error } = await supabase
    .from('wearable_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
};

const saveConnection = async (
  userId: string,
  provider: WearableProvider,
  tokens: WearableTokens
): Promise<WearableConnection> => {
  const { data, error } = await supabase
    .from('wearable_connections')
    .upsert(tokensToRow(userId, provider, tokens), { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const disconnectWearable = async (
  userId: string,
  provider: WearableProvider
): Promise<void> => {
  const connection = await getConnection(userId, provider);
  if (connection) {
    try {
      await getWearableAdapter(provider).revoke(connection.access_token);
    } catch (error) {
      // Best-effort: still remove the local connection even if the
      // provider-side revoke call fails (e.g. token already expired).
      console.warn(`Failed to revoke ${provider} token:`, error);
    }
  }

  const { error } = await supabase
    .from('wearable_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw error;
};

// ============================================
// OAUTH CONNECT FLOW
// ============================================

export const connectWearable = async (
  userId: string,
  provider: WearableProvider,
  params: { code: string; codeVerifier: string; redirectUri: string }
): Promise<WearableConnection> => {
  const tokens = await getWearableAdapter(provider).exchangeCode(params);
  return saveConnection(userId, provider, tokens);
};

/** Returns a guaranteed-valid access token, refreshing (and persisting the
 * rotated refresh_token) first if the current one has expired. */
const ensureValidAccessToken = async (
  userId: string,
  connection: WearableConnection
): Promise<string> => {
  const isExpired = new Date(connection.expires_at).getTime() <= Date.now();
  if (!isExpired) return connection.access_token;

  const tokens = await getWearableAdapter(connection.provider).refreshToken(
    connection.refresh_token
  );
  const refreshed = await saveConnection(userId, connection.provider, tokens);
  return refreshed.access_token;
};

// ============================================
// METRICS SYNC
// ============================================

export const getLatestMetric = async (
  userId: string,
  provider: WearableProvider
): Promise<WellnessMetric | null> => {
  const { data, error } = await supabase
    .from('wellness_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .order('metric_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getMetricForDate = async (
  userId: string,
  provider: WearableProvider,
  date: string
): Promise<WellnessMetric | null> => {
  const { data, error } = await supabase
    .from('wellness_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('metric_date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const syncMetrics = async (
  userId: string,
  provider: WearableProvider,
  date: string = toLocalISODate(new Date())
): Promise<WellnessMetric> => {
  const connection = await getConnection(userId, provider);
  if (!connection) throw new Error(`No ${provider} connection found for this user`);

  const accessToken = await ensureValidAccessToken(userId, connection);
  const metricDate = date;
  const metrics = await getWearableAdapter(provider).fetchDailyMetrics(accessToken, metricDate);

  const { data, error } = await supabase
    .from('wellness_metrics')
    .upsert(
      {
        user_id: userId,
        provider,
        metric_date: metricDate,
        resting_heart_rate: metrics.restingHeartRate,
        sleep_minutes: metrics.sleepMinutes,
        sleep_efficiency: metrics.sleepEfficiency,
        steps: metrics.steps,
        heart_rate_series: metrics.heartRateSeries,
        raw_payload: metrics.rawPayload,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,metric_date' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};
