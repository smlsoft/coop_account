import axios from 'axios';

const OCR_API_BASE_URL = import.meta.env.VITE_APP_API_OCR || 'https://account-ocr-api.dedepos.com/';
const API_BASE_URL = import.meta.env.VITE_APP_API || 'https://api.dev.dedepos.com/';

// OCR API Client (ไม่ต้องการ token)
const ocrApiClient = axios.create({
    baseURL: OCR_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        accept: 'application/json'
    }
});

// Main API Client (สำหรับ update documentimagegroup)
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        accept: 'application/json'
    }
});

// Interceptor สำหรับเพิ่ม token ใน header อัตโนมัติ (สำหรับ apiClient เท่านั้น)
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * วิเคราะห์เอกสารด้วย OCR AI
 * @param {Object} payload - ข้อมูลสำหรับวิเคราะห์
 * @param {string} payload.shopid - Shop ID
 * @param {string} payload.model - AI Model (mistral, gemini)
 * @param {Array} payload.imagereferences - Array of image references
 * @returns {Promise}
 */
export const analyzeReceipt = (payload) => {
    return ocrApiClient.post('/api/v1/analyze-receipt', payload);
};

/**
 * ทดสอบ Template OCR
 * @param {Object} formData - FormData containing file and template data
 * @returns {Promise}
 */
export const testTemplate = (formData) => {
    return ocrApiClient.post('/api/v1/test-template', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

/**
 * อัพเดท ocranalyzeai ใน documentimagegroup
 * @param {string} guidfixed - Document image group GUID
 * @param {Object} data - ข้อมูลที่ต้องการอัพเดท
 * @returns {Promise}
 */
export const updateDocumentImageGroup = (guidfixed, data) => {
    return apiClient.put(`/documentimagegroup/${guidfixed}`, data);
};
