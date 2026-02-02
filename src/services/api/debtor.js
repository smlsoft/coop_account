import apiClient from './client';

/**
 * ดึงรายการลูกหนี้
 * @param {object} params - query parameters (limit, q, page, sort)
 * @returns {Promise} รายการลูกหนี้
 */
export const getDebtors = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            q: '',
            page: 1,
            sort: 'code:1'
        };
        const response = await apiClient.get('/debtaccount/debtor', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching debtors:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลลูกหนี้ตาม ID
 * @param {string} id - รหัสลูกหนี้ (guidfixed)
 * @returns {Promise} ข้อมูลลูกหนี้
 */
export const getDebtor = async (id) => {
    try {
        const response = await apiClient.get(`/debtaccount/debtor/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching debtor:', error);
        throw error;
    }
};

/**
 * สร้างลูกหนี้ใหม่
 * @param {object} data - ข้อมูลลูกหนี้
 * @returns {Promise} ผลการสร้าง
 */
export const createDebtor = async (data) => {
    try {
        const response = await apiClient.post('/debtaccount/debtor', data);
        return response.data;
    } catch (error) {
        console.error('Error creating debtor:', error);
        throw error;
    }
};

/**
 * แก้ไขลูกหนี้
 * @param {string} id - รหัสลูกหนี้ (guidfixed)
 * @param {object} data - ข้อมูลลูกหนี้ที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateDebtor = async (id, data) => {
    try {
        const response = await apiClient.put(`/debtaccount/debtor/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating debtor:', error);
        throw error;
    }
};

/**
 * ลบลูกหนี้
 * @param {string} id - รหัสลูกหนี้ (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteDebtor = async (id) => {
    try {
        const response = await apiClient.delete(`/debtaccount/debtor/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting debtor:', error);
        throw error;
    }
};
