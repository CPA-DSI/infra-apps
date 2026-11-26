import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient, getCurrentUserProfile } from '../services/api';
import Swal from 'sweetalert2';

vi.mock('../services/api', () => ({
  apiClient: { post: vi.fn() },
  getCurrentUserProfile: vi.fn(),
}));

// AuthContext.js utilise withReactContent(Swal), qui fait `class extends Swal` :
// il faut donc un vrai constructeur ici, pas un objet simple.
vi.mock('sweetalert2', () => {
  class MockSwal {
    static fire = vi.fn(() => new Promise(() => {}));
    static close = vi.fn();
  }
  return { default: MockSwal };
});


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
    vi.clearAllMocks();
    vi.useRealTimers();
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

      vi.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));
      expect(Swal.fire).not.toHaveBeenCalled();

      // 9 minutes d'inactivité : l'avertissement doit s'afficher.
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
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

      vi.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));

      // À 8 min, l'utilisateur redevient actif : le compteur doit repartir de zéro.
      act(() => {
        vi.advanceTimersByTime(8 * 60 * 1000);
        window.dispatchEvent(new Event('keydown'));
      });
      act(() => {
        vi.advanceTimersByTime(8 * 60 * 1000);
      });
      expect(Swal.fire).not.toHaveBeenCalled();

      // 1 min plus tard (9 min après la dernière activité), l'avertissement apparaît.
      act(() => {
        vi.advanceTimersByTime(1 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);
    });

    test("cliquer sur \"Rester connecté\" annule la déconnexion", async () => {
      getCurrentUserProfile.mockResolvedValue({ role: 'USER' });
      let resolveWarning;
      Swal.fire.mockImplementation(() => new Promise((resolve) => { resolveWarning = resolve; }));

      vi.useFakeTimers();
      renderWithProvider();

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));

      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveWarning({ isConfirmed: true });
      });

      expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié');
      expect(apiClient.post).not.toHaveBeenCalledWith('/auth/logout');

      // Le timer a bien été relancé : encore 9 min plus tard, un nouvel avertissement.
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(2);
    });
  });

  describe('maintien de session pendant une opération longue (holdSession)', () => {
    let holdSession;
    const HoldProbe = () => {
      const auth = useAuth();
      holdSession = auth.holdSession;
      if (auth.isLoading) return <div>chargement</div>;
      return <div data-testid="auth-state">{auth.isAuthenticated ? 'authentifié' : 'non-authentifié'}</div>;
    };

    beforeEach(() => {
      apiClient.post.mockResolvedValue({});
      getCurrentUserProfile.mockResolvedValue({ role: 'USER' });
      Swal.fire.mockImplementation(() => new Promise(() => {}));
    });

    const renderHold = async () => {
      vi.useFakeTimers();
      render(
        <AuthProvider>
          <HoldProbe />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié'));
      getCurrentUserProfile.mockClear();
    };

    test("aucun avertissement ni déconnexion tant que la session est maintenue, avec prolongation côté serveur", async () => {
      await renderHold();
      let release;
      act(() => {
        release = holdSession();
      });

      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000);
      });
      expect(Swal.fire).not.toHaveBeenCalled();
      expect(apiClient.post).not.toHaveBeenCalledWith('/auth/logout');
      // Un appel /auth/me toutes les 4 min pour réémettre le cookie.
      expect(getCurrentUserProfile).toHaveBeenCalledTimes(7);

      // Après libération, le compte à rebours normal reprend.
      act(() => {
        release();
      });
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);
      expect(getCurrentUserProfile).toHaveBeenCalledTimes(7);
    });

    test("la session reste maintenue tant qu'au moins une opération est en cours", async () => {
      await renderHold();
      let releaseA;
      let releaseB;
      act(() => {
        releaseA = holdSession();
        releaseB = holdSession();
      });
      act(() => {
        releaseA();
        releaseA(); // appel multiple sans effet
        vi.advanceTimersByTime(20 * 60 * 1000);
      });
      expect(Swal.fire).not.toHaveBeenCalled();

      act(() => {
        releaseB();
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);
    });

    test("le maintien expire de lui-même après 60 min", async () => {
      await renderHold();
      act(() => {
        holdSession();
      });
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });
      expect(Swal.fire).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);
    });

    test("un maintien démarré pendant l'avertissement le referme et annule la déconnexion", async () => {
      let resolveWarning;
      Swal.fire.mockImplementation(() => new Promise((resolve) => { resolveWarning = resolve; }));
      Swal.close.mockImplementation(() => resolveWarning({ isConfirmed: false, isDismissed: true }));
      await renderHold();

      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(Swal.fire).toHaveBeenCalledTimes(1);

      await act(async () => {
        holdSession();
      });
      expect(Swal.close).toHaveBeenCalled();
      expect(apiClient.post).not.toHaveBeenCalledWith('/auth/logout');
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authentifié');
    });
  });
});
