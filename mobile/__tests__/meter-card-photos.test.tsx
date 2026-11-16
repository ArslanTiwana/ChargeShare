import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MeterCard } from '../src/components/MeterCard';
import * as bookingsApi from '../src/api/bookings';

describe('MeterCard Absence of Photos Handling', () => {
  const baseSession = {
    id: 's1',
    kwhDelivered: 15.5,
    rateSnapshotPaisa: 6000,
    totalPaisa: 93000,
    commissionPaisa: 13950,
    hostEnteredAt: '2026-11-16T10:00:00Z',
  };

  it('renders "No photo provided" when both start and end photo keys are null/undefined', async () => {
    const sessionNoPhotos = {
      ...baseSession,
      meterStartPhotoKey: null,
      meterEndPhotoKey: null,
    };

    const getReadUrlSpy = jest.spyOn(bookingsApi, 'getReadUrl');

    const { getByText, queryByText, getByLabelText } = await render(
      <MeterCard
        session={sessionNoPhotos as any}
        canAct={false}
        onConfirm={jest.fn()}
        onDispute={jest.fn()}
      />
    );

    expect(getByText('No photo provided')).toBeTruthy();
    expect(queryByText('Start Photo')).toBeNull();
    expect(queryByText('End Photo')).toBeNull();

    // Proves it never attempted to request a signed read URL
    expect(getReadUrlSpy).not.toHaveBeenCalled();
  });

  it('renders Meter Photo button when end photo key is present and loads read URL on tap', async () => {
    const sessionWithPhoto = {
      ...baseSession,
      meterStartPhotoKey: null,
      meterEndPhotoKey: 'METER_PHOTO/host1/meter.jpg',
    };

    const getReadUrlSpy = jest
      .spyOn(bookingsApi, 'getReadUrl')
      .mockResolvedValue({ key: 'METER_PHOTO/host1/meter.jpg', readUrl: 'https://storage/meter.jpg', expiresInSeconds: 900 });

    const { getByText, queryByText, getByLabelText } = await render(
      <MeterCard
        session={sessionWithPhoto as any}
        canAct={false}
        onConfirm={jest.fn()}
        onDispute={jest.fn()}
      />
    );

    expect(queryByText('No photo provided')).toBeNull();
    const photoBtn = getByLabelText('View end meter photo');
    expect(photoBtn).toBeTruthy();

    fireEvent.press(photoBtn);
    expect(getReadUrlSpy).toHaveBeenCalledWith('METER_PHOTO/host1/meter.jpg');
  });
});
