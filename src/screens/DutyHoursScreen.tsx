import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { getResidentTracking, getProgramTracking, getComplianceSummary } from '../services/api';
import { ScheduleRotationTracking, ComplianceSummary } from '../types';

export default function DutyHoursScreen() {
  const { profile } = useAuth();
  const [myTracking, setMyTracking] = useState<ScheduleRotationTracking[]>([]);
  const [programTracking, setProgramTracking] = useState<ScheduleRotationTracking[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'program'>('personal');

  const isChief =
    profile?.role === 'chief_resident' ||
    profile?.role === 'program_coordinator' ||
    profile?.role === 'program_director' ||
    profile?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!profile?.id || !profile?.program_id) return;

    try {
      setLoading(true);

      if (viewMode === 'personal') {
        const trackingData = await getResidentTracking(profile.id);
        setMyTracking(trackingData);
      } else {
        const [programTrackingData, summaryData] = await Promise.all([
          getProgramTracking(profile.program_id),
          getComplianceSummary(profile.program_id),
        ]);
        setProgramTracking(programTrackingData);
        setComplianceSummary(summaryData);
      }
    } catch (error: any) {
      console.error('Error loading duty hours:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderStatCard = (title: string, value: string | number, subtitle?: string, color?: string) => (
    <View style={[styles.statCard, color && { borderLeftColor: color }]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderPersonalView = () => {
    if (myTracking.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No duty hours tracked yet</Text>
          <Text style={styles.emptySubtext}>
            Hours will appear here once you are assigned to shifts
          </Text>
        </View>
      );
    }

    const recent = myTracking[0];
    const rolling4Week = myTracking.slice(0, 4).reduce((sum, t) => sum + t.total_hours, 0) / 4;

    return (
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Current Week Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Week</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Total Hours',
              recent.total_hours.toFixed(1),
              `of 80 max`,
              recent.total_hours > 80 ? '#e74c3c' : '#27ae60'
            )}
            {renderStatCard(
              'Day Shifts',
              `${recent.day_shifts}`,
              `${recent.day_shift_hours.toFixed(1)} hrs`
            )}
            {renderStatCard(
              'Night Shifts',
              `${recent.night_shifts}`,
              `${recent.night_shift_hours.toFixed(1)} hrs`
            )}
            {renderStatCard(
              'Days Off',
              `${recent.days_off_count}`,
              recent.days_off_count < 1 ? 'Below minimum!' : 'Good',
              recent.days_off_count < 1 ? '#e74c3c' : '#27ae60'
            )}
          </View>
        </View>

        {/* Compliance Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance Status</Text>
          <View
            style={[
              styles.complianceCard,
              { backgroundColor: recent.is_compliant ? '#d4edda' : '#f8d7da' },
            ]}
          >
            <Text
              style={[
                styles.complianceStatus,
                { color: recent.is_compliant ? '#155724' : '#721c24' },
              ]}
            >
              {recent.is_compliant ? '✓ COMPLIANT' : '⚠ VIOLATIONS'}
            </Text>
            {!recent.is_compliant && recent.violation_notes.length > 0 && (
              <View style={styles.violationsList}>
                {recent.violation_notes.map((note, idx) => (
                  <Text key={idx} style={styles.violationText}>
                    • {note}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Rolling Average */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4-Week Rolling Average</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Avg Hours/Week',
              rolling4Week.toFixed(1),
              'Last 4 weeks',
              rolling4Week > 80 ? '#e74c3c' : '#3498db'
            )}
            {renderStatCard(
              'Total Weeks',
              `${myTracking.length}`,
              'Tracked'
            )}
          </View>
        </View>

        {/* Weekly History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly History</Text>
          {myTracking.map((tracking) => (
            <View key={tracking.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyWeek}>{tracking.week?.week_name || 'Week'}</Text>
                <View
                  style={[
                    styles.historyBadge,
                    { backgroundColor: tracking.is_compliant ? '#27ae60' : '#e74c3c' },
                  ]}
                >
                  <Text style={styles.historyBadgeText}>
                    {tracking.is_compliant ? 'OK' : 'VIOLATION'}
                  </Text>
                </View>
              </View>
              <View style={styles.historyStats}>
                <Text style={styles.historyStat}>
                  {tracking.total_hours.toFixed(1)} hrs
                </Text>
                <Text style={styles.historyStat}>
                  {tracking.total_shifts} shifts
                </Text>
                <Text style={styles.historyStat}>
                  {tracking.days_off_count} days off
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderProgramView = () => {
    if (!complianceSummary) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No program data available</Text>
        </View>
      );
    }

    return (
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Overall Compliance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Compliance</Text>
          <View style={styles.complianceOverview}>
            <Text style={styles.complianceRate}>
              {complianceSummary.compliance_rate.toFixed(1)}%
            </Text>
            <Text style={styles.complianceLabel}>Compliance Rate</Text>
          </View>
        </View>

        {/* Program Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Statistics</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Total Residents',
              complianceSummary.total_residents,
              'Active'
            )}
            {renderStatCard(
              'Compliant',
              complianceSummary.compliant_residents,
              `${((complianceSummary.compliant_residents / complianceSummary.total_residents) * 100).toFixed(0)}%`,
              '#27ae60'
            )}
            {renderStatCard(
              'Violations',
              complianceSummary.non_compliant_residents,
              'Residents',
              '#e74c3c'
            )}
            {renderStatCard(
              'Weeks Tracked',
              complianceSummary.total_weeks,
              'Total'
            )}
          </View>
        </View>

        {/* Common Violations */}
        {complianceSummary.common_violations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Common Violations</Text>
            <View style={styles.violationsCard}>
              {complianceSummary.common_violations.map((violation, idx) => (
                <View key={idx} style={styles.violationItem}>
                  <Text style={styles.violationBullet}>⚠</Text>
                  <Text style={styles.violationLabel}>{violation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Program Tracking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Resident Hours</Text>
          {programTracking.slice(0, 10).map((tracking) => (
            <View key={tracking.id} style={styles.residentCard}>
              <View style={styles.residentHeader}>
                <Text style={styles.residentName}>
                  {tracking.resident?.first_name} {tracking.resident?.last_name}
                </Text>
                <View
                  style={[
                    styles.residentBadge,
                    { backgroundColor: tracking.is_compliant ? '#27ae60' : '#e74c3c' },
                  ]}
                >
                  <Text style={styles.residentBadgeText}>
                    {tracking.is_compliant ? '✓' : '✕'}
                  </Text>
                </View>
              </View>
              <View style={styles.residentStats}>
                <Text style={styles.residentStat}>
                  {tracking.total_hours.toFixed(1)} hrs
                </Text>
                <Text style={styles.residentStat}>
                  {tracking.night_shifts} nights
                </Text>
                <Text style={styles.residentStat}>
                  {tracking.days_off_count} days off
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading duty hours...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      {isChief && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'personal' && styles.activeTab]}
            onPress={() => {
              setViewMode('personal');
              loadData();
            }}
          >
            <Text style={[styles.tabText, viewMode === 'personal' && styles.activeTabText]}>
              My Hours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'program' && styles.activeTab]}
            onPress={() => {
              setViewMode('program');
              loadData();
            }}
          >
            <Text style={[styles.tabText, viewMode === 'program' && styles.activeTabText]}>
              Program
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {viewMode === 'personal' ? renderPersonalView() : renderProgramView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 11,
    color: '#95a5a6',
  },
  complianceCard: {
    borderRadius: 12,
    padding: 16,
  },
  complianceStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  violationsList: {
    marginTop: 8,
  },
  violationText: {
    fontSize: 13,
    color: '#721c24',
    marginBottom: 4,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyWeek: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  historyStat: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  complianceOverview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  complianceRate: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  complianceLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
  },
  violationsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  violationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  violationBullet: {
    fontSize: 20,
    marginRight: 12,
  },
  violationLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  residentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  residentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  residentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  residentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  residentBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  residentStats: {
    flexDirection: 'row',
    gap: 16,
  },
  residentStat: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});
