import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../services/AuthContext';
import { getScheduleWeekById, getScheduleWeekGrid, publishScheduleWeek, deleteScheduleWeek, duplicateScheduleWeek } from '../services/api';
import { ScheduleWeek, ScheduleGridCell } from '../types';

export default function ScheduleViewScreen({ route, navigation }: any) {
  const { weekId } = route.params;
  const { profile, user } = useAuth();
  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [gridData, setGridData] = useState<ScheduleGridCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [numberOfWeeks, setNumberOfWeeks] = useState('4');
  const [duplicateStartDate, setDuplicateStartDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const isChief = profile?.role === 'chief_resident' ||
    profile?.role === 'program_coordinator' ||
    profile?.role === 'program_director' ||
    profile?.role === 'admin';

  useEffect(() => {
    loadSchedule();
  }, [weekId]);

  useEffect(() => {
    // Set header title
    if (week) {
      navigation.setOptions({ title: week.week_name });
    }
  }, [week, navigation]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const [weekData, gridDataResult] = await Promise.all([
        getScheduleWeekById(weekId),
        getScheduleWeekGrid(weekId),
      ]);
      setWeek(weekData);
      setGridData(gridDataResult);
    } catch (error: any) {
      console.error('Error loading schedule:', error);
      showAlert('Error', 'Failed to load schedule');
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

  const handlePublish = async () => {
    try {
      await publishScheduleWeek(weekId);
      showAlert('Success', 'Schedule published successfully', loadSchedule);
    } catch (error: any) {
      showAlert('Error', 'Failed to publish schedule');
    }
  };

  const handleDelete = () => {
    const isPublished = week.status === 'published';
    const message = isPublished
      ? 'This schedule is PUBLISHED and visible to all residents. Deleting it will remove all assignments and duty hour tracking. Are you sure?'
      : 'Are you sure you want to delete this schedule? This action cannot be undone.';

    if (Platform.OS === 'web') {
      if (confirm(message)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Schedule',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const performDelete = async () => {
    try {
      await deleteScheduleWeek(weekId);
      showAlert('Success', 'Schedule deleted successfully', () => navigation.goBack());
    } catch (error: any) {
      showAlert('Error', 'Failed to delete schedule');
    }
  };

  const handleDuplicate = () => {
    if (!week) return;
    // Set default start date to the week after the current one
    const nextWeekStart = new Date(week.end_date);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    setDuplicateStartDate(formatDateToString(nextWeekStart));
    setDuplicateModalVisible(true);
  };

  const formatDateToString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDuplicateStartDate(formatDateToString(selectedDate));
    }
  };

  const performDuplicate = async () => {
    const weeks = parseInt(numberOfWeeks);
    if (!weeks || weeks < 1 || weeks > 52) {
      showAlert('Error', 'Please enter a valid number of weeks (1-52)');
      return;
    }

    if (!duplicateStartDate) {
      showAlert('Error', 'Please select a start date');
      return;
    }

    if (!user?.id) return;

    setDuplicating(true);
    try {
      const startDate = new Date(duplicateStartDate);
      const createdWeeks = await duplicateScheduleWeek(weekId, weeks, startDate, user.id);

      setDuplicateModalVisible(false);
      showAlert('Success', `Successfully created ${createdWeeks.length} schedule copies!`, () => {
        navigation.goBack();
      });
    } catch (error: any) {
      console.error('Error duplicating schedule:', error);
      showAlert('Error', error.message || 'Failed to duplicate schedule');
    } finally {
      setDuplicating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName}\n${month}/${dayNum}`;
  };

  const renderResidentList = (residents: string[], backupResidents: string[]) => {
    if (!residents.length && !backupResidents.length) {
      return <Text style={styles.emptyCell}>—</Text>;
    }

    return (
      <View>
        {residents.map((name, idx) => (
          <Text key={`resident-${idx}`} style={styles.residentName}>
            {name}
          </Text>
        ))}
        {backupResidents.map((name, idx) => (
          <Text key={`backup-${idx}`} style={styles.backupName}>
            {name} (Backup)
          </Text>
        ))}
      </View>
    );
  };

  const renderGridCell = (cell: ScheduleGridCell, shiftType: 'day' | 'night') => {
    const residents = shiftType === 'day' ? cell.day_residents : cell.night_residents;
    const backupResidents = shiftType === 'day' ? cell.day_backup_residents : cell.night_backup_residents;

    return (
      <View style={[styles.gridCell, shiftType === 'night' && styles.nightCell]}>
        {renderResidentList(residents, backupResidents)}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (!week) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Schedule not found</Text>
      </View>
    );
  }

  // Group grid data by role
  const roleGroups = gridData.reduce((acc, cell) => {
    if (!acc[cell.role_name]) {
      acc[cell.role_name] = [];
    }
    acc[cell.role_name].push(cell);
    return acc;
  }, {} as Record<string, ScheduleGridCell[]>);

  // Get unique dates
  const uniqueDates = Array.from(new Set(gridData.map((c) => c.shift_date))).sort();

  return (
    <View style={styles.container}>
      {/* Header with actions */}
      {isChief && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditSchedule', { weekId })}>
            <Text style={styles.editButtonText}>Edit Schedule</Text>
          </TouchableOpacity>
          {week.status === 'draft' && (
            <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
              <Text style={styles.publishButtonText}>Publish</Text>
            </TouchableOpacity>
          )}
          {week.status === 'published' && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>📢 Published</Text>
            </View>
          )}
          {week.status !== 'archived' && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Duplicate Button */}
      {isChief && (
        <TouchableOpacity style={styles.duplicateButton} onPress={handleDuplicate}>
          <Text style={styles.duplicateButtonText}>📋 Duplicate to Following Weeks</Text>
        </TouchableOpacity>
      )}

      {/* Schedule info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {new Date(week.start_date).toLocaleDateString()} - {new Date(week.end_date).toLocaleDateString()}
        </Text>
        {week.notes && <Text style={styles.notesText}>{week.notes}</Text>}
      </View>

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header row with dates */}
          <View style={styles.headerRow}>
            <View style={styles.roleHeaderCell}>
              <Text style={styles.roleHeaderText}>Role / Shift</Text>
            </View>
            {uniqueDates.map((date) => (
              <View key={date} style={styles.dateHeaderCell}>
                <Text style={styles.dateHeaderText}>{formatDate(date)}</Text>
              </View>
            ))}
          </View>

          {/* Rows for each role */}
          <ScrollView showsVerticalScrollIndicator={true}>
            {Object.entries(roleGroups).map(([roleName, cells]) => (
              <View key={roleName}>
                {/* Day shift row */}
                <View style={styles.gridRow}>
                  <View style={styles.roleCell}>
                    <Text style={styles.roleName}>{roleName}</Text>
                    <Text style={styles.shiftLabel}>Day</Text>
                  </View>
                  {uniqueDates.map((date) => {
                    const cell = cells.find((c) => c.shift_date === date);
                    return (
                      <View key={`${roleName}-day-${date}`}>
                        {cell ? renderGridCell(cell, 'day') : <View style={styles.gridCell}><Text style={styles.emptyCell}>—</Text></View>}
                      </View>
                    );
                  })}
                </View>

                {/* Night shift row */}
                <View style={styles.gridRow}>
                  <View style={styles.roleCell}>
                    <Text style={styles.roleName}>{roleName}</Text>
                    <Text style={styles.shiftLabel}>Night</Text>
                  </View>
                  {uniqueDates.map((date) => {
                    const cell = cells.find((c) => c.shift_date === date);
                    return (
                      <View key={`${roleName}-night-${date}`}>
                        {cell ? renderGridCell(cell, 'night') : <View style={styles.gridCell}><Text style={styles.emptyCell}>—</Text></View>}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Duplicate Modal */}
      <Modal visible={duplicateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Duplicate Schedule</Text>
            <Text style={styles.modalSubtitle}>
              Create copies of this schedule for consecutive weeks
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Number of Weeks *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 4"
                keyboardType="numeric"
                value={numberOfWeeks}
                onChangeText={setNumberOfWeeks}
                editable={!duplicating}
              />
              <View style={styles.presetButtons}>
                {['1', '4', '8', '12'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetButton,
                      numberOfWeeks === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setNumberOfWeeks(preset)}
                    disabled={duplicating}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        numberOfWeeks === preset && styles.presetButtonTextActive,
                      ]}
                    >
                      {preset} {preset === '1' ? 'week' : 'weeks'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                disabled={duplicating}
              >
                <Text style={duplicateStartDate ? styles.dateText : styles.datePlaceholder}>
                  {duplicateStartDate || 'Select start date'}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={parseDate(duplicateStartDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.helperText}>
                Copies will be created starting from this date
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>What will be copied:</Text>
              <Text style={styles.infoText}>
                • All role assignments{'\n'}
                • All resident assignments (primary & backup){'\n'}
                • Shift periods (day/night){'\n'}
                • Notes (with "Duplicated from" prefix)
              </Text>
              <Text style={[styles.infoText, { marginTop: 8 }]}>
                All copies will be created as <Text style={{ fontWeight: 'bold' }}>drafts</Text>.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDuplicateModalVisible(false)}
                disabled={duplicating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, duplicating && styles.saveButtonDisabled]}
                onPress={performDuplicate}
                disabled={duplicating}
              >
                {duplicating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Create Copies</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  publishButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  publishButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusBadge: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  duplicateButton: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498db',
    alignItems: 'center',
  },
  duplicateButtonText: {
    color: '#3498db',
    fontWeight: '600',
    fontSize: 14,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
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
  presetButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#3498db',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2c3e50',
  },
  presetButtonTextActive: {
    color: '#fff',
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#95a5a6',
  },
  calendarIcon: {
    fontSize: 20,
  },
  doneButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
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
  infoBar: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  notesText: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#ecf0f1',
    borderBottomWidth: 2,
    borderBottomColor: '#bdc3c7',
  },
  roleHeaderCell: {
    width: 120,
    padding: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
  },
  roleHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },
  dateHeaderCell: {
    width: 100,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  roleCell: {
    width: 120,
    padding: 8,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  roleName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
  },
  shiftLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    marginTop: 2,
  },
  gridCell: {
    width: 100,
    minHeight: 50,
    padding: 6,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    justifyContent: 'center',
  },
  nightCell: {
    backgroundColor: '#34495e',
  },
  emptyCell: {
    fontSize: 16,
    color: '#bdc3c7',
    textAlign: 'center',
  },
  residentName: {
    fontSize: 11,
    color: '#2c3e50',
    marginBottom: 2,
  },
  backupName: {
    fontSize: 10,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginBottom: 2,
  },
});
