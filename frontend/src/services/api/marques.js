import { apiClient, getErrorMessage } from './client';

export const fetchAMarques = async () => {
  try {
    const response = await apiClient.get('/marques');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Récupère les marques avec le nombre d'équipements (relation materiels via Prisma)
export const fetchMarquesWithCount = async () => {
  try {
    const response = await apiClient.get('/marques/with-count');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

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
    await apiClient.delete(`/marques/${id_marque}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};
