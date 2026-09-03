import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import {
  getScheduleRoles,
  createScheduleRole,
  updateScheduleRole,
  deleteScheduleRole,
} from '../services/api';
import { ScheduleRole } from '../types';
import { formatTimeDisplay, calculateShiftDurationHours, generateShiftTimeOptions } from '../utils/shiftHelpers';

const TIME_OPTIONS = generateShiftTimeOptions();

export default function ManageRolesScreen() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<ScheduleRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<ScheduleRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasDayShift, setHasDayShift] = useState(true);
  const [hasNightShift, setHasNightShift] = useState(true);
  const [dayShiftStart, setDayShiftStart] = useState('07:00');
  const [dayShiftEnd, setDayShiftEnd] = useState('19:00');
  const [nightShiftStart, setNightShiftStart] = useState('19:00');
  const [nightShiftEnd, setNightShiftEnd] = useState('07:00');
  const [timePickerField, setTimePickerField] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const loadRoles = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const data = await getScheduleRoles(profile.program_id);
      setRoles(data);
    } catch (error: any) {
      console.error('Error loading roles:', error);
      showAlert('Error', 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingRole(null);
    setRoleName('');
    setDisplayOrder(String(roles.length));
    setHasDayShift(true);
    setHasNightShift(true);
    setDayShiftStart('07:00');
    setDayShiftEnd('19:00');
    setNightShiftStart('19:00');
    setNightShiftEnd('07:00');
    setModalVisible(true);
  };

  const openEditModal = (role: ScheduleRole) => {
    setEditingRole(role);
    setRoleName(role.role_name);
    setDisplayOrder(String(role.display_order));
    setHasDayShift(role.has_day_shift !== false);
    setHasNightShift(role.has_night_shift !== false);
    setDayShiftStart(role.day_shift_start_time || '07:00');
    setDayShiftEnd(role.day_shift_end_time || '19:00');
    setNightShiftStart(role.night_shift_start_time || '19:00');
    setNightShiftEnd(role.night_shift_end_time || '07:00');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      showAlert('Error', 'Please enter a role name');
      return;
    }

    if (!hasDayShift && !hasNightShift) {
      showAlert('Error', 'Please select at least one shift type (Day or Night)');
      return;
    }

    if (!profile?.program_id) return;

    setSaving(true);
    try {
      const rolePayload = {
        role_name: roleName.trim(),
        display_order: parseInt(displayOrder) || 0,
        has_day_shift: hasDayShift,
        has_night_shift: hasNightShift,
        day_shift_start_time: hasDayShift ? dayShiftStart : null,
        day_shift_end_time: hasDayShift ? dayShiftEnd : null,
        night_shift_start_time: hasNightShift ? nightShiftStart : null,
        night_shift_end_time: hasNightShift ? nightShiftEnd : null,
      };

      if (editingRole) {
        await updateScheduleRole(editingRole.id, rolePayload);
        showAlert('Success', 'Role updated successfully');
      } else {
        await createScheduleRole({
          program_id: profile.program_id,
          ...rolePayload,
        });
        showAlert('Success', 'Role created successfully');
      }
      setModalVisible(false);
      await loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      showAlert('Error', error.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: ScheduleRole) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Delete role "${role.role_name}"? This will also delete all assignments for this role.`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm Delete',
            `Delete role "${role.role_name}"? This will also delete all assignments for this role.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      setLoading(true);
      await deleteScheduleRole(role.id);
      showAlert('Success', 'Role deleted successfully');
      await loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      showAlert('Error', error.message || 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (role: ScheduleRole) => {
    try {
      await updateScheduleRole(role.id, {
        is_active: !role.is_active,
      });
      await loadRoles();
    } catch (error: any) {
      console.error('Error toggling role:', error);
      showAlert('Error', 'Failed to update role status');
    }
  };

  const selectTime = (value: string) => {
    if (!timePickerField) return;
    switch (timePickerField) {
      case 'dayStart': setDayShiftStart(value); break;
      case 'dayEnd': setDayShiftEnd(value); break;
      case 'nightStart': setNightShiftStart(value); break;
      case 'nightEnd': setNightShiftEnd(value); break;
    }
    setTimePickerField(null);
  };

  const renderRole = ({ item }: { item: ScheduleRole }) => (
    <View style={styles.roleCard}>
      <View style={styles.roleHeader}>
        <View style={styles.roleInfo}>
          <Text style={styles.roleName}>{item.role_name}</Text>
          <Text style={styles.roleOrder}>Order: {item.display_order}</Text>
          <View style={styles.shiftBadges}>
            {item.has_day_shift !== false && (
              <View style={styles.shiftBadgeDay}>
                <Text style={styles.shiftBadgeText}>
                  Day {item.day_shift_start_time && item.day_shift_end_time
                    ? `${formatTimeDisplay(item.day_shift_start_time)}-${formatTimeDisplay(item.day_shift_end_time)} (${calculateShiftDurationHours(item.day_shift_start_time, item.day_shift_end_time)}h)`
                    : ''}
                </Text>
              </View>
            )}
            {item.has_night_shift !== false && (
              <View style={styles.shiftBadgeNight}>
                <Text style={styles.shiftBadgeText}>
                  Night {item.night_shift_start_time && item.night_shift_end_time
                    ? `${formatTimeDisplay(item.night_shift_start_time)}-${formatTimeDisplay(item.night_shift_end_time)} (${calculateShiftDurationHours(item.night_shift_start_time, item.night_shift_end_time)}h)`
                    : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.roleActions}>
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: item.is_active ? '#27ae60' : '#95a5a6' }]}
            onPress={() => toggleActive(item)}
          >
            <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTimeSelector = (label: string, value: string, field: string) => (
    <TouchableOpacity
      style={styles.timeSelector}
      onPress={() => setTimePickerField(field)}
      disabled={saving}
    >
      <Text style={styles.timeSelectorLabel}>{label}</Text>
      <Text style={styles.timeSelectorValue}>{formatTimeDisplay(value)}</Text>
    </TouchableOpacity>
  );

  if (loading && roles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading roles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Manage Schedule Roles</Text>
        <Text style={styles.subtitle}>Add or edit roles for your weekly schedule</Text>
      </View>

      {/* Role List */}
      <FlatList
        data={roles}
        renderItem={renderRole}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No roles yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first role</Text>
          </View>
        }
      />

      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingRole ? 'Edit Role' : 'Add New Role'}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Role Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., PICU, NICU, A5 Senior"
                  value={roleName}
                  onChangeText={setRoleName}
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={displayOrder}
                  onChangeText={setDisplayOrder}
                  editable={!saving}
                />
                <Text style={styles.helperText}>Lower numbers appear first in the schedule</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Shift Types</Text>
                <Text style={styles.helperText}>Select which shifts this role uses in the schedule</Text>
                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setHasDayShift(!hasDayShift)}
                    disabled={saving}
                  >
                    <View style={[styles.checkboxBox, hasDayShift && styles.checkboxChecked]}>
                      {hasDayShift && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Day Shift</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setHasNightShift(!hasNightShift)}
                    disabled={saving}
                  >
                    <View style={[styles.checkboxBox, hasNightShift && styles.checkboxChecked]}>
                      {hasNightShift && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Night Shift</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {hasDayShift && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Day Shift Timing</Text>
                  <View style={styles.timeRow}>
                    {renderTimeSelector('Start', dayShiftStart, 'dayStart')}
                    <Text style={styles.timeSeparator}>to</Text>
                    {renderTimeSelector('End', dayShiftEnd, 'dayEnd')}
                  </View>
                  <Text style={styles.durationText}>
                    Duration: {calculateShiftDurationHours(dayShiftStart, dayShiftEnd)} hours
                  </Text>
                </View>
              )}

              {hasNightShift && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Night Shift Timing</Text>
                  <View style={styles.timeRow}>
                    {renderTimeSelector('Start', nightShiftStart, 'nightStart')}
                    <Text style={styles.timeSeparator}>to</Text>
                    {renderTimeSelector('End', nightShiftEnd, 'nightEnd')}
                  </View>
                  <Text style={styles.durationText}>
                    Duration: {calculateShiftDurationHours(nightShiftStart, nightShiftEnd)} hours
                  </Text>
                  {calculateShiftDurationHours(nightShiftStart, nightShiftEnd) > 0 && nightShiftStart > nightShiftEnd && (
                    <Text style={styles.midnightNote}>Crosses midnight (ends next day)</Text>
                  )}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={timePickerField !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerContent}>
            <Text style={styles.timePickerTitle}>Select Time</Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.timeOption}
                  onPress={() => selectTime(item.value)}
                >
                  <Text style={styles.timeOptionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
              style={styles.timeList}
            />
            <TouchableOpacity
              style={styles.timePickerCancel}
              onPress={() => setTimePickerField(null)}
            >
              <Text style={styles.timePickerCancelText}>Cancel</Text>
            </TouchableOpacity>
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
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  listContent: {
    padding: 16,
  },
  roleCard: {
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
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  roleOrder: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  shiftBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  shiftBadgeDay: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shiftBadgeNight: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  roleActions: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  helperText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 10,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#bdc3c7',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  checkboxChecked: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeSelector: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  timeSelectorLabel: {
    fontSize: 11,
    color: '#95a5a6',
    marginBottom: 4,
  },
  timeSelectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  timeSeparator: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  durationText: {
    fontSize: 13,
    color: '#3498db',
    fontWeight: '600',
    marginTop: 6,
  },
  midnightNote: {
    fontSize: 11,
    color: '#f39c12',
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ecf0f1',
  },
  cancelButtonText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timePickerContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    maxHeight: 450,
    overflow: 'hidden',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timeList: {
    maxHeight: 340,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  timePickerCancel: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: '600',
  },
});
