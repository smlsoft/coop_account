<script setup>
import { useLoading } from '@/composables/useLoading';

const { isLoading, loadingMessage } = useLoading();
</script>

<template>
    <Dialog v-model:visible="isLoading" modal :closable="false" :draggable="false" :dismissableMask="false" :showHeader="false" class="loading-dialog" :pt="{ mask: { class: 'loading-mask' } }">
        <div class="flex flex-col items-center justify-center p-8 gap-6">
            <!-- Logo Section -->
            <div class="logo-wrapper">
                <!-- Ripple effects -->
                <div class="ripple ripple-1"></div>
                <div class="ripple ripple-2"></div>
                <div class="ripple ripple-3"></div>

                <!-- Logo -->
                <img src="/demo/images/logoCoop.png" alt="COOP Account" class="logo-image" />
            </div>

            <!-- Text & Progress Section -->
            <div class="flex flex-col items-center gap-4 w-full">
                <h3 class="text-lg font-medium text-surface-700 dark:text-surface-200 text-center m-0">
                    {{ loadingMessage || 'กำลังโหลด' }}
                </h3>

                <!-- Progress Bar -->
                <div class="w-full max-w-[200px]">
                    <div class="h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-500 rounded-full progress-animation"></div>
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.loading-dialog {
    border-radius: 1.5rem;
    overflow: hidden;
    min-width: 320px;
    max-width: 380px;
}

:deep(.loading-mask) {
    backdrop-filter: blur(12px);
    background: rgba(0, 0, 0, 0.4) !important;
}

:deep(.p-dialog-content) {
    padding: 0 !important;
}

/* Logo Wrapper */
.logo-wrapper {
    position: relative;
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Ripple Effects */
.ripple {
    position: absolute;
    border-radius: 50%;
    border: 2px solid var(--p-primary-400);
    opacity: 0;
    animation: ripple-expand 2.4s ease-out infinite;
}

.ripple-1 {
    width: 100px;
    height: 100px;
    animation-delay: 0s;
}

.ripple-2 {
    width: 100px;
    height: 100px;
    animation-delay: 0.8s;
}

.ripple-3 {
    width: 100px;
    height: 100px;
    animation-delay: 1.6s;
}

.logo-image {
    width: 96px;
    height: 96px;
    object-fit: contain;
    z-index: 2;
}

/* Progress Animation */
.progress-animation {
    width: 30%;
    animation: progress-slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

/* Keyframes */
@keyframes ripple-expand {
    0% {
        transform: scale(1);
        opacity: 0.6;
    }
    100% {
        transform: scale(1.6);
        opacity: 0;
    }
}

@keyframes progress-slide {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(430%);
    }
}
</style>
