import { apiClient, getErrorMessage } from './client';

export const fetchALocaux = async () => {
  try {
    const response = await apiClient.get('/locaux');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const fetchLocaux = async () => {
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
  const response = await apiClient.post('/locaux', locationData);
  return response.data;
};

export const updateLocation = async (locationId, locationData) => {
  const response = await apiClient.put(`/locaux/${locationId}`, locationData);
  return response.data;
};

export const deleteLocation = async (locationId) => {
  const response = await apiClient.delete(`/locaux/${locationId}`);
  return response.data;
};
