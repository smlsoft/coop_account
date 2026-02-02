import apiClient from './client';

/**
 * ดึงรายการงวดบัญชี
 * @param {object} params - query parameters (limit, page, q, sort)
 * @returns {Promise} รายการงวดบัญชี
 */
export const getAccountPeriods = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 12,
            page: 1,
            sort: 'period:-1'
        };
        const response = await apiClient.get('/gl/accountperiodmaster', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching account periods:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลงวดบัญชีตาม ID
 * @param {string} id - รหัสงวดบัญชี (guidfixed)
 * @returns {Promise} ข้อมูลงวดบัญชี
 */
export const getAccountPeriod = async (id) => {
    try {
        const response = await apiClient.get(`/gl/accountperiodmaster/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching account period:', error);
        throw error;
    }
};

/**
 * ดึงงวดบัญชีตามวันที่
 * @param {string} dateList - รายการวันที่ (comma separated)
 * @returns {Promise} ข้อมูลงวดบัญชี
 */
export const getAccountPeriodByDate = async (dateList) => {
    try {
        const response = await apiClient.get('/gl/accountperiodmaster/by-date', {
            params: { 'date-list': dateList }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching account period by date:', error);
        throw error;
    }
};

/**
 * สร้างงวดบัญชีใหม่
 * @param {object} data - ข้อมูลงวดบัญชี { startdate, enddate, period, description, isdisabled }
 * @returns {Promise} ผลการสร้าง
 */
export const createAccountPeriod = async (data) => {
    try {
        const response = await apiClient.post('/gl/accountperiodmaster', data);
        return response.data;
    } catch (error) {
        console.error('Error creating account period:', error);
        throw error;
    }
};

/**
 * สร้างงวดบัญชีแบบ bulk (หลายรายการ)
 * @param {array} data - รายการงวดบัญชี [{ startdate, enddate, period, description, isdisabled }, ...]
 * @returns {Promise} ผลการสร้าง
 */
export const createAccountPeriodBulk = async (data) => {
    try {
        const response = await apiClient.post('/gl/accountperiodmaster/bulk', data);
        return response.data;
    } catch (error) {
        console.error('Error creating account periods bulk:', error);
        throw error;
    }
};

/**
 * แก้ไขงวดบัญชี
 * @param {string} id - รหัสงวดบัญชี (guidfixed)
 * @param {object} data - ข้อมูลงวดบัญชีที่ต้องการแก้ไข
 * @returns {Promise} ผลการแก้ไข
 */
export const updateAccountPeriod = async (id, data) => {
    try {
        const response = await apiClient.put(`/gl/accountperiodmaster/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating account period:', error);
        throw error;
    }
};

/**
 * ลบงวดบัญชี
 * @param {string} id - รหัสงวดบัญชี (guidfixed)
 * @returns {Promise} ผลการลบ
 */
export const deleteAccountPeriod = async (id) => {
    try {
        const response = await apiClient.delete(`/gl/accountperiodmaster/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting account period:', error);
        throw error;
    }
};

/**
 * ลบงวดบัญชีแบบ bulk (หลายรายการ)
 * @param {array} ids - รายการรหัสงวดบัญชี ["id1", "id2", ...]
 * @returns {Promise} ผลการลบ
 */
export const deleteAccountPeriodBulk = async (ids) => {
    try {
        const response = await apiClient.delete('/gl/accountperiodmaster', {
            data: ids
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting account periods bulk:', error);
        throw error;
    }
};
