import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { getProgramMembers } from '../services/api';
import { Profile, PGYLevel } from '../types';

export default function ProgramMembersScreen() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'residents' | 'leadership'>('all');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const data = await getProgramMembers(profile.program_id);
      setMembers(data);
    } catch (error: any) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const filterMembers = (members: Profile[]): Profile[] => {
    let filtered = members;

    // Apply role filter
    if (selectedFilter === 'residents') {
      filtered = filtered.filter((m) => m.role === 'resident');
    } else if (selectedFilter === 'leadership') {
      filtered = filtered.filter((m) =>
        ['chief_resident', 'program_coordinator', 'program_director', 'faculty', 'admin'].includes(m.role)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.first_name?.toLowerCase().includes(query) ||
          m.last_name?.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query) ||
          m.specialty?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const groupByPGY = (members: Profile[]) => {
    const pgyOrder: PGYLevel[] = ['PGY1', 'PGY2', 'PGY3', 'PGY4', 'PGY5', 'PGY6', 'PGY7', 'PGY8', 'PGY0', 'ALUMNI'];

    const grouped: Record<string, Profile[]> = {};

    members.forEach((member) => {
      const key = member.pgy || 'Not Set';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(member);
    });

    // Sort each group by last name
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
    });

    // Return in PGY order
    const sorted: Array<{ pgy: string; members: Profile[] }> = [];

    pgyOrder.forEach((pgy) => {
      if (grouped[pgy]) {
        sorted.push({ pgy, members: grouped[pgy] });
      }
    });

    // Add any other PGYs not in the order
    Object.keys(grouped).forEach((key) => {
      if (!pgyOrder.includes(key as PGYLevel)) {
        sorted.push({ pgy: key, members: grouped[key] });
      }
    });

    return sorted;
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'chief_resident':
        return 'Chief Resident';
      case 'program_coordinator':
        return 'Program Coordinator';
      case 'program_director':
        return 'Program Director';
      case 'faculty':
        return 'Faculty';
      case 'admin':
        return 'Admin';
      case 'resident':
        return 'Resident';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'chief_resident':
        return '#e67e22';
      case 'program_coordinator':
        return '#9b59b6';
      case 'program_director':
        return '#8e44ad';
      case 'faculty':
        return '#16a085';
      case 'admin':
        return '#c0392b';
      default:
        return '#3498db';
    }
  };

  const renderMemberCard = (member: Profile) => (
    <View key={member.id} style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {member.first_name} {member.last_name}
          </Text>
          <Text style={styles.memberEmail}>{member.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
          <Text style={styles.roleBadgeText}>{getRoleLabel(member.role)}</Text>
        </View>
      </View>

      <View style={styles.memberDetails}>
        {member.specialty && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Specialty:</Text>
            <Text style={styles.detailValue}>{member.specialty}</Text>
          </View>
        )}
        {member.pgy && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Level:</Text>
            <Text style={styles.detailValue}>{member.pgy}</Text>
          </View>
        )}
        {member.phone_number && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValue}>{member.phone_number}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: member.is_approved ? '#d4edda' : '#fff3cd' }]}>
            <Text style={[styles.statusText, { color: member.is_approved ? '#155724' : '#856404' }]}>
              {member.is_approved ? 'Active' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderLeadershipSection = (members: Profile[]) => {
    if (members.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👑 Leadership</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{members.length}</Text>
          </View>
        </View>
        {members.map(renderMemberCard)}
      </View>
    );
  };

  const renderResidentsSection = (members: Profile[]) => {
    const residents = members.filter((m) => m.role === 'resident');
    if (residents.length === 0) return null;

    const pgyGroups = groupByPGY(residents);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👨‍⚕️ Residents</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{residents.length}</Text>
          </View>
        </View>

        {pgyGroups.map(({ pgy, members: pgyMembers }) => (
          <View key={pgy} style={styles.pgyGroup}>
            <View style={styles.pgyHeader}>
              <Text style={styles.pgyTitle}>{pgy}</Text>
              <Text style={styles.pgyCount}>({pgyMembers.length})</Text>
            </View>
            {pgyMembers.map(renderMemberCard)}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading program members...</Text>
      </View>
    );
  }

  const filteredMembers = filterMembers(members);
  const leadership = filteredMembers.filter((m) =>
    ['chief_resident', 'program_coordinator', 'program_director', 'faculty', 'admin'].includes(m.role)
  );
  const residents = filteredMembers.filter((m) => m.role === 'resident');

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{members.length}</Text>
          <Text style={styles.summaryLabel}>Total Members</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{members.filter((m) => m.role === 'resident').length}</Text>
          <Text style={styles.summaryLabel}>Residents</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {members.filter((m) => ['chief_resident', 'program_coordinator', 'program_director'].includes(m.role)).length}
          </Text>
          <Text style={styles.summaryLabel}>Leadership</Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or specialty..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'residents' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('residents')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'residents' && styles.filterButtonTextActive]}>
              Residents
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'leadership' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('leadership')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'leadership' && styles.filterButtonTextActive]}>
              Leadership
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Members List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No members found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'No members in this program yet'}
            </Text>
          </View>
        ) : (
          <>
            {(selectedFilter === 'all' || selectedFilter === 'leadership') && renderLeadershipSection(leadership)}
            {(selectedFilter === 'all' || selectedFilter === 'residents') && renderResidentsSection(residents)}
          </>
        )}
      </ScrollView>
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
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  searchSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  pgyGroup: {
    marginBottom: 16,
  },
  pgyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 8,
  },
  pgyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
  },
  pgyCount: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 6,
  },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  memberDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#7f8c8d',
    width: 80,
  },
  detailValue: {
    fontSize: 13,
    color: '#2c3e50',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
