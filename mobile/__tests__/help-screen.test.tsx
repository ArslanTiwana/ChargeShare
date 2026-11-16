import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HelpScreen from '../app/help';
import { useAuthStore } from '../src/store/auth-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('Help & Support Screen', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
    useAuthStore.setState({
      user: {
        id: 'u_help_1',
        email: 'user@example.com',
        name: 'Sara Ahmed',
        phone: '03001112233',
        role: 'USER',
        hostStatus: 'NONE',
      } as any,
      activeRole: 'driver',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('renders app version, policy links, and form inputs', async () => {
    const { getByText, getByPlaceholderText } = await render(<HelpScreen />);

    expect(getByText(/App Version 1.0.0/)).toBeTruthy();
    expect(getByText('Terms of Service & Electrical Safety')).toBeTruthy();
    expect(getByText('Privacy Policy & Data Handling')).toBeTruthy();
    expect(getByText('Web Account Deletion Portal')).toBeTruthy();

    expect(getByPlaceholderText('e.g., Question about my charging session')).toBeTruthy();
    expect(getByPlaceholderText('Please describe your inquiry in detail...')).toBeTruthy();
  });

  it('shows error toast when attempting to submit with empty subject', async () => {
    const { getByText, getByRole } = await render(<HelpScreen />);
    const submitBtn = getByRole('button', { name: 'Submit Message' });

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Please enter a subject')).toBeTruthy();
    });
  });

  it('submits valid support ticket to API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: { id: 'supp_123', status: 'OPEN', message: 'Ticket received' },
        error: null,
      }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    global.fetch = fetchMock;

    const screen = await render(<HelpScreen />);

    const subjectInput = screen.getByPlaceholderText('e.g., Question about my charging session');
    const messageInput = screen.getByPlaceholderText('Please describe your inquiry in detail...');

    await act(async () => {
      subjectInput.props.onChangeText('Charger offline');
      messageInput.props.onChangeText('The charger was offline when I arrived for my booking.');
    });

    const submitBtn = screen.getByRole('button', { name: 'Submit Message' });
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByText('Your message has been sent. Our support team will reply via email.')
      ).toBeTruthy();
    });
  });
});
