import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import {
  getGuestRequests,
  createGuestRequest,
  reviewGuestRequest,
  revokeGuestRequest,
  searchExternalResidents,
} from '../services/api';
import { GuestRequest, ExternalResidentSearchResult, GuestRequestStatus } from '../types';

export default function GuestResidentsScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExternalResidentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [selectedResident, setSelectedResident] = useState<ExternalResidentSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<GuestRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [tab, profile?.program_id])
  );

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const loadRequests = async () => {
    if (!profile?.program_id) return;
    try {
      setLoading(true);
      const data = await getGuestRequests(profile.program_id, tab);
      setRequests(data);
    } catch (error: any) {
      console.error('Error loading guest requests:', error);
      showAlert('Error', 'Failed to load guest requests');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !profile?.program_id) return;
    setSearching(true);
    try {
      const results = await searchExternalResidents(profile.program_id, searchQuery.trim());
      setSearchResults(results);
    } catch (error: any) {
      console.error('Error searching:', error);
      showAlert('Error', 'Failed to search residents');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedResident || !profile?.program_id || !profile?.id) return;
    setSubmitting(true);
    try {
      await createGuestRequest(
        profile.program_id,
        selectedResident.resident_id,
        selectedResident.program_id,
        profile.id,
        requestNotes.trim() || undefined
      );
      showAlert('Success', `Guest request sent for ${selectedResident.first_name} ${selectedResident.last_name}. Their program will review it.`);
      setSearchModalVisible(false);
      setSelectedResident(null);
      setRequestNotes('');
      setSearchQuery('');
      setSearchResults([]);
      await loadRequests();
    } catch (error: any) {
      console.error('Error sending request:', error);
      const msg = error.message?.includes('unique_active_request')
        ? 'A request already exists for this resident'
        : error.message || 'Failed to send request';
      showAlert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (status: 'approved' | 'declined') => {
    if (!reviewingRequest || !profile?.id) return;
    setReviewing(true);
    try {
      await reviewGuestRequest(reviewingRequest.id, status, profile.id, reviewNotes.trim() || undefined);
      showAlert('Success', `Request ${status}`);
      setReviewModalVisible(false);
      setReviewingRequest(null);
      setReviewNotes('');
      await loadRequests();
    } catch (error: any) {
      console.error('Error reviewing request:', error);
      showAlert('Error', error.message || 'Failed to update request');
    } finally {
      setReviewing(false);
    }
  };

  const handleRevoke = async (request: GuestRequest) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Revoke guest access for ${request.resident?.first_name} ${request.resident?.last_name}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Revoke Access',
            `Revoke guest access for ${request.resident?.first_name} ${request.resident?.last_name}? They will no longer appear in your schedule picker.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Revoke', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;
    try {
      await revokeGuestRequest(request.id);
      showAlert('Success', 'Guest access revoked');
      await loadRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to revoke');
    }
  };

  const getStatusColor = (status: GuestRequestStatus) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'approved': return '#27ae60';
      case 'declined': return '#e74c3c';
      case 'revoked': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const renderRequest = ({ item }: { item: GuestRequest }) => {
    const resident = item.resident;
    const isOutgoing = tab === 'outgoing';
    const programLabel = isOutgoing
      ? `From: ${item.resident_program?.program_name || 'Unknown'}`
      : `Requested by: ${item.requesting_program?.program_name || 'Unknown'}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.residentName}>
              {resident?.first_name} {resident?.last_name}
            </Text>
            {resident?.pgy && <Text style={styles.pgyBadgeText}>{resident.pgy}</Text>}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.programLabel}>{programLabel}</Text>
        {item.notes && <Text style={styles.notes}>Note: {item.notes}</Text>}
        {item.review_notes && <Text style={styles.reviewNotes}>Review: {item.review_notes}</Text>}

        {/* Actions based on tab and status */}
        {isOutgoing && item.status === 'approved' && (
          <TouchableOpacity style={styles.revokeButton} onPress={() => handleRevoke(item)}>
            <Text style={styles.revokeButtonText}>Revoke Access</Text>
          </TouchableOpacity>
        )}
        {!isOutgoing && item.status === 'pending' && (
          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => {
                setReviewingRequest(item);
                setReviewNotes('');
                setReviewModalVisible(true);
              }}
            >
              <Text style={styles.actionButtonText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: ExternalResidentSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.searchResultCard,
        selectedResident?.resident_id === item.resident_id && styles.searchResultSelected,
      ]}
      onPress={() => {
        if (item.existing_request_status) return;
        setSelectedResident(
          selectedResident?.resident_id === item.resident_id ? null : item
        );
      }}
      disabled={!!item.existing_request_status}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.searchResultName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.searchResultDetail}>
          {item.pgy ? `${item.pgy} - ` : ''}{item.program_name}
        </Text>
      </View>
      {item.existing_request_status ? (
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.existing_request_status) }]}>
          <Text style={styles.statusText}>{item.existing_request_status.toUpperCase()}</Text>
        </View>
      ) : selectedResident?.resident_id === item.resident_id ? (
        <Text style={styles.selectedMark}>Selected</Text>
      ) : null}
    </TouchableOpacity>
  );

  if (loading && requests.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading guest requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'outgoing' && styles.activeTab]}
          onPress={() => setTab('outgoing')}
        >
          <Text style={[styles.tabText, tab === 'outgoing' && styles.activeTabText]}>
            Our Guests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'incoming' && styles.activeTab]}
          onPress={() => setTab('incoming')}
        >
          <Text style={[styles.tabText, tab === 'incoming' && styles.activeTabText]}>
            Incoming Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request List */}
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {tab === 'outgoing' ? 'No guest requests yet' : 'No incoming requests'}
            </Text>
            <Text style={styles.emptySubtext}>
              {tab === 'outgoing'
                ? 'Tap + to request a resident from another program'
                : 'Guest requests from other programs will appear here'}
            </Text>
          </View>
        }
      />

      {/* Add Guest Button (outgoing tab only) */}
      {tab === 'outgoing' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedResident(null);
            setRequestNotes('');
            setSearchModalVisible(true);
          }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Search & Request Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Guest Resident</Text>
            <Text style={styles.modalSubtitle}>
              Search for a resident from another program
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or program..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.resident_id}
                style={styles.searchResultsList}
              />
            )}

            {selectedResident && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>
                  Selected: {selectedResident.first_name} {selectedResident.last_name} ({selectedResident.program_name})
                </Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add a note (optional) — e.g., coverage dates, reason..."
                  value={requestNotes}
                  onChangeText={setRequestNotes}
                  multiline
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSearchModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              {selectedResident && (
                <TouchableOpacity
                  style={[styles.sendButton, submitting && { opacity: 0.6 }]}
                  onPress={handleSendRequest}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sendButtonText}>Send Request</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Modal (for incoming requests) */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Guest Request</Text>
            {reviewingRequest && (
              <>
                <Text style={styles.reviewDetail}>
                  {reviewingRequest.requesting_program?.program_name} is requesting{' '}
                  <Text style={{ fontWeight: '600' }}>
                    {reviewingRequest.resident?.first_name} {reviewingRequest.resident?.last_name}
                  </Text>{' '}
                  to be added to their schedule.
                </Text>
                {reviewingRequest.notes && (
                  <Text style={styles.reviewRequestNote}>
                    Their note: "{reviewingRequest.notes}"
                  </Text>
                )}
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add review notes (optional)..."
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  multiline
                />
                <View style={styles.reviewButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setReviewModalVisible(false);
                      setReviewingRequest(null);
                    }}
                    disabled={reviewing}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineButton, reviewing && { opacity: 0.6 }]}
                    onPress={() => handleReview('declined')}
                    disabled={reviewing}
                  >
                    <Text style={styles.actionButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveActionButton, reviewing && { opacity: 0.6 }]}
                    onPress={() => handleReview('approved')}
                    disabled={reviewing}
                  >
                    {reviewing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#7f8c8d' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#3498db' },
  tabText: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  activeTabText: { color: '#3498db', fontWeight: '600' },
  listContent: { padding: 16, flexGrow: 1 },
  card: {
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
  residentName: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  pgyBadgeText: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  programLabel: { fontSize: 13, color: '#3498db', marginBottom: 4 },
  notes: { fontSize: 12, color: '#7f8c8d', fontStyle: 'italic', marginTop: 4 },
  reviewNotes: { fontSize: 12, color: '#27ae60', fontStyle: 'italic', marginTop: 4 },
  revokeButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
    alignItems: 'center',
  },
  revokeButtonText: { color: '#e74c3c', fontSize: 13, fontWeight: '600' },
  reviewActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  approveButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', paddingHorizontal: 24 },
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
  fabIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#7f8c8d', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchResultsList: { maxHeight: 220, marginBottom: 12 },
  searchResultCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultSelected: { backgroundColor: '#ebf5fb' },
  searchResultName: { fontSize: 15, fontWeight: '500', color: '#2c3e50' },
  searchResultDetail: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
  selectedMark: { fontSize: 12, color: '#3498db', fontWeight: '600' },
  notesSection: { marginBottom: 12 },
  notesLabel: { fontSize: 13, color: '#2c3e50', fontWeight: '600', marginBottom: 8 },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 60,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#2c3e50', fontSize: 15, fontWeight: '600' },
  sendButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    alignItems: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  reviewDetail: { fontSize: 14, color: '#2c3e50', lineHeight: 20, marginBottom: 12 },
  reviewRequestNote: { fontSize: 13, color: '#7f8c8d', fontStyle: 'italic', marginBottom: 12 },
  reviewButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
  },
  approveActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    alignItems: 'center',
  },
});
