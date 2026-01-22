import apiClient from './client';

// Task APIs (Image Upload)
export const getTasks = (params = {}) => {
    const defaultParams = {
        limit: 20,
        page: 1,
        status: '0,1,2,3,4,5',
        sort: 'ownerat:-1'
    };
    return apiClient.get('task', {
        params: { ...defaultParams, ...params }
    });
};

export const getTask = (guidfixed) => {
    return apiClient.get(`task/${guidfixed}`);
};

export const createTask = (data) => {
    return apiClient.post('task', data);
};

export const updateTask = (guidfixed, data) => {
    return apiClient.put(`task/${guidfixed}`, data);
};

export const updateTaskStatus = (guidfixed, status) => {
    return apiClient.put(`task/${guidfixed}/status`, status);
};

export const deleteTask = (guidfixed) => {
    return apiClient.delete(`task/${guidfixed}`);
};

export const generateTaskId = () => {
    return apiClient.get('task/generate-code');
};
