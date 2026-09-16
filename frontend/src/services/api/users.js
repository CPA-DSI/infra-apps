import { apiClient, getErrorMessage } from './client';

export const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    const sortedData = response.data.sort((a, b) => a.id_n - b.id_n);
    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Erreur lors de fetchUsers');
  }
};

export const fetchAllUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const addUser = async (userData) => {
  try {
    const response = await apiClient.post('/users', userData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateUser = async (id, userData) => {
  try {
    const response = await apiClient.put(`/users/${id}`, userData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    throw new Error(errorMessage);
  }
};

export const updateUserStatus = async (id, isActive) => {
  try {
    const response = await apiClient.patch(`/users/${id}/status`, { is_active: isActive });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    throw new Error(errorMessage);
  }
};

export const addUserEmail = async (emailData) => {
  try {
    const response = await apiClient.post('/user-emails', emailData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateUserEmail = async (id, emailData) => {
  try {
    const response = await apiClient.put(`/user-emails/${id}`, emailData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteUser = async (id) => {
  try {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchMailStats = async () => {
  try {
    const response = await apiClient.get('/user-emails/stats');
    return response.data;
  } catch (error) {
    console.error("Détail de l'erreur dans fetchMailStats:", error.message, error.response?.data);
    throw new Error(getErrorMessage(error));
  }
};
