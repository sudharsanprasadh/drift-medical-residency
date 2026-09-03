import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

export default function FloatingFeedbackButton() {
  const { user, profile } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const lastOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const BUTTON_SIZE = 56;
  const MARGIN = 10;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = false;
      },
      onPanResponderMove: (_, gesture) => {
        isDragging.current = true;
        const { width, height } = Dimensions.get('window');
        const newX = Math.max(
          -(width - BUTTON_SIZE - MARGIN * 2),
          Math.min(0, lastOffset.current.x + gesture.dx)
        );
        const newY = Math.max(
          -(height - BUTTON_SIZE - MARGIN * 2 - 100),
          Math.min(0, lastOffset.current.y + gesture.dy)
        );
        pan.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gesture) => {
        const { width } = Dimensions.get('window');
        const currentX = lastOffset.current.x + gesture.dx;
        const centerX = -(width - BUTTON_SIZE - MARGIN * 2) / 2;
        const snapX = currentX < centerX ? -(width - BUTTON_SIZE - MARGIN * 2) : 0;
        const newY = lastOffset.current.y + gesture.dy;

        lastOffset.current = { x: snapX, y: newY };
        Animated.spring(pan, {
          toValue: { x: snapX, y: newY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  // Don't show if user not logged in
  if (!user || !profile) {
    return null;
  }

  const showAlert = (alertTitle: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      alert(`${alertTitle}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(alertTitle, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert('Required', 'Please enter a title');
      return;
    }

    if (!description.trim()) {
      showAlert('Required', 'Please enter a description');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        program_id: profile.program_id,
        title: title.trim(),
        description: description.trim(),
        name: name.trim() || null,
      });

      if (error) throw error;

      showAlert('Success', 'Thank you for your feedback!', () => {
        setModalVisible(false);
        setTitle('');
        setDescription('');
        setName('');
      });
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      showAlert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setModalVisible(false);
    setTitle('');
    setDescription('');
    setName('');
  };

  return (
    <>
      {/* Floating Draggable Button */}
      <Animated.View
        style={[
          styles.floatingButton,
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => {
            if (!isDragging.current) setModalVisible(true);
          }}
          activeOpacity={0.8}
          style={styles.buttonTouchable}
        >
          <Text style={styles.buttonIcon}>💬</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Feedback Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Feedback</Text>
              <TouchableOpacity onPress={handleClose} disabled={submitting}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.subtitle}>
                Help us improve! Share bugs, feature requests, or general feedback.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Title <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Brief summary of your feedback"
                  value={title}
                  onChangeText={setTitle}
                  editable={!submitting}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Description <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Provide details about your feedback..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!submitting}
                  maxLength={1000}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name (optional)"
                  value={name}
                  onChangeText={setName}
                  editable={!submitting}
                  maxLength={100}
                />
                <Text style={styles.helperText}>
                  Leave blank to submit anonymously
                </Text>
              </View>
            </ScrollView>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  buttonTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 24,
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
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
  },
  closeIcon: {
    fontSize: 24,
    color: '#7f8c8d',
    paddingHorizontal: 8,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#2c3e50',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 6,
  },
  buttonGroup: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontSize: 15,
  },
});
