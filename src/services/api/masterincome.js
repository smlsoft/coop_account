import apiClient from './client';

/**
 * ดึงรายการรายได้อื่น ๆ
 * @param {object} params - query parameters (limit, page, q, sort)
 * @returns {Promise} รายการรายได้อื่น ๆ
 */
export const getMasterIncomes = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 20,
            page: 1,
            sort: 'code:1',
            q: ''
        };
        const response = await apiClient.get('/master-income', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching master incomes:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลรายได้อื่น ๆ ตาม ID
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ข้อมูลรายได้อื่น ๆ
 */
export const getMasterIncome = async (id) => {
    try {
        const response = await apiClient.get(`/master-income/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching master income:', error);
        throw error;
    }
};

/**
 * สร้างรายได้อื่น ๆ ใหม่
 * @param {object} data - ข้อมูลรายได้อื่น ๆ { guidfixed, code, names, accountcode, accountname }
 * @returns {Promise} ผลการสร้าง
 */
export const createMasterIncome = async (data) => {
    try {
        const response = await apiClient.post('/master-income', data);
        return response.data;
    } catch (error) {
        console.error('Error creating master income:', error);
        throw error;
    }
};

/**
 * แก้ไขรายได้อื่น ๆ
 * @param {string} id - รหัส (guidfixed)
 * @param {object} data - ข้อมูลรายได้อื่น ๆ ที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateMasterIncome = async (id, data) => {
    try {
        const response = await apiClient.put(`/master-income/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating master income:', error);
        throw error;
    }
};

/**
 * ลบรายได้อื่น ๆ
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteMasterIncome = async (id) => {
    try {
        const response = await apiClient.delete(`/master-income/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting master income:', error);
        throw error;
    }
};
