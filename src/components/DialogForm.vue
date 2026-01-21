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
        <div class="flex items-center gap-4">
            <i class="pi pi-question-circle text-4xl text-primary"></i>
            <span>{{ textContent }}</span>
        </div>
        <template #footer>
            <Button :label="cancelLabel" icon="pi pi-times" class="p-button-text" @click="handleClose" />
            <Button :label="confirmLabel" icon="pi pi-check" class="p-button-success" @click="handleConfirm" />
        </template>
    </Dialog>
</template>
