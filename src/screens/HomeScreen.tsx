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
import AnnouncementCard from '../components/AnnouncementCard';
import { getUserApprovalStatus } from '../services/api';
import { fetchProgramAnnouncements } from '../services/announcementApi';
import { ApprovalRequest, Announcement } from '../types';

export default function HomeScreen({ navigation }: any) {
  const { profile, refreshProfile, signOut } = useAuth();
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  useEffect(() => {
    loadApprovalStatus();
    loadAnnouncements();
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

  const loadAnnouncements = async () => {
    if (!profile?.program_id) return;
    try {
      setAnnouncementsLoading(true);
      const data = await fetchProgramAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadApprovalStatus();
    await loadAnnouncements();
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

      {/* Welcome Section */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.nameText}>
          {profile?.first_name || 'User'}
        </Text>
      </View>

      {/* Announcements Section */}
      {canAccessFullFeatures && (
        <View style={styles.announcementsSection}>
          <View style={styles.announcementHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {(profile?.role === 'chief_resident' || profile?.role === 'admin') && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CreateAnnouncement')}
                style={styles.createButton}
              >
                <Text style={styles.createButtonText}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>

          {announcementsLoading ? (
            <View style={styles.announcementsLoading}>
              <ActivityIndicator size="small" color="#3498db" />
            </View>
          ) : announcements.length > 0 ? (
            <View style={styles.announcementsList}>
              {announcements.map((announcement: Announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No announcements yet</Text>
              {(profile?.role === 'chief_resident' || profile?.role === 'admin') && (
                <Text style={styles.emptyStateSubtext}>
                  Be the first to post an announcement!
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Profile</Text>
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
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role:</Text>
          <Text style={styles.infoValue}>
            {profile?.role === 'chief_resident' ? 'Chief Resident' : 'Resident'}
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
          <Text style={styles.cardTitle}>Your Program</Text>
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

      {/* General Information (always accessible) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>General Information</Text>
        <Text style={styles.generalInfo}>
          Welcome to Drift! This app helps you manage your medical residency program
          efficiently.
        </Text>
        {!canAccessFullFeatures && (
          <Text style={styles.warningText}>
            Full features will be available once your profile is approved.
          </Text>
        )}
      </View>

      {/* Admin/Chief Actions */}
      {canAccessFullFeatures &&
        (profile?.role === 'admin' || profile?.role === 'chief_resident') && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Approvals')}
          >
            <Text style={styles.actionButtonText}>Manage Approvals</Text>
          </TouchableOpacity>
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
  },
  welcomeText: {
    fontSize: 18,
    color: '#7f8c8d',
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
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
    width: 100,
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
  generalInfo: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#e67e22',
    marginTop: 12,
    fontStyle: 'italic',
  },
  actionButton: {
    backgroundColor: '#3498db',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
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
  announcementsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  createButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  announcementsList: {
    marginTop: 8,
  },
  announcementsLoading: {
    padding: 20,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
});
