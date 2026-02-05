import apiClient from './client';

/**
 * ดึงรายการรูปแบบการบันทึกบัญชี
 * @param {object} params - query parameters (limit, page, q, sort)
 * @returns {Promise} รายการรูปแบบการบันทึกบัญชี
 */
export const getDocumentFormats = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 20,
            page: 1,
            sort: 'doccode:1',
            q: ''
        };
        const response = await apiClient.get('/transaction/document-formate', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching document formats:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลรูปแบบการบันทึกบัญชี ตาม ID
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ข้อมูลรูปแบบการบันทึกบัญชี
 */
export const getDocumentFormat = async (id) => {
    try {
        const response = await apiClient.get(`/transaction/document-formate/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching document format:', error);
        throw error;
    }
};

/**
 * สร้างรูปแบบการบันทึกบัญชี ใหม่
 * @param {object} data - ข้อมูลรูปแบบการบันทึกบัญชี
 * @returns {Promise} ผลการสร้าง
 */
export const createDocumentFormat = async (data) => {
    try {
        const response = await apiClient.post('/transaction/document-formate', data);
        return response.data;
    } catch (error) {
        console.error('Error creating document format:', error);
        throw error;
    }
};

/**
 * แก้ไขรูปแบบการบันทึกบัญชี
 * @param {string} id - รหัส (guidfixed)
 * @param {object} data - ข้อมูลรูปแบบการบันทึกบัญชี ที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateDocumentFormat = async (id, data) => {
    try {
        const response = await apiClient.put(`/transaction/document-formate/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating document format:', error);
        throw error;
    }
};

/**
 * ลบรูปแบบการบันทึกบัญชี
 * @param {string} id - รหัส (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteDocumentFormat = async (id) => {
    try {
        const response = await apiClient.delete(`/transaction/document-formate/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting document format:', error);
        throw error;
    }
};
