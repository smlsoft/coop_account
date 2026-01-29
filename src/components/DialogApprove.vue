<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    mode: {
        type: String,
        default: 'cancel' // 'cancel' or 'delete'
    },
    title: {
        type: String,
        default: 'ยืนยัน'
    },
    randomNumber: {
        type: Number,
        default: 0
    },
    loading: {
        type: Boolean,
        default: false
    },
    confirmDialog: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close', 'confirmJob', 'confirmJobFalse']);

const inputNumber = ref('');

watch(
    () => props.confirmDialog,
    (newValue) => {
        if (newValue) {
            inputNumber.value = '';
        }
    }
);

const handleClose = () => {
    inputNumber.value = '';
    emit('close');
};

const handleConfirm = () => {
    if (parseInt(inputNumber.value) === props.randomNumber) {
        inputNumber.value = '';
        emit('confirmJob');
    } else {
        inputNumber.value = '';
        emit('confirmJobFalse');
    }
};

const getModeConfig = () => {
    if (props.mode === 'delete') {
        return {
            icon: 'pi pi-trash',
            iconClass: 'text-red-500',
            buttonClass: 'p-button-danger',
            buttonLabel: 'ลบ (Enter)'
        };
    }
    if (props.mode === 'close') {
        return {
            icon: 'pi pi-lock',
            iconClass: 'text-primary-500',
            buttonClass: '',
            buttonLabel: 'ปิดงาน (Enter)'
        };
    }
    return {
        icon: 'pi pi-exclamation-triangle',
        iconClass: 'text-yellow-500',
        buttonClass: 'p-button-warning',
        buttonLabel: 'ยกเลิก'
    };
};
</script>

<template>
    <Dialog :visible="confirmDialog" :style="{ width: '450px' }" :header="title" :modal="true" @update:visible="handleClose">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <i :class="[getModeConfig().icon, 'text-5xl', getModeConfig().iconClass]"></i>
                <div class="text-center">
                    <p class="text-surface-700 dark:text-surface-300 mb-2">กรุณากรอกตัวเลขเพื่อยืนยัน</p>
                    <div class="inline-flex items-center justify-center px-6 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border-2 border-primary-500 dark:border-primary-400">
                        <span class="text-4xl font-bold text-primary-600 dark:text-primary-400 tracking-wider">{{ randomNumber }}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <label for="confirmNumber" class="font-medium text-surface-700 dark:text-surface-300">ตัวเลขยืนยัน</label>
                <InputText id="confirmNumber" v-model="inputNumber" type="number" placeholder="กรอกตัวเลข" autofocus class="text-center text-2xl" @keyup.enter="handleConfirm" />
            </div>
        </div>
        <template #footer>
            <Button label="ปิด" icon="pi pi-times" class="p-button-text" @click="handleClose" :disabled="loading" />
            <Button :label="getModeConfig().buttonLabel" :icon="getModeConfig().icon" :class="getModeConfig().buttonClass" :loading="loading" :disabled="loading" @click="handleConfirm" />
        </template>
    </Dialog>
</template>
