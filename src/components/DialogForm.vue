<script setup>
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
        default: 'ยืนยัน'
    },
    cancelLabel: {
        type: String,
        default: 'ยกเลิก'
    }
});

const emit = defineEmits(['close', 'confirm']);

const handleClose = () => {
    emit('close');
};

const handleConfirm = () => {
    emit('confirm');
};
</script>

<template>
    <Dialog :visible="confirmDialog" :style="{ width: '450px' }" header="ยืนยัน" :modal="true" @update:visible="handleClose">
        <div class="flex flex-col items-center gap-4 p-4">
            <div class="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <i class="pi pi-question-circle text-4xl text-primary-500 dark:text-primary-400"></i>
            </div>
            <p class="text-center text-surface-700 dark:text-surface-300 text-lg">{{ textContent }}</p>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2">
                <Button :label="cancelLabel" icon="pi pi-times" severity="secondary" text @click="handleClose" />
                <Button :label="confirmLabel" icon="pi pi-check" @click="handleConfirm" />
            </div>
        </template>
    </Dialog>
</template>
