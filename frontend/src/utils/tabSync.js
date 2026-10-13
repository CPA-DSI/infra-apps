// Synchronisation entre onglets du même navigateur (activité, déconnexion).
// Utilise BroadcastChannel quand il est disponible, sinon se rabat sur
// l'évènement `storage` de localStorage (déclenché uniquement dans les AUTRES
// onglets, comme BroadcastChannel). Si aucun des deux n'est utilisable, les
// messages sont simplement ignorés : chaque onglet fonctionne alors isolément.

const CHANNEL_NAME = 'infra-apps-auth';
const STORAGE_KEY = 'infra-apps-auth-sync';

/**
 * Ouvre un canal de communication inter-onglets.
 * @param {(message: {type: string}) => void} onMessage Appelé pour chaque message reçu d'un autre onglet.
 * @returns {{ post: (message: {type: string}) => void, close: () => void }}
 */
export const createTabSync = (onMessage) => {
  if (typeof window === 'undefined') {
    return { post: () => {}, close: () => {} };
  }

  if (typeof window.BroadcastChannel === 'function') {
    try {
      const channel = new window.BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event?.data?.type) onMessage(event.data);
      };
      return {
        post: (message) => {
          try {
            channel.postMessage(message);
          } catch (error) {
            // Canal fermé ou message non sérialisable : sans conséquence.
          }
        },
        close: () => channel.close(),
      };
    } catch (error) {
      // On passe au repli localStorage.
    }
  }

  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue);
      if (message?.type) onMessage(message);
    } catch (error) {
      // Valeur illisible : ignorée.
    }
  };

  window.addEventListener('storage', handleStorage);

  return {
    post: (message) => {
      try {
        // Le nonce garantit un changement de valeur, donc un évènement `storage`,
        // même si le même message est envoyé deux fois de suite.
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...message, nonce: `${Date.now()}-${Math.random()}` })
        );
      } catch (error) {
        // localStorage indisponible (navigation privée, quota...) : ignoré.
      }
    },
    close: () => window.removeEventListener('storage', handleStorage),
  };
};
