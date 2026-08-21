import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import {
  getScheduleWeeks,
  getScheduleAssignments,
  getProgramMembers,
  createShiftSwapRequest,
} from '../services/api';
import { ScheduleWeek, ScheduleAssignment, Profile } from '../types';

export default function CreateSwapRequestScreen({ navigation }: any) {
  const { profile, user } = useAuth();
  const [weeks, setWeeks] = useState<ScheduleWeek[]>([]);
  const [myAssignments, setMyAssignments] = useState<ScheduleAssignment[]>([]);
  const [targetResidents, setTargetResidents] = useState<Profile[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeek | null>(null);
  const [selectedMyAssignment, setSelectedMyAssignment] = useState<ScheduleAssignment | null>(null);
  const [selectedTargetResident, setSelectedTargetResident] = useState<Profile | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const loadData = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);

      // Load published weeks
      const weeksData = await getScheduleWeeks(profile.program_id, 'published');
      setWeeks(weeksData);

      // Load all residents in program (potential swap targets)
      const residentsData = await getProgramMembers(profile.program_id);
      const otherResidents = residentsData.filter(
        (r) =>
          r.id !== profile.id &&
          (r.role === 'resident' || r.role === 'chief_resident') &&
          r.is_approved
      );
      setTargetResidents(otherResidents);
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMyAssignments = async (week: ScheduleWeek) => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const assignments = await getScheduleAssignments(week.id);

      // Filter to only my assignments
      const myAssigns = assignments.filter((assignment) =>
        assignment.residents?.some((r) => r.resident_id === profile.id)
      );

      setMyAssignments(myAssigns);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      showAlert('Error', 'Failed to load your assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleWeekSelect = (week: ScheduleWeek) => {
    setSelectedWeek(week);
    setSelectedMyAssignment(null);
    loadMyAssignments(week);
  };

  const handleSubmit = async () => {
    if (!selectedMyAssignment) {
      showAlert('Error', 'Please select your shift');
      return;
    }

    if (!selectedTargetResident) {
      showAlert('Error', 'Please select who to swap with');
      return;
    }

    if (!reason.trim()) {
      showAlert('Error', 'Please provide a reason for the swap');
      return;
    }

    if (!user?.id) return;

    // Find my resident assignment ID
    const myResidentAssignment = selectedMyAssignment.residents?.find(
      (r) => r.resident_id === profile?.id
    );

    if (!myResidentAssignment) {
      showAlert('Error', 'Assignment not found');
      return;
    }

    setSubmitting(true);
    try {
      await createShiftSwapRequest({
        requester_id: user.id,
        requester_assignment_id: myResidentAssignment.id,
        target_resident_id: selectedTargetResident.id,
        reason: reason.trim(),
      });

      showAlert('Success', 'Swap request sent!', () => {
        navigation.goBack();
      });
    } catch (error: any) {
      console.error('Error creating swap request:', error);
      showAlert('Error', error.message || 'Failed to create swap request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  if (loading && weeks.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>Request Shift Swap</Text>
        <Text style={styles.subtitle}>Select your shift and who you want to swap with</Text>

        {/* Step 1: Select Week */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Week</Text>
          {weeks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No published schedules available</Text>
            </View>
          ) : (
            <View style={styles.optionsList}>
              {weeks.map((week) => (
                <TouchableOpacity
                  key={week.id}
                  style={[styles.optionCard, selectedWeek?.id === week.id && styles.selectedCard]}
                  onPress={() => handleWeekSelect(week)}
                >
                  <Text style={styles.optionTitle}>{week.week_name}</Text>
                  <Text style={styles.optionSubtitle}>
                    {new Date(week.start_date).toLocaleDateString()} -{' '}
                    {new Date(week.end_date).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Step 2: Select Your Shift */}
        {selectedWeek && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Select Your Shift</Text>
            {loading ? (
              <ActivityIndicator color="#3498db" style={{ marginVertical: 20 }} />
            ) : myAssignments.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>You have no assignments this week</Text>
              </View>
            ) : (
              <View style={styles.optionsList}>
                {myAssignments.map((assignment) => (
                  <TouchableOpacity
                    key={assignment.id}
                    style={[
                      styles.optionCard,
                      selectedMyAssignment?.id === assignment.id && styles.selectedCard,
                    ]}
                    onPress={() => setSelectedMyAssignment(assignment)}
                  >
                    <Text style={styles.optionTitle}>
                      {assignment.role?.role_name} - {assignment.shift_period}
                    </Text>
                    <Text style={styles.optionSubtitle}>{formatDate(assignment.shift_date)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 3: Select Target Resident */}
        {selectedMyAssignment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Who do you want to swap with?</Text>
            {targetResidents.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No other residents available</Text>
              </View>
            ) : (
              <View style={styles.optionsList}>
                {targetResidents.map((resident) => (
                  <TouchableOpacity
                    key={resident.id}
                    style={[
                      styles.optionCard,
                      selectedTargetResident?.id === resident.id && styles.selectedCard,
                    ]}
                    onPress={() => setSelectedTargetResident(resident)}
                  >
                    <Text style={styles.optionTitle}>
                      {resident.first_name} {resident.last_name}
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      {resident.pgy} • {resident.specialty || 'Resident'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 4: Reason */}
        {selectedTargetResident && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Reason for Swap *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Explain why you need this swap (e.g., family emergency, conference, vacation)"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!submitting}
            />
          </View>
        )}

        {/* Submit Button */}
        {selectedTargetResident && (
          <View style={styles.submitSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>📋 What happens next:</Text>
              <Text style={styles.infoText}>
                1. Your swap request will be sent to{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {selectedTargetResident.first_name}
                </Text>
                {'\n'}
                2. They can accept or reject your request{'\n'}
                3. If accepted, a chief will review and approve{'\n'}
                4. You'll be notified of the decision
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Send Swap Request</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    borderColor: '#3498db',
    backgroundColor: '#e8f4f8',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitSection: {
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#34495e',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
  },
});
