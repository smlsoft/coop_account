import api from '@/services/api';
import { signOutFirebase } from '@/services/firebase';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

// Reactive state สำหรับข้อมูล user
const token = ref(localStorage.getItem('token') || '');
const shopId = ref(localStorage.getItem('shopid') || '');
const shopName = ref(localStorage.getItem('shopname') || '');
const isAuthenticated = ref(localStorage.getItem('isAuthenticated') === 'true');
const displayName = ref(localStorage.getItem('displayName') || '');
const username = ref(localStorage.getItem('username') || '');

export function useAuth() {
    const router = useRouter();
    const toast = useToast();

    // Computed properties
    const hasSelectedShop = computed(() => !!shopId.value);
    const currentShop = computed(() => ({
        id: shopId.value,
        name: shopName.value
    }));

    // Login function
    const login = async (usernameInput, password) => {
        try {
            const response = await api.login(usernameInput, password);

            if (response.data.success) {
                // Update state และ localStorage
                token.value = response.data.token;
                isAuthenticated.value = true;
                username.value = usernameInput;

                localStorage.setItem('token', response.data.token);
                localStorage.setItem('refresh', response.data.refresh);
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('username', usernameInput);
                // Clear displayName เมื่อ login ด้วย username/password
                localStorage.removeItem('displayName');
                displayName.value = '';

                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ'
            };
        }
    };

    // Login with Google function
    const loginGoogle = async (googleToken, googleDisplayName) => {
        try {
            const response = await api.loginWithGoogle(googleToken);

            if (response.data.success && response.data.token) {
                // Update state และ localStorage
                token.value = response.data.token;
                isAuthenticated.value = true;
                displayName.value = googleDisplayName;

                localStorage.setItem('token', response.data.token);
                localStorage.setItem('refresh', response.data.refresh || '');
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('displayName', googleDisplayName);
                // Clear username เมื่อ login ด้วย Google
                localStorage.removeItem('username');
                username.value = '';

                return { success: true };
            }

            return {
                success: false,
                error: response.data.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
            };
        }
    };

    // Logout function (ใช้ได้ทั้ง user/password และ Google Sign-In)
    const logout = async () => {
        try {
            // Logout จาก Backend API
            await api.logout();
        } catch (error) {
            console.error('Logout API error:', error);
        }

        try {
            // Logout จาก Firebase (สำหรับ Google Sign-In)
            await signOutFirebase();
        } catch (error) {
            console.error('Firebase signout error:', error);
        }

        // ลบข้อมูลทั้งหมด
        clearAuthData();

        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'ออกจากระบบสำเร็จ',
            life: 2000
        });

        router.push({ name: 'login' });
    };

    // Select shop function
    const selectShop = async (shop) => {
        try {
            const response = await api.selectShop(shop.shopid);

            if (response.data.success) {
                shopId.value = shop.shopid;
                shopName.value = shop.name;

                localStorage.setItem('shopid', shop.shopid);
                localStorage.setItem('shopname', shop.name);

                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                error: 'เลือกร้านค้าไม่สำเร็จ'
            };
        }
    };

    // Clear all auth data
    const clearAuthData = () => {
        token.value = '';
        shopId.value = '';
        shopName.value = '';
        isAuthenticated.value = false;
        displayName.value = '';
        username.value = '';

        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        localStorage.removeItem('shopid');
        localStorage.removeItem('shopname');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('displayName');
        localStorage.removeItem('username');
    };

    return {
        // State
        token,
        shopId,
        shopName,
        isAuthenticated,
        displayName,
        username,

        // Computed
        hasSelectedShop,
        currentShop,

        // Methods
        login,
        loginGoogle,
        logout,
        selectShop,
        clearAuthData
    };
}
