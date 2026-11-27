import { apiClient, getErrorMessage } from './client';

// --- HISTORIQUE DES INTERVENTIONS ---
// periode : 'jour' | 'mois' | 'annee' ; date : 'AAAA-MM-JJ', 'AAAA-MM' ou 'AAAA'.
// Réponse : { periode, debut, fin, stats, interventions }.
// materiel / beneficiaire : liens « Récurrences » du tableau de bord.
export const getInterventions = async ({ periode, date, types, sousType, technicien, source, bloque, materiel, beneficiaire } = {}) => {
  try {
    const params = { periode, date };
    if (types?.length) params.types = types.join(',');
    if (sousType) params.sous_type = sousType;
    if (technicien) params.technicien = technicien;
    if (source) params.source = source;
    if (bloque) params.bloque = '1';
    if (materiel) params.materiel = materiel;
    if (beneficiaire) params.beneficiaire = beneficiaire;
    const response = await apiClient.get('/interventions', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Tableau de bord : statistiques de la période sans la liste, et totaux de la
// période précédente ({ total, duree_totale, interventions_bloquantes,
// utilisateurs_bloques, temps_bloque, serie, a_date, a_venir }).
export const getInterventionStats = async ({ periode, date }) => {
  try {
    const response = await apiClient.get('/interventions/stats', { params: { periode, date } });
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
