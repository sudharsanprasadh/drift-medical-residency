import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { getAllSetupCodes, regenerateSetupCode, ProgramSetupCode } from '../services/api';

export default function SetupCodesScreen() {
  const [codes, setCodes] = useState<ProgramSetupCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      const data = await getAllSetupCodes();
      setCodes(data);
    } catch (error: any) {
      showAlert('Error', 'Failed to load setup codes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCodes();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const toggleReveal = (programId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });
  };

  const handleRegenerate = async (programId: string, programName: string) => {
    const message = `Regenerate setup code for "${programName}"? The old code will stop working.`;
    const confirmed = Platform.OS === 'web'
      ? window.confirm(message)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Regenerate Code', message, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Regenerate', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    setRegeneratingId(programId);
    try {
      const newCode = await regenerateSetupCode(programId);
      setCodes((prev) =>
        prev.map((c) => (c.program_id === programId ? { ...c, setup_code: newCode } : c))
      );
      setRevealedIds((prev) => new Set(prev).add(programId));
      showAlert('Success', `New code for ${programName}: ${newCode}`);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to regenerate');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleShare = async (item: ProgramSetupCode) => {
    const message = `Setup Code for ${item.program_name}:\n\n${item.setup_code}\n\nUse this code when registering as a leader in the Drift app to get auto-approved.`;

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(message);
        showAlert('Copied', 'Setup code info copied to clipboard');
      } catch {
        showAlert('Setup Code', message);
      }
    } else {
      try {
        await Share.share({ message });
      } catch {}
    }
  };

  const renderItem = ({ item }: { item: ProgramSetupCode }) => {
    const isRevealed = revealedIds.has(item.program_id);
    const isRegenerating = regeneratingId === item.program_id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.programName}>{item.program_name}</Text>
            <Text style={styles.programMeta}>
              {item.specialty} {item.location ? `• ${item.location}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>Setup Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeValue}>
              {isRevealed ? item.setup_code : '••••••'}
            </Text>
            <TouchableOpacity style={styles.revealButton} onPress={() => toggleReveal(item.program_id)}>
              <Text style={styles.revealButtonText}>{isRevealed ? 'Hide' : 'Reveal'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => handleShare(item)}
          >
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={() => handleRegenerate(item.program_id, item.program_name)}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <ActivityIndicator size="small" color="#e67e22" />
            ) : (
              <Text style={styles.regenerateButtonText}>Regenerate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          Share setup codes with the first leader of each program so they can auto-approve when registering.
        </Text>
      </View>

      <FlatList
        data={codes}
        keyExtractor={(item) => item.program_id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No programs found</Text>
          </View>
        }
      />
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
  },
  infoBanner: {
    backgroundColor: '#eaf2f8',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e6f1',
  },
  infoText: {
    fontSize: 14,
    color: '#2471a3',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  programName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  programMeta: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 2,
  },
  codeSection: {
    backgroundColor: '#fef9e7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f6c00',
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  revealButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f9e79f',
  },
  revealButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7f6c00',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  shareButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3498db',
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  regenerateButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e67e22',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
});
