import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import {
  getScheduleWeekById,
  getScheduleRoles,
  getScheduleAssignments,
  getProgramMembers,
  createScheduleAssignment,
  addResidentToAssignment,
  removeResidentFromAssignment,
  seedDefaultScheduleRoles,
} from '../services/api';
import { ScheduleWeek, ScheduleRole, ScheduleAssignment, Profile, ShiftPeriod } from '../types';

export default function EditScheduleScreen({ route, navigation }: any) {
  const { weekId } = route.params;
  const { profile } = useAuth();
  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [roles, setRoles] = useState<ScheduleRole[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [residents, setResidents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    roleId: string;
    date: string;
    shiftPeriod: ShiftPeriod;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [weekId]);

  const loadData = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const [weekData, rolesData, assignmentsData, residentsData] = await Promise.all([
        getScheduleWeekById(weekId),
        getScheduleRoles(profile.program_id),
        getScheduleAssignments(weekId),
        getProgramMembers(profile.program_id),
      ]);

      // If no roles exist, seed default roles
      if (!rolesData || rolesData.length === 0) {
        await seedDefaultScheduleRoles(profile.program_id);
        const newRoles = await getScheduleRoles(profile.program_id);
        setRoles(newRoles);
      } else {
        setRoles(rolesData);
      }

      setWeek(weekData);
      setAssignments(assignmentsData);
      setResidents(
        residentsData.filter(
          (r) =>
            (r.role === 'resident' || r.role === 'chief_resident') &&
            r.pgy !== 'ALUMNI'
        )
      );
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const getDatesInRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const getAssignment = (roleId: string, date: string, shiftPeriod: ShiftPeriod) => {
    return assignments.find(
      (a) => a.role_id === roleId && a.shift_date === date && a.shift_period === shiftPeriod
    );
  };

  const handleCellPress = (roleId: string, date: string, shiftPeriod: ShiftPeriod) => {
    setSelectedCell({ roleId, date, shiftPeriod });
    setModalVisible(true);
  };

  const handleResidentToggle = async (residentId: string, isBackup: boolean) => {
    if (!selectedCell) return;

    try {
      let assignment = getAssignment(selectedCell.roleId, selectedCell.date, selectedCell.shiftPeriod);

      // Create assignment if it doesn't exist
      if (!assignment) {
        assignment = await createScheduleAssignment({
          schedule_week_id: weekId,
          role_id: selectedCell.roleId,
          shift_date: selectedCell.date,
          shift_period: selectedCell.shiftPeriod,
        });
      }

      // Check if resident is already assigned
      const existingAssignment = assignment.residents?.find((r) => r.resident_id === residentId);

      if (existingAssignment) {
        // Remove resident
        await removeResidentFromAssignment(existingAssignment.id);
      } else {
        // Add resident
        await addResidentToAssignment(assignment.id, residentId, isBackup);
      }

      // Reload assignments
      const updatedAssignments = await getScheduleAssignments(weekId);
      setAssignments(updatedAssignments);
    } catch (error: any) {
      console.error('Error toggling resident:', error);
      showAlert('Error', 'Failed to update assignment');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${dayName} ${month}/${day}`;
  };

  const renderCell = (roleId: string, date: string, shiftPeriod: ShiftPeriod) => {
    const assignment = getAssignment(roleId, date, shiftPeriod);
    const primaryResidents = assignment?.residents?.filter((r) => !r.is_backup) || [];
    const backupResidents = assignment?.residents?.filter((r) => r.is_backup) || [];

    return (
      <TouchableOpacity
        key={`${roleId}-${date}-${shiftPeriod}`}
        style={[styles.cell, shiftPeriod === 'night' && styles.nightCell]}
        onPress={() => handleCellPress(roleId, date, shiftPeriod)}
      >
        {primaryResidents.length === 0 && backupResidents.length === 0 ? (
          <Text style={styles.emptyCell}>—</Text>
        ) : (
          <View>
            {primaryResidents.map((ar) => (
              <Text key={ar.id} style={styles.residentName}>
                {ar.resident?.first_name?.[0]}.{ar.resident?.last_name}
              </Text>
            ))}
            {backupResidents.map((ar) => (
              <Text key={ar.id} style={styles.backupName}>
                {ar.resident?.first_name?.[0]}.{ar.resident?.last_name} (B)
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderResidentModal = () => {
    if (!selectedCell) return null;

    const assignment = getAssignment(selectedCell.roleId, selectedCell.date, selectedCell.shiftPeriod);
    const assignedResidentIds = assignment?.residents?.map((r) => r.resident_id) || [];
    const assignedBackupIds = assignment?.residents?.filter((r) => r.is_backup).map((r) => r.resident_id) || [];

    return (
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Residents</Text>
            <Text style={styles.modalSubtitle}>
              {roles.find((r) => r.id === selectedCell.roleId)?.role_name} -{' '}
              {formatDate(selectedCell.date)} - {selectedCell.shiftPeriod}
            </Text>

            <ScrollView style={styles.residentList}>
              <Text style={styles.sectionTitle}>Primary</Text>
              {residents.map((resident) => (
                <TouchableOpacity
                  key={`primary-${resident.id}`}
                  style={styles.residentItem}
                  onPress={() => handleResidentToggle(resident.id, false)}
                >
                  <Text style={styles.residentItemText}>
                    {resident.first_name} {resident.last_name}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      assignedResidentIds.includes(resident.id) && !assignedBackupIds.includes(resident.id) && styles.checkboxChecked,
                    ]}
                  >
                    {assignedResidentIds.includes(resident.id) && !assignedBackupIds.includes(resident.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Backup</Text>
              {residents.map((resident) => (
                <TouchableOpacity
                  key={`backup-${resident.id}`}
                  style={styles.residentItem}
                  onPress={() => handleResidentToggle(resident.id, true)}
                >
                  <Text style={styles.residentItemText}>
                    {resident.first_name} {resident.last_name}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      assignedBackupIds.includes(resident.id) && styles.checkboxChecked,
                    ]}
                  >
                    {assignedBackupIds.includes(resident.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  const dates = getDatesInRange(week.start_date, week.end_date);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{week.week_name}</Text>
        <Text style={styles.headerSubtitle}>Tap any cell to assign residents</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.roleHeaderCell}>
              <Text style={styles.headerText}>Role / Shift</Text>
            </View>
            {dates.map((date) => (
              <View key={date} style={styles.dateHeaderCell}>
                <Text style={styles.headerText}>{formatDate(date)}</Text>
              </View>
            ))}
          </View>

          {/* Rows */}
          <ScrollView showsVerticalScrollIndicator={true}>
            {roles.map((role) => (
              <View key={role.id}>
                {/* Day shift row */}
                <View style={styles.row}>
                  <View style={styles.roleCell}>
                    <Text style={styles.roleName}>{role.role_name}</Text>
                    <Text style={styles.shiftLabel}>Day</Text>
                  </View>
                  {dates.map((date) => renderCell(role.id, date, 'day'))}
                </View>

                {/* Night shift row */}
                <View style={styles.row}>
                  <View style={styles.roleCell}>
                    <Text style={styles.roleName}>{role.role_name}</Text>
                    <Text style={styles.shiftLabel}>Night</Text>
                  </View>
                  {dates.map((date) => renderCell(role.id, date, 'night'))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Done Editing</Text>
        </TouchableOpacity>
      </View>

      {renderResidentModal()}
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
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
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
  dateHeaderCell: {
    width: 100,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  row: {
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
  },
  cell: {
    width: 100,
    minHeight: 60,
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
    fontSize: 10,
    color: '#2c3e50',
    marginBottom: 2,
  },
  backupName: {
    fontSize: 9,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  doneButton: {
    backgroundColor: '#27ae60',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  residentList: {
    maxHeight: 400,
  },
  residentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  residentItemText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#bdc3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#3498db',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
