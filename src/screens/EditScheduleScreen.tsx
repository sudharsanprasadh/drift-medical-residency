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
  getScheduleWeekById,
  getScheduleRoles,
  getScheduleAssignments,
  getProgramMembers,
  createScheduleAssignment,
  addResidentToAssignment,
  removeResidentFromAssignment,
  seedDefaultScheduleRoles,
  getApprovedGuests,
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

  // Bulk assign state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkSelectedResidents, setBulkSelectedResidents] = useState<Set<string>>(new Set());
  const [bulkSelectedBackups, setBulkSelectedBackups] = useState<Set<string>>(new Set());
  const [bulkShiftPeriod, setBulkShiftPeriod] = useState<ShiftPeriod>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestResidentIds, setGuestResidentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [weekId]);

  useEffect(() => {
    if (!bulkAssigning) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      showAlert('Please Wait', 'Bulk assignment is in progress. Please wait for it to complete.');
    });
    return unsubscribe;
  }, [bulkAssigning, navigation]);

  const loadData = async () => {
    if (!profile?.program_id) return;

    try {
      setLoading(true);
      const [weekData, rolesData, assignmentsData, residentsData, guestsData] = await Promise.all([
        getScheduleWeekById(weekId),
        getScheduleRoles(profile.program_id),
        getScheduleAssignments(weekId),
        getProgramMembers(profile.program_id),
        getApprovedGuests(profile.program_id),
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

      const programResidents = residentsData.filter(
        (r) =>
          (r.role === 'resident' || r.role === 'chief_resident') &&
          r.pgy !== 'ALUMNI'
      );

      const guestIds = new Set<string>();
      const guestProfiles: Profile[] = (guestsData || []).map((g) => {
        guestIds.add(g.resident_id);
        return {
          id: g.resident_id,
          first_name: g.first_name,
          last_name: `${g.last_name} (${g.home_program_name})`,
          email: g.email,
          pgy: g.pgy as any,
          role: 'resident' as const,
          phone_number: null,
          specialty: null,
          program_id: g.home_program_id,
          is_approved: true,
          is_profile_complete: true,
          created_at: '',
          updated_at: '',
        };
      });

      setGuestResidentIds(guestIds);
      setResidents([...programResidents, ...guestProfiles]);
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
    if (bulkMode) {
      toggleCellSelection(roleId, date);
      return;
    }
    setSearchQuery('');
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

  const makeCellKey = (roleId: string, date: string) => `${roleId}::${date}`;

  const parseCellKey = (key: string) => {
    const [roleId, date] = key.split('::');
    return { roleId, date };
  };

  const toggleCellSelection = (roleId: string, date: string) => {
    const key = makeCellKey(roleId, date);
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedCells(new Set());
  };

  const openBulkAssignModal = () => {
    if (selectedCells.size === 0) {
      showAlert('No Cells Selected', 'Tap cells in the grid to select them first.');
      return;
    }
    setSearchQuery('');
    setBulkSelectedResidents(new Set());
    setBulkSelectedBackups(new Set());
    setBulkModalVisible(true);
  };

  const toggleBulkResident = (residentId: string, isBackup: boolean) => {
    if (isBackup) {
      setBulkSelectedBackups((prev) => {
        const next = new Set(prev);
        if (next.has(residentId)) {
          next.delete(residentId);
        } else {
          next.add(residentId);
        }
        return next;
      });
    } else {
      setBulkSelectedResidents((prev) => {
        const next = new Set(prev);
        if (next.has(residentId)) {
          next.delete(residentId);
        } else {
          next.add(residentId);
        }
        return next;
      });
    }
  };

  const performBulkAssign = async () => {
    const allResidents = [
      ...Array.from(bulkSelectedResidents).map((id) => ({ id, isBackup: false })),
      ...Array.from(bulkSelectedBackups).map((id) => ({ id, isBackup: true })),
    ];

    if (allResidents.length === 0) {
      showAlert('No Residents Selected', 'Please select at least one resident to assign.');
      return;
    }

    const cells = Array.from(selectedCells).map(parseCellKey);
    const totalOps = cells.length * allResidents.length;

    setBulkAssigning(true);
    setBulkProgress(0);
    setBulkTotal(totalOps);

    let completed = 0;
    let errors = 0;

    try {
      for (const cell of cells) {
        let assignment = getAssignment(cell.roleId, cell.date, bulkShiftPeriod);

        if (!assignment) {
          assignment = await createScheduleAssignment({
            schedule_week_id: weekId,
            role_id: cell.roleId,
            shift_date: cell.date,
            shift_period: bulkShiftPeriod,
          });
        }

        for (const resident of allResidents) {
          try {
            const alreadyAssigned = assignment.residents?.find(
              (r) => r.resident_id === resident.id && r.is_backup === resident.isBackup
            );
            if (!alreadyAssigned) {
              await addResidentToAssignment(assignment.id, resident.id, resident.isBackup);
            }
          } catch (e) {
            errors++;
            console.error('Error assigning resident:', e);
          }
          completed++;
          setBulkProgress(completed);
        }
      }

      const updatedAssignments = await getScheduleAssignments(weekId);
      setAssignments(updatedAssignments);

      setBulkAssigning(false);
      setBulkModalVisible(false);
      exitBulkMode();

      if (errors > 0) {
        showAlert('Partial Success', `Assigned residents with ${errors} error(s). Some assignments may not have been created.`);
      } else {
        showAlert('Success', `Assigned ${allResidents.length} resident(s) across ${cells.length} cell(s).`);
      }
    } catch (error: any) {
      console.error('Error in bulk assign:', error);
      setBulkAssigning(false);
      const updatedAssignments = await getScheduleAssignments(weekId);
      setAssignments(updatedAssignments);
      showAlert('Error', error.message || 'Failed to complete bulk assignment.');
    }
  };

  const pgyOrder = ['PGY0', 'PGY1', 'PGY2', 'PGY3', 'PGY4', 'PGY5', 'PGY6', 'PGY7', 'PGY8'];

  const residentsByPgy = (() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = query
      ? residents.filter((r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(query) ||
          (r.pgy || '').toLowerCase().includes(query)
        )
      : residents;
    const groups: Record<string, Profile[]> = {};
    for (const r of filtered) {
      const key = r.pgy || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = pgyOrder.indexOf(a);
      const bi = pgyOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  })();

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
    const isSelected = bulkMode && selectedCells.has(makeCellKey(roleId, date));

    return (
      <TouchableOpacity
        key={`${roleId}-${date}-${shiftPeriod}`}
        style={[
          styles.cell,
          shiftPeriod === 'night' && styles.nightCell,
          isSelected && styles.selectedCell,
        ]}
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

            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or PGY level..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView style={styles.residentList} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>Primary</Text>
              {residentsByPgy.map(([pgy, group]) => (
                <View key={`primary-group-${pgy}`}>
                  <Text style={styles.pgyGroupHeader}>{pgy}</Text>
                  {group.map((resident) => (
                    <TouchableOpacity
                      key={`primary-${resident.id}`}
                      style={styles.residentItem}
                      onPress={() => handleResidentToggle(resident.id, false)}
                    >
                      <View style={styles.residentNameRow}>
                        <Text style={styles.residentItemText}>
                          {resident.first_name} {resident.last_name}
                        </Text>
                        <View style={styles.pgyBadge}>
                          <Text style={styles.pgyBadgeText}>{resident.pgy || '?'}</Text>
                        </View>
                        {guestResidentIds.has(resident.id) && (
                          <View style={styles.guestBadge}>
                            <Text style={styles.guestBadgeText}>Guest</Text>
                          </View>
                        )}
                      </View>
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
                </View>
              ))}

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Backup</Text>
              {residentsByPgy.map(([pgy, group]) => (
                <View key={`backup-group-${pgy}`}>
                  <Text style={styles.pgyGroupHeader}>{pgy}</Text>
                  {group.map((resident) => (
                    <TouchableOpacity
                      key={`backup-${resident.id}`}
                      style={styles.residentItem}
                      onPress={() => handleResidentToggle(resident.id, true)}
                    >
                      <View style={styles.residentNameRow}>
                        <Text style={styles.residentItemText}>
                          {resident.first_name} {resident.last_name}
                        </Text>
                        <View style={styles.pgyBadge}>
                          <Text style={styles.pgyBadgeText}>{resident.pgy || '?'}</Text>
                        </View>
                        {guestResidentIds.has(resident.id) && (
                          <View style={styles.guestBadge}>
                            <Text style={styles.guestBadgeText}>Guest</Text>
                          </View>
                        )}
                      </View>
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
                </View>
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
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{week.week_name}</Text>
            <Text style={styles.headerSubtitle}>
              {bulkMode ? 'Tap cells to select, then assign residents' : 'Tap any cell to assign residents'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.bulkToggle, bulkMode && styles.bulkToggleActive]}
            onPress={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          >
            <Text style={[styles.bulkToggleText, bulkMode && styles.bulkToggleTextActive]}>
              {bulkMode ? 'Exit Bulk' : 'Bulk Assign'}
            </Text>
          </TouchableOpacity>
        </View>
        {bulkMode && (
          <View style={styles.bulkShiftRow}>
            <Text style={styles.bulkShiftLabel}>Shift:</Text>
            {(['day', 'night'] as ShiftPeriod[]).map((sp) => (
              <TouchableOpacity
                key={sp}
                style={[styles.bulkShiftOption, bulkShiftPeriod === sp && styles.bulkShiftOptionActive]}
                onPress={() => setBulkShiftPeriod(sp)}
              >
                <Text style={[styles.bulkShiftOptionText, bulkShiftPeriod === sp && styles.bulkShiftOptionTextActive]}>
                  {sp.charAt(0).toUpperCase() + sp.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
                {role.has_day_shift !== false && (
                  <View style={styles.row}>
                    <View style={styles.roleCell}>
                      <Text style={styles.roleName}>{role.role_name}</Text>
                      <Text style={styles.shiftLabel}>Day</Text>
                    </View>
                    {dates.map((date) => renderCell(role.id, date, 'day'))}
                  </View>
                )}

                {role.has_night_shift !== false && (
                  <View style={styles.row}>
                    <View style={styles.roleCell}>
                      <Text style={styles.roleName}>{role.role_name}</Text>
                      <Text style={styles.shiftLabel}>Night</Text>
                    </View>
                    {dates.map((date) => renderCell(role.id, date, 'night'))}
                  </View>
                )}
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

      {/* Bulk mode floating bar */}
      {bulkMode && !bulkModalVisible && (
        <View style={styles.bulkFloatingBar}>
          <Text style={styles.bulkFloatingText}>
            {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected ({bulkShiftPeriod})
          </Text>
          <TouchableOpacity style={styles.bulkAssignButton} onPress={openBulkAssignModal}>
            <Text style={styles.bulkAssignButtonText}>Assign Residents</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk assign modal */}
      <Modal visible={bulkModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {bulkAssigning ? (
              <View style={styles.bulkProgressContainer}>
                <Text style={styles.modalTitle}>Assigning Residents...</Text>
                <Text style={styles.bulkProgressText}>
                  {bulkProgress} of {bulkTotal} assignments completed
                </Text>
                <View style={styles.bulkProgressBar}>
                  <View style={[styles.bulkProgressFill, { width: bulkTotal > 0 ? `${(bulkProgress / bulkTotal) * 100}%` : '0%' }]} />
                </View>
                <Text style={styles.bulkProgressSubtext}>Please wait — do not navigate away</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Bulk Assign Residents</Text>
                <Text style={styles.modalSubtitle}>
                  Assign to {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} ({bulkShiftPeriod} shift)
                </Text>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or PGY level..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <ScrollView style={styles.residentList} keyboardShouldPersistTaps="handled">
                  <Text style={styles.sectionTitle}>Primary</Text>
                  {residentsByPgy.map(([pgy, group]) => (
                    <View key={`bulk-primary-group-${pgy}`}>
                      <Text style={styles.pgyGroupHeader}>{pgy}</Text>
                      {group.map((resident) => (
                        <TouchableOpacity
                          key={`bulk-primary-${resident.id}`}
                          style={styles.residentItem}
                          onPress={() => toggleBulkResident(resident.id, false)}
                        >
                          <View style={styles.residentNameRow}>
                            <Text style={styles.residentItemText}>
                              {resident.first_name} {resident.last_name}
                            </Text>
                            <View style={styles.pgyBadge}>
                              <Text style={styles.pgyBadgeText}>{resident.pgy || '?'}</Text>
                            </View>
                            {guestResidentIds.has(resident.id) && (
                              <View style={styles.guestBadge}>
                                <Text style={styles.guestBadgeText}>Guest</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.checkbox, bulkSelectedResidents.has(resident.id) && styles.checkboxChecked]}>
                            {bulkSelectedResidents.has(resident.id) && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}

                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Backup</Text>
                  {residentsByPgy.map(([pgy, group]) => (
                    <View key={`bulk-backup-group-${pgy}`}>
                      <Text style={styles.pgyGroupHeader}>{pgy}</Text>
                      {group.map((resident) => (
                        <TouchableOpacity
                          key={`bulk-backup-${resident.id}`}
                          style={styles.residentItem}
                          onPress={() => toggleBulkResident(resident.id, true)}
                        >
                          <View style={styles.residentNameRow}>
                            <Text style={styles.residentItemText}>
                              {resident.first_name} {resident.last_name}
                            </Text>
                            <View style={styles.pgyBadge}>
                              <Text style={styles.pgyBadgeText}>{resident.pgy || '?'}</Text>
                            </View>
                            {guestResidentIds.has(resident.id) && (
                              <View style={styles.guestBadge}>
                                <Text style={styles.guestBadgeText}>Guest</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.checkbox, bulkSelectedBackups.has(resident.id) && styles.checkboxChecked]}>
                            {bulkSelectedBackups.has(resident.id) && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.bulkModalButtons}>
                  <TouchableOpacity
                    style={styles.bulkCancelButton}
                    onPress={() => setBulkModalVisible(false)}
                  >
                    <Text style={styles.bulkCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bulkConfirmButton} onPress={performBulkAssign}>
                    <Text style={styles.bulkConfirmButtonText}>Assign to All</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulkToggle: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  bulkToggleActive: {
    backgroundColor: '#3498db',
  },
  bulkToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3498db',
  },
  bulkToggleTextActive: {
    color: '#fff',
  },
  bulkShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  bulkShiftLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
  },
  bulkShiftOption: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#ecf0f1',
  },
  bulkShiftOptionActive: {
    backgroundColor: '#2c3e50',
  },
  bulkShiftOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
  },
  bulkShiftOptionTextActive: {
    color: '#fff',
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
  selectedCell: {
    backgroundColor: '#d4efdf',
    borderWidth: 2,
    borderColor: '#27ae60',
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
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  residentList: {
    maxHeight: 400,
  },
  pgyGroupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7f8c8d',
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#f0f3f5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  residentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  residentItemText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  pgyBadge: {
    backgroundColor: '#eaf2f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#aed6f1',
  },
  pgyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2980b9',
  },
  guestBadge: {
    backgroundColor: '#fef3e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f0c674',
  },
  guestBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d68910',
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
  bulkFloatingBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bulkFloatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  bulkAssignButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  bulkAssignButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkModalButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  bulkCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    alignItems: 'center',
  },
  bulkCancelButtonText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  bulkConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    alignItems: 'center',
  },
  bulkConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bulkProgressContainer: {
    padding: 20,
  },
  bulkProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  bulkProgressBar: {
    height: 10,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    overflow: 'hidden',
  },
  bulkProgressFill: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 5,
  },
  bulkProgressSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
  },
});
