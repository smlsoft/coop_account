import apiClient from './client';

/**
 * ดึงรายการค่าใช้จ่ายอื่น ๆ
 * @param {object} params - query parameters (limit, page, q, sort)
 * @returns {Promise} รายการค่าใช้จ่ายอื่น ๆ
 */
export const getMasterExpenses = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 20,
            page: 1,
            sort: 'code:1',
            q: ''
        };
        const response = await apiClient.get('/master-expense', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching master expenses:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลค่าใช้จ่ายอื่น ๆ ตาม ID
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ข้อมูลค่าใช้จ่ายอื่น ๆ
 */
export const getMasterExpense = async (id) => {
    try {
        const response = await apiClient.get(`/master-expense/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching master expense:', error);
        throw error;
    }
};

/**
 * สร้างค่าใช้จ่ายอื่น ๆ ใหม่
 * @param {object} data - ข้อมูลค่าใช้จ่ายอื่น ๆ { guidfixed, code, names, accountcode, accountname }
 * @returns {Promise} ผลการสร้าง
 */
export const createMasterExpense = async (data) => {
    try {
        const response = await apiClient.post('/master-expense', data);
        return response.data;
    } catch (error) {
        console.error('Error creating master expense:', error);
        throw error;
    }
};

/**
 * แก้ไขค่าใช้จ่ายอื่น ๆ
 * @param {string} id - รหัส (guidfixed)
 * @param {object} data - ข้อมูลค่าใช้จ่ายอื่น ๆ ที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateMasterExpense = async (id, data) => {
    try {
        const response = await apiClient.put(`/master-expense/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating master expense:', error);
        throw error;
    }
};

/**
 * ลบค่าใช้จ่ายอื่น ๆ
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteMasterExpense = async (id) => {
    try {
        const response = await apiClient.delete(`/master-expense/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting master expense:', error);
        throw error;
    }
};
