import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { getCurrentUserProfile } from '../services/api';

jest.mock('../services/api', () => ({
  apiClient: { post: jest.fn() },
  getCurrentUserProfile: jest.fn(),
}));

const Probe = () => {
  const { isAuthenticated, isLoading, user, mustChangePassword } = useAuth();
  if (isLoading) return <div>chargement</div>;
  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'authentifié' : 'non-authentifié'}</div>
      <div data-testid="role">{user?.role || ''}</div>
      <div data-testid="must-change">{mustChangePassword ? 'oui' : 'non'}</div>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe('AuthContext', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("authentifie l'utilisateur quand /auth/me répond avec succès", async () => {
    getCurrentUserProfile.mockResolvedValue({
      role: 'IT_ADMIN',
      must_change_password: false,
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));
    expect(screen.getByTestId('role')).toHaveTextContent('IT_ADMIN');
    expect(screen.getByTestId('must-change')).toHaveTextContent('non');
  });

  test("reste non-authentifié quand /auth/me échoue (pas de session)", async () => {
    getCurrentUserProfile.mockRejectedValue(new Error('401'));

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('non-authentifié'));
  });

  test('signale must_change_password quand le backend le demande', async () => {
    getCurrentUserProfile.mockResolvedValue({
      role: 'USER',
      must_change_password: true,
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('must-change')).toHaveTextContent('oui'));
  });
});
