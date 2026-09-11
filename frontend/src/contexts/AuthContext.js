import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getCurrentUserProfile } from '../services/api';

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
