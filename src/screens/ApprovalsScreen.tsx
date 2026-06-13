import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { getPendingApprovals, approveUser, rejectUser } from '../services/api';
import { ApprovalRequest } from '../types';

export default function ApprovalsScreen() {
  const { profile } = useAuth();
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      console.log('🔍 Loading approvals... Profile:', profile?.id, profile?.role, profile?.is_approved);
      const requests = await getPendingApprovals();
      console.log('✅ Loaded approvals:', requests.length, 'requests');
      console.log('📋 Approval requests:', JSON.stringify(requests, null, 2));
      setApprovalRequests(requests);
    } catch (error) {
      console.error('❌ Error loading approvals:', error);
      if (Platform.OS === 'web') {
        alert('Failed to load approval requests');
      } else {
        Alert.alert('Error', 'Failed to load approval requests');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApprovals();
    setRefreshing(false);
  };

  const handleApprove = async (request: ApprovalRequest) => {
    const userName = `${request.profile?.first_name} ${request.profile?.last_name}`;
    const message = `Are you sure you want to approve ${userName}?`;

    // Use window.confirm on web, Alert.alert on native
    const confirmed = Platform.OS === 'web'
      ? window.confirm(message)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Approve User',
            message,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Approve', style: 'default', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await approveUser(request.id, request.user_id, profile!.id);

      // Show success message
      if (Platform.OS === 'web') {
        alert('User approved successfully');
      } else {
        Alert.alert('Success', 'User approved successfully');
      }

      await loadApprovals();
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!rejectNotes.trim()) {
      if (Platform.OS === 'web') {
        alert('Please provide a reason for rejection');
      } else {
        Alert.alert('Error', 'Please provide a reason for rejection');
      }
      return;
    }

    setActionLoading(true);
    try {
      await rejectUser(selectedRequest!.id, profile!.id, rejectNotes);

      if (Platform.OS === 'web') {
        alert('User rejected');
      } else {
        Alert.alert('Success', 'User rejected');
      }

      setShowRejectModal(false);
      setRejectNotes('');
      setSelectedRequest(null);
      await loadApprovals();
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const renderApprovalRequest = ({ item }: { item: ApprovalRequest }) => {
    const userProfile = item.profile;
    if (!userProfile) return null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.userName}>
            {userProfile.first_name} {userProfile.last_name}
          </Text>
          <Text style={styles.roleTag}>
            {item.requested_role === 'chief_resident' ? 'Chief Resident' : 'Resident'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{userProfile.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{userProfile.phone_number}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Specialty:</Text>
          <Text style={styles.infoValue}>{userProfile.specialty}</Text>
        </View>

        {userProfile.program && (
          <View style={styles.programSection}>
            <Text style={styles.infoLabel}>Program:</Text>
            <Text style={styles.programName}>{userProfile.program.program_name}</Text>
            <Text style={styles.programLocation}>{userProfile.program.location}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() => handleApprove(item)}
            disabled={actionLoading}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() => handleReject(item)}
            disabled={actionLoading}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info for Chief Residents */}
      {profile?.role === 'chief_resident' && profile?.program && (
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Your Program Approvals</Text>
          <Text style={styles.headerSubtitle}>
            Showing approval requests for: {profile.program.program_name}
          </Text>
        </View>
      )}

      <FlatList
        data={approvalRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderApprovalRequest}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {profile?.role === 'chief_resident'
                ? 'No pending approvals from your program'
                : 'No pending approvals'}
            </Text>
            {profile?.role === 'chief_resident' && (
              <Text style={styles.emptySubtext}>
                Only residents enrolling in your program will appear here
              </Text>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject User</Text>
            <Text style={styles.modalSubtitle}>
              Provide a reason for rejecting this user:
            </Text>

            <TextInput
              style={styles.textArea}
              placeholder="Reason for rejection..."
              value={rejectNotes}
              onChangeText={setRejectNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectNotes('');
                  setSelectedRequest(null);
                }}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={submitRejection}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Reject User</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerInfo: {
    backgroundColor: '#3498db',
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ecf0f1',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  roleTag: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    width: 80,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  programSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  programName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
    marginTop: 4,
  },
  programLocation: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ecf0f1',
  },
  modalRejectButton: {
    backgroundColor: '#e74c3c',
  },
  modalCancelButtonText: {
    color: '#2c3e50',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
