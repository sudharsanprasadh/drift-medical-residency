import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { getScheduleWeeks } from '../services/api';
import { ScheduleWeek, ScheduleStatus } from '../types';

export default function ScheduleListScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | ScheduleStatus>('all');

  const isChief = profile?.role === 'chief_resident' ||
    profile?.role === 'program_coordinator' ||
    profile?.role === 'program_director' ||
    profile?.role === 'admin';

  useEffect(() => {
    loadSchedules();
  }, [selectedTab]);

  const loadSchedules = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const status = selectedTab === 'all' ? undefined : selectedTab;
      const data = await getScheduleWeeks(profile.program_id, status);
      setSchedules(data);
    } catch (error: any) {
      console.error('Error loading schedules:', error);
      showAlert('Error', 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedules();
    setRefreshing(false);
  }, [selectedTab, profile]);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const getStatusColor = (status: ScheduleStatus) => {
    switch (status) {
      case 'draft':
        return '#95a5a6';
      case 'published':
        return '#27ae60';
      case 'archived':
        return '#7f8c8d';
      default:
        return '#3498db';
    }
  };

  const getStatusLabel = (status: ScheduleStatus) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'published':
        return 'Published';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  };

  const renderScheduleItem = ({ item }: { item: ScheduleWeek }) => (
    <TouchableOpacity
      style={styles.scheduleCard}
      onPress={() => navigation.navigate('ScheduleView', { weekId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.weekName}>{item.week_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.dateRange}>{formatDateRange(item.start_date, item.end_date)}</Text>
      {item.notes && <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>}
      {item.creator && (
        <Text style={styles.creator}>
          Created by {item.creator.first_name} {item.creator.last_name}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No schedules found</Text>
      <Text style={styles.emptySubtitle}>
        {isChief
          ? 'Tap the + button to create your first weekly schedule'
          : 'Check back later for published schedules'}
      </Text>
    </View>
  );

  const renderTabBar = () => {
    if (!isChief) return null;

    const tabs: Array<{ key: 'all' | ScheduleStatus; label: string }> = [
      { key: 'all', label: 'All' },
      { key: 'draft', label: 'Drafts' },
      { key: 'published', label: 'Published' },
      { key: 'archived', label: 'Archived' },
    ];

    return (
      <View>
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.manageRolesButton}
          onPress={() => navigation.navigate('ManageRoles')}
        >
          <Text style={styles.manageRolesButtonText}>⚙️ Manage Roles</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading schedules...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTabBar()}
      <FlatList
        data={schedules}
        renderItem={renderScheduleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      {isChief && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateWeek')}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: '#f5f5f5',
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
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
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
  manageRolesButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  manageRolesButtonText: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  scheduleCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  dateRange: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  creator: {
    fontSize: 12,
    color: '#95a5a6',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
});
