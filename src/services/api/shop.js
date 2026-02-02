import apiClient from './client';

/**
 * ดึงข้อมูลกิจการตาม shopId
 * @param {string} shopId - รหัสกิจการ
 * @returns {Promise} ข้อมูลกิจการ
 */
export const getShop = async (shopId) => {
    try {
        const response = await apiClient.get(`/shop/${shopId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching shop:', error);
        throw error;
    }
};

/**
 * อัพเดตข้อมูลกิจการ
 * @param {string} shopId - รหัสกิจการ
 * @param {object} data - ข้อมูลกิจการที่ต้องการอัพเดต
 * @returns {Promise} ผลการอัพเดต
 */
export const updateShop = async (shopId, data) => {
    try {
        const response = await apiClient.put(`/shop/${shopId}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating shop:', error);
        throw error;
    }
};
