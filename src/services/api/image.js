import apiClient from './client';

// Document Image Group APIs
export const getDocumentImageGroups = (params = {}) => {
    const defaultParams = {
        limit: 100,
        page: 1,
        sort: 'xorder:1,guidfixed:1'
    };
    return apiClient.get('documentimagegroup', {
        params: { ...defaultParams, ...params }
    });
};

export const getDocumentImageDetail = (guidfixed) => {
    return apiClient.get(`documentimage/${guidfixed}`);
};

export const addDocumentImageComment = (guidfixed, comment) => {
    return apiClient.put(`documentimage/${guidfixed}/comment`, { comment });
};

export const updateDocumentImageGroupTags = (guidfixed, tags) => {
    return apiClient.put(`documentimagegroup/${guidfixed}/tags`, tags);
};

// Upload APIs
export const uploadImage = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('upload/images', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const bulkCreateDocumentImages = (data) => {
    return apiClient.post('documentimage/bulk', data);
};

// Merge APIs
export const mergeDocumentImageGroups = (data) => {
    return apiClient.post('documentimagegroup', data);
};

export const recountTaskDocuments = (taskGuid) => {
    return apiClient.put(`documentimagegroup/task/${taskGuid}/recount`);
};

export const getDocumentImageGroup = (guidfixed) => {
    return apiClient.get(`documentimagegroup/${guidfixed}`);
};

export const updateDocumentImageGroupsOrder = (taskGuid, orderData) => {
    return apiClient.put(`documentimagegroup/xsort/${taskGuid}`, orderData);
};

// Ungroup API
export const ungroupDocumentImageGroup = (guidfixed) => {
    return apiClient.put(`documentimagegroup/${guidfixed}/ungroup`);
};

// Delete API
export const deleteDocumentImageGroups = (guidfixedArray) => {
    return apiClient.delete('documentimagegroup', {
        data: guidfixedArray
    });
};

// Sort images within a group
export const updateDocumentImageGroupImages = (groupGuidfixed, imagesArray) => {
    return apiClient.put(`documentimagegroup/${groupGuidfixed}/documentimages`, imagesArray);
};
