import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { MySwal, swalButtons } from '../utils/swal';
import { apiClient, getCurrentUserProfile } from '../services/api';
import { onSessionExpired } from '../services/sessionEvents';
import { createTabSync } from '../utils/tabSync';

// Doit rester alignée avec la durée de vie du cookie/JWT côté backend
// (voir TOKEN_MAX_AGE_MS dans backend-Prisma/config/authToken.js).
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
// Limite la diffusion de l'activité aux autres onglets (mousemove/scroll
// déclenchent des dizaines d'évènements par seconde).
const ACTIVITY_BROADCAST_INTERVAL_MS = 5 * 1000;
// Pendant une opération longue (import...), la session est maintenue active :
// un appel léger à /auth/me réémet le cookie bien avant ses 10 min d'expiration.
const SESSION_KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
// Garde-fou : un maintien de session non libéré expire de lui-même.
const SESSION_HOLD_MAX_MS = 60 * 60 * 1000;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Copie synchrone de isAuthenticated, lisible depuis les callbacks
  // asynchrones (intercepteur Axios, messages des autres onglets, modale).
  const isAuthenticatedRef = useRef(false);
  // Canal de synchronisation inter-onglets (voir utils/tabSync.js).
  const tabSyncRef = useRef(null);
  // Réaction à l'activité signalée par un autre onglet (définie par l'effet d'inactivité).
  const remoteActivityRef = useRef(null);
  // Vrai tant que la modale d'avertissement d'inactivité est affichée.
  const idleWarningOpenRef = useRef(false);
  // Opérations longues en cours qui empêchent la déconnexion (voir holdSession).
  const sessionHoldsRef = useRef(new Set());
  // Réaction au début/à la fin d'un maintien de session (définie par l'effet d'inactivité).
  const holdChangedRef = useRef(null);

  const clearAuthState = useCallback(() => {
    isAuthenticatedRef.current = false;
    setUser(null);
    setIsAuthenticated(false);
    setMustChangePassword(false);
  }, []);

    const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCurrentUserProfile();

      const normalizedEmails = Array.isArray(data?.emails) && data.emails.length > 0
        ? data.emails.map((e, idx) => ({
            email: typeof e === 'string' ? e : e.email,
            is_primary: typeof e === 'object' ? Boolean(e.is_primary) : idx === 0,
          }))
        : [data?.email_1, data?.email]
            .filter(Boolean)
            .map((email, idx) => ({ email, is_primary: idx === 0 }));

      const materielSource = data?.materiel || data?.details_materiel || data;
      const normalizedMateriel = {
        utilisateur: materielSource?.utilisateur || materielSource?.nom_utilisateur || '',
        id_n: materielSource?.id_n || materielSource?.matricule || materielSource?.id || '',
        equipe: materielSource?.equipe || '',
      };

      const normalizedUser = {
        ...data,
        id_n: data?.id_n || '',
        emails: normalizedEmails,
        email_1: data?.email_1 || (normalizedEmails[0]?.email || ''),
        email_2: data?.email_2 || (normalizedEmails[1]?.email || ''),
        materiel: normalizedMateriel,
        details_materiel: normalizedMateriel,
        role: data?.role || data?.user_role || '',
        must_change_password: Boolean(data?.must_change_password),
      };

      isAuthenticatedRef.current = true;
      setUser(normalizedUser);
      setIsAuthenticated(true);
      setMustChangePassword(Boolean(normalizedUser.must_change_password));
      return normalizedUser;
    } catch (error) {
      clearAuthState();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Synchronisation entre onglets : une déconnexion dans un onglet déconnecte
  // les autres, et l'activité dans un onglet repousse la déconnexion pour
  // inactivité dans tous les onglets (le cookie de session est commun).
  useEffect(() => {
    const tabSync = createTabSync((message) => {
      if (message.type === 'logout') {
        if (isAuthenticatedRef.current) {
          clearAuthState();
        }
      } else if (message.type === 'activity') {
        if (remoteActivityRef.current) {
          remoteActivityRef.current();
        }
      }
    });
    tabSyncRef.current = tabSync;

    return () => {
      tabSync.close();
      if (tabSyncRef.current === tabSync) {
        tabSyncRef.current = null;
      }
    };
  }, [clearAuthState]);

  const broadcast = useCallback((message) => {
    if (tabSyncRef.current) {
      tabSyncRef.current.post(message);
    }
  }, []);

  // Session expirée/invalide signalée par l'intercepteur Axios
  // (services/api/client.js) : on vide l'état local, ce qui renvoie vers /login
  // via AppLayout, sans rechargement de la page.
  useEffect(() => onSessionExpired(() => {
    if (!isAuthenticatedRef.current) {
      return;
    }
    // La modale d'inactivité éventuelle sera remplacée par le message ci-dessous :
    // l'effet d'inactivité ne doit pas la refermer lors de son nettoyage.
    idleWarningOpenRef.current = false;
    clearAuthState();
    broadcast({ type: 'logout' });
    MySwal.fire({
      icon: 'info',
      title: 'Session expirée',
      text: 'Votre session a expiré. Veuillez vous reconnecter.',
      ...swalButtons('primary'),
    });
  }), [clearAuthState, broadcast]);

  const login = useCallback(async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    await checkAuth();
    return response;
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthState();
      broadcast({ type: 'logout' });
    }
  }, [clearAuthState, broadcast]);

  /**
   * Empêche la déconnexion pour inactivité pendant une opération longue
   * (ex. import de mouvements) : le minuteur d'inactivité est suspendu et la
   * session est prolongée régulièrement côté serveur, dans tous les onglets.
   * Le maintien expire de lui-même après SESSION_HOLD_MAX_MS.
   * @returns {() => void} Fonction de libération, à appeler dans un `finally`
   * (appels multiples sans effet).
   */
  const holdSession = useCallback(() => {
    const holdToken = {};
    let released = false;
    let maxHoldTimer = null;

    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(maxHoldTimer);
      sessionHoldsRef.current.delete(holdToken);
      if (sessionHoldsRef.current.size === 0 && holdChangedRef.current) {
        holdChangedRef.current(false);
      }
    };

    const wasIdle = sessionHoldsRef.current.size === 0;
    sessionHoldsRef.current.add(holdToken);
    maxHoldTimer = setTimeout(release, SESSION_HOLD_MAX_MS);
    if (wasIdle && holdChangedRef.current) {
      holdChangedRef.current(true);
    }
    return release;
  }, []);

  // Déconnexion automatique après 10 min d'inactivité, avec un avertissement
  // 1 min avant la coupure. Le compte à rebours est ignoré si l'utilisateur
  // est inactif : seule une action explicite sur la modale (ou une activité
  // avant son ouverture) prolonge la session. L'activité d'un autre onglet
  // compte aussi : elle relance le compteur (et referme l'avertissement).
  // Tant qu'un maintien de session est actif (holdSession), le compteur est
  // suspendu et la session est prolongée périodiquement.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let idleTimer = null;
    let keepAliveInterval = null;
    let disposed = false;
    // Avertissement refermé par un évènement extérieur (autre onglet, maintien de session).
    let resumedElsewhere = false;
    let lastBroadcastAt = 0;

    const isSessionHeld = () => sessionHoldsRef.current.size > 0;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleWarning = () => {
      clearIdleTimer();
      if (isSessionHeld()) return;
      idleTimer = setTimeout(showWarning, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    };

    const broadcastActivity = (force = false) => {
      const now = Date.now();
      if (force || now - lastBroadcastAt >= ACTIVITY_BROADCAST_INTERVAL_MS) {
        lastBroadcastAt = now;
        broadcast({ type: 'activity' });
      }
    };

    const stopKeepAlive = () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    };

    const startKeepAlive = () => {
      if (keepAliveInterval) return;
      keepAliveInterval = setInterval(() => {
        // Réémet le cookie de session. Une session réellement expirée est
        // signalée par l'intercepteur Axios (onSessionExpired ci-dessus).
        getCurrentUserProfile().catch(() => {});
        // Empêche aussi les autres onglets d'afficher l'avertissement.
        broadcastActivity(true);
      }, SESSION_KEEPALIVE_INTERVAL_MS);
    };

    const applySessionHold = (held) => {
      if (held) {
        clearIdleTimer();
        if (idleWarningOpenRef.current) {
          resumedElsewhere = true;
          Swal.close();
        }
        startKeepAlive();
        broadcastActivity(true);
      } else {
        stopKeepAlive();
        scheduleWarning();
      }
    };

    function showWarning() {
      if (idleWarningOpenRef.current || isSessionHeld()) return;
      idleWarningOpenRef.current = true;
      resumedElsewhere = false;

      let remainingSeconds = IDLE_WARNING_MS / 1000;
      let countdownInterval;

      MySwal.fire({
        title: 'Toujours là ?',
        html: `Vous allez être déconnecté dans <b id="idle-countdown">${remainingSeconds}</b> secondes pour inactivité.`,
        icon: 'warning',
        showDenyButton: true,
        confirmButtonText: 'Rester connecté',
        denyButtonText: 'Se déconnecter',
        ...swalButtons('primary'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        timer: IDLE_WARNING_MS,
        timerProgressBar: true,
        didOpen: () => {
          countdownInterval = setInterval(() => {
            remainingSeconds -= 1;
            const el = document.getElementById('idle-countdown');
            if (el) el.textContent = Math.max(remainingSeconds, 0);
          }, 1000);
        },
        willClose: () => {
          clearInterval(countdownInterval);
        },
      }).then((result) => {
        idleWarningOpenRef.current = false;
        // Session déjà terminée entre-temps (autre onglet, session expirée...).
        if (disposed || !isAuthenticatedRef.current) return;

        if (resumedElsewhere) {
          resumedElsewhere = false;
          scheduleWarning();
        } else if (result.isConfirmed) {
          checkAuth();
          scheduleWarning();
          broadcastActivity(true);
        } else {
          logout();
        }
      });
    }

    const handleActivity = () => {
      if (idleWarningOpenRef.current) return;
      scheduleWarning();
      broadcastActivity();
    };

    // Activité dans un autre onglet : on repart de zéro, sans rediffuser.
    remoteActivityRef.current = () => {
      if (idleWarningOpenRef.current) {
        resumedElsewhere = true;
        Swal.close();
        return;
      }
      scheduleWarning();
    };
    holdChangedRef.current = applySessionHold;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    if (isSessionHeld()) {
      applySessionHold(true);
    } else {
      scheduleWarning();
    }

    return () => {
      disposed = true;
      remoteActivityRef.current = null;
      holdChangedRef.current = null;
      stopKeepAlive();
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearIdleTimer();
      if (idleWarningOpenRef.current) {
        idleWarningOpenRef.current = false;
        Swal.close();
      }
    };
  }, [isAuthenticated, checkAuth, logout, broadcast]);

  const value = {
    isAuthenticated,
    user,
    mustChangePassword,
    isLoading,
    login,
    logout,
    checkAuth,
    setMustChangePassword,
    holdSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
