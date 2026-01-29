<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    confirmDialog: {
        type: Boolean,
        default: false
    },
    textContent: {
        type: String,
        default: ''
    },
    confirmLabel: {
        type: String,
        default: 'ยืนยัน (Enter)'
    },
    cancelLabel: {
        type: String,
        default: 'ยกเลิก'
    },
    severity: {
        type: String,
        default: 'primary' // 'primary', 'success', 'danger', 'warning'
    }
});

const emit = defineEmits(['close', 'confirm']);

const confirmButton = ref(null);

const handleClose = () => {
    emit('close');
};

const handleConfirm = () => {
    emit('confirm');
};

const handleKeyPress = (event) => {
    if (event.key === 'Enter' && props.confirmDialog) {
        handleConfirm();
    }
};

const getSeverityConfig = () => {
    switch (props.severity) {
        case 'danger':
            return {
                icon: 'pi pi-exclamation-triangle',
                iconClass: 'text-red-500',
                buttonClass: 'p-button-danger'
            };
        case 'success':
            return {
                icon: 'pi pi-check-circle',
                iconClass: 'text-green-500',
                buttonClass: 'p-button-success'
            };
        case 'warning':
            return {
                icon: 'pi pi-exclamation-circle',
                iconClass: 'text-orange-500',
                buttonClass: 'p-button-warning'
            };
        default:
            return {
                icon: 'pi pi-question-circle',
                iconClass: 'text-primary-500',
                buttonClass: ''
            };
    }
};

watch(
    () => props.confirmDialog,
    (newValue) => {
        if (newValue) {
            window.addEventListener('keypress', handleKeyPress);
        } else {
            window.removeEventListener('keypress', handleKeyPress);
        }
    }
);

onMounted(() => {
    // Focus on confirm button when dialog opens
    if (confirmButton.value) {
        confirmButton.value.$el?.focus();
    }
});

onUnmounted(() => {
    window.removeEventListener('keypress', handleKeyPress);
});
</script>

<template>
    <Dialog :visible="confirmDialog" :style="{ width: '450px' }" header="ยืนยัน" :modal="true" @update:visible="handleClose">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <i :class="[getSeverityConfig().icon, 'text-5xl', getSeverityConfig().iconClass]"></i>
                <p class="text-center text-surface-700 dark:text-surface-300 text-lg">{{ textContent }}</p>
            </div>
        </div>
        <template #footer>
            <Button :label="cancelLabel" icon="pi pi-times" class="p-button-text" @click="handleClose" />
            <Button ref="confirmButton" :label="confirmLabel" icon="pi pi-check" :class="getSeverityConfig().buttonClass" @click="handleConfirm" @keyup.enter="handleConfirm" autofocus />
        </template>
    </Dialog>
</template>
