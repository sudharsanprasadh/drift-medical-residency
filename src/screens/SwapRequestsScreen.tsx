import React, { useState, useEffect } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import {
  getShiftSwapRequests,
  targetRespondToSwap,
  chiefApproveSwap,
  cancelShiftSwapRequest,
} from '../services/api';
import { ShiftSwapRequest } from '../types';

export default function SwapRequestsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'incoming' | 'outgoing' | 'all'>('incoming');
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShiftSwapRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isChief =
    profile?.role === 'chief_resident' ||
    profile?.role === 'program_coordinator' ||
    profile?.role === 'program_director' ||
    profile?.role === 'admin';

  useEffect(() => {
    loadSwapRequests();
  }, []);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const loadSwapRequests = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const data = await getShiftSwapRequests(profile.id, isChief);
      setSwapRequests(data);
    } catch (error: any) {
      console.error('Error loading swap requests:', error);
      showAlert('Error', 'Failed to load swap requests');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSwapRequests();
    setRefreshing(false);
  };

  const getFilteredRequests = () => {
    if (isChief) {
      // Chiefs see all requests with their status
      return swapRequests;
    }

    // Residents see incoming/outgoing
    if (selectedTab === 'incoming') {
      return swapRequests.filter((req) => req.target_resident_id === profile?.id);
    } else if (selectedTab === 'outgoing') {
      return swapRequests.filter((req) => req.requester_id === profile?.id);
    }
    return swapRequests;
  };

  const handleTargetResponse = (request: ShiftSwapRequest, accept: boolean) => {
    setSelectedRequest(request);
    setResponseText('');
    if (accept) {
      setResponseModalVisible(true);
    } else {
      confirmReject(request);
    }
  };

  const confirmReject = (request: ShiftSwapRequest) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Reject this swap request?')
        : Alert.alert('Reject Swap', 'Are you sure you want to reject this swap request?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reject', style: 'destructive', onPress: () => performTargetResponse(request, false) },
          ]);

    if (Platform.OS === 'web' && confirmed) {
      performTargetResponse(request, false);
    }
  };

  const performTargetResponse = async (request: ShiftSwapRequest, accept: boolean) => {
    setActionLoading(true);
    try {
      await targetRespondToSwap(request.id, accept, responseText || undefined);
      showAlert('Success', accept ? 'Swap request accepted!' : 'Swap request rejected');
      setResponseModalVisible(false);
      await loadSwapRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to respond to swap request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChiefApprove = async (request: ShiftSwapRequest, approve: boolean) => {
    const message = approve
      ? 'Approve this swap? The assignments will be exchanged.'
      : 'Reject this swap request?';

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(message)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Confirm', message, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: approve ? 'Approve' : 'Reject', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await chiefApproveSwap(request.id, approve, profile!.id);
      showAlert('Success', approve ? 'Swap approved!' : 'Swap rejected');
      await loadSwapRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to process swap request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (request: ShiftSwapRequest) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Cancel this swap request?')
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Cancel Swap', 'Are you sure you want to cancel this swap request?', [
              { text: 'No', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Yes', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await cancelShiftSwapRequest(request.id);
      showAlert('Success', 'Swap request cancelled');
      await loadSwapRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to cancel swap request');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
      pending_target: { bg: '#fff3cd', text: '#856404', label: 'Awaiting Response' },
      pending_chief: { bg: '#cce5ff', text: '#004085', label: 'Awaiting Chief' },
      approved: { bg: '#d4edda', text: '#155724', label: 'Approved' },
      rejected: { bg: '#f8d7da', text: '#721c24', label: 'Rejected' },
      cancelled: { bg: '#e2e3e5', text: '#383d41', label: 'Cancelled' },
    };

    const badge = colors[status] || colors.pending_target;

    return (
      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
      </View>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderSwapRequest = ({ item }: { item: ShiftSwapRequest }) => {
    const isRequester = item.requester_id === profile?.id;
    const isTarget = item.target_resident_id === profile?.id;
    const canRespond = isTarget && item.status === 'pending_target';
    const canApprove = isChief && item.status === 'pending_chief';
    const canCancel = isRequester && item.status === 'pending_target';

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.requestTitle}>
              {isRequester ? 'Your Request' : isTarget ? 'Request from' : 'Swap Request'}
            </Text>
            <Text style={styles.participantName}>
              {isRequester
                ? `To: ${item.target_resident?.first_name} ${item.target_resident?.last_name}`
                : `From: ${item.requester?.first_name} ${item.requester?.last_name}`}
            </Text>
          </View>
          {getStatusBadge(item.status)}
        </View>

        <View style={styles.shiftDetails}>
          <View style={styles.shiftBox}>
            <Text style={styles.shiftLabel}>Your Shift</Text>
            <Text style={styles.shiftDate}>
              {formatDate(item.requester_assignment?.assignment?.shift_date || '')}
            </Text>
            <Text style={styles.shiftRole}>
              {item.requester_assignment?.assignment?.role?.role_name} -{' '}
              {item.requester_assignment?.assignment?.shift_period}
            </Text>
          </View>

          <Text style={styles.swapArrow}>⇄</Text>

          <View style={styles.shiftBox}>
            <Text style={styles.shiftLabel}>Their Shift</Text>
            <Text style={styles.shiftDate}>
              {item.target_assignment?.assignment?.shift_date
                ? formatDate(item.target_assignment.assignment.shift_date)
                : 'Any shift'}
            </Text>
            {item.target_assignment?.assignment?.role && (
              <Text style={styles.shiftRole}>
                {item.target_assignment.assignment.role.role_name} -{' '}
                {item.target_assignment.assignment.shift_period}
              </Text>
            )}
          </View>
        </View>

        {item.reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        )}

        {item.target_response && (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>Response:</Text>
            <Text style={styles.responseText}>{item.target_response}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          {canRespond && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleTargetResponse(item, true)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleTargetResponse(item, false)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}

          {canApprove && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleChiefApprove(item, true)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleChiefApprove(item, false)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}

          {canCancel && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancel(item)}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading swap requests...</Text>
      </View>
    );
  }

  const filteredRequests = getFilteredRequests();

  return (
    <View style={styles.container}>
      {/* Tab Bar for Residents */}
      {!isChief && (
        <View style={styles.tabBar}>
          {(['incoming', 'outgoing', 'all'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.activeTab]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
                {tab === 'incoming' ? 'Incoming' : tab === 'outgoing' ? 'Outgoing' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Request List */}
      <FlatList
        data={filteredRequests}
        renderItem={renderSwapRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No swap requests</Text>
            <Text style={styles.emptySubtext}>
              {isChief
                ? 'Swap requests will appear here for approval'
                : 'Request a shift swap from the schedule'}
            </Text>
          </View>
        }
      />

      {/* FAB for creating swap request (residents only) */}
      {!isChief && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateSwapRequest')}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Response Modal */}
      <Modal visible={responseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Swap Request</Text>
            <Text style={styles.modalSubtitle}>Add an optional message</Text>

            <TextInput
              style={styles.textArea}
              placeholder="Message (optional)"
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!actionLoading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setResponseModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalAcceptButton]}
                onPress={() => selectedRequest && performTargetResponse(selectedRequest, true)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalAcceptButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  shiftDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  shiftBox: {
    flex: 1,
  },
  shiftLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  shiftDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  shiftRole: {
    fontSize: 12,
    color: '#34495e',
  },
  swapArrow: {
    fontSize: 24,
    color: '#3498db',
    marginHorizontal: 8,
  },
  reasonBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    color: '#856404',
  },
  responseBox: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c5460',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    color: '#0c5460',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ecf0f1',
  },
  modalCancelButtonText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAcceptButton: {
    backgroundColor: '#27ae60',
  },
  modalAcceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
