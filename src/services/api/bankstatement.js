import axios from 'axios';

/**
 * Bank Statement Reader Service
 * เชื่อมต่อกับ Mistral OCR API สำหรับอ่าน Bank Statement PDF
 */

// สร้าง Axios instance แยกสำหรับ Bank Statement API
const bankStatementClient = axios.create({
    baseURL: import.meta.env.VITE_APP_BANK_STATEMENT_API,
    timeout: 90000, // 90 วินาที (เผื่อไว้สำหรับ OCR ที่ใช้เวลานาน)
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});

/**
 * อ่าน Bank Statement PDF ด้วย Mistral OCR (Auto Detection)
 * @param {File} file - ไฟล์ PDF Statement
 * @param {string|null} password - รหัสผ่าน PDF (ถ้ามี)
 * @returns {Promise} - { status, result, cached, meta }
 */
export const readBankStatement = async (file, password = null) => {
    try {
        const formData = new FormData();
        formData.append('file', file);

        // สร้าง query params (server ใช้ req.query.password)
        const params = {};
        if (password) {
            params.password = password;
        }

        console.log('[Bank Statement API] Uploading file:', file.name);
        console.log('[Bank Statement API] Has password:', !!password);

        const response = await bankStatementClient.post('/bankstatementreader/mistral-ocr/', formData, { params });

        console.log('[Bank Statement API] Response status:', response.data.status);

        return response.data;
    } catch (error) {
        console.error('[Bank Statement API] Error:', error);

        // จัดการ error response
        if (error.response?.data) {
            // ถ้า API ส่ง error message กลับมา
            throw {
                status: error.response.data.status || 'error',
                message: error.response.data.message || 'เกิดข้อผิดพลาดในการอ่าน Statement',
                detail: error.response.data.detail || null
            };
        }

        // ถ้าเป็น network error หรือ timeout
        if (error.code === 'ECONNABORTED') {
            throw {
                status: 'timeout',
                message: 'หมดเวลาการประมวลผล กรุณาลองใหม่อีกครั้ง'
            };
        }

        throw {
            status: 'error',
            message: error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'
        };
    }
};

/**
 * ตรวจสอบสถานะของ Bank Statement API
 * @returns {Promise<boolean>} - true ถ้า API พร้อมใช้งาน
 */
export const checkBankStatementAPIStatus = async () => {
    try {
        const response = await bankStatementClient.get('/health');
        return response.status === 200;
    } catch (error) {
        console.error('[Bank Statement API] Health check failed:', error);
        return false;
    }
};

export default {
    readBankStatement,
    checkBankStatementAPIStatus
};
