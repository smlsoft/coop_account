import apiClient from './client';

// Dashboard Stats APIs
export const getChartOfAccount = (params = {}) => {
    return apiClient.get('gl/chartofaccount', { params });
};

export const getJournals = (params = {}) => {
    return apiClient.get('gl/journal', { params });
};

export const getDocumentImages = (params = {}) => {
    return apiClient.get('documentimagegroup', { params });
};

export const getDuplicateDocNos = () => {
    return apiClient.get('gl/journal/duplicate-docnos');
};
