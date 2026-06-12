import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Announcement } from '../types';
import { deleteAnnouncement } from '../services/announcementApi';

interface AnnouncementCardProps {
  announcement: Announcement;
  currentUserId?: string;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (announcementId: string) => void;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  currentUserId,
  onEdit,
  onDelete
}) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const getAuthorName = (): string => {
    if (announcement.author?.first_name && announcement.author?.last_name) {
      return `${announcement.author.first_name} ${announcement.author.last_name}`;
    }
    return 'Unknown Author';
  };

  const getAuthorRole = (): string => {
    const role = announcement.author?.role;
    if (role === 'chief_resident') {
      return 'Chief Resident';
    } else if (role === 'admin') {
      return 'Program Director';
    }
    return '';
  };

  const isAuthor = currentUserId && announcement.author_id === currentUserId;

  // Debug logging
  console.log('AnnouncementCard debug:', {
    currentUserId,
    author_id: announcement.author_id,
    isAuthor,
    title: announcement.title
  });

  const handleDelete = async () => {
    console.log('Delete button clicked!');

    // Use window.confirm for web, Alert for native
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Announcement',
            'Are you sure you want to delete this announcement? This action cannot be undone.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ]
          );
        });

    if (!confirmed) {
      console.log('Delete cancelled');
      return;
    }

    try {
      console.log('Deleting announcement:', announcement.id);
      await deleteAnnouncement(announcement.id);
      console.log('Delete successful');
      if (onDelete) {
        onDelete(announcement.id);
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'Failed to delete announcement. Please try again.');
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to delete announcement. Please try again.'
        );
      }
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{announcement.title}</Text>
          <View style={styles.metadata}>
            <Text style={styles.author}>
              {getAuthorName()}
              {getAuthorRole() && (
                <Text style={styles.role}> • {getAuthorRole()}</Text>
              )}
            </Text>
            <Text style={styles.date}>{formatDate(announcement.created_at)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.content}>{announcement.content}</Text>

      {/* Edit/Delete buttons for author */}
      {isAuthor && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEdit(announcement)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  role: {
    fontSize: 13,
    color: '#3498db',
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#95a5a6',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: '#34495e',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3498db',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AnnouncementCard;
