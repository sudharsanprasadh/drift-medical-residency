import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Announcement } from '../types';

interface AnnouncementCardProps {
  announcement: Announcement;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ announcement }) => {
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
});

export default AnnouncementCard;
