import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HostStatusGate } from '../src/components/HostStatusGate';
import { useAuthStore } from '../src/store/auth-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('HostStatusGate Role Gating', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      activeRole: 'host',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders children when hostStatus is APPROVED', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'host@test.com',
        name: 'Tariq',
        phone: '03001234567',
        role: 'USER',
        hostStatus: 'APPROVED',
      } as any,
    });

    const { getByText } = await render(
      <HostStatusGate>
        <Text>Protected Host Content</Text>
      </HostStatusGate>
    );

    expect(getByText('Protected Host Content')).toBeTruthy();
  });

  it('renders PENDING application card when hostStatus is PENDING', async () => {
    useAuthStore.setState({
      user: {
        id: 'u2',
        email: 'pending@test.com',
        name: 'Bilal',
        phone: '03001234567',
        role: 'USER',
        hostStatus: 'PENDING',
      } as any,
    });

    const { getByText, queryByText } = await render(
      <HostStatusGate>
        <Text>Protected Host Content</Text>
      </HostStatusGate>
    );

    expect(queryByText('Protected Host Content')).toBeNull();
    expect(getByText('Application Under Review')).toBeTruthy();
    expect(getByText(/currently being reviewed by our administrative team/i)).toBeTruthy();
  });

  it('renders SUSPENDED alert when hostStatus is SUSPENDED', async () => {
    useAuthStore.setState({
      user: {
        id: 'u3',
        email: 'suspended@test.com',
        name: 'Zain',
        phone: '03001234567',
        role: 'USER',
        hostStatus: 'SUSPENDED',
      } as any,
    });

    const { getByText, queryByText } = await render(
      <HostStatusGate>
        <Text>Protected Host Content</Text>
      </HostStatusGate>
    );

    expect(queryByText('Protected Host Content')).toBeNull();
    expect(getByText('Host Privileges Suspended')).toBeTruthy();
    expect(getByText(/contact platform support at support@chargeshare.pk/i)).toBeTruthy();
  });

  it('renders "Become a Host" application form when hostStatus is NONE', async () => {
    useAuthStore.setState({
      user: {
        id: 'u4',
        email: 'driver@test.com',
        name: 'Ali',
        phone: '',
        role: 'USER',
        hostStatus: 'NONE',
      } as any,
    });

    const { getByText, queryByText } = await render(
      <HostStatusGate>
        <Text>Protected Host Content</Text>
      </HostStatusGate>
    );

    expect(queryByText('Protected Host Content')).toBeNull();
    expect(getByText('Become a ChargeShare Host')).toBeTruthy();
    expect(getByText('Submit Host Application')).toBeTruthy();
  });
});
