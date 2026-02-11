<script setup>
import { useLoading } from '@/composables/useLoading';
import { testTemplate } from '@/services/api/ocr';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import AiModelSelectionDialog from './AiModelSelectionDialog.vue';
import OcrResultDialog from './OcrResultDialog.vue';

const props = defineProps({
    visible: Boolean,
    templateData: Object // { doccode, description, details, promptdescription }
});

const emit = defineEmits(['update:visible', 'close']);

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const uploadedFile = ref(null);
const imagePreview = ref(null);
const selectedModel = ref(null);
const showModelDialog = ref(false);
const showResultDialog = ref(false);
const ocrResult = ref(null);

// Get shopid from localStorage
const shopId = computed(() => {
    return localStorage.getItem('shopid') || '';
});

/**
 * Handle file upload
 */
const onFileSelect = (event) => {
    const file = event.files[0];
    if (file) {
        uploadedFile.value = file;

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.value = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

/**
 * Remove uploaded file
 */
const removeFile = () => {
    uploadedFile.value = null;
    imagePreview.value = null;
};

/**
 * เปิด dialog เลือก model และทดสอบ OCR
 */
const openTestDialog = () => {
    if (!uploadedFile.value) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณาอัปโหลดรูปภาพก่อน',
            life: 3000
        });
        return;
    }

    if (!shopId.value) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่พบ Shop ID กรุณาเข้าสู่ระบบใหม่',
            life: 3000
        });
        return;
    }

    // เปิด dialog เลือก model
    showModelDialog.value = true;
};

/**
 * Handle model selected และเรียก API
 */
const handleModelSelected = async (model) => {
    selectedModel.value = model;
    showModelDialog.value = false;

    // เรียก API ทันที
    await testOcr();
};

/**
 * Test OCR
 */
const testOcr = async () => {
    try {
        showLoading('กำลังวิเคราะห์เอกสารด้วย AI...');

        // Create FormData
        const formData = new FormData();
        formData.append('file', uploadedFile.value);
        formData.append('shopid', shopId.value);
        formData.append('model', selectedModel.value);

        // Create template object
        const template = {
            doccode: props.templateData.doccode || '',
            description: props.templateData.description || '',
            details: props.templateData.details || [],
            promptdescription: props.templateData.promptdescription || ''
        };

        formData.append('template', JSON.stringify(template));

        // Call API
        const response = await testTemplate(formData);

        if (response.data) {
            ocrResult.value = response.data;
            showResultDialog.value = true;
        }
    } catch (error) {
        console.error('Error testing OCR:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถทดสอบ OCR ได้',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

/**
 * Test again
 */
const testAgain = () => {
    showResultDialog.value = false;
    removeFile();
    selectedModel.value = null;
};

/**
 * Close dialog
 */
const handleClose = () => {
    removeFile();
    ocrResult.value = null;
    selectedModel.value = null;
    showResultDialog.value = false;
    emit('update:visible', false);
    emit('close');
};

/**
 * Close result and back to test dialog
 */
const handleCloseResult = () => {
    showResultDialog.value = false;
};
</script>

<template>
    <!-- Main Test Dialog -->
    <Dialog :visible="visible" :style="{ width: '700px' }" :modal="true" header="ทดสอบ Prompt OCR" @update:visible="handleClose">
        <div class="flex flex-col gap-4">
            <!-- Upload Zone -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold">อัปโหลดรูปภาพเอกสาร</label>

                <FileUpload v-if="!uploadedFile" mode="basic" accept="image/*" :maxFileSize="10000000" :auto="true" chooseLabel="เลือกรูปภาพ" @select="onFileSelect" class="w-full" />

                <!-- Image Preview -->
                <div v-if="imagePreview" class="relative border rounded-lg p-4">
                    <Button icon="pi pi-times" severity="danger" text rounded class="absolute top-2 right-2" @click="removeFile" v-tooltip.top="'ลบรูป'" />

                    <div class="flex justify-center">
                        <img :src="imagePreview" alt="Preview" class="max-w-full max-h-96 rounded" />
                    </div>

                    <div class="mt-2 text-sm text-surface-600 dark:text-surface-400 text-center">{{ uploadedFile?.name }}</div>
                </div>
            </div>

            <!-- Shop ID Info -->
            <!-- <div class="flex flex-col gap-2">
                <label class="font-semibold">Shop ID</label>
                <InputText :value="shopId" readonly fluid class="bg-surface-100 dark:bg-surface-700" />
            </div> -->
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="ยกเลิก" severity="secondary" @click="handleClose" outlined />
                <Button label="ทดสอบ" icon="pi pi-play" @click="openTestDialog" :disabled="!uploadedFile" />
            </div>
        </template>
    </Dialog>

    <!-- Model Selection Dialog -->
    <AiModelSelectionDialog :visible="showModelDialog" @update:visible="showModelDialog = $event" @confirm="handleModelSelected" />

    <!-- Result Dialog -->
    <OcrResultDialog v-if="ocrResult" :visible="showResultDialog" :ocr-data="JSON.stringify(ocrResult)" @update:visible="handleCloseResult" @close="handleCloseResult" @test-again="testAgain" />
</template>
