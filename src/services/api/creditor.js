import apiClient from './client';

/**
 * ดึงรายการเจ้าหนี้
 * @param {object} params - query parameters (limit, q, page, sort)
 * @returns {Promise} รายการเจ้าหนี้
 */
export const getCreditors = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            q: '',
            page: 1,
            sort: 'code:1'
        };
        const response = await apiClient.get('/debtaccount/creditor', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching creditors:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลเจ้าหนี้ตาม ID
 * @param {string} id - รหัสเจ้าหนี้ (guidfixed)
 * @returns {Promise} ข้อมูลเจ้าหนี้
 */
export const getCreditor = async (id) => {
    try {
        const response = await apiClient.get(`/debtaccount/creditor/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching creditor:', error);
        throw error;
    }
};

/**
 * สร้างเจ้าหนี้ใหม่
 * @param {object} data - ข้อมูลเจ้าหนี้
 * @returns {Promise} ผลการสร้าง
 */
export const createCreditor = async (data) => {
    try {
        const response = await apiClient.post('/debtaccount/creditor', data);
        return response.data;
    } catch (error) {
        console.error('Error creating creditor:', error);
        throw error;
    }
};

/**
 * อัพเดทข้อมูลเจ้าหนี้
 * @param {string} id - รหัสเจ้าหนี้ (guidfixed)
 * @param {object} data - ข้อมูลที่ต้องการอัพเดท
 * @returns {Promise} ผลการอัพเดท
 */
export const updateCreditor = async (id, data) => {
    try {
        const response = await apiClient.put(`/debtaccount/creditor/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating creditor:', error);
        throw error;
    }
};

/**
 * ลบเจ้าหนี้
 * @param {string} id - รหัสเจ้าหนี้ (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteCreditor = async (id) => {
    try {
        const response = await apiClient.delete(`/debtaccount/creditor/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting creditor:', error);
        throw error;
    }
};

/**
 * นำเข้าเจ้าหนี้แบบ bulk
 * @param {array} data - รายการข้อมูลเจ้าหนี้
 * @returns {Promise} ผลการนำเข้า
 */
export const importCreditors = async (data) => {
    try {
        const response = await apiClient.post('/debtaccount/creditor/bulk', data);
        return response.data;
    } catch (error) {
        console.error('Error importing creditors:', error);
        throw error;
    }
};
