import { apiClient, getErrorMessage } from './client';

// --- CONFIGURATION EMAIL ---

export const getEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL HEBDOMADAIRE ---

export const getWeeklyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateWeeklyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/hebdomadaire', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteWeeklyEmailConfig = async () => {
  try {
    const response = await apiClient.delete('/config/hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getWeeklyConfigStatus = async () => {
  try {
    const response = await apiClient.get('/config/hebdomadaire/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL QUOTIDIENNE ---

export const getDailyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateDailyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/quotidien', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// --- CONFIGURATION EMAIL MENSUELLE ---

export const getMonthlyEmailConfig = async () => {
  try {
    const response = await apiClient.get('/config/mensuel');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateMonthlyEmailConfig = async (configData) => {
  try {
    const response = await apiClient.post('/config/mensuel', configData);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteMonthlyEmailConfig = async () => {
  try {
    const response = await apiClient.delete('/config/mensuel');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMonthlyConfigStatus = async () => {
  try {
    const response = await apiClient.get('/config/mensuel/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmail = async () => {
  try {
    const response = await apiClient.post('/email/send-test-quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmailQuotidien = async () => {
  try {
    const response = await apiClient.post('/email/send-test-quotidien');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmailHebdomadaire = async () => {
  try {
    const response = await apiClient.post('/email/send-test-hebdomadaire');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const sendTestEmailMensuel = async () => {
  try {
    const response = await apiClient.post('/email/send-test-mensuel');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};
