import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { createAnnouncement } from '../services/announcementApi';

export default function CreateAnnouncementScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert('Error', 'Title must be at least 3 characters long');
      return;
    }

    if (title.trim().length > 200) {
      Alert.alert('Error', 'Title must be less than 200 characters');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter announcement content');
      return;
    }

    if (content.trim().length < 10) {
      Alert.alert('Error', 'Content must be at least 10 characters long');
      return;
    }

    if (content.trim().length > 5000) {
      Alert.alert('Error', 'Content must be less than 5000 characters');
      return;
    }

    try {
      setLoading(true);
      await createAnnouncement(title.trim(), content.trim());

      Alert.alert(
        'Success',
        'Announcement posted successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create announcement. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (title.trim() || content.trim()) {
      Alert.alert(
        'Discard Announcement?',
        'Are you sure you want to discard this announcement?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter announcement title"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            editable={!loading}
          />
          <Text style={styles.charCount}>
            {title.length}/200
          </Text>

          <Text style={styles.label}>Content *</Text>
          <TextInput
            style={styles.contentInput}
            placeholder="Enter announcement details..."
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
            maxLength={5000}
            textAlignVertical="top"
            editable={!loading}
          />
          <Text style={styles.charCount}>
            {content.length}/5000
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Post Announcement</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 16,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#2c3e50',
  },
  contentInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 200,
    color: '#2c3e50',
  },
  charCount: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  cancelButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3498db',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
