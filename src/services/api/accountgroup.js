import apiClient from './client';

/**
 * ดึงรายการกลุ่มบัญชี
 * @param {object} params - query parameters (limit, q, page, sort)
 * @returns {Promise} รายการกลุ่มบัญชี
 */
export const getAccountGroups = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            q: '',
            page: 1,
            sort: 'code:1'
        };
        const response = await apiClient.get('/gl/accountgroup', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching account groups:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลกลุ่มบัญชีตาม ID
 * @param {string} id - รหัสกลุ่มบัญชี (guidfixed)
 * @returns {Promise} ข้อมูลกลุ่มบัญชี
 */
export const getAccountGroup = async (id) => {
    try {
        const response = await apiClient.get(`/gl/accountgroup/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching account group:', error);
        throw error;
    }
};

/**
 * สร้างกลุ่มบัญชีใหม่
 * @param {object} data - ข้อมูลกลุ่มบัญชี
 * @returns {Promise} ผลการสร้าง
 */
export const createAccountGroup = async (data) => {
    try {
        const response = await apiClient.post('/gl/accountgroup', data);
        return response.data;
    } catch (error) {
        console.error('Error creating account group:', error);
        throw error;
    }
};

/**
 * แก้ไขกลุ่มบัญชี
 * @param {string} id - รหัสกลุ่มบัญชี (guidfixed)
 * @param {object} data - ข้อมูลกลุ่มบัญชีที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateAccountGroup = async (id, data) => {
    try {
        const response = await apiClient.put(`/gl/accountgroup/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating account group:', error);
        throw error;
    }
};

/**
 * ลบกลุ่มบัญชี
 * @param {string} id - รหัสกลุ่มบัญชี (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteAccountGroup = async (id) => {
    try {
        const response = await apiClient.delete(`/gl/accountgroup/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting account group:', error);
        throw error;
    }
};
