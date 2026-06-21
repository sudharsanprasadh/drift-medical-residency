import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native';
import { useAuth } from '../services/AuthContext';
import { completeProfile, getSpecialties, searchPrograms } from '../services/api';
import { Specialty, Program, PGYLevel } from '../types';

export default function CompleteProfileScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'resident' | 'chief_resident' | 'program_coordinator' | 'program_director' | 'faculty'>('resident');

  // PGY dropdown
  const [selectedPGY, setSelectedPGY] = useState<PGYLevel | ''>('');
  const [showPGYModal, setShowPGYModal] = useState(false);

  // Specialty dropdown
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);

  // Program search
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [programQuery, setProgramQuery] = useState('');
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [searchingPrograms, setSearchingPrograms] = useState(false);

  useEffect(() => {
    loadSpecialties();
  }, []);

  useEffect(() => {
    if (programQuery.length >= 2) {
      const delayDebounce = setTimeout(() => {
        handleProgramSearch(programQuery);
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setPrograms([]);
    }
  }, [programQuery]);

  const loadSpecialties = async () => {
    try {
      const data = await getSpecialties();
      setSpecialties(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load specialties');
    } finally {
      setLoadingData(false);
    }
  };

  const handleProgramSearch = async (query: string) => {
    if (!query || query.length < 2) return;
    setSearchingPrograms(true);
    try {
      const results = await searchPrograms(query, 20);
      setPrograms(results);
    } catch (error: any) {
      console.error('Search error:', error);
    } finally {
      setSearchingPrograms(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!firstName || !lastName || !phoneNumber || !selectedSpecialty || !selectedProgram || !selectedPGY) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await completeProfile(user.id, {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        role,
        specialty: selectedSpecialty,
        program_id: selectedProgram.id,
        pgy: selectedPGY as PGYLevel,
      });

      await refreshProfile();

      Alert.alert(
        'Profile Submitted',
        `Your profile has been submitted for approval. ${
          role === 'resident' || role === 'faculty'
            ? 'A Chief Resident, Program Coordinator, or Program Director from your program will review it.'
            : 'An Admin or existing leadership member will review it.'
        }`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Tell us about yourself to get started
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!loading}
            />

            {/* Role Selection */}
            <Text style={styles.label}>Role</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.roleScrollContainer}
              contentContainerStyle={styles.roleContainer}
            >
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'resident' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('resident')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'resident' && styles.roleButtonTextActive,
                  ]}
                >
                  Resident
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'faculty' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('faculty')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'faculty' && styles.roleButtonTextActive,
                  ]}
                >
                  Faculty
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'chief_resident' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('chief_resident')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'chief_resident' && styles.roleButtonTextActive,
                  ]}
                >
                  Chief Resident
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'program_coordinator' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('program_coordinator')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'program_coordinator' && styles.roleButtonTextActive,
                  ]}
                >
                  Program Coordinator
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'program_director' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('program_director')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'program_director' && styles.roleButtonTextActive,
                  ]}
                >
                  Program Director
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* PGY Selection */}
            <Text style={styles.label}>PGY Level</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowPGYModal(true)}
              disabled={loading}
            >
              <Text style={selectedPGY ? styles.inputText : styles.placeholder}>
                {selectedPGY || 'Select PGY Level'}
              </Text>
            </TouchableOpacity>

            {/* Specialty Selection */}
            <Text style={styles.label}>Specialty</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowSpecialtyModal(true)}
              disabled={loading}
            >
              <Text style={selectedSpecialty ? styles.inputText : styles.placeholder}>
                {selectedSpecialty || 'Select Specialty'}
              </Text>
            </TouchableOpacity>

            {/* Program Search */}
            <Text style={styles.label}>Program</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowProgramModal(true)}
              disabled={loading}
            >
              <Text style={selectedProgram ? styles.inputText : styles.placeholder}>
                {selectedProgram
                  ? `${selectedProgram.program_name} - ${selectedProgram.location}`
                  : 'Search and Select Program'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Submit for Approval</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutLink}
              onPress={signOut}
              disabled={loading}
            >
              <Text style={styles.signOutLinkText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* PGY Modal */}
      <Modal
        visible={showPGYModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select PGY Level</Text>
            <FlatList
              data={['PGY0', 'PGY1', 'PGY2', 'PGY3', 'PGY4', 'PGY5', 'PGY6', 'PGY7', 'PGY8', 'ALUMNI'] as PGYLevel[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedPGY(item);
                    setShowPGYModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPGYModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Specialty Modal */}
      <Modal
        visible={showSpecialtyModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Specialty</Text>
            <FlatList
              data={specialties}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSpecialty(item.name);
                    setShowSpecialtyModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSpecialtyModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Program Search Modal */}
      <Modal
        visible={showProgramModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Search Program</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Type to search programs..."
              value={programQuery}
              onChangeText={setProgramQuery}
              autoFocus
            />
            {searchingPrograms && (
              <ActivityIndicator style={styles.searchLoader} color="#3498db" />
            )}
            <FlatList
              data={programs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedProgram(item);
                    setShowProgramModal(false);
                    setProgramQuery('');
                  }}
                >
                  <Text style={styles.modalItemText}>{item.program_name}</Text>
                  <Text style={styles.modalItemSubtext}>
                    {item.specialty} • {item.location}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {programQuery.length < 2
                    ? 'Type at least 2 characters to search'
                    : 'No programs found'}
                </Text>
              }
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowProgramModal(false);
                setProgramQuery('');
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
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
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  placeholder: {
    fontSize: 16,
    color: '#95a5a6',
  },
  roleScrollContainer: {
    marginBottom: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 12,
  },
  roleButton: {
    minWidth: 140,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#3498db',
    backgroundColor: '#3498db',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  searchLoader: {
    marginVertical: 12,
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalItemSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 24,
    fontSize: 14,
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  signOutLink: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  signOutLinkText: {
    fontSize: 15,
    color: '#7f8c8d',
    textDecorationLine: 'underline',
  },
});
