import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const BASE = `${API_BASE_URL}/api`;

export const apiClient = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const apiClientUpload = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

/**
 * Extrait un message d'erreur exploitable depuis une erreur Axios.
 * @param {object} error L'erreur Axios.
 * @returns {string} Le message d'erreur.
 */
export const getErrorMessage = (error) => {
  if (error.response) {
    return error.response.data?.error || error.response.data?.message || `Échec de la requête (Status: ${error.response.status})`;
  } else if (error.request) {
    return 'Aucune réponse du serveur. Veuillez vérifier votre connexion réseau.';
  } else {
    return `Une erreur inattendue est survenue : ${error.message}`;
  }
};
