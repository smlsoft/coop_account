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
    ramdomNumber: {
        type: Number,
        default: 0
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
    if (parseInt(inputNumber.value) === props.ramdomNumber) {
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
            buttonLabel: 'ลบ'
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
            <div class="flex items-center gap-4">
                <i :class="[getModeConfig().icon, 'text-4xl', getModeConfig().iconClass]"></i>
                <span>กรุณากรอกตัวเลข <strong class="text-xl">{{ ramdomNumber }}</strong> เพื่อยืนยัน</span>
            </div>
            <div class="flex flex-col gap-2">
                <label for="confirmNumber">ตัวเลขยืนยัน</label>
                <InputText id="confirmNumber" v-model="inputNumber" type="number" placeholder="กรอกตัวเลข" autofocus />
            </div>
        </div>
        <template #footer>
            <Button label="ปิด" icon="pi pi-times" class="p-button-text" @click="handleClose" />
            <Button :label="getModeConfig().buttonLabel" :icon="getModeConfig().icon" :class="getModeConfig().buttonClass" @click="handleConfirm" />
        </template>
    </Dialog>
</template>
