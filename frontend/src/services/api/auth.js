import { apiClient, getErrorMessage } from './client';

export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updatePasswords = async (oldPassword, p1, p2) => {
  try {
    const response = await apiClient.post('/auth/update-passwords', { oldPassword, p1, p2 });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const forceChangePassword = async (p1, p2) => {
  try {
    const response = await apiClient.post('/auth/force-change-password', { p1, p2 });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Récupère le profil de l'utilisateur connecté via /auth/me.
 * Retourne : id_n (Users), utilisateur (Materiels), email (UserEmail), rôle...
 */
export const getCurrentUserProfile = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const register = async (email, password, name) => {
  try {
    const response = await apiClient.post('/auth/register', { email, password, name });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};
