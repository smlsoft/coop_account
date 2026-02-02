import apiClient from './client';

/**
 * ดึงรายการสมุดรายวัน
 * @param {object} params - query parameters (limit, q, page, sort)
 * @returns {Promise} รายการสมุดรายวัน
 */
export const getJournalBooks = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            q: '',
            page: 1,
            sort: 'code:1'
        };
        const response = await apiClient.get('/gl/journalbook', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal books:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลสมุดรายวันตาม ID
 * @param {string} id - รหัสสมุดรายวัน (guidfixed)
 * @returns {Promise} ข้อมูลสมุดรายวัน
 */
export const getJournalBook = async (id) => {
    try {
        const response = await apiClient.get(`/gl/journalbook/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching journal book:', error);
        throw error;
    }
};

/**
 * สร้างสมุดรายวันใหม่
 * @param {object} data - ข้อมูลสมุดรายวัน
 * @returns {Promise} ผลการสร้าง
 */
export const createJournalBook = async (data) => {
    try {
        const response = await apiClient.post('/gl/journalbook', data);
        return response.data;
    } catch (error) {
        console.error('Error creating journal book:', error);
        throw error;
    }
};

/**
 * แก้ไขสมุดรายวัน
 * @param {string} id - รหัสสมุดรายวัน (guidfixed)
 * @param {object} data - ข้อมูลสมุดรายวันที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateJournalBook = async (id, data) => {
    try {
        const response = await apiClient.put(`/gl/journalbook/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating journal book:', error);
        throw error;
    }
};

/**
 * ลบสมุดรายวัน
 * @param {string} id - รหัสสมุดรายวัน (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteJournalBook = async (id) => {
    try {
        const response = await apiClient.delete(`/gl/journalbook/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting journal book:', error);
        throw error;
    }
};
