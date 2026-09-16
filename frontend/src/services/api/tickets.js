import { apiClient, getErrorMessage } from './client';

export const getTickets = async () => {
  try {
    const response = await apiClient.get('/tickets');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getTicketById = async (id) => {
  try {
    const response = await apiClient.get(`/tickets/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération du ticket:', error);
    throw error;
  }
};

export const createTicket = async (data) => {
  try {
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

export const fetchCommentaires = async () => {
  const response = await apiClient.get('/commentaires');
  return response.data;
};

export const getCommentaireById = async (commentId) => {
  const response = await apiClient.get(`/commentaires/${commentId}`);
  return response.data;
};

// 'commentData' doit contenir : contenu, idTicket, idAuteur
export const addCommentaire = async (commentData) => {
  const response = await apiClient.post('/commentaires', commentData);
  return response.data;
};

export const updateCommentaire = async (commentId, commentData) => {
  const response = await apiClient.put(`/commentaires/${commentId}`, commentData);
  return response.data;
};

export const deleteCommentaire = async (commentId) => {
  const response = await apiClient.delete(`/commentaires/${commentId}`);
  return response.data;
};

export const fetchCommentairesByTicket = async (ticketId) => {
  const response = await apiClient.get(`/commentaires/ticket/${ticketId}`);
  return response.data;
};

export const closeTicket = async (ticketId, solution = '', motif = '', fermePar, dureeResolution) => {
  try {
    const response = await apiClient.put(`/tickets/${ticketId}/close`, { solution, motif, fermePar, dureeResolution });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const assignTicket = async (ticketId, userId, nomAssigne = '') => {
  const response = await apiClient.put(`/tickets/${ticketId}/assign`, { idAssigne: userId, nomAssigne });
  return response.data;
};
