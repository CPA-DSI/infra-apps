import { apiClient, getErrorMessage } from './client';

export const fetchProduits = async () => {
  try {
    const response = await apiClient.get('/produits');
    return response.data;
  } catch (error) {
    const enriched = new Error(getErrorMessage(error));
    enriched.originalError = error;
    throw enriched;
  }
};

export const getProductById = async (productId) => {
  const response = await apiClient.get(`/produits/${productId}`);
  return response.data;
};

export const addProduct = async (productData) => {
  const response = await apiClient.post('/produits', productData);
  return response.data;
};

export const updateProduct = async (productId, productData) => {
  const response = await apiClient.put(`/produits/${productId}`, productData);
  return response.data;
};

export const deleteProduct = async (productId) => {
  const response = await apiClient.delete(`/produits/${productId}`);
  return response.data;
};

// Récupérer tous les produits (alias pour fetchProduits)
export const getAllProducts = async () => {
  try {
    const response = await apiClient.get('/produits');
    return response.data;
  } catch (error) {
    console.error('Erreur dans getAllProducts:', error);
    throw new Error(getErrorMessage(error));
  }
};
