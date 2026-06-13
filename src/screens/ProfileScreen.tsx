import React, { useEffect, useState } from 'react';
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
import PendingApprovalBanner from '../components/PendingApprovalBanner';
import { getUserApprovalStatus } from '../services/api';
import { ApprovalRequest } from '../types';

export default function ProfileScreen({ navigation }: any) {
  const { profile, refreshProfile, signOut } = useAuth();
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadApprovalStatus();
  }, [profile]);

  const loadApprovalStatus = async () => {
    if (!profile) return;
    try {
      const request = await getUserApprovalStatus(profile.id);
      setApprovalRequest(request);
    } catch (error) {
      console.error('Error loading approval status:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadApprovalStatus();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  const canAccessFullFeatures = profile?.is_approved;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Pending Approval Banner */}
      {profile?.is_profile_complete && !profile?.is_approved && (
        <PendingApprovalBanner />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <Text style={styles.headerSubtitle}>
          {profile?.first_name} {profile?.last_name}
        </Text>
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>
            {profile?.first_name} {profile?.last_name}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{profile?.email}</Text>
        </View>
        {profile?.phone_number && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{profile.phone_number}</Text>
          </View>
        )}
        {profile?.specialty && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Specialty:</Text>
            <Text style={styles.infoValue}>{profile.specialty}</Text>
          </View>
        )}
        {profile?.pgy && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PGY Level:</Text>
            <Text style={styles.infoValue}>{profile.pgy}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role:</Text>
          <Text style={styles.infoValue}>
            {profile?.role === 'chief_resident'
              ? 'Chief Resident'
              : profile?.role === 'admin'
              ? 'Program Director'
              : profile?.role === 'program_coordinator'
              ? 'Program Coordinator'
              : 'Resident'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text
            style={[
              styles.infoValue,
              profile?.is_approved ? styles.approved : styles.pending,
            ]}
          >
            {profile?.is_approved ? 'Approved' : 'Pending Approval'}
          </Text>
        </View>
      </View>

      {/* Program Card (only if approved) */}
      {canAccessFullFeatures && profile?.program && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Program Information</Text>
          <Text style={styles.programName}>{profile.program.program_name}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location:</Text>
            <Text style={styles.infoValue}>{profile.program.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Specialty:</Text>
            <Text style={styles.infoValue}>{profile.program.specialty}</Text>
          </View>
          {profile.program.program_director && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Director:</Text>
              <Text style={styles.infoValue}>
                {profile.program.program_director}
              </Text>
            </View>
          )}
          {profile.program.program_coordinator && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Coordinator:</Text>
              <Text style={styles.infoValue}>
                {profile.program.program_coordinator}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Admin/Chief/Coordinator Actions */}
      {canAccessFullFeatures &&
        (profile?.role === 'admin' || profile?.role === 'chief_resident' || profile?.role === 'program_coordinator') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Approvals')}
            >
              <Text style={styles.actionButtonText}>Manage Approvals</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>

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
  header: {
    padding: 24,
    paddingTop: 32,
    backgroundColor: '#3498db',
  },
  headerTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    width: 110,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  approved: {
    color: '#27ae60',
    fontWeight: '600',
  },
  pending: {
    color: '#f39c12',
    fontWeight: '600',
  },
  programName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#3498db',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  signOutButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 32,
  },
});
