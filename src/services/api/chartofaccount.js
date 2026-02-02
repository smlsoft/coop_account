import apiClient from './client';

/**
 * ดึงรายการผังบัญชี
 * @param {object} params - query parameters (limit, q, page, sort)
 * @returns {Promise} รายการผังบัญชี
 */
export const getChartOfAccounts = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            q: '',
            page: 1,
            sort: 'accountcode:1'
        };
        const response = await apiClient.get('/gl/chartofaccount', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching chart of accounts:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลผังบัญชีตาม ID
 * @param {string} id - รหัสผังบัญชี
 * @returns {Promise} ข้อมูลผังบัญชี
 */
export const getChartOfAccount = async (id) => {
    try {
        const response = await apiClient.get(`/gl/chartofaccount/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching chart of account:', error);
        throw error;
    }
};

/**
 * สร้างผังบัญชีใหม่
 * @param {object} data - ข้อมูลผังบัญชี
 * @returns {Promise} ผลการสร้าง
 */
export const createChartOfAccount = async (data) => {
    try {
        const response = await apiClient.post('/gl/chartofaccount', data);
        return response.data;
    } catch (error) {
        console.error('Error creating chart of account:', error);
        throw error;
    }
};

/**
 * อัพเดตผังบัญชี
 * @param {string} id - รหัสผังบัญชี
 * @param {object} data - ข้อมูลผังบัญชีที่ต้องการอัพเดต
 * @returns {Promise} ผลการอัพเดต
 */
export const updateChartOfAccount = async (id, data) => {
    try {
        const response = await apiClient.put(`/gl/chartofaccount/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating chart of account:', error);
        throw error;
    }
};

/**
 * ลบผังบัญชี
 * @param {string} id - รหัสผังบัญชี
 * @returns {Promise} ผลการลบ
 */
export const deleteChartOfAccount = async (id) => {
    try {
        const response = await apiClient.delete(`/gl/chartofaccount/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting chart of account:', error);
        throw error;
    }
};
