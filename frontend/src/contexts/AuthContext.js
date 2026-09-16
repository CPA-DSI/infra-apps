import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { apiClient, getCurrentUserProfile } from '../services/api';

const MySwal = withReactContent(Swal);

// Doit rester alignée avec la durée de vie du cookie/JWT côté backend
// (voir TOKEN_MAX_AGE_MS dans backend-Prisma/config/authToken.js).
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

      setUser(normalizedUser);
      setIsAuthenticated(true);
      setMustChangePassword(Boolean(normalizedUser.must_change_password));
      return normalizedUser;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setMustChangePassword(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Déconnexion automatique après 10 min d'inactivité, avec un avertissement
  // 1 min avant la coupure. Le compte à rebours est ignoré si l'utilisateur
  // est inactif : seule une action explicite sur la modale (ou une activité
  // avant son ouverture) prolonge la session.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let idleTimer = null;
    let warningOpen = false;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleWarning = () => {
      clearIdleTimer();
      idleTimer = setTimeout(showWarning, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    };

    function showWarning() {
      if (warningOpen) return;
      warningOpen = true;

      let remainingSeconds = IDLE_WARNING_MS / 1000;
      let countdownInterval;

      MySwal.fire({
        title: 'Toujours là ?',
        html: `Vous allez être déconnecté dans <b id="idle-countdown">${remainingSeconds}</b> secondes pour inactivité.`,
        icon: 'warning',
        showDenyButton: true,
        confirmButtonText: 'Rester connecté',
        denyButtonText: 'Se déconnecter',
        confirmButtonColor: '#6366f1',
        denyButtonColor: '#64748b',
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
        warningOpen = false;
        if (result.isConfirmed) {
          checkAuth();
          scheduleWarning();
        } else {
          logout();
        }
      });
    }

    const handleActivity = () => {
      if (warningOpen) return;
      scheduleWarning();
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    scheduleWarning();

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearIdleTimer();
      if (warningOpen) {
        Swal.close();
      }
    };
  }, [isAuthenticated, checkAuth, logout]);

  const value = {
    isAuthenticated,
    user,
    mustChangePassword,
    isLoading,
    login,
    logout,
    checkAuth,
    setMustChangePassword,
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
