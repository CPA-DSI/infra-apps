import { apiClient, getErrorMessage } from './client';

export const STATUTS_ECRAN_LABELS = {
  EN_STOCK: 'En stock',
  AFFECTE: 'Affecté',
  EN_REPARATION: 'En réparation',
  REFORME: 'Réformé',
};

export const fetchEcrans = async (statut) => {
  try {
    const response = await apiClient.get('/ecrans', { params: statut ? { statut } : {} });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const addEcran = async (ecranData) => {
  try {
    const response = await apiClient.post('/ecrans', ecranData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Déplace un écran. data : { id_materiels (null = hors poste), statut?,
 * mode_conflit? ('refuser' | 'echanger' | 'stock'), motif?, etat_remise?, commentaire? }
 * En cas de conflit (poste cible déjà équipé), l'erreur levée porte
 * `status === 409` et `conflit` ({ id_ecran, code_ecran }).
 */
export const affecterEcran = async (id, data) => {
  try {
    const response = await apiClient.post(`/ecrans/${id}/affecter`, data);
    return response.data;
  } catch (error) {
    const err = new Error(getErrorMessage(error));
    err.status = error.response?.status;
    err.conflit = error.response?.data?.conflit;
    throw err;
  }
};

export const fetchAffectationsEcran = async (id) => {
  try {
    const response = await apiClient.get(`/ecrans/${id}/affectations`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};
