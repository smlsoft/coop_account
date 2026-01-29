<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    header: {
        type: String,
        default: 'แจ้งเตือน'
    },
    message: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: ''
    },
    iconColor: {
        type: String,
        default: ''
    },
    severity: {
        type: String,
        default: 'warning', // warning, error, info, success
        validator: (value) => ['warning', 'error', 'info', 'success'].includes(value)
    },
    confirmLabel: {
        type: String,
        default: 'ตกลง'
    }
});

const emit = defineEmits(['update:visible', 'confirm']);

const confirmButtonRef = ref(null);

// Severity configurations
const severityConfig = computed(() => {
    const configs = {
        warning: {
            icon: 'pi-exclamation-triangle',
            iconColor: 'text-orange-500',
            iconBg: 'bg-orange-100 dark:bg-orange-900/30'
        },
        error: {
            icon: 'pi-times-circle',
            iconColor: 'text-red-500',
            iconBg: 'bg-red-100 dark:bg-red-900/30'
        },
        info: {
            icon: 'pi-info-circle',
            iconColor: 'text-blue-500',
            iconBg: 'bg-blue-100 dark:bg-blue-900/30'
        },
        success: {
            icon: 'pi-check-circle',
            iconColor: 'text-green-500',
            iconBg: 'bg-green-100 dark:bg-green-900/30'
        }
    };
    return configs[props.severity] || configs.warning;
});

// Use custom icon/color or severity default
const displayIcon = computed(() => props.icon || severityConfig.value.icon);
const displayIconColor = computed(() => props.iconColor || severityConfig.value.iconColor);

const handleConfirm = () => {
    emit('confirm');
    emit('update:visible', false);
};

const handleKeydown = (event) => {
    if (props.visible && event.key === 'Enter') {
        event.preventDefault();
        handleConfirm();
    }
};

watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            setTimeout(() => {
                confirmButtonRef.value?.$el?.focus();
            }, 100);
        }
    }
);

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" :modal="true" :closable="true" :draggable="false" :style="{ width: '500px', maxWidth: '90vw' }">
        <template #header>
            <div class="flex items-center gap-3">
                <div :class="['flex items-center justify-center w-9 h-9 rounded-full', severityConfig.iconBg]">
                    <i :class="['pi', displayIcon, 'text-lg', displayIconColor]"></i>
                </div>
                <span class="font-semibold text-lg text-surface-900 dark:text-surface-0">{{ header }}</span>
            </div>
        </template>

        <!-- Content -->
        <div class="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            <div v-html="message" class="alert-message text-surface-700 dark:text-surface-300"></div>
        </div>

        <template #footer>
            <div class="flex justify-end">
                <Button ref="confirmButtonRef" :label="confirmLabel" icon="pi pi-check" @click="handleConfirm" autofocus />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* Alert message styling */
.alert-message :deep(p) {
    margin: 0 0 0.75rem 0;
}

.alert-message :deep(p:last-child) {
    margin-bottom: 0;
}

/* Error card items */
.alert-message :deep(.flex.items-start) {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
}

.alert-message :deep(.flex.items-start:last-child) {
    margin-bottom: 0;
}

/* Scrollbar styling */
.max-h-\[50vh\]::-webkit-scrollbar {
    width: 6px;
}

.max-h-\[50vh\]::-webkit-scrollbar-track {
    background: transparent;
}

.max-h-\[50vh\]::-webkit-scrollbar-thumb {
    background: var(--p-surface-300);
    border-radius: 3px;
}

.dark .max-h-\[50vh\]::-webkit-scrollbar-thumb {
    background: var(--p-surface-600);
}
</style>
