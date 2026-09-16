import { apiClient, apiClientUpload, getErrorMessage } from './client';

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
