<script setup>
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import { computed } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    file: {
        type: Object,
        default: null
    },
    uploadedUri: {
        type: String,
        default: ''
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

// Check if file is PDF
const isPdf = computed(() => {
    if (props.file) {
        return props.file.type === 'application/pdf' || props.file.name?.toLowerCase().endsWith('.pdf');
    }
    if (props.uploadedUri) {
        const uri = props.uploadedUri;
        return /\.pdf$/i.test(uri) || /pdf$/i.test(uri.split('/').pop() || '');
    }
    return false;
});

// Create mock group for ImageDetailPanel preview
const previewGroup = computed(() => {
    if (!props.uploadedUri || !props.file) return null;

    return {
        guidfixed: 'preview',
        title: props.file.name,
        imagereferences: [
            {
                xorder: 1,
                documentimageguid: 'preview-image',
                imageuri: props.uploadedUri,
                billcount: 0,
                cloneimagefrom: '',
                name: props.file.name,
                uploadedby: '',
                uploadedat: new Date().toISOString(),
                metafileat: new Date(props.file.lastModified).toISOString()
            }
        ]
    };
});

// File info
const fileName = computed(() => props.file?.name || '');
const fileSize = computed(() => {
    if (!props.file?.size) return '';
    const size = props.file.size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
});

const handleConfirm = () => {
    emit('confirm');
};

const handleCancel = () => {
    emit('cancel');
    dialogVisible.value = false;
};
</script>

<template>
    <Dialog v-model:visible="dialogVisible" :style="{ width: '50rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" header="ยืนยันการใช้เอกสาร" :modal="true" :closable="!loading">
        <div class="flex flex-col gap-4">
            <!-- File Info -->
            <div class="flex items-center gap-3 p-2 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <i :class="isPdf ? 'pi pi-file-pdf text-red-500' : 'pi pi-image text-blue-500'" class="text-xl"></i>
                <div class="font-medium flex-1 min-w-0">{{ fileName }}</div>
                <span class="text-sm text-surface-500 shrink-0">{{ fileSize }}</span>
            </div>

            <!-- Preview Area using ImageDetailPanel -->
            <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden" style="height: 40vw">
                <ImageDetailPanel v-if="previewGroup" :selectedGroup="previewGroup" :selectedImageDetail="null" :loadingDetail="false" :isJobClosed="true" :isReviewMode="false" :updatingStatus="false" :isReadOnly="true" :hideDetails="true" />
                <div v-else class="h-full flex items-center justify-center text-surface-500">
                    <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                </div>
            </div>

            <!-- Confirmation Message -->
            <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <i class="pi pi-info-circle text-blue-500 mt-0.5"></i>
                <p class="text-sm text-blue-700 dark:text-blue-300">คุณต้องการใช้ไฟล์นี้เป็นเอกสารประกอบรายการบัญชีหรือไม่?</p>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" text @click="handleCancel" :disabled="loading" />
                <Button label="ยืนยัน" icon="pi pi-check" @click="handleConfirm" :loading="loading" />
            </div>
        </template>
    </Dialog>
</template>
