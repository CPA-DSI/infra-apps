import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient, getCurrentUserProfile } from '../services/api';

jest.mock('../services/api', () => ({
  apiClient: { post: jest.fn() },
  getCurrentUserProfile: jest.fn(),
}));

// AuthContext.js utilise withReactContent(Swal), qui fait `class extends Swal` :
// il faut donc un vrai constructeur ici, pas un objet simple.
jest.mock('sweetalert2', () => {
  class MockSwal {
    static fire = jest.fn(() => new Promise(() => {}));
    static close = jest.fn();
  }
  return MockSwal;
});

const Swal = require('sweetalert2');

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
    jest.useRealTimers();
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

  describe("déconnexion automatique pour inactivité", () => {
    beforeEach(() => {
      apiClient.post.mockResolvedValue({});
    });

    test("affiche un avertissement après 9 min d'inactivité, puis déconnecte après 10 min sans réaction", async () => {
      getCurrentUserProfile.mockResolvedValue({ role: 'USER' });
      let resolveWarning;
      Swal.fire.mockImplementation(() => new Promise((resolve) => { resolveWarning = resolve; }));

      jest.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));
      expect(Swal.fire).not.toHaveBeenCalled();

      // 9 minutes d'inactivité : l'avertissement doit s'afficher.
      act(() => {
        jest.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);

      // Aucune réaction de l'utilisateur : la modale se ferme au bout de son propre
      // délai (60s), ce qui correspond à result.isConfirmed === false côté SweetAlert2.
      await act(async () => {
        resolveWarning({ isConfirmed: false, isDenied: false, dismiss: 'timer' });
      });

      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');
      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('non-authentifié'));
    });

    test("une activité avant l'avertissement repousse la déconnexion", async () => {
      getCurrentUserProfile.mockResolvedValue({ role: 'USER' });
      Swal.fire.mockImplementation(() => new Promise(() => {}));

      jest.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));

      // À 8 min, l'utilisateur redevient actif : le compteur doit repartir de zéro.
      act(() => {
        jest.advanceTimersByTime(8 * 60 * 1000);
        window.dispatchEvent(new Event('keydown'));
      });
      act(() => {
        jest.advanceTimersByTime(8 * 60 * 1000);
      });
      expect(Swal.fire).not.toHaveBeenCalled();

      // 1 min plus tard (9 min après la dernière activité), l'avertissement apparaît.
      act(() => {
        jest.advanceTimersByTime(1 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);
    });

    test("cliquer sur \"Rester connecté\" annule la déconnexion", async () => {
      getCurrentUserProfile.mockResolvedValue({ role: 'USER' });
      let resolveWarning;
      Swal.fire.mockImplementation(() => new Promise((resolve) => { resolveWarning = resolve; }));

      jest.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));

      act(() => {
        jest.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveWarning({ isConfirmed: true });
      });

      expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié');
      expect(apiClient.post).not.toHaveBeenCalledWith('/auth/logout');

      // Le timer a bien été relancé : encore 9 min plus tard, un nouvel avertissement.
      act(() => {
        jest.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(2);
    });
  });
});
