import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { LineChart } from 'react-native-chart-kit';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../services/AuthContext';
import {
  getWearableAdapter,
  getConnection,
  connectWearable,
  disconnectWearable,
  getMetricForDate,
  syncMetrics,
  toLocalISODate,
} from '../services/wearables/wearableApi';
import { WearableConnection, WellnessMetric } from '../types';

// Required once per app so Android can close out the in-app browser tab
// when Fitbit redirects back after the resident approves/denies access.
WebBrowser.maybeCompleteAuthSession();

const PROVIDER = 'fitbit';

/** Formats a "YYYY-MM-DD" string as a local date — parsing it via `new
 * Date(string)` would read it as UTC midnight and can print the wrong day. */
const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const CHART_WIDTH = Dimensions.get('window').width - 64;
const MAX_CHART_LABELS = 8;

/** Thins a heart-rate series down to ~MAX_CHART_LABELS x-axis labels — the
 * chart still plots every point, but showing a label per 5-minute bucket
 * (up to 288/day) would be unreadable. */
const chartLabelsFor = (series: { time: string }[]): string[] => {
  const interval = Math.max(1, Math.ceil(series.length / MAX_CHART_LABELS));
  return series.map((point, i) =>
    i % interval === 0
      ? new Date(point.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : ''
  );
};

export default function WellnessScreen() {
  const { profile } = useAuth();
  const today = toLocalISODate(new Date());
  const [connection, setConnection] = useState<WearableConnection | null>(null);
  const [metric, setMetric] = useState<WellnessMetric | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const adapter = getWearableAdapter(PROVIDER);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'drift', path: 'fitbit-callback' });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    adapter.getAuthRequestConfig(redirectUri),
    adapter.discovery
  );

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      alert(`${title}\n\n${message}`);
    }
  };

  // Cache-first: shows whatever's already synced for that date instantly,
  // and only calls out to Google Health (via syncMetrics) if nothing has
  // ever been synced for it yet — so revisiting a date already viewed today
  // doesn't refire the API.
  const loadOrSyncDate = async (date: string) => {
    if (!profile) return;
    const cached = await getMetricForDate(profile.id, PROVIDER, date);
    if (cached) {
      setMetric(cached);
      return;
    }
    setSyncing(true);
    try {
      const synced = await syncMetrics(profile.id, PROVIDER, date);
      setMetric(synced);
    } catch (error: any) {
      console.error('Fitbit sync error:', error);
      showAlert('Error', error.message || 'Failed to sync Fitbit data.');
    } finally {
      setSyncing(false);
    }
  };

  // Pull-to-refresh bypasses the cache to force a fresh pull from Google
  // Health, since the whole point of refreshing is to get the latest.
  const forceSyncDate = async (date: string) => {
    if (!profile) return;
    try {
      const synced = await syncMetrics(profile.id, PROVIDER, date);
      setMetric(synced);
    } catch (error: any) {
      console.error('Fitbit sync error:', error);
      showAlert('Error', error.message || 'Failed to sync Fitbit data.');
    }
  };

  const loadData = async () => {
    if (!profile) return;
    try {
      const conn = await getConnection(profile.id, PROVIDER);
      setConnection(conn);
      if (conn) {
        await loadOrSyncDate(selectedDate);
      }
    } catch (error) {
      console.error('Error loading wellness data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    setCalendarVisible(false);
    setMetric(null);
    await loadOrSyncDate(date);
  };

  const handleExchange = async (code: string, codeVerifier: string) => {
    if (!profile) return;
    setConnecting(true);
    try {
      const conn = await connectWearable(profile.id, PROVIDER, { code, codeVerifier, redirectUri });
      setConnection(conn);
      await loadOrSyncDate(selectedDate);
    } catch (error: any) {
      console.error('Fitbit connect error:', error);
      showAlert('Error', error.message || 'Failed to connect Fitbit.');
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (response?.type === 'success' && request?.codeVerifier) {
      handleExchange(response.params.code, request.codeVerifier);
    } else if (response?.type === 'error') {
      showAlert('Error', response.error?.message || 'Fitbit authorization failed.');
    }
  }, [response]);

  const handleDisconnect = async () => {
    if (!profile) return;
    try {
      await disconnectWearable(profile.id, PROVIDER);
      setConnection(null);
      setMetric(null);
    } catch (error: any) {
      console.error('Fitbit disconnect error:', error);
      showAlert('Error', error.message || 'Failed to disconnect Fitbit.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (connection) {
      await forceSyncDate(selectedDate);
    } else {
      await loadData();
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!connection ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connect Your Wearable</Text>
          <Text style={styles.description}>
            Connect Google Health to start tracking wellness signals like resting heart rate,
            sleep, and daily activity from your wearable.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, (connecting || !request) && styles.buttonDisabled]}
            onPress={() => promptAsync()}
            disabled={connecting || !request}
          >
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Connect Google Health</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.dateSelector} onPress={() => setCalendarVisible(true)}>
            <Text style={styles.dateSelectorText}>
              {selectedDate === today ? 'Today' : formatDate(selectedDate)}
            </Text>
            <Text style={styles.dateSelectorIcon}>📅</Text>
          </TouchableOpacity>

          {metric?.heart_rate_series && metric.heart_rate_series.length > 0 && (
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroValue}>
                  {metric.resting_heart_rate ?? '–'}
                  <Text style={styles.heroValueSuffix}> bpm resting</Text>
                </Text>
                <Text style={styles.heroTitle}>Heart rate through the day</Text>
              </View>
              <LineChart
                data={{
                  labels: chartLabelsFor(metric.heart_rate_series),
                  datasets: [{ data: metric.heart_rate_series.map((p) => p.bpm) }],
                }}
                width={CHART_WIDTH}
                height={200}
                withDots={false}
                withInnerLines={true}
                withOuterLines={false}
                bezier
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(228, 87, 61, ${opacity})`,
                  labelColor: () => '#5E7A80',
                  fillShadowGradient: '#E4573D',
                  fillShadowGradientOpacity: 0.07,
                  propsForBackgroundLines: { stroke: '#EDF3F2' },
                }}
                style={styles.heroChart}
              />
            </View>
          )}

          <View style={styles.glanceRow}>
            <View style={styles.glanceTile}>
              <Text style={styles.glanceIcon}>❤️</Text>
              <Text style={styles.glanceLabel}>Resting HR</Text>
              <Text style={styles.glanceValue}>
                {metric?.resting_heart_rate != null ? metric.resting_heart_rate : '—'}
              </Text>
            </View>
            <View style={styles.glanceTile}>
              <Text style={styles.glanceIcon}>😴</Text>
              <Text style={styles.glanceLabel}>Sleep</Text>
              <Text style={styles.glanceValue}>
                {metric?.sleep_minutes != null
                  ? `${Math.floor(metric.sleep_minutes / 60)}h ${metric.sleep_minutes % 60}m`
                  : '—'}
              </Text>
            </View>
            <View style={styles.glanceTile}>
              <Text style={styles.glanceIcon}>👣</Text>
              <Text style={styles.glanceLabel}>Steps</Text>
              <Text style={styles.glanceValue}>
                {metric?.steps != null ? metric.steps.toLocaleString() : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {selectedDate === today ? "Today's Wellness Metrics" : `Wellness Metrics — ${formatDate(selectedDate)}`}
            </Text>

            {syncing && !metric ? (
              <ActivityIndicator color="#3498db" style={styles.metricsLoading} />
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Resting Heart Rate:</Text>
                  <Text style={styles.infoValue}>
                    {metric?.resting_heart_rate != null
                      ? `${metric.resting_heart_rate} bpm`
                      : 'Not yet available'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sleep:</Text>
                  <Text style={styles.infoValue}>
                    {metric?.sleep_minutes != null
                      ? `${Math.floor(metric.sleep_minutes / 60)}h ${metric.sleep_minutes % 60}m`
                      : 'Not yet available'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Steps:</Text>
                  <Text style={styles.infoValue}>
                    {metric?.steps != null ? metric.steps.toLocaleString() : 'Not yet available'}
                  </Text>
                </View>
                {metric?.synced_at && (
                  <Text style={styles.syncedAt}>
                    Last synced at {new Date(metric.synced_at).toLocaleTimeString()}
                  </Text>
                )}
              </>
            )}
          </View>

          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect Wearable</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCalendarVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarCard}>
            <Calendar
              current={selectedDate}
              maxDate={today}
              markedDates={{ [selectedDate]: { selected: true, selectedColor: '#3498db' } }}
              onDayPress={(day: DateData) => handleSelectDate(day.dateString)}
              theme={{
                todayTextColor: '#3498db',
                selectedDayBackgroundColor: '#3498db',
                arrowColor: '#3498db',
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                monthTextColor: '#2c3e50',
                dayTextColor: '#2c3e50',
                textDisabledColor: '#bdc3c7',
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginRight: 8,
  },
  dateSelectorIcon: {
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingTop: 20,
    paddingBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTop: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E4573D',
  },
  heroValueSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E7A80',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 2,
  },
  heroChart: {
    borderRadius: 12,
  },
  glanceRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  glanceTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glanceIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  glanceLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 2,
  },
  glanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    width: 160,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  syncedAt: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
    marginBottom: 16,
  },
  metricsLoading: {
    marginVertical: 20,
  },
  actionButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  disconnectButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 32,
  },
});
