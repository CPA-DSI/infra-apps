// Canal de notification « session expirée » entre la couche HTTP (intercepteur
// Axios de services/api/client.js) et l'état d'authentification (AuthContext).
// Module volontairement sans dépendance pour éviter tout import circulaire.

const listeners = new Set();

/**
 * Enregistre un callback appelé quand l'API signale une session expirée/invalide.
 * @param {(detail: {status: number, message: string, url: string}) => void} callback
 * @returns {() => void} Fonction de désinscription.
 */
export const onSessionExpired = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Notifie tous les abonnés qu'une session a expiré.
 * @param {{status: number, message: string, url: string}} detail
 */
export const notifySessionExpired = (detail) => {
  listeners.forEach((callback) => {
    try {
      callback(detail);
    } catch (error) {
      console.error('Erreur dans un gestionnaire de session expirée :', error);
    }
  });
};
