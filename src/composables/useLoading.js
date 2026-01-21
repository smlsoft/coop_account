import { ref } from 'vue';

const isLoading = ref(false);
const loadingMessage = ref('กำลังโหลด...');

export function useLoading() {
    const showLoading = (message = 'กำลังโหลด...') => {
        loadingMessage.value = message;
        isLoading.value = true;
    };

    const hideLoading = () => {
        isLoading.value = false;
    };

    return {
        isLoading,
        loadingMessage,
        showLoading,
        hideLoading
    };
}
