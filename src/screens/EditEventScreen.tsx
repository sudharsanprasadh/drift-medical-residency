import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { updateEvent } from '../services/eventApi';
import { Event, EventType } from '../types';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'conference', label: 'Conference' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'social', label: 'Social Event' },
  { value: 'educational', label: 'Educational' },
  { value: 'grand_rounds', label: 'Grand Rounds' },
  { value: 'morning_report', label: 'Morning Report' },
  { value: 'other', label: 'Other' },
];

export default function EditEventScreen({ route, navigation }: any) {
  const { event } = route.params as { event: Event };
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [eventType, setEventType] = useState<EventType>(event.event_type);
  const [eventDate, setEventDate] = useState(event.event_date);
  const [eventTime, setEventTime] = useState(event.event_time.substring(0, 5));
  const [durationMinutes, setDurationMinutes] = useState(event.duration_minutes || 60);
  const [venue, setVenue] = useState(event.venue);
  const [contactInfo, setContactInfo] = useState(event.contact_info || '');
  const [notes, setNotes] = useState(event.notes || '');
  const [isPublished, setIsPublished] = useState(event.is_published);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlertMsg('Please enter event title');
      return;
    }
    if (title.length < 3 || title.length > 200) {
      showAlertMsg('Title must be 3-200 characters');
      return;
    }
    if (!eventDate) {
      showAlertMsg('Please enter event date');
      return;
    }
    if (!eventTime) {
      showAlertMsg('Please enter event time');
      return;
    }
    if (!venue.trim()) {
      showAlertMsg('Please enter venue');
      return;
    }
    if (venue.length < 2 || venue.length > 200) {
      showAlertMsg('Venue must be 2-200 characters');
      return;
    }

    setLoading(true);
    try {
      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        event_date: eventDate,
        event_time: eventTime + ':00',
        duration_minutes: durationMinutes,
        venue: venue.trim(),
        contact_info: contactInfo.trim() || null,
        notes: notes.trim() || null,
        is_published: isPublished,
      });

      showAlertMsg('Event updated successfully', () => {
        navigation.navigate('EventsList', { refresh: Date.now() });
      });
    } catch (error: any) {
      showAlertMsg(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showAlertMsg = (message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(message);
      onOk?.();
    } else {
      Alert.alert('', message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Select Date';
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeForDisplay = (timeString: string): string => {
    if (!timeString) return 'Select Time';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const generateDateOptions = () => {
    const options: { label: string; value: string }[] = [];
    const today = new Date();
    today.setDate(today.getDate() - 30);

    for (let i = 0; i < 180; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const value = `${year}-${month}-${day}`;

      const label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      options.push({ label, value });
    }

    return options;
  };

  const generateTimeOptions = () => {
    const options: { label: string; value: string }[] = [];

    for (let hour = 6; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        const value = `${hourStr}:${minuteStr}`;

        const displayHour = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const label = `${displayHour}:${minuteStr} ${ampm}`;

        options.push({ label, value });
      }
    }

    return options;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Event</Text>

      <Text style={styles.label}>
        Title <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Event title"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        editable={!loading}
      />

      <Text style={styles.label}>
        Event Type <Text style={styles.required}>*</Text>
      </Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowTypeModal(true)}
        disabled={loading}
      >
        <Text style={styles.inputText}>
          {EVENT_TYPES.find((t) => t.value === eventType)?.label}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>
        Date <Text style={styles.required}>*</Text>
      </Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
        disabled={loading}
      >
        <Text style={[styles.inputText, !eventDate && styles.placeholder]}>
          {formatDateForDisplay(eventDate)}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>
        Time <Text style={styles.required}>*</Text>
      </Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowTimePicker(true)}
        disabled={loading}
      >
        <Text style={[styles.inputText, !eventTime && styles.placeholder]}>
          {formatTimeForDisplay(eventTime)}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Duration</Text>
      <View style={styles.durationRow}>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => setDurationMinutes(Math.max(15, durationMinutes - 15))}
          disabled={loading || durationMinutes <= 15}
        >
          <Text style={styles.durationButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.durationValue}>
          {durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ''}`
            : `${durationMinutes}m`}
        </Text>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => setDurationMinutes(Math.min(480, durationMinutes + 15))}
          disabled={loading || durationMinutes >= 480}
        >
          <Text style={styles.durationButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.durationPresets}>
        {[30, 60, 90, 120].map((mins) => (
          <TouchableOpacity
            key={mins}
            style={[styles.presetButton, durationMinutes === mins && styles.presetButtonActive]}
            onPress={() => setDurationMinutes(mins)}
            disabled={loading}
          >
            <Text style={[styles.presetButtonText, durationMinutes === mins && styles.presetButtonTextActive]}>
              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>
        Venue <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Event location"
        value={venue}
        onChangeText={setVenue}
        maxLength={200}
        editable={!loading}
      />

      <Text style={styles.label}>Contact Information</Text>
      <TextInput
        style={styles.input}
        placeholder="Contact person or phone number"
        value={contactInfo}
        onChangeText={setContactInfo}
        maxLength={200}
        editable={!loading}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Event description"
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!loading}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Additional notes"
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!loading}
      />

      <View style={styles.publishRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setIsPublished(!isPublished)}
          disabled={loading}
        >
          <View style={[styles.checkboxBox, isPublished && styles.checkboxChecked]}>
            {isPublished && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Published</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <Modal visible={showTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Event Type</Text>
            <FlatList
              data={EVENT_TYPES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setEventType(item.value);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {eventType === item.value && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTypeModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <FlatList
              data={generateDateOptions()}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setEventDate(item.value);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {eventDate === item.value && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <FlatList
              data={generateTimeOptions()}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setEventTime(item.value);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {eventTime === item.value && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 12,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#2c3e50',
  },
  inputText: {
    fontSize: 15,
    color: '#2c3e50',
  },
  placeholder: {
    color: '#95a5a6',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  durationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 26,
  },
  durationValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    minWidth: 80,
    textAlign: 'center',
  },
  durationPresets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  presetButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  presetButtonTextActive: {
    color: '#fff',
  },
  publishRow: {
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#2c3e50',
  },
  submitButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  cancelButtonText: {
    color: '#7f8c8d',
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
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  modalCheckmark: {
    color: '#3498db',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
