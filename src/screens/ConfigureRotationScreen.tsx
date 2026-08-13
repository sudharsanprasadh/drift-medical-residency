import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import {
  getRotationConstraints,
  createRotationConstraint,
  deleteRotationConstraint,
  getProgramMembers,
  getScheduleRoles,
} from '../services/api';
import { ScheduleRotationConstraint, Profile, ScheduleRole, ConstraintType } from '../types';

export default function ConfigureRotationScreen({ route, navigation }: any) {
  const { weekId } = route.params;
  const { profile } = useAuth();
  const [constraints, setConstraints] = useState<ScheduleRotationConstraint[]>([]);
  const [residents, setResidents] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<ScheduleRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedConstraintType, setSelectedConstraintType] = useState<ConstraintType | null>(null);

  // Form state
  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [maxValue, setMaxValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [weekId]);

  const loadData = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const [constraintsData, residentsData, rolesData] = await Promise.all([
        getRotationConstraints(weekId),
        getProgramMembers(profile.program_id),
        getScheduleRoles(profile.program_id),
      ]);

      setConstraints(constraintsData);
      setResidents(residentsData.filter((r) => r.role === 'resident' || r.role === 'chief_resident'));
      setRoles(rolesData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load constraints');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const openAddConstraintModal = (type: ConstraintType) => {
    setSelectedConstraintType(type);
    resetForm();
    setModalVisible(true);
  };

  const resetForm = () => {
    setSelectedResident(null);
    setSelectedRole(null);
    setSelectedPair(null);
    setMaxValue('');
    setStartDate('');
    setEndDate('');
    setNotes('');
  };

  const handleAddConstraint = async () => {
    if (!selectedResident) {
      showAlert('Error', 'Please select a resident');
      return;
    }

    if (!selectedConstraintType) return;

    // Validate based on constraint type
    if (selectedConstraintType === 'excluded_role' && !selectedRole) {
      showAlert('Error', 'Please select a role to exclude');
      return;
    }

    if (selectedConstraintType === 'required_pair' && !selectedPair) {
      showAlert('Error', 'Please select a paired resident');
      return;
    }

    if (selectedConstraintType === 'vacation_block' && (!startDate || !endDate)) {
      showAlert('Error', 'Please enter vacation start and end dates');
      return;
    }

    if (
      (selectedConstraintType === 'max_nights_per_month' ||
        selectedConstraintType === 'max_consecutive_nights') &&
      !maxValue
    ) {
      showAlert('Error', 'Please enter a maximum value');
      return;
    }

    try {
      await createRotationConstraint({
        schedule_week_id: weekId,
        resident_id: selectedResident,
        constraint_type: selectedConstraintType,
        role_id: selectedRole || undefined,
        paired_resident_id: selectedPair || undefined,
        constraint_value: maxValue || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        notes: notes || undefined,
      });

      showAlert('Success', 'Constraint added successfully');
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to add constraint');
    }
  };

  const handleDeleteConstraint = (constraintId: string) => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete this constraint?')) {
        performDelete(constraintId);
      }
    } else {
      Alert.alert('Delete Constraint', 'Are you sure you want to delete this constraint?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => performDelete(constraintId) },
      ]);
    }
  };

  const performDelete = async (constraintId: string) => {
    try {
      await deleteRotationConstraint(constraintId);
      loadData();
    } catch (error: any) {
      showAlert('Error', 'Failed to delete constraint');
    }
  };

  const getConstraintLabel = (constraint: ScheduleRotationConstraint): string => {
    const residentName = `${constraint.resident?.first_name} ${constraint.resident?.last_name}`;

    switch (constraint.constraint_type) {
      case 'excluded_role':
        return `${residentName} cannot work ${constraint.role?.role_name}`;
      case 'required_pair':
        return `${residentName} must work with ${constraint.paired_resident?.first_name} ${constraint.paired_resident?.last_name}`;
      case 'vacation_block':
        return `${residentName} on vacation ${constraint.start_date} to ${constraint.end_date}`;
      case 'max_nights_per_month':
        return `${residentName}: max ${constraint.constraint_value} night shifts/month`;
      case 'max_consecutive_nights':
        return `${residentName}: max ${constraint.constraint_value} consecutive nights`;
      case 'preferred_off_day':
        return `${residentName}: prefers ${constraint.constraint_value} off`;
      case 'min_days_off_per_week':
        return `${residentName}: min ${constraint.constraint_value} days off/week`;
      default:
        return `${residentName}: ${constraint.constraint_type}`;
    }
  };

  const renderConstraintCard = ({ item }: { item: ScheduleRotationConstraint }) => (
    <View style={styles.constraintCard}>
      <View style={styles.constraintContent}>
        <Text style={styles.constraintLabel}>{getConstraintLabel(item)}</Text>
        {item.notes && <Text style={styles.constraintNotes}>{item.notes}</Text>}
      </View>
      <TouchableOpacity onPress={() => handleDeleteConstraint(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddConstraintModal = () => {
    if (!selectedConstraintType) return null;

    return (
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add {selectedConstraintType.replace(/_/g, ' ')}
            </Text>

            <ScrollView style={styles.modalForm}>
              {/* Resident Selection */}
              <Text style={styles.label}>Select Resident *</Text>
              <FlatList
                data={residents}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.chipButton,
                      selectedResident === item.id && styles.chipButtonSelected,
                    ]}
                    onPress={() => setSelectedResident(item.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedResident === item.id && styles.chipTextSelected,
                      ]}
                    >
                      {item.first_name} {item.last_name}
                    </Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                style={styles.chipList}
              />

              {/* Role Selection (for excluded_role) */}
              {selectedConstraintType === 'excluded_role' && (
                <>
                  <Text style={styles.label}>Select Role to Exclude *</Text>
                  <FlatList
                    data={roles}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.chipButton,
                          selectedRole === item.id && styles.chipButtonSelected,
                        ]}
                        onPress={() => setSelectedRole(item.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedRole === item.id && styles.chipTextSelected,
                          ]}
                        >
                          {item.role_name}
                        </Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    style={styles.chipList}
                  />
                </>
              )}

              {/* Paired Resident (for required_pair) */}
              {selectedConstraintType === 'required_pair' && (
                <>
                  <Text style={styles.label}>Select Paired Resident *</Text>
                  <FlatList
                    data={residents.filter((r) => r.id !== selectedResident)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.chipButton,
                          selectedPair === item.id && styles.chipButtonSelected,
                        ]}
                        onPress={() => setSelectedPair(item.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedPair === item.id && styles.chipTextSelected,
                          ]}
                        >
                          {item.first_name} {item.last_name}
                        </Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    style={styles.chipList}
                  />
                </>
              )}

              {/* Max Value (for max_nights_per_month, max_consecutive_nights) */}
              {(selectedConstraintType === 'max_nights_per_month' ||
                selectedConstraintType === 'max_consecutive_nights' ||
                selectedConstraintType === 'min_days_off_per_week') && (
                <>
                  <Text style={styles.label}>Maximum Value *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 8"
                    keyboardType="numeric"
                    value={maxValue}
                    onChangeText={setMaxValue}
                  />
                </>
              )}

              {/* Vacation Dates */}
              {selectedConstraintType === 'vacation_block' && (
                <>
                  <Text style={styles.label}>Start Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                  <Text style={styles.label}>End Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </>
              )}

              {/* Notes */}
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any additional notes"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddConstraint}>
                <Text style={styles.addButtonText}>Add Constraint</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading constraints...</Text>
      </View>
    );
  }

  const constraintTypes: Array<{ type: ConstraintType; label: string; icon: string }> = [
    { type: 'excluded_role', label: 'Exclude from Role', icon: '🚫' },
    { type: 'required_pair', label: 'Required Pairing', icon: '👥' },
    { type: 'vacation_block', label: 'Vacation Block', icon: '🏖️' },
    { type: 'max_nights_per_month', label: 'Max Nights/Month', icon: '🌙' },
    { type: 'max_consecutive_nights', label: 'Max Consecutive Nights', icon: '⏰' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rotation Constraints</Text>
        <Text style={styles.headerSubtitle}>
          Configure exceptions and rules for rotation generation
        </Text>
      </View>

      {/* Add Constraint Buttons */}
      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>Add New Constraint</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {constraintTypes.map((ct) => (
            <TouchableOpacity
              key={ct.type}
              style={styles.addConstraintButton}
              onPress={() => openAddConstraintModal(ct.type)}
            >
              <Text style={styles.addConstraintIcon}>{ct.icon}</Text>
              <Text style={styles.addConstraintLabel}>{ct.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Existing Constraints */}
      <View style={styles.constraintsSection}>
        <Text style={styles.sectionTitle}>
          Current Constraints ({constraints.length})
        </Text>
        {constraints.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No constraints configured</Text>
            <Text style={styles.emptySubtext}>
              Add constraints to customize the rotation generation
            </Text>
          </View>
        ) : (
          <FlatList
            data={constraints}
            renderItem={renderConstraintCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.constraintsList}
          />
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {renderAddConstraintModal()}
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
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 4,
  },
  addSection: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  addConstraintButton: {
    backgroundColor: '#ecf0f1',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  addConstraintIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addConstraintLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2c3e50',
    textAlign: 'center',
  },
  constraintsSection: {
    flex: 1,
    padding: 16,
  },
  constraintsList: {
    paddingBottom: 16,
  },
  constraintCard: {
    flexDirection: 'row',
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
  constraintContent: {
    flex: 1,
  },
  constraintLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  constraintNotes: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  doneButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    paddingHorizontal: 20,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  modalForm: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipList: {
    marginBottom: 8,
  },
  chipButton: {
    backgroundColor: '#ecf0f1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  chipText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
  },
  cancelButtonText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#27ae60',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
