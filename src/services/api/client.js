import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_APP_API || 'https://api.dev.dedepos.com/';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        accept: 'application/json'
    }
});

// Interceptor สำหรับเพิ่ม token ใน header อัตโนมัติ
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

// Interceptor สำหรับจัดการ response errors
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token หมดอายุหรือไม่ถูกต้อง - ให้ออกจากระบบ
            localStorage.removeItem('token');
            localStorage.removeItem('refresh');
            localStorage.removeItem('shopid');
            localStorage.removeItem('isAuthenticated');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
