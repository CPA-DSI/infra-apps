import { apiClient, getErrorMessage } from './client';

// --- HISTORIQUE DES INTERVENTIONS ---
// periode : 'jour' | 'mois' | 'annee' ; date : 'AAAA-MM-JJ', 'AAAA-MM' ou 'AAAA'.
// Réponse : { periode, debut, fin, stats, interventions }.
export const getInterventions = async ({ periode, date, types, technicien, source } = {}) => {
  try {
    const params = { periode, date };
    if (types?.length) params.types = types.join(',');
    if (technicien) params.technicien = technicien;
    if (source) params.source = source;
    const response = await apiClient.get('/interventions', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createIntervention = async (data) => {
  try {
    const response = await apiClient.post('/interventions', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateIntervention = async (id, data) => {
  try {
    const response = await apiClient.put(`/interventions/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteIntervention = async (id) => {
  try {
    await apiClient.delete(`/interventions/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};
