import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/auth-store';
import { colors, radii } from '../theme';

export function RoleSwitcher() {
  const { activeRole, setActiveRole } = useAuthStore();

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel="Role switcher">
      <TouchableOpacity
        style={[styles.segment, activeRole === 'driver' && styles.segmentActive]}
        onPress={() => setActiveRole('driver')}
        accessibilityRole="radio"
        accessibilityState={{ selected: activeRole === 'driver' }}
        accessibilityLabel="Switch to Driver mode"
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentText, activeRole === 'driver' && styles.segmentTextActive]}>
          🚗 Driver
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.segment, activeRole === 'host' && styles.segmentActive]}
        onPress={() => setActiveRole('host')}
        accessibilityRole="radio"
        accessibilityState={{ selected: activeRole === 'host' }}
        accessibilityLabel="Switch to Host mode"
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentText, activeRole === 'host' && styles.segmentTextActive]}>
          ⚡ Host
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignSelf: 'center',
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.emeraldDark,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
  },
  segmentTextActive: {
    color: colors.white,
  },
});
