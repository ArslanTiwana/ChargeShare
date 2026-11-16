import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../app/(tabs)/profile';
import { useAuthStore } from '../src/store/auth-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../src/api/auth', () => ({
  updateProfileApi: jest.fn(),
  resendVerificationApi: jest.fn(),
  applyHostApi: jest.fn(),
}));

jest.mock('../src/api/client', () => ({
  apiFetch: jest.fn(),
}));

describe('ProfileScreen Account Deletion', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'u_del_1',
        email: 'user@example.com',
        name: 'Asad Khan',
        phone: '03009876543',
        role: 'USER',
        hostStatus: 'NONE',
        emailVerifiedAt: '2026-01-01T00:00:00Z',
      } as any,
      activeRole: 'driver',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders Delete Account button and opens confirmation modal on press', async () => {
    const { getByText, queryByText, getByRole } = await render(<ProfileScreen />);

    // Delete Account button exists
    const deleteBtn = getByRole('button', { name: 'Delete Account' });
    expect(deleteBtn).toBeTruthy();

    // Modal warning initially not visible
    expect(queryByText('Delete Account?')).toBeNull();

    // Press Delete Account
    fireEvent.press(deleteBtn);

    // Modal appears with warning and options
    await waitFor(() => {
      expect(getByText('Delete Account?')).toBeTruthy();
      expect(
        getByText(
          'Warning: This action is permanent. Your personal details will be wiped and active sessions terminated.'
        )
      ).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });
  });
});
