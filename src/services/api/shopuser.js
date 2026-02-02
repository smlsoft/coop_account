import apiClient from './client';

/**
 * ดึงรายการผู้ใช้งานในระบบ
 * @param {object} params - query parameters (limit, page, q)
 * @returns {Promise} รายการผู้ใช้งาน
 */
export const getShopUsers = async (params = {}) => {
    try {
        const defaultParams = {
            limit: 10,
            page: 1,
            q: ''
        };
        const response = await apiClient.get('/shop/users', {
            params: { ...defaultParams, ...params }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching shop users:', error);
        throw error;
    }
};

/**
 * เพิ่ม/แก้ไขสิทธิ์ผู้ใช้งาน
 * @param {object} data - ข้อมูลผู้ใช้ { shopid, username, role }
 * @returns {Promise} ผลการบันทึก
 */
export const saveShopUserPermission = async (data) => {
    try {
        const response = await apiClient.put('/shop/permission', data);
        return response.data;
    } catch (error) {
        console.error('Error saving shop user permission:', error);
        throw error;
    }
};

/**
 * ลบผู้ใช้งานออกจากระบบ
 * @param {string} username - ชื่อผู้ใช้
 * @returns {Promise} ผลการลบ
 */
export const deleteShopUser = async (username) => {
    try {
        const response = await apiClient.delete(`/shop/permission/${username}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting shop user:', error);
        throw error;
    }
};
