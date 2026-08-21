import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../services/AuthContext';
import { createScheduleWeek } from '../services/api';

export default function CreateWeekScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [weekName, setWeekName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const validateDates = () => {
    if (!startDate || !endDate) {
      showAlert('Error', 'Please enter both start and end dates');
      return false;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      showAlert('Error', 'Please use date format YYYY-MM-DD (e.g., 2024-07-01)');
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      showAlert('Error', 'Invalid date format');
      return false;
    }

    if (end < start) {
      showAlert('Error', 'End date must be on or after start date');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!weekName.trim()) {
      showAlert('Error', 'Please enter a week name');
      return;
    }

    if (!validateDates()) {
      return;
    }

    if (!profile?.program_id) {
      showAlert('Error', 'Program not found');
      return;
    }

    setLoading(true);
    try {
      const newWeek = await createScheduleWeek({
        program_id: profile.program_id,
        week_name: weekName.trim(),
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || undefined,
        created_by: user.id,
      });

      showAlert('Success', 'Weekly schedule created successfully', () => {
        navigation.replace('EditSchedule', { weekId: newWeek.id });
      });
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      showAlert('Error', error.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const suggestWeekName = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setWeekName(`Week of ${startStr} - ${endStr}`);
    }
  };

  const formatDateToString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setDefaultDates = () => {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    setStartDate(formatDateToString(nextMonday));
    setEndDate(formatDateToString(nextSunday));
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      setStartDate(formatDateToString(selectedDate));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      setEndDate(formatDateToString(selectedDate));
    }
  };

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>Create Weekly Schedule</Text>
        <Text style={styles.subtitle}>
          Set up a new weekly schedule for your residency program
        </Text>

        <View style={styles.form}>
          {/* Week Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Week Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Week of July 1-7, 2024"
              value={weekName}
              onChangeText={setWeekName}
              editable={!loading}
            />
            <TouchableOpacity onPress={suggestWeekName} disabled={loading}>
              <Text style={styles.helperLink}>Auto-generate from dates</Text>
            </TouchableOpacity>
          </View>

          {/* Start Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
              disabled={loading}
            >
              <Text style={startDate ? styles.dateText : styles.datePlaceholder}>
                {startDate || 'Select start date'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={parseDate(startDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleStartDateChange}
                maximumDate={endDate ? parseDate(endDate) : undefined}
              />
            )}
            {Platform.OS === 'ios' && showStartPicker && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowStartPicker(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* End Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
              disabled={loading}
            >
              <Text style={endDate ? styles.dateText : styles.datePlaceholder}>
                {endDate || 'Select end date'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={parseDate(endDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleEndDateChange}
                minimumDate={startDate ? parseDate(startDate) : undefined}
              />
            )}
            {Platform.OS === 'ios' && showEndPicker && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowEndPicker(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={setDefaultDates} disabled={loading}>
              <Text style={styles.helperLink}>Set to next Mon-Sun</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add any notes or special instructions for this week"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!loading}
            />
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 What happens next?</Text>
            <Text style={styles.infoText}>
              1. This creates a draft schedule{'\n'}
              2. You'll be taken to the editor to assign residents{'\n'}
              3. Once complete, publish it to make it visible to residents
            </Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create & Edit Schedule</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
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
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  helperText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
  },
  helperLink: {
    fontSize: 12,
    color: '#3498db',
    marginTop: 4,
    textDecorationLine: 'underline',
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
  infoText: {
    fontSize: 13,
    color: '#34495e',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
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
