import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useUIStore, showToast, showConfirm } from '../src/store/ui-store';
import { ToastBanner } from '../src/components/ToastBanner';
import { GlobalConfirmModal } from '../src/components/GlobalConfirmModal';

describe('UI Store & Theme Toast / Confirmation Modals', () => {
  beforeEach(async () => {
    await act(async () => {
      useUIStore.getState().hideToast();
      useUIStore.getState().hideConfirm();
    });
  });

  afterEach(async () => {
    await act(async () => {
      useUIStore.getState().hideToast();
      useUIStore.getState().hideConfirm();
    });
  });

  describe('Toast Banner', () => {
    it('renders toast banner when showToast is called', async () => {
      const { queryByText, getByText } = await render(<ToastBanner />);
      expect(queryByText('Host address copied.')).toBeNull();

      await act(async () => {
        showToast({ message: 'Host address copied.', type: 'success' });
      });

      expect(getByText('Host address copied.')).toBeTruthy();
      expect(getByText('✓')).toBeTruthy();
    });

    it('dismisses toast when tapped', async () => {
      const { queryByText, getByText, getByRole } = await render(<ToastBanner />);

      await act(async () => {
        showToast('Operation successful', 'success');
      });

      expect(getByText('Operation successful')).toBeTruthy();

      const toastCard = getByRole('alert');
      await act(async () => {
        fireEvent.press(toastCard);
      });

      expect(queryByText('Operation successful')).toBeNull();
    });
  });

  describe('Global Confirm Modal', () => {
    it('renders theme-styled confirmation modal and handles confirm', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const { queryByText, getByText } = await render(<GlobalConfirmModal />);
      expect(queryByText('Confirm Meter Reading')).toBeNull();

      await act(async () => {
        showConfirm({
          title: 'Confirm Meter Reading',
          message: 'Confirm charging session of 15 kWh for Rs 525?',
          icon: '⚡',
          confirmText: 'Confirm & Complete',
          onConfirm,
          onCancel,
        });
      });

      expect(getByText('Confirm Meter Reading')).toBeTruthy();
      expect(getByText('Confirm charging session of 15 kWh for Rs 525?')).toBeTruthy();
      expect(getByText('⚡')).toBeTruthy();

      // Tap Confirm
      await act(async () => {
        fireEvent.press(getByText('Confirm & Complete'));
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);

      expect(queryByText('Confirm Meter Reading')).toBeNull();
    });

    it('renders danger variant with warning icon and handles cancel', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      const { queryByText, getByText, getAllByText } = await render(<GlobalConfirmModal />);

      await act(async () => {
        showConfirm({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out?',
          icon: '🚪',
          variant: 'danger',
          confirmText: 'Sign Out',
          cancelText: 'Cancel',
          onConfirm,
          onCancel,
        });
      });

      expect(getAllByText('Sign Out')).toHaveLength(2);
      expect(getByText('Are you sure you want to sign out?')).toBeTruthy();
      expect(getByText('🚪')).toBeTruthy();

      // Tap Cancel
      await act(async () => {
        fireEvent.press(getByText('Cancel'));
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();

      expect(queryByText('Sign Out')).toBeNull();
    });
  });
});
