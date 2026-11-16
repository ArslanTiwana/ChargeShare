import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCharger, CreateChargerInput } from '../../src/api/chargers';
import { HostStatusGate } from '../../src/components/HostStatusGate';
import { ChargerForm, ChargerFormData } from '../../src/components/ChargerForm';
import { showToast } from '../../src/store/ui-store';
import { colors } from '../../src/theme';

export default function NewChargerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: ChargerFormData) => createCharger(data as CreateChargerInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-chargers'] });
      queryClient.invalidateQueries({ queryKey: ['host-chargers-full'] });
      showToast({
        title: 'Charger Submitted',
        message: 'Submitted for administrative review. Once approved, you can turn it online!',
        type: 'success',
      });
      router.replace('/host-chargers');
    },
    onError: (err: any) => {
      showToast({
        title: 'Submission Failed',
        message: err?.message || 'Could not submit charger specifications.',
        type: 'error',
      });
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
