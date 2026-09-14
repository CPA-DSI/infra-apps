// frontend/src/services/api.js

import axios from 'axios';
import { API_BASE_URL } from '../config/api';

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
 * Helper function to extract a meaningful error message from an Axios error object.
 * @param {object} error The Axios error object.
 * @returns {string} The error message.
 */
const getErrorMessage = (error) => {
  if (error.response) {
    // Le serveur a répondu avec un statut d'erreur (hors de la plage 2xx)
    return error.response.data?.error || error.response.data?.message || `Échec de la requête (Status: ${error.response.status})`;
  } else if (error.request) {
    // La requête a été faite, mais aucune réponse n'a été reçue (ex: problème réseau)
    return 'Aucune réponse du serveur. Veuillez vérifier votre connexion réseau.';
  } else {
    // Quelque chose s'est passé pendant la configuration de la requête qui a déclenché une erreur
    return `Une erreur inattendue est survenue : ${error.message}`;
  }
};

apiClient.interceptors.request.use(
    (config) => {
        try {
            const stored = localStorage.getItem('user');
            const user = stored ? JSON.parse(stored) : null;
            const token = user ? user.token : null;

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (e) {
            console.warn('Impossible de lire le token d\'authentification depuis localStorage.', e);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        return Promise.reject(error);
    }
);

export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data; 
  } catch (error) {
    // Utilisation de la fonction helper pour remonter l'erreur avec le message le plus pertinent possible
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

// --- CONFIGURATION EMAIL ---

export const getEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL HEBDOMADAIRE ---

export const getWeeklyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateWeeklyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/hebdomadaire', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteWeeklyEmailConfig = async () => {
  try {
    const response = await apiClient.delete('/config/hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getWeeklyConfigStatus = async () => {
  try {
    const response = await apiClient.get('/config/hebdomadaire/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL QUOTIDIENNE ---

export const getDailyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateDailyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/quotidien', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL MENSUELLE ---

export const getMonthlyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/mensuel'); // ✅ Correspond à /api/config/mensuel
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateMonthlyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/mensuel', configData); // ✅ Correspond à /api/config/mensuel
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteMonthlyEmailConfig = async () => {
  try {
    const response = await apiClient.delete('/config/mensuel'); // ✅ Correspond à /api/config/mensuel
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMonthlyConfigStatus = async () => {
  try {
    const response = await apiClient.get('/config/mensuel/status'); // ✅ Correspond à /api/config/mensuel/status
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};


export const sendTestEmail = async () => {
  try {
    // Backward compatibility - try daily first, then weekly
    const response = await apiClient.post('/email/send-test-quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmailQuotidien = async () => {
  try {
    const response = await apiClient.post('/email/send-test-quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmailHebdomadaire = async () => {
  try {
    const response = await apiClient.post('/email/send-test-hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ✅ CORRECTION : La route pour le test
export const sendTestEmailMensuel = async () => {
  try {
    // Utiliser la même route que les autres configs
    const response = await apiClient.post('/email/send-test-mensuel');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};


// api.js (exemple de fonction backend utilisant Prisma)
export const fetchMaterielsWithUsers = async () => {
    try {
        // La requête inclut maintenant les données de l'utilisateur (Users) liées via la relation 'user'
        const response = await apiClient.get('/materiels?includeUser=true');
        
        // Supposons que l'API renvoie des données correctement structurées
        const sortedData = response.data.sort((a, b) => {
        return a.id_n - b.id_n;
        });

        return sortedData;
    } catch (error) {
        throw new Error(getErrorMessage(error) || "Erreur lors de fetchMaterielsWithUsers");
    }
};

//api.js
export const fetchUsers = async () => {
    try {
        // Si id_n est fourni, il est utilisé comme paramètre d'URL (ex: /users?id_n=123)
        const response = await apiClient.get('/users');
        
        const sortedData = response.data.sort((a, b) => {
        return a.id_n - b.id_n;
        });

        return sortedData;
    } catch (error) {
        throw new Error(getErrorMessage(error) || "Erreur lors de fetchUsers");
    }
};

export const fetchAllUsers = async () => {
  try {
    // CORRECTION : L'URL cible doit être '/users_all' pour correspondre à votre route backend
    const response = await apiClient.get('/users'); 
    // Pas besoin de trier côté client, c'est fait côté Prisma
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
        // L'id utilisé ici est l'id_user du modèle Prisma
        const response = await apiClient.put(`/users/${id}`, userData);
        return response.data;
    } catch (error) {
        // Renvoie le message d'erreur spécifique du backend
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

export const deleteUser = async (id) => {
    try {
        const response = await apiClient.delete(`/users/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const fetchMaterielsByMarque = async () => {
  try {
    const response = await apiClient.get('/materiels');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchMaterielsByLocal = async () => {
  try {
    const response = await apiClient.get('/materiels/count-by-local');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchEcranStats = async () => {
  try {
    const response = await apiClient.get('/materiels/stats-ecrans'); 
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchCountEquipe = async () => {
  try {
    // Utilisation de apiClient comme demandé
    const response = await apiClient.get('/materiels/count-equipe');
    return response.data;
  } catch (error) {
    // Affiche l'erreur réelle du serveur dans la console du navigateur
    if (error.response) {
      console.error("Réponse d'erreur du serveur:", error.response.data);
    }
    throw error;
  }
};

// Nouvelle fonction pour récupérer les détails complets par équipe
export const fetchEquipeDetails = async () => {
  try {
    const response = await apiClient.get('/materiels/equipe-details');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Réponse d'erreur du serveur:", error.response.data);
    }
    throw error;
  }
};

// Assurez-vous que apiClient est configuré (baseURL, etc.)
export const fetchAllMouvements = async (year, signal) => {
  try {
    const response = await apiClient.get(`/mouvements/stats/${year}`, { signal });
    return response.data;
  } catch (error) {
    // Vérification correcte de l'annulation
    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return null; 
    }
    const message = error.response?.data?.message || "Erreur de chargement";
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
    const message = error.response?.data?.message || "Erreur de chargement";
    throw new Error(message);
  }
};

// Assurez-vous que apiClient est configuré (baseURL, etc.)
export const fetchAllMouvementsChart = async (year, signal) => {
  try {
    const response = await apiClient.get('/mouvements');
    return response.data;
  } catch (error) {
    // Vérification correcte de l'annulation
    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return null; 
    }
    const message = error.response?.data?.message || "Erreur de chargement";
    throw new Error(message);
  }
};

export const fetchSSDStats = async () => {
  try {
    const response = await apiClient.get('/materiels/capacite-ssd'); 
    return response.data;
  } catch (error) {
    // Important: propage l'erreur pour que le composant React puisse la gérer
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

export const fetchAllMateriels = async () => {
  try {
    const response = await apiClient.get('/materiels_all'); 
    // Tri des données par id_n (ordre croissant)
    const sortedData = response.data.sort((a, b) => {
      return a.id_n - b.id_n;
    });

    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchTechnicians = async () => {
  try {
    const response = await apiClient.get('/materiels_all/technicians');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchAllMaterielsIt = async () => {
  try {
    const response = await apiClient.get('/materiels_all'); 
    
    const sortedData = response.data
    // 1. Filtrer pour ne garder que l'équipe Informatique DSI uniquement
    .filter(item => item.equipe === 'Informatique DSI') 
    
    // 2. Trier par id_n (ordre croissant)
    .sort((a, b) => {
        return (a.id_n || 0) - (b.id_n || 0);
    });

    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchAllMaterielsByIdN = async () => {
  try {
    const response = await apiClient.get('/materiels_all'); 
    // Tri des données par id_n (ordre croissant)
    const sortedData = response.data.sort((a, b) => {
      return a.id_n - b.id_n;
    });

    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchMateriels = async () => {
     // Note: On utilise le chemin relatif '/materiels_s'
    const response = await apiClient.get('/materiels_s');
    return response.data;
};

export const addMateriel = async (materielData) => {
    try {
        const response = await apiClient.post('/materiels_all', materielData);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const updateMateriel = async (id, materielData) => {
    try {
        const response = await apiClient.put(`/materiels_all/${id}`, materielData);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const deleteMateriel = async (id) => {
    try {
        const response = await apiClient.delete(`/materiels_all/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const fetchAMarques = async () => {
    try {
        // Change la route pour correspondre à la route de votre backend /api/marques
        const response = await apiClient.get('/marques'); 
        return response.data; // Axios renvoie les données directement dans .data
    } catch (error) {
        // Utilise la fonction d'erreur de l'image
        throw new Error(getErrorMessage(error));
    }
};

// Nouvelle fonction pour récupérer les marques avec le nombre d'équipements
// Utilise l'inclusion de la relation materiels depuis Prisma
export const fetchMarquesWithCount = async () => {
    try {
        const response = await apiClient.get('/marques/with-count');
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

// Fonction pour récupérer les statistiques des équipes et états
export const fetchStatsEquipesEtats = async () => {
    try {
        const response = await apiClient.get('/marques/stats-equipes-etats');
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const createMarque = async (nom_marque, url) => {
    try {
        const response = await apiClient.post('/marques', { nom_marque, url });
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const updateMarque = async (id_marque, nom_marque, url) => {
    try {
        const response = await apiClient.put(`/marques/${id_marque}`, { nom_marque, url });
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const deleteMarque = async (id_marque) => {
    try {
        // Assurez-vous que l'ID est correctement passé dans l'URL
        await apiClient.delete(`/marques/${id_marque}`);
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const fetchALocaux = async () => {
    try {
        // L'URL relative '/locaux' sera préfixée par votre baseURL axios (ex: http://localhost:3001/api)
        const response = await apiClient.get('/locaux'); 
        return response.data; // Axios renvoie les données dans .data
    } catch (error) {
        // Utilise la fonction d'erreur pour un message cohérent
        throw new Error(getErrorMessage(error));
    }
};

export const fetchLocaux = async () => {
     // Note: On utilise le chemin relatif '/locaux'
    try {
        const response = await apiClient.get('/locaux');
        return response.data;
    } catch (error) {
        const enriched = new Error(getErrorMessage(error));
        enriched.originalError = error;
        throw enriched;
    }
};

export const addLocation = async (locationData) => {
    // locationData doit être un objet { nom_local: '...', description: '...' }
    console.log("Sending POST data to API:", locationData);
    const response = await apiClient.post('/locaux', locationData);
    return response.data;
};

export const updateLocation = async (locationId, locationData) => {
    // Correspond à PUT /api/locaux/:id
    const response = await apiClient.put(`/locaux/${locationId}`, locationData);
    return response.data;
};

export const deleteLocation = async (locationId) => {
    // Correspond à DELETE /api/locaux/:id
    const response = await apiClient.delete(`/locaux/${locationId}`);
    return response.data;
};

export const fetchProduits = async () => {
    // Note: On utilise le chemin relatif '/produits' car baseURL est déjà configuré
    try {
        const response = await apiClient.get('/produits');
        return response.data;
    } catch (error) {
        const enriched = new Error(getErrorMessage(error));
        enriched.originalError = error;
        throw enriched;
    }
};

// GET product by ID (optionnel pour le modal CRUD simple)
export const getProductById = async (productId) => {
    // Correspond à GET /api/produits/:id
    const response = await apiClient.get(`/produits/${productId}`);
    return response.data;
};

// CREATE product
export const addProduct = async (productData) => {
    // Correspond à POST /api/produits
    const response = await apiClient.post('/produits', productData);
    return response.data;
};

// UPDATE product
export const updateProduct = async (productId, productData) => {
    // Correspond à PUT /api/produits/:id
    const response = await apiClient.put(`/produits/${productId}`, productData);
    return response.data;
};

// DELETE product
export const deleteProduct = async (productId) => {
    // Correspond à DELETE /api/produits/:id
    const response = await apiClient.delete(`/produits/${productId}`);
    return response.data;
};


// Ajoutez ces fonctions dans api.js après les fonctions produits (vers ligne 450)

// --- HISTORIQUE DES ARRIVÉES AVEC PAGINATION ET FILTRES ---
export const getHistoriqueArriveesWithFilters = async (params = {}) => {
    try {
        const queryParams = new URLSearchParams();
        
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.produitId) queryParams.append('produitId', params.produitId);
        if (params.search) queryParams.append('search', params.search);
        
        const url = `/historique${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await apiClient.get(url);
        return response.data;
    } catch (error) {
        console.error("Erreur dans getHistoriqueArriveesWithFilters:", error);
        throw new Error(getErrorMessage(error));
    }
};

// Récupérer les statistiques pour le graphique
export const getHistoriqueStats = async (params = {}) => {
    try {
        const { periode = 'month', annee = new Date().getFullYear() } = params;
        const response = await apiClient.get(`/historique/stats?periode=${periode}&annee=${annee}`);
        return response.data;
    } catch (error) {
        console.error("Erreur dans getHistoriqueStats:", error);
        throw new Error(getErrorMessage(error));
    }
};

// Récupérer tous les produits (alias pour fetchProduits)
export const getAllProducts = async () => {
    try {
        const response = await apiClient.get('/produits');
        return response.data;
    } catch (error) {
        console.error("Erreur dans getAllProducts:", error);
        throw new Error(getErrorMessage(error));
    }
};

export const getHistoriqueArrivees = async () => {
    try {
        // L'URL d'appel reste '/historique_arrive'
        const response = await apiClient.get('/historique_arrive');
        return response.data;
    } catch (error) {
        // Assurez-vous d'avoir une fonction getErrorMessage appropriée
        // throw new Error(getErrorMessage(error));
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const getHistoriqueArriveeById = async (id) => {
    try {
        const response = await apiClient.get(`/historique_arrive/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const createHistoriqueArrivee = async (data) => {
    try {
        const response = await apiClient.post('/historique_arrive', data);
        return response.data; // Retourne l'objet créé
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const updateHistoriqueArrivee = async (id, data) => {
    try {
        const response = await apiClient.put(`/historique_arrive/${id}`, data);
        return response.data; // Retourne l'objet mis à jour
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const deleteHistoriqueArrivee = async (id) => {
    try {
        const response = await apiClient.delete(`/historique_arrive/${id}`);
        return response.data; // Confirme la suppression
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

// --- HISTORIQUE DES MATÉRIELS ---

export const getHistoriqueMateriel = async () => {
    try {
        const response = await apiClient.get('/historique_materiels');
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getHistoriqueMaterielById = async (id) => {
    try {
        const response = await apiClient.get(`/historique_materiels/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getHistoriqueMaterielByMaterielId = async (id_materiels) => {
    try {
        const response = await apiClient.get(`/historique_materiels/materiel/${id_materiels}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const createHistoriqueMateriel = async (data) => {
    try {
        const response = await apiClient.post('/historique_materiels', data);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getMouvements = async () => {
    try {
        const response = await apiClient.get('/mouvements'); 
        console.log("Appel de l'API à l'URL : http://localhost:4000/api/mouvements"); 
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getMouvementById = async (id) => {
  try {
    const response = await apiClient.get(`/mouvements/${id}`);
    
    // ✅ C'est la ligne cruciale : retourner seulement l'objet de données
    return response.data; 

  } catch (error) {
    console.error("Erreur lors de la récupération du mouvement:", error);
    // On propage l'erreur pour que le modal sache qu'il doit afficher le bandeau rouge
    throw error; 
  }
};

export const createMouvement = async (data) => {
    try {
        // Note: On utilise le chemin relatif '/mouvements'
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
        return response.data; // Retourne l'objet mis à jour
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const deleteMouvement = async (id) => {
    try {
        const response = await apiClient.delete(`/mouvements/${id}`);
        return response.data; // Confirme la suppression
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

// Fonction pour importer des mouvements depuis un fichier Excel
export const importMouvements = async (formData, signal) => {
    try {
        const response = await apiClientUpload.post('/mouvements/import', formData, {
            signal: signal,
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log(`Progression: ${progress}%`);
                }
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erreur lors de l\'importation des mouvements:', error);
        if (axios.isCancel(error)) {
            throw new Error('Importation annulée');
        }
        if (error.response) {
            throw new Error(error.response.data.message || 'Erreur serveur lors de l\'importation');
        }
        throw new Error('Erreur de connexion au serveur');
    }
};

export const getTickets = async () => {
    try {
        const response = await apiClient.get('/tickets'); 
        console.log("Appel de l'API à l'URL : http://localhost:4000/api/tickets"); 
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getTicketById = async (id) => {
    try {
        const response = await apiClient.get(`/tickets/${id}`);
        // Retourne l'objet de données (incluant les relations demandeur/matériel si inclus par l'API)
        return response.data; 
    } catch (error) {
        console.error("Erreur lors de la récupération du ticket:", error);
        throw error; 
    }
};

export const createTicket = async (data) => {
    try {
        // 'data' doit contenir : titre, description, id_materiels, id_n_demandeur, etc.
        const response = await apiClient.post('/tickets', data);
        return response.data; 
    } catch (error) {
        const userFriendlyErrorMessage = getErrorMessage(error);
        console.error("Détail de l'erreur d'API:", error.response?.data || error);
        throw new Error(userFriendlyErrorMessage);
    }
};

export const updateTicket = async (id, data) => {
    try {
        // Utile pour changer le statut, la priorité ou assigner un technicien (id_n_assigne)
        const response = await apiClient.put(`/tickets/${id}`, data);
        return response.data; 
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const deleteTicket = async (id) => {
    try {
        const response = await apiClient.delete(`/tickets/${id}`);
        return response.data; 
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};


// FETCH ALL COMMENTS (Récupérer tous les commentaires)
export const fetchCommentaires = async () => {
    // Correspond à GET /api/commentaires
    const response = await apiClient.get('/commentaires');
    return response.data;
};

// GET COMMENT BY ID (Récupérer un commentaire spécifique)
export const getCommentaireById = async (commentId) => {
    // Correspond à GET /api/commentaires/:id
    const response = await apiClient.get(`/commentaires/${commentId}`);
    return response.data;
};

// CREATE COMMENT (Ajouter un commentaire lié à un ticket et un auteur)
export const addCommentaire = async (commentData) => {
    // 'commentData' doit contenir : contenu, idTicket, idAuteur
    // Correspond à POST /api/commentaires
    const response = await apiClient.post('/commentaires', commentData);
    return response.data;
};

// UPDATE COMMENT (Modifier le texte d'un commentaire)
export const updateCommentaire = async (commentId, commentData) => {
    // 'commentData' contient généralement uniquement le champ { contenu: "..." }
    // Correspond à PUT /api/commentaires/:id
    const response = await apiClient.put(`/commentaires/${commentId}`, commentData);
    return response.data;
};

// DELETE COMMENT (Supprimer un commentaire)
export const deleteCommentaire = async (commentId) => {
    // Correspond à DELETE /api/commentaires/:id
    const response = await apiClient.delete(`/commentaires/${commentId}`);
    return response.data;
};

// OPTIONNEL : FETCH BY TICKET (Récupérer les commentaires d'un ticket spécifique)
export const fetchCommentairesByTicket = async (ticketId) => {
    // Correspond à GET /api/commentaires/ticket/:id
    const response = await apiClient.get(`/commentaires/ticket/${ticketId}`);
    return response.data;
};

// CLOSE TICKET (Fermer un ticket)
export const closeTicket = async (ticketId, solution = '', motif = '', fermePar, dureeResolution) => {
    try {
        const response = await apiClient.put(`/tickets/${ticketId}/close`, { solution, motif, fermePar, dureeResolution });
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

// ASSIGN TICKET (Assigner un ticket à un technicien)
export const assignTicket = async (ticketId, userId, nomAssigne = '') => {
    // Correspond à PUT /api/tickets/:id/assign
    const response = await apiClient.put(`/tickets/${ticketId}/assign`, { idAssigne: userId, nomAssigne });
    return response.data;
};

export const fetchDocuments = async () => {
  try {
    const response = await apiClient.get('/documents');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchDocumentsStats = async () => {
  try {
    const response = await apiClient.get('/documents/stats');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getDocumentById = async (id) => {
  try {
    const response = await apiClient.get(`/documents/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createDocument = async (data) => {
  try {
    const response = await apiClient.post('/documents', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createDocumentWithFile = async (formData) => {
  try {
    const response = await apiClientUpload.post('/documents', formData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateDocument = async (id, data) => {
  try {
    const response = await apiClient.put(`/documents/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateDocumentWithFile = async (id, formData) => {
  try {
    const response = await apiClientUpload.put(`/documents/${id}`, formData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteDocument = async (id) => {
    try {
        const response = await apiClient.delete(`/documents/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(getErrorMessage(error));
    }
};

export const getPiecesJointes = async (documentId) => {
  try {
    const response = await apiClient.get(`/documents/${documentId}/pj`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const uploadPieceJointe = async (documentId, file) => {
  try {
    const fd = new FormData();
    fd.append('pj', file);
    const response = await apiClientUpload.post(`/documents/${documentId}/pj`, fd);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deletePieceJointe = async (pjId) => {
  try {
    const response = await apiClient.delete(`/documents/pj/${pjId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export default apiClient;
