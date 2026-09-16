import axios from 'axios';
import { apiClient, apiClientUpload, getErrorMessage } from './client';

export const fetchAllMouvements = async (year, signal) => {
  try {
    const response = await apiClient.get(`/mouvements/stats/${year}`, { signal });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return null;
    }
    const message = error.response?.data?.message || 'Erreur de chargement';
    throw new Error(message);
  }
};

// Récupère la plage d'années réellement couvertes par les mouvements en base
export const fetchAnneesDisponibles = async (signal) => {
  try {
    const response = await apiClient.get('/mouvements/annees/disponibles', { signal });
    return response.data; // { minYear, maxYear }
  } catch (error) {
    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return null;
    }
    const message = error.response?.data?.message || 'Erreur de chargement';
    throw new Error(message);
  }
};

export const fetchAllMouvementsChart = async () => {
  try {
    const response = await apiClient.get('/mouvements');
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return null;
    }
    const message = error.response?.data?.message || 'Erreur de chargement';
    throw new Error(message);
  }
};

export const getMouvements = async () => {
  try {
    const response = await apiClient.get('/mouvements');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMouvementById = async (id) => {
  try {
    const response = await apiClient.get(`/mouvements/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération du mouvement:', error);
    throw error;
  }
};

export const createMouvement = async (data) => {
  try {
    const response = await apiClient.post('/mouvements', data);
    return response.data;
  } catch (error) {
    const userFriendlyErrorMessage = getErrorMessage(error);
    console.error("Détail de l'erreur d'API:", error.response?.data || error);
    throw new Error(userFriendlyErrorMessage);
  }
};

export const updateMouvement = async (id, data) => {
  try {
    const response = await apiClient.put(`/mouvements/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteMouvement = async (id) => {
  try {
    const response = await apiClient.delete(`/mouvements/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Importe des mouvements depuis un fichier Excel
export const importMouvements = async (formData, signal) => {
  try {
    const response = await apiClientUpload.post('/mouvements/import', formData, {
      signal: signal,
    });
    return response.data;
  } catch (error) {
    console.error("Erreur lors de l'importation des mouvements:", error);
    if (axios.isCancel(error)) {
      throw new Error('Importation annulée');
    }
    if (error.response) {
      throw new Error(error.response.data.message || "Erreur serveur lors de l'importation");
    }
    throw new Error('Erreur de connexion au serveur');
  }
};
