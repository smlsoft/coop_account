<script setup>
import { onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    jobData: {
        type: Object,
        default: () => ({})
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'save', 'cancel', 'delete']);

const newJobName = ref('');
const newJobDescription = ref('');
const disableApproval = ref(false);

// Watch for dialog visibility and jobData changes
watch(
    () => [props.visible, props.jobData],
    ([visible, jobData]) => {
        if (visible && jobData) {
            newJobName.value = jobData.name || '';
            newJobDescription.value = jobData.description || '';
            // ถ้า status = 6 แสดงว่าปิดการอนุมัติ (true), ถ้า status = 0 แสดงว่าเปิดการอนุมัติ (false)
            disableApproval.value = jobData.status === 6;
        }
    },
    { immediate: true }
);

// Computed properties
const canDeleteJob = () => {
    if (props.jobData?.parentguidfixed !== '') {
        return false;
    }

    // เช็คว่ามี status 1 (ผ่านแล้ว) และ total > 0
    const hasPassedDocuments = props.jobData?.totaldocumentstatus?.some((item) => item.status === 1 && item.total > 0);

    // เช็ค referencecount
    const hasReferences = (props.jobData?.referencecount || 0) !== 0;

    // ถ้ามีรูปที่ผ่านแล้ว หรือมี reference ไม่สามารถลบได้
    return !(hasPassedDocuments || hasReferences);
};

const getDeleteTooltip = () => {
    if (props.jobData?.parentguidfixed !== '') {
        return 'งานย่อยไม่สามารถลบได้';
    }

    if (!canDeleteJob()) {
        return 'มีรูปที่ผ่านแล้วไม่สามารถลบได้';
    }

    return 'ลบงาน';
};

const canCancelJob = () => {
    return props.jobData?.parentguidfixed !== '';
};

const canEditApproval = () => {
    // สามารถแก้ไขการอนุมัติได้เมื่อ status = 0 (รออัพโหลด) หรือ 6 (ไม่ต้องอนุมัติ)
    return props.jobData?.status === 0 || props.jobData?.status === 6;
};

const formatDate = (dateString) => {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const handleClose = () => {
    emit('update:visible', false);
};

const handleSave = () => {
    if (newJobName.value.trim() === '') {
        return;
    }

    const saveData = {
        name: newJobName.value.trim(),
        description: newJobDescription.value.trim()
    };

    // เพิ่ม status ถ้าสามารถแก้ไขการอนุมัติได้
    if (canEditApproval()) {
        // ถ้า disableApproval = true (ปิดการอนุมัติ) → status = 6
        // ถ้า disableApproval = false (เปิดการอนุมัติ) → status = 0
        saveData.status = disableApproval.value ? 6 : 0;
    }

    emit('save', saveData);
};

const handleCancel = () => {
    emit('cancel');
};

const handleDelete = () => {
    emit('delete');
};

const handleKeyPress = (event) => {
    if (event.key === 'Enter' && props.visible && !props.loading) {
        event.preventDefault();
        handleSave();
    }
};

watch(
    () => props.visible,
    (newValue) => {
        if (newValue) {
            window.addEventListener('keypress', handleKeyPress);
        } else {
            window.removeEventListener('keypress', handleKeyPress);
        }
    }
);

onUnmounted(() => {
    window.removeEventListener('keypress', handleKeyPress);
});
</script>

<template>
    <Dialog :visible="visible" :style="{ width: '560px' }" :modal="true" :draggable="false" @update:visible="handleClose">
        <template #header>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                    <i class="pi pi-cog text-surface-600 text-lg"></i>
                </div>
                <div>
                    <p class="text-ml text-surface-500 m-0">เลขที่งาน : {{ jobData.code }}</p>
                </div>
            </div>
        </template>

        <div class="flex flex-col gap-4 py-2">
            <!-- Info Cards -->
            <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                    <span class="text-xs text-surface-500">วันที่สร้าง</span>
                    <span class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ formatDate(jobData.ownerat) }}</span>
                </div>
                <div class="flex flex-col gap-1 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                    <span class="text-xs text-surface-500">จำนวนเอกสาร</span>
                    <span class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ jobData.totaldocument || 0 }} รายการ</span>
                </div>
            </div>

            <!-- Divider -->
            <Divider class="my-0" />

            <!-- Editable Fields -->
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">ชื่องาน</label>
                    <InputText v-model="newJobName" placeholder="ชื่องาน" autofocus />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">หมายเหตุ</label>
                    <Textarea v-model="newJobDescription" placeholder="หมายเหตุ" :autoResize="true" rows="3" />
                </div>

                <!-- Toggle Switch สำหรับปิด/เปิดการอนุมัติ (แสดงเฉพาะเมื่อ status = 0 หรือ 6) -->
                <div v-if="canEditApproval()" class="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                    <ToggleSwitch v-model="disableApproval" :disabled="loading" />
                    <label class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer" @click="!loading && (disableApproval = !disableApproval)"> ปิดการอนุมัติงาน </label>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center w-full">
                <div class="flex gap-2">
                    <Button v-if="canCancelJob()" label="ยกเลิกงาน" icon="pi pi-ban" severity="warn" outlined @click="handleCancel" :loading="loading" />
                    <Button v-if="jobData?.parentguidfixed === ''" label="ลบงาน" icon="pi pi-trash" severity="danger" outlined :disabled="!canDeleteJob()" @click="handleDelete" :loading="loading" v-tooltip.top="getDeleteTooltip()" />
                </div>
                <div class="flex gap-2">
                    <Button label="ปิด" severity="secondary" text @click="handleClose" />
                    <Button label="บันทึก (Enter)" icon="pi pi-save" @click="handleSave" :loading="loading" />
                </div>
            </div>
        </template>
    </Dialog>
</template>
