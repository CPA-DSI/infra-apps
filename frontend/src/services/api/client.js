import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { notifySessionExpired } from '../sessionEvents';

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

// --- Détection des sessions expirées -------------------------------------
// Le backend répond :
//   - 401 si le cookie de session est absent ('Accès refusé. Token manquant.')
//     ou si l'utilisateur n'est pas identifié ('Utilisateur non authentifié.') ;
//   - 403 'Token expiré.' / 'Token invalide.' si le JWT n'est plus valable ;
//   - 403 "Demandez à l'administrateur d'activer votre compte" si le compte a été désactivé.
// Les autres 403 ('Accès interdit : ...', CSRF, etc.) sont des refus de permission :
// ils ne doivent PAS déconnecter l'utilisateur.

// Endpoints dont les 401/403 relèvent du formulaire lui-même (identifiants
// erronés, lien de réinitialisation invalide...), pas d'une session expirée.
const SESSION_IGNORED_ENDPOINTS = [
  '/auth/login',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// Pages publiques : un 401 sur /auth/me y est normal (aucune session ouverte).
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// 401 métier qui ne signifient pas une session expirée.
const NON_SESSION_401_MESSAGES = [
  'Mot de passe actuel incorrect.',
  'Identifiants invalides.',
];

const SESSION_403_PATTERNS = [
  /token\s+(expir|invalide)/i,
  /activer votre compte/i,
];

const getResponseMessage = (data) => {
  if (!data || typeof data !== 'object') return '';
  return String(data.error || data.message || '');
};

const isSessionError = (error) => {
  const { response, config } = error || {};
  if (!response) return false;

  const url = config?.url || '';
  if (SESSION_IGNORED_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
    return false;
  }

  if (url.includes('/auth/me') && typeof window !== 'undefined'
    && PUBLIC_PATHS.includes(window.location.pathname)) {
    return false;
  }

  const message = getResponseMessage(response.data);

  if (response.status === 401) {
    return !NON_SESSION_401_MESSAGES.includes(message);
  }

  if (response.status === 403) {
    return SESSION_403_PATTERNS.some((pattern) => pattern.test(message));
  }

  return false;
};

const handleSessionError = (error) => {
  if (isSessionError(error)) {
    notifySessionExpired({
      status: error.response.status,
      message: getResponseMessage(error.response.data),
      url: error.config?.url || '',
    });
  }
  // L'erreur est toujours propagée : chaque appelant garde sa propre gestion.
  return Promise.reject(error);
};

[apiClient, apiClientUpload].forEach((instance) => {
  instance.interceptors.response.use((response) => response, handleSessionError);
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
