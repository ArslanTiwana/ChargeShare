import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChargerDetail, updateCharger, UpdateChargerInput } from '../../src/api/chargers';
import { HostStatusGate } from '../../src/components/HostStatusGate';
import { ChargerForm, ChargerFormData } from '../../src/components/ChargerForm';
import { ErrorState } from '../../src/components/ErrorState';
import { showToast } from '../../src/store/ui-store';
import { colors } from '../../src/theme';

export default function EditChargerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: charger, isLoading, isError, refetch } = useQuery({
    queryKey: ['charger-detail-edit', id],
    queryFn: () => getChargerDetail(id as string),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ChargerFormData) =>
      updateCharger(id as string, data as UpdateChargerInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-chargers'] });
      queryClient.invalidateQueries({ queryKey: ['host-chargers-full'] });
      queryClient.invalidateQueries({ queryKey: ['charger-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['charger-detail-edit', id] });
      showToast({
        title: 'Charger Updated',
        message: 'Your charger specifications have been saved successfully.',
        type: 'success',
      });
      router.back();
    },
    onError: (err: any) => {
      showToast({
        title: 'Update Failed',
        message: err?.message || 'Could not update charger specifications.',
        type: 'error',
      });
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.emeraldDark} />
      </View>
    );
  }

  if (isError || !charger) {
    return (
      <View style={styles.container}>
        <ErrorState message="Could not load charger details." onRetry={refetch} />
      </View>
    );
  }

  return (
    <HostStatusGate>
      <View style={styles.container}>
        <ChargerForm
          isEditing
          initialValues={{
            title: charger.title,
            powerKw: charger.powerKw,
            connectorType: charger.connectorType,
            pricePerKwhPaisa: charger.pricePerKwhPaisa,
            areaLabel: charger.areaLabel,
            addressLine: charger.addressLine || '',
            notes: charger.notes,
            meterInstalled: charger.meterInstalled,
            lat: charger.publicLat,
            lng: charger.publicLng,
          }}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync(data);
          }}
          isSubmitting={updateMutation.isPending}
          submitButtonText="Save Changes"
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
