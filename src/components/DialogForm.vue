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
let dialogOpenTime = 0;

const handleClose = () => {
    emit('close');
};

const handleConfirm = () => {
    emit('confirm');
};

const handleKeyUp = (event) => {
    if (event.key === 'Enter' && props.confirmDialog) {
        // ตรวจสอบว่า event เกิดหลังจาก dialog เปิดแล้วอย่างน้อย 300ms
        const timeSinceOpen = Date.now() - dialogOpenTime;
        if (timeSinceOpen > 300) {
            event.preventDefault();
            event.stopPropagation();
            handleConfirm();
        }
    }
};

const getSeverityConfig = () => {
    switch (props.severity) {
        case 'danger':
            return {
                icon: 'pi pi-exclamation-triangle',
                iconClass: 'text-red-500',
                buttonSeverity: 'danger'
            };
        case 'success':
            return {
                icon: 'pi pi-check-circle',
                iconClass: 'text-green-500',
                buttonSeverity: 'success'
            };
        case 'warning':
            return {
                icon: 'pi pi-exclamation-circle',
                iconClass: 'text-orange-500',
                buttonSeverity: 'warning'
            };
        default:
            return {
                icon: 'pi pi-question-circle',
                iconClass: 'text-primary-500',
                buttonSeverity: 'primary'
            };
    }
};

watch(
    () => props.confirmDialog,
    (newValue) => {
        if (newValue) {
            // บันทึกเวลาที่ dialog เปิด
            dialogOpenTime = Date.now();
            // ใช้ keyup เพื่อหลีกเลี่ยง Enter event จาก form submit
            window.addEventListener('keyup', handleKeyUp);
        } else {
            window.removeEventListener('keyup', handleKeyUp);
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
    window.removeEventListener('keyup', handleKeyUp);
});
</script>

<template>
    <Dialog :visible="confirmDialog" :style="{ width: '450px' }" header="ยืนยันการทำรายการ" :modal="true" @update:visible="handleClose">
        <div class="flex items-center justify-center">
            <i :class="[getSeverityConfig().icon, 'mr-4']" style="font-size: 2rem"></i>
            <span>{{ textContent }}</span>
        </div>
        <template #footer>
            <Button :label="cancelLabel" icon="pi pi-times" @click="handleClose" text severity="secondary" />
            <Button ref="confirmButton" :label="confirmLabel" icon="pi pi-save" :severity="getSeverityConfig().buttonSeverity" @click="handleConfirm" autofocus />
        </template>
    </Dialog>
</template>
