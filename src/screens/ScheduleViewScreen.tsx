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
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { getScheduleWeekById, getScheduleWeekGrid, publishScheduleWeek, deleteScheduleWeek } from '../services/api';
import { ScheduleWeek, ScheduleGridCell } from '../types';

export default function ScheduleViewScreen({ route, navigation }: any) {
  const { weekId } = route.params;
  const { profile } = useAuth();
  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [gridData, setGridData] = useState<ScheduleGridCell[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Schedule',
        'Are you sure you want to delete this schedule? This action cannot be undone.',
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
      {isChief && week.status === 'draft' && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditSchedule', { weekId })}>
            <Text style={styles.editButtonText}>Edit Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
            <Text style={styles.publishButtonText}>Publish</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
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
