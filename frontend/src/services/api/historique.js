import { apiClient, getErrorMessage } from './client';

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
    console.error('Erreur dans getHistoriqueArriveesWithFilters:', error);
    throw new Error(getErrorMessage(error));
  }
};

export const getHistoriqueArrivees = async () => {
  try {
    const response = await apiClient.get('/historique_arrive');
    return response.data;
  } catch (error) {
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

// Pas de création / modification / suppression directe de l'historique des
// arrivées : il est écrit côté serveur avec chaque variation de stock.

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
