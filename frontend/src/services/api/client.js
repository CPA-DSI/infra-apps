import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const BASE = `${API_BASE_URL}/api`;

// En-tête exigé par l'API sur toute requête mutante (protection CSRF, voir
// backend-Prisma/middleware/csrfMiddleware.js). À ajouter aussi à tout fetch direct.
export const CSRF_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
};

export const apiClient = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
    ...CSRF_HEADERS,
  },
  withCredentials: true,
});

export const apiClientUpload = axios.create({
  baseURL: BASE,
  headers: {
    ...CSRF_HEADERS,
  },
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
