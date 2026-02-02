import apiClient from './client';

/**
 * ดึงรายงานภาษีมูลค่าเพิ่ม (ภาษีซื้อ/ภาษีขาย)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {number} params.mode - โหมด (0 = ภาษีซื้อ, 1 = ภาษีขาย)
 * @param {number} params.year - ปี พ.ศ.
 * @param {number} params.period - เดือน (1-12)
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.shopname - ชื่อกิจการ
 * @param {string} params.taxid - เลขประจำตัวผู้เสียภาษี
 * @param {string} params.address - ที่อยู่กิจการ
 * @returns {Promise} ข้อมูลรายงานภาษี
 */
export const getJournalVat = async (params) => {
    try {
        const response = await apiClient.get('/apireport/journalvat', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal VAT report:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลรายละเอียดบันทึกบัญชีจากเลขที่เอกสาร
 * @param {string} docno - เลขที่เอกสาร
 * @returns {Promise} ข้อมูลรายละเอียดบันทึกบัญชี
 */
export const getJournalDetail = async (docno) => {
    try {
        const response = await apiClient.get(`/gl/journal/docno/${docno}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        throw error;
    }
};
