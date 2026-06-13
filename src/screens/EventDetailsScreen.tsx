import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { deleteEvent } from '../services/eventApi';
import { Event } from '../types';

export default function EventDetailsScreen({ route, navigation }: any) {
  const { event } = route.params as { event: Event };
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const isCreator = profile?.id === event.creator_id;
  const canManageEvents =
    profile?.is_approved &&
    ['admin', 'program_coordinator', 'chief_resident'].includes(profile.role);

  const canEdit = isCreator || canManageEvents;
  const canDelete = isCreator || canManageEvents;

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatEventTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      conference: 'Conference',
      meeting: 'Meeting',
      social: 'Social',
      educational: 'Educational',
      grand_rounds: 'Grand Rounds',
      morning_report: 'Morning Report',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const handleDelete = async () => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this event?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Event',
            'Are you sure you want to delete this event?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

    if (!confirmDelete) return;

    setDeleting(true);
    try {
      await deleteEvent(event.id);
      if (Platform.OS === 'web') {
        alert('Event deleted successfully');
      } else {
        Alert.alert('Success', 'Event deleted successfully');
      }
      navigation.navigate('EventsList', { refresh: Date.now() });
    } catch (error: any) {
      const message = `Error: ${error.message}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dateBox}>
            <Text style={styles.dateMonth}>
              {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.dateDay}>
              {new Date(event.event_date).getDate()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.eventType}>{getEventTypeLabel(event.event_type)}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatEventDate(event.event_date)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🕐</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>
                {formatEventTime(event.event_time)}
                {event.duration_minutes && ` (${event.duration_minutes} min)`}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📍</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Venue</Text>
              <Text style={styles.detailValue}>{event.venue}</Text>
            </View>
          </View>

          {event.contact_info && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📞</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{event.contact_info}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {/* Notes */}
        {event.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{event.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {(canEdit || canDelete) && (
          <View style={styles.actions}>
            {canEdit && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('EditEvent', { event })}
              >
                <Text style={styles.editButtonText}>Edit Event</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete Event</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateBox: {
    width: 70,
    height: 70,
    backgroundColor: '#3498db',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dateMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dateDay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
  },
  eventType: {
    fontSize: 14,
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },
  notes: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actions: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  editButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
