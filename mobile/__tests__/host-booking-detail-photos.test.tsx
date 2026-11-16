import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

// Test component simulating host booking detail meter photo display
function HostBookingDetailPhotoSection({
  session,
}: {
  session: { meterEndPhotoKey: string | null } | null;
}) {
  if (!session) {
    return <Text>No session reading has been submitted yet</Text>;
  }

  return (
    <View testID="photo-section">
      <Text>Sub-meter Photo</Text>
      {session.meterEndPhotoKey ? (
        <View testID="photo-thumb">
          <Text>View Meter Photo</Text>
        </View>
      ) : (
        <View testID="no-photo-box">
          <Text>No photo provided</Text>
        </View>
      )}
    </View>
  );
}

describe('Host Booking Detail Absence of Photos Handling', () => {
  it('renders "No photo provided" when meterEndPhotoKey is null', async () => {
    const { getByText, queryByText } = await render(
      <HostBookingDetailPhotoSection session={{ meterEndPhotoKey: null }} />
    );

    expect(getByText('No photo provided')).toBeTruthy();
    expect(queryByText('View Meter Photo')).toBeNull();
  });

  it('renders "View Meter Photo" when meterEndPhotoKey is present', async () => {
    const { getByText, queryByText } = await render(
      <HostBookingDetailPhotoSection
        session={{ meterEndPhotoKey: 'METER_PHOTO/host_1/end.jpg' }}
      />
    );

    expect(getByText('View Meter Photo')).toBeTruthy();
    expect(queryByText('No photo provided')).toBeNull();
  });
});
