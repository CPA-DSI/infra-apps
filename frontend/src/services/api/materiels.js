import { apiClient, getErrorMessage } from './client';

export const fetchMaterielsWithUsers = async () => {
  try {
    const response = await apiClient.get('/materiels?includeUser=true');
    const sortedData = response.data.sort((a, b) => a.id_n - b.id_n);
    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error) || 'Erreur lors de fetchMaterielsWithUsers');
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
    const response = await apiClient.get('/materiels/count-equipe');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Réponse d'erreur du serveur:", error.response.data);
    }
    throw error;
  }
};

// Récupère les détails complets par équipe
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

export const fetchSSDStats = async () => {
  try {
    const response = await apiClient.get('/materiels/capacite-ssd');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchAllMateriels = async () => {
  try {
    const response = await apiClient.get('/materiels_all');
    const sortedData = response.data.sort((a, b) => a.id_n - b.id_n);
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
      .sort((a, b) => (a.id_n || 0) - (b.id_n || 0));

    return sortedData;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchAllMaterielsByIdN = async () => {
  try {
    const response = await apiClient.get('/materiels_all');
    const sortedData = response.data.sort((a, b) => a.id_n - b.id_n);
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

