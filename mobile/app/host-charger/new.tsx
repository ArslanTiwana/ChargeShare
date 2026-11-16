import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCharger, CreateChargerInput } from '../../src/api/chargers';
import { HostStatusGate } from '../../src/components/HostStatusGate';
import { ChargerForm, ChargerFormData } from '../../src/components/ChargerForm';
import { colors } from '../../src/theme';

export default function NewChargerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: ChargerFormData) => createCharger(data as CreateChargerInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-chargers'] });
      queryClient.invalidateQueries({ queryKey: ['host-chargers-full'] });
      Alert.alert(
        'Charger Submitted',
        'Your charger has been submitted for administrative review. Once approved, you can turn it online to accept bookings!',
        [{ text: 'OK', onPress: () => router.replace('/host-chargers') }]
      );
    },
  });

  return (
    <HostStatusGate>
      <View style={styles.container}>
        <ChargerForm
          onSubmit={async (data: ChargerFormData) => {
            await createMutation.mutateAsync(data);
          }}
          isSubmitting={createMutation.isPending}
          submitButtonText="Submit Charger for Approval"
        />
      </View>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
