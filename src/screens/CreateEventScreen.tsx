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
import { createEvent } from '../services/eventApi';
import { EventType, EventVisibility } from '../types';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'conference', label: 'Conference' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'social', label: 'Social Event' },
  { value: 'educational', label: 'Educational' },
  { value: 'grand_rounds', label: 'Grand Rounds' },
  { value: 'morning_report', label: 'Morning Report' },
  { value: 'other', label: 'Other' },
];

export default function CreateEventScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('meeting');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [venue, setVenue] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [contactInfo, setContactInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  // Modals
  const [showTypeModal, setShowTypeModal] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      showAlert('Please enter event title');
      return;
    }
    if (title.length < 3 || title.length > 200) {
      showAlert('Title must be 3-200 characters');
      return;
    }
    if (!eventDate) {
      showAlert('Please enter event date');
      return;
    }
    if (!eventTime) {
      showAlert('Please enter event time');
      return;
    }
    if (!venue.trim()) {
      showAlert('Please enter venue');
      return;
    }
    if (venue.length < 2 || venue.length > 200) {
      showAlert('Venue must be 2-200 characters');
      return;
    }

    setLoading(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        event_date: eventDate,
        event_time: eventTime + ':00', // Add seconds
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        venue: venue.trim(),
        visibility,
        contact_info: contactInfo.trim() || null,
        notes: notes.trim() || null,
        is_published: isPublished,
        program_id: profile!.program_id!,
        creator_id: profile!.id,
      });

      showAlert('Event created successfully', () => {
        navigation.goBack();
      });
    } catch (error: any) {
      showAlert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(message);
      onOk?.();
    } else {
      Alert.alert('', message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Event</Text>

      {/* Title */}
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

      {/* Event Type */}
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

      {/* Date */}
      <Text style={styles.label}>
        Date <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={eventDate}
        onChangeText={setEventDate}
        editable={!loading}
      />

      {/* Time */}
      <Text style={styles.label}>
        Time <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="HH:MM (24-hour format)"
        value={eventTime}
        onChangeText={setEventTime}
        editable={!loading}
      />

      {/* Duration */}
      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput
        style={styles.input}
        placeholder="60"
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        keyboardType="numeric"
        editable={!loading}
      />

      {/* Venue */}
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

      {/* Visibility */}
      <Text style={styles.label}>Visibility</Text>
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[styles.visibilityButton, visibility === 'public' && styles.visibilityActive]}
          onPress={() => setVisibility('public')}
          disabled={loading}
        >
          <Text
            style={[
              styles.visibilityText,
              visibility === 'public' && styles.visibilityTextActive,
            ]}
          >
            Public
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.visibilityButton, visibility === 'private' && styles.visibilityActive]}
          onPress={() => setVisibility('private')}
          disabled={loading}
        >
          <Text
            style={[
              styles.visibilityText,
              visibility === 'private' && styles.visibilityTextActive,
            ]}
          >
            Private
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <Text style={styles.label}>Contact Information</Text>
      <TextInput
        style={styles.input}
        placeholder="Contact person or phone number"
        value={contactInfo}
        onChangeText={setContactInfo}
        maxLength={200}
        editable={!loading}
      />

      {/* Description */}
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

      {/* Notes */}
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

      {/* Publish Status */}
      <View style={styles.publishRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setIsPublished(!isPublished)}
          disabled={loading}
        >
          <View style={[styles.checkboxBox, isPublished && styles.checkboxChecked]}>
            {isPublished && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Publish immediately</Text>
        </TouchableOpacity>
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Create Event</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      {/* Event Type Modal */}
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
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  visibilityActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  visibilityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  visibilityTextActive: {
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
