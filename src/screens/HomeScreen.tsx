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
import { fetchProgramAnnouncements } from '../services/announcementApi';
import { Announcement } from '../types';

export default function HomeScreen({ navigation, route }: any) {
  const { profile, refreshProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  // Refresh announcements when returning from CreateAnnouncement
  useEffect(() => {
    if (route.params?.refresh) {
      loadAnnouncements();
      // Clear the refresh param
      navigation.setParams({ refresh: undefined });
    }
  }, [route.params?.refresh]);

  const loadData = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    await loadAnnouncements();
    setLoading(false);
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
    await loadAnnouncements();
    setRefreshing(false);
  };

  const handleEdit = (announcement: Announcement) => {
    navigation.navigate('EditAnnouncement', { announcement });
  };

  const handleDelete = (announcementId: string) => {
    // Remove from local state
    setAnnouncements((prev: Announcement[]) => prev.filter((a: Announcement) => a.id !== announcementId));
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

      {/* Welcome Header */}
      <View style={styles.welcomeHeader}>
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
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  currentUserId={profile?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
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

      {/* Not Approved Message */}
      {!canAccessFullFeatures && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to Drift!</Text>
          <Text style={styles.generalInfo}>
            Your profile is currently pending approval. Once approved by your Chief
            Resident or Program Director, you'll have access to all features including
            announcements and program resources.
          </Text>
        </View>
      )}

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
  welcomeHeader: {
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
    marginBottom: 12,
  },
  generalInfo: {
    fontSize: 15,
    color: '#7f8c8d',
    lineHeight: 22,
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
