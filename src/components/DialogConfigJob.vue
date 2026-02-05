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

// Watch for dialog visibility and jobData changes
watch(
    () => [props.visible, props.jobData],
    ([visible, jobData]) => {
        if (visible && jobData) {
            newJobName.value = jobData.name || '';
            newJobDescription.value = jobData.description || '';
        }
    },
    { immediate: true }
);

// Computed properties
const canDeleteJob = () => {
    return props.jobData?.parentguidfixed === '';
};

const canCancelJob = () => {
    return props.jobData?.parentguidfixed !== '';
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
    emit('save', {
        name: newJobName.value.trim(),
        description: newJobDescription.value.trim()
    });
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
                    <p class="text-ml text-surface-500 m-0 font-mono">เลขที่งาน : {{ jobData.code }}</p>
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
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center w-full">
                <div class="flex gap-2">
                    <Button v-if="canCancelJob()" label="ยกเลิกงาน" icon="pi pi-ban" severity="warn" outlined @click="handleCancel" :loading="loading" />
                    <Button v-if="canDeleteJob()" label="ลบงาน" icon="pi pi-trash" severity="danger" outlined @click="handleDelete" :loading="loading" />
                </div>
                <div class="flex gap-2">
                    <Button label="ปิด" severity="secondary" text @click="handleClose" />
                    <Button label="บันทึก (Enter)" icon="pi pi-save" @click="handleSave" :loading="loading" />
                </div>
            </div>
        </template>
    </Dialog>
</template>
