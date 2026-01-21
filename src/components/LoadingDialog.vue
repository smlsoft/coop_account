<script setup>
import { useLoading } from '@/composables/useLoading';

const { isLoading, loadingMessage } = useLoading();
</script>

<template>
    <Dialog v-model:visible="isLoading" modal :closable="false" :draggable="false" :dismissableMask="false" :showHeader="false" class="loading-dialog" :pt="{ mask: { class: 'loading-mask' } }">
        <div class="flex flex-col items-center justify-center p-6">
            <!-- Modern Spinner -->
            <div class="spinner-container mb-5">
                <div class="spinner">
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                    <i class="pi pi-sync spinner-icon"></i>
                </div>
            </div>

            <!-- Loading Message -->
            <p class="text-surface-900 dark:text-surface-0 text-base font-medium text-center">
                {{ loadingMessage || 'กำลังโหลด...' }}
            </p>

            <!-- Animated Dots -->
            <div class="loading-dots mt-2">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.loading-dialog {
    border-radius: 1rem;
    overflow: hidden;
    min-width: 280px;
    max-width: 320px;
}

:deep(.loading-mask) {
    backdrop-filter: blur(4px);
    background: rgba(0, 0, 0, 0.4) !important;
}

/* Spinner Container */
.spinner-container {
    position: relative;
    width: 64px;
    height: 64px;
}

.spinner {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spinner-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid transparent;
}

.spinner-ring:nth-child(1) {
    border-top-color: var(--p-primary-color);
    animation: spin 1s linear infinite;
}

.spinner-ring:nth-child(2) {
    width: 80%;
    height: 80%;
    border-right-color: var(--p-primary-400);
    animation: spin 1.5s linear infinite reverse;
}

.spinner-ring:nth-child(3) {
    width: 60%;
    height: 60%;
    border-bottom-color: var(--p-primary-300);
    animation: spin 2s linear infinite;
}

.spinner-icon {
    font-size: 1.25rem;
    color: var(--p-primary-color);
    animation: pulse 1.5s ease-in-out infinite;
}

/* Loading Dots */
.loading-dots {
    display: flex;
    gap: 6px;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--p-primary-color);
    animation: bounce 1.4s ease-in-out infinite;
}

.dot:nth-child(1) {
    animation-delay: 0s;
}

.dot:nth-child(2) {
    animation-delay: 0.2s;
}

.dot:nth-child(3) {
    animation-delay: 0.4s;
}

/* Animations */
@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(0.9);
    }
}

@keyframes bounce {
    0%,
    80%,
    100% {
        transform: translateY(0);
        opacity: 0.5;
    }
    40% {
        transform: translateY(-8px);
        opacity: 1;
    }
}
</style>
