import React, { useState, useEffect, useRef } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../services/AuthContext';
import { getScheduleWeekById, getScheduleWeekGrid, getScheduleRoles, publishScheduleWeek, deleteScheduleWeek, duplicateScheduleWeek } from '../services/api';
import { ScheduleWeek, ScheduleGridCell, ScheduleRole } from '../types';

export default function ScheduleViewScreen({ route, navigation }: any) {
  const { weekId } = route.params;
  const { profile, user } = useAuth();
  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [gridData, setGridData] = useState<ScheduleGridCell[]>([]);
  const [roles, setRoles] = useState<ScheduleRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [numberOfWeeks, setNumberOfWeeks] = useState('4');
  const [duplicateStartDate, setDuplicateStartDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState(0);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [myScheduleMode, setMyScheduleMode] = useState(false);

  const headerHScrollRef = useRef<ScrollView>(null);
  const dataHScrollRef = useRef<ScrollView>(null);
  const isSyncingHScroll = useRef(false);

  const isChief = profile?.role === 'chief_resident' ||
    profile?.role === 'program_coordinator' ||
    profile?.role === 'program_director' ||
    profile?.role === 'admin';

  useEffect(() => {
    loadSchedule();
  }, [weekId]);

  useEffect(() => {
    if (week) {
      navigation.setOptions({ title: week.week_name });
    }
  }, [week, navigation]);

  useEffect(() => {
    if (!duplicating) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      showAlert('Please Wait', 'Schedule duplication is in progress. Please wait for it to complete.');
    });
    return unsubscribe;
  }, [duplicating, navigation]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const [weekData, gridDataResult, rolesData] = await Promise.all([
        getScheduleWeekById(weekId),
        getScheduleWeekGrid(weekId),
        profile?.program_id ? getScheduleRoles(profile.program_id) : Promise.resolve([]),
      ]);
      setWeek(weekData);
      setGridData(gridDataResult);
      setRoles(rolesData);
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
    const [y, m, d] = week.end_date.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    setDuplicateStartDate(formatDateToString(nextDay));
    setDuplicateModalVisible(true);
  };

  const formatDateToString = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(Date.UTC(y, m - 1, d));
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setDuplicateStartDate(`${year}-${month}-${day}`);
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
    setDuplicateProgress(0);
    setDuplicateTotal(weeks);
    try {
      const startDate = parseLocalDate(duplicateStartDate);
      const createdWeeks = await duplicateScheduleWeek(weekId, weeks, startDate, user.id, (completed, total) => {
        setDuplicateProgress(completed);
        setDuplicateTotal(total);
      });

      setDuplicating(false);
      setDuplicateModalVisible(false);
      showAlert('Success', `Successfully created ${createdWeeks.length} schedule copies!`, () => {
        navigation.goBack();
      });
    } catch (error: any) {
      console.error('Error duplicating schedule:', error);
      setDuplicating(false);
      showAlert('Error', error.message || 'Failed to duplicate schedule. Any partially created weeks have been cleaned up.');
    }
  };

  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName}\n${month}/${dayNum}`;
  };

  const handleHeaderHScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingHScroll.current) return;
    isSyncingHScroll.current = true;
    dataHScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    isSyncingHScroll.current = false;
  };

  const handleDataHScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingHScroll.current) return;
    isSyncingHScroll.current = true;
    headerHScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    isSyncingHScroll.current = false;
  };

  const myName = profile ? `${profile.first_name} ${profile.last_name}` : '';

  const renderResidentList = (residents: string[], backupResidents: string[], isNight: boolean) => {
    if (!residents.length && !backupResidents.length) {
      return <Text style={[styles.emptyCell, isNight && styles.emptyCellNight]}>—</Text>;
    }

    return (
      <View>
        {residents.map((name, idx) => (
          <Text key={`resident-${idx}`} style={[styles.residentName, isNight && styles.residentNameNight]}>
            {name}
          </Text>
        ))}
        {backupResidents.map((name, idx) => (
          <Text key={`backup-${idx}`} style={[styles.backupName, isNight && styles.backupNameNight]}>
            {name} (Backup)
          </Text>
        ))}
      </View>
    );
  };

  const renderGridCell = (cell: ScheduleGridCell, shiftType: 'day' | 'night') => {
    const residents = shiftType === 'day' ? cell.day_residents : cell.night_residents;
    const backupResidents = shiftType === 'day' ? cell.day_backup_residents : cell.night_backup_residents;
    const isNight = shiftType === 'night';

    const isMyShift =
      residents.includes(myName) ||
      backupResidents.includes(myName);

    return (
      <View style={[
        styles.gridCell,
        isNight && styles.nightCell,
        isMyShift && styles.myShiftCell,
        isMyShift && isNight && styles.myShiftCellNight
      ]}>
        {renderResidentList(residents, backupResidents, isNight)}
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

  // Build role shift flags lookup by role_id
  const roleShiftFlags = roles.reduce((acc, role) => {
    acc[role.id] = { hasDayShift: role.has_day_shift !== false, hasNightShift: role.has_night_shift !== false };
    return acc;
  }, {} as Record<string, { hasDayShift: boolean; hasNightShift: boolean }>);

  const hasAnyAssignment = (cells: ScheduleGridCell[], shift: 'day' | 'night') => {
    return cells.some((c) => {
      if (shift === 'day') {
        return c.day_residents.length > 0 || c.day_backup_residents.length > 0 || c.day_night_residents.length > 0 || c.day_night_backup_residents.length > 0;
      }
      return c.night_residents.length > 0 || c.night_backup_residents.length > 0 || c.day_night_residents.length > 0 || c.day_night_backup_residents.length > 0;
    });
  };

  const cellHasMe = (cell: ScheduleGridCell, shift: 'day' | 'night') => {
    if (shift === 'day') {
      return cell.day_residents.includes(myName) || cell.day_backup_residents.includes(myName) ||
        cell.day_night_residents.includes(myName) || cell.day_night_backup_residents.includes(myName);
    }
    return cell.night_residents.includes(myName) || cell.night_backup_residents.includes(myName) ||
      cell.day_night_residents.includes(myName) || cell.day_night_backup_residents.includes(myName);
  };

  const roleHasMe = (cells: ScheduleGridCell[], shift: 'day' | 'night') => {
    return cells.some((c) => cellHasMe(c, shift));
  };

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

      {/* Schedule info + view toggle */}
      <View style={styles.infoBar}>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            {parseLocalDate(week.start_date).toLocaleDateString()} - {parseLocalDate(week.end_date).toLocaleDateString()}
          </Text>
          <TouchableOpacity
            style={[styles.viewToggle, myScheduleMode && styles.viewToggleActive]}
            onPress={() => setMyScheduleMode(!myScheduleMode)}
          >
            <Text style={[styles.viewToggleText, myScheduleMode && styles.viewToggleTextActive]}>
              {myScheduleMode ? 'My Shifts' : 'All Shifts'}
            </Text>
          </TouchableOpacity>
        </View>
        {week.notes && <Text style={styles.notesText}>{week.notes}</Text>}
      </View>

      {/* Grid with sticky header + frozen first column */}
      <View style={styles.gridContainer}>
        {/* Sticky header row */}
        <View style={styles.stickyHeader}>
          <View style={styles.cornerCell}>
            <Text style={styles.roleHeaderText}>Role / Shift</Text>
          </View>
          <ScrollView
            ref={headerHScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleHeaderHScroll}
            scrollEventThrottle={16}
            scrollEnabled={false}
          >
            {uniqueDates.map((date) => (
              <View key={date} style={styles.dateHeaderCell}>
                <Text style={styles.dateHeaderText}>{formatDate(date)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Body: single vertical scroll containing frozen column + data side by side */}
        <ScrollView showsVerticalScrollIndicator={true}>
          <View style={styles.bodyRow}>
            {/* Frozen role/shift column */}
            <View style={styles.frozenColumn}>
              {Object.entries(roleGroups).map(([roleName, cells]) => {
                const roleId = cells[0]?.role_id;
                const flags = roleId ? roleShiftFlags[roleId] : undefined;
                const showDay = (flags ? flags.hasDayShift : true) && hasAnyAssignment(cells, 'day') && (!myScheduleMode || roleHasMe(cells, 'day'));
                const showNight = (flags ? flags.hasNightShift : true) && hasAnyAssignment(cells, 'night') && (!myScheduleMode || roleHasMe(cells, 'night'));
                return (
                  <View key={roleName}>
                    {showDay && (
                      <View style={styles.gridRow}>
                        <View style={styles.roleCell}>
                          <Text style={styles.roleName}>{roleName}</Text>
                          <Text style={styles.shiftLabel}>Day</Text>
                        </View>
                      </View>
                    )}
                    {showNight && (
                      <View style={styles.gridRow}>
                        <View style={styles.roleCell}>
                          <Text style={styles.roleName}>{roleName}</Text>
                          <Text style={styles.shiftLabel}>Night</Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Horizontally scrollable data columns */}
            <ScrollView
              ref={dataHScrollRef}
              horizontal
              showsHorizontalScrollIndicator={true}
              onScroll={handleDataHScroll}
              scrollEventThrottle={16}
            >
              <View>
                {Object.entries(roleGroups).map(([roleName, cells]) => {
                  const roleId = cells[0]?.role_id;
                  const flags = roleId ? roleShiftFlags[roleId] : undefined;
                  const showDay = (flags ? flags.hasDayShift : true) && hasAnyAssignment(cells, 'day') && (!myScheduleMode || roleHasMe(cells, 'day'));
                  const showNight = (flags ? flags.hasNightShift : true) && hasAnyAssignment(cells, 'night') && (!myScheduleMode || roleHasMe(cells, 'night'));
                  return (
                    <View key={roleName}>
                      {showDay && (
                        <View style={styles.gridRow}>
                          {uniqueDates.map((date) => {
                            const cell = cells.find((c) => c.shift_date === date);
                            return (
                              <View key={`${roleName}-day-${date}`}>
                                {cell ? renderGridCell(cell, 'day') : <View style={styles.gridCell}><Text style={styles.emptyCell}>—</Text></View>}
                              </View>
                            );
                          })}
                        </View>
                      )}
                      {showNight && (
                        <View style={styles.gridRow}>
                          {uniqueDates.map((date) => {
                            const cell = cells.find((c) => c.shift_date === date);
                            return (
                              <View key={`${roleName}-night-${date}`}>
                                {cell ? renderGridCell(cell, 'night') : <View style={styles.gridCell}><Text style={styles.emptyCell}>—</Text></View>}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

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
              <View style={styles.dateInputRow}>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  placeholder="YYYY-MM-DD"
                  value={duplicateStartDate}
                  onChangeText={setDuplicateStartDate}
                  editable={!duplicating}
                />
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={() => setShowDatePicker(true)}
                    disabled={duplicating}
                  >
                    <Text style={styles.calendarIconButton}>📅</Text>
                  </TouchableOpacity>
                )}
              </View>
              {Platform.OS !== 'web' && showDatePicker && (
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
                Type date or tap 📅 to pick from calendar
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

            {duplicating ? (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Creating schedule {duplicateProgress} of {duplicateTotal}...
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: duplicateTotal > 0 ? `${(duplicateProgress / duplicateTotal) * 100}%` : '0%' }]} />
                </View>
                <Text style={styles.progressSubtext}>
                  Please wait — do not navigate away
                </Text>
              </View>
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setDuplicateModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={performDuplicate}
                >
                  <Text style={styles.saveButtonText}>Create Copies</Text>
                </TouchableOpacity>
              </View>
            )}
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
  dateInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
  },
  calendarButton: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIconButton: {
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
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 5,
  },
  progressSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
  },
  infoBar: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  viewToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  viewToggleActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
  },
  viewToggleTextActive: {
    color: '#fff',
  },
  notesText: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  gridContainer: {
    flex: 1,
  },
  stickyHeader: {
    flexDirection: 'row',
    backgroundColor: '#ecf0f1',
    borderBottomWidth: 2,
    borderBottomColor: '#bdc3c7',
    zIndex: 2,
  },
  cornerCell: {
    width: 120,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    borderRightWidth: 2,
    borderRightColor: '#bdc3c7',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  frozenColumn: {
    width: 120,
    borderRightWidth: 2,
    borderRightColor: '#bdc3c7',
    backgroundColor: '#fff',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
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
  myShiftCell: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196f3',
  },
  myShiftCellNight: {
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
    borderColor: '#64b5f6',
  },
  emptyCell: {
    fontSize: 16,
    color: '#bdc3c7',
    textAlign: 'center',
  },
  emptyCellNight: {
    color: '#ffffff',
  },
  residentName: {
    fontSize: 11,
    color: '#2c3e50',
    marginBottom: 2,
  },
  residentNameNight: {
    color: '#ffffff',
  },
  backupName: {
    fontSize: 10,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  backupNameNight: {
    color: '#e0e0e0',
  },
});
