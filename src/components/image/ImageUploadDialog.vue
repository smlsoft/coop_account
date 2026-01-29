<script setup>
import { useLoading } from '@/composables/useLoading';
import { bulkCreateDocumentImages, uploadImage } from '@/services/api/image';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    taskGuid: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'upload-complete']);

const toast = useToast();
const { showLoading, hideLoading } = useLoading();
const fileInput = ref(null);
const uploadedFiles = ref([]);
const uploading = ref(false);
const confirming = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all'); // all, uploaded, error, pending, uploading
const isDragging = ref(false);

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

const hasFiles = computed(() => uploadedFiles.value.length > 0);
const allUploaded = computed(() => uploadedFiles.value.every((f) => f.status === 'uploaded' || f.status === 'error'));
const hasErrors = computed(() => uploadedFiles.value.some((f) => f.status === 'error'));
const uploadProgress = computed(() => {
    if (uploadedFiles.value.length === 0) return 0;
    const uploaded = uploadedFiles.value.filter((f) => f.status === 'uploaded').length;
    return Math.round((uploaded / uploadedFiles.value.length) * 100);
});

// Statistics
const stats = computed(() => ({
    total: uploadedFiles.value.length,
    uploaded: uploadedFiles.value.filter((f) => f.status === 'uploaded').length,
    error: uploadedFiles.value.filter((f) => f.status === 'error').length,
    pending: uploadedFiles.value.filter((f) => f.status === 'pending').length,
    uploading: uploadedFiles.value.filter((f) => f.status === 'uploading').length
}));

// Filtered files
const filteredFiles = computed(() => {
    let files = uploadedFiles.value;

    // Apply status filter
    if (statusFilter.value !== 'all') {
        files = files.filter((f) => f.status === statusFilter.value);
    }

    // Apply search filter
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase();
        files = files.filter((f) => f.name.toLowerCase().includes(query));
    }

    return files;
});

watch(
    () => props.visible,
    (newVal) => {
        if (!newVal) {
            resetDialog();
        }
    }
);

const resetDialog = () => {
    uploadedFiles.value = [];
    uploading.value = false;
    confirming.value = false;
    searchQuery.value = '';
    statusFilter.value = 'all';
    if (fileInput.value) {
        fileInput.value.value = '';
    }
};

const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);

    // Filter เฉพาะ image และ PDF
    const validFiles = files.filter((file) => {
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        return isPdf || isImage;
    });

    if (validFiles.length !== files.length) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'บางไฟล์ไม่ใช่รูปภาพหรือ PDF',
            life: 3000
        });
    }

    // เพิ่มไฟล์เข้า list
    for (const file of validFiles) {
        const fileObj = {
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending', // pending, uploading, uploaded, error
            preview: null,
            uploadedUri: null,
            error: null
        };

        // สร้าง preview สำหรับ image
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fileObj.preview = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        uploadedFiles.value.push(fileObj);
    }

    // เริ่ม upload ทันที
    await startUpload();
};

const startUpload = async () => {
    uploading.value = true;

    const pendingFiles = uploadedFiles.value.filter((f) => f.status === 'pending');

    for (const fileObj of pendingFiles) {
        fileObj.status = 'uploading';

        try {
            const response = await uploadImage(fileObj.file);

            if (response.data.success && response.data.data.uri) {
                fileObj.uploadedUri = response.data.data.uri;
                fileObj.status = 'uploaded';
            } else {
                fileObj.status = 'error';
                fileObj.error = 'Upload failed';
            }
        } catch (error) {
            console.error('Upload error:', error);
            fileObj.status = 'error';
            fileObj.error = error.message || 'Upload failed';
        }

        // Delay 0.5 วินาทีระหว่างการอัปโหลดแต่ละรูป เพื่อให้เห็น progress bar
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    uploading.value = false;

    if (hasErrors.value) {
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'บางไฟล์ upload ไม่สำเร็จ',
            life: 3000
        });
    }
};

const removeFile = (fileId) => {
    uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== fileId);
};

const retryUpload = async (fileId) => {
    const fileObj = uploadedFiles.value.find((f) => f.id === fileId);
    if (!fileObj) return;

    fileObj.status = 'uploading';
    fileObj.error = null;

    try {
        const response = await uploadImage(fileObj.file);

        if (response.data.success && response.data.data.uri) {
            fileObj.uploadedUri = response.data.data.uri;
            fileObj.status = 'uploaded';
        } else {
            fileObj.status = 'error';
            fileObj.error = 'Upload failed';
        }
    } catch (error) {
        console.error('Upload error:', error);
        fileObj.status = 'error';
        fileObj.error = error.message || 'Upload failed';
    }
};

const handleConfirm = async () => {
    const uploadedOnly = uploadedFiles.value.filter((f) => f.status === 'uploaded');

    if (uploadedOnly.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'ไม่มีไฟล์ที่ upload สำเร็จ',
            life: 3000
        });
        return;
    }

    confirming.value = true;

    try {
        const payload = uploadedOnly.map((fileObj) => ({
            name: fileObj.name,
            metafileat: new Date(fileObj.file.lastModified).toISOString(),
            imageuri: fileObj.uploadedUri,
            uploadedby: props.userEmail || 'unknown@example.com',
            uploadedat: new Date().toISOString(),
            billcount: 1,
            tags: [],
            taskguid: props.taskGuid
        }));

        showLoading('กำลังบันทึกข้อมูล...');
        const response = await bulkCreateDocumentImages(payload);

        if (response.data.success) {
            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `Upload ${uploadedOnly.length} ไฟล์สำเร็จ`,
                life: 3000
            });

            emit('upload-complete');
            dialogVisible.value = false;
        } else {
            throw new Error('Bulk create failed');
        }
    } catch (error) {
        console.error('Confirm error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถยืนยันการ upload ได้',
            life: 3000
        });
    } finally {
        confirming.value = false;
    }
};

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getStatusColor = (status) => {
    switch (status) {
        case 'pending':
            return 'contrast';
        case 'uploading':
            return 'info';
        case 'uploaded':
            return 'success';
        case 'error':
            return 'danger';
        default:
            return 'secondary';
    }
};

const getStatusIcon = (status) => {
    switch (status) {
        case 'pending':
            return 'pi pi-clock';
        case 'uploading':
            return 'pi pi-spin pi-spinner';
        case 'uploaded':
            return 'pi pi-check-circle';
        case 'error':
            return 'pi pi-times';
        default:
            return 'pi pi-question';
    }
};

const getStatusIconColor = (status) => {
    switch (status) {
        case 'pending':
            return 'text-surface-400';
        case 'uploading':
            return 'text-blue-500';
        case 'uploaded':
            return 'text-green-500';
        case 'error':
            return 'text-red-500';
        default:
            return 'text-surface-400';
    }
};

const openFileDialog = () => {
    fileInput.value?.click();
};

const showHelp = () => {
    toast.add({
        severity: 'info',
        summary: 'วิธีใช้งาน Upload',
        detail: '1. ลากไฟล์มาวางในพื้นที่ หรือ 2. คลิกปุ่มเลือกไฟล์ หรือ 3. คลิกที่กรอบเพื่อเลือกไฟล์',
        life: 5000
    });
};

// Batch actions
const retryAllErrors = async () => {
    const errorFiles = uploadedFiles.value.filter((f) => f.status === 'error');

    for (const fileObj of errorFiles) {
        await retryUpload(fileObj.id);
    }
};

const removeAllErrors = () => {
    uploadedFiles.value = uploadedFiles.value.filter((f) => f.status !== 'error');
};

const clearAll = () => {
    uploadedFiles.value = [];
};

// Drag and drop handlers
const handleDragOver = (event) => {
    event.preventDefault();
    isDragging.value = true;
};

const handleDragLeave = (event) => {
    event.preventDefault();
    isDragging.value = false;
};

const handleDrop = async (event) => {
    event.preventDefault();
    isDragging.value = false;

    const files = Array.from(event.dataTransfer.files);

    // Filter เฉพาะ image และ PDF
    const validFiles = files.filter((file) => {
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        return isPdf || isImage;
    });

    if (validFiles.length !== files.length) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'บางไฟล์ไม่ใช่รูปภาพหรือ PDF',
            life: 3000
        });
    }

    // เพิ่มไฟล์เข้า list
    for (const file of validFiles) {
        const fileObj = {
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            preview: null,
            uploadedUri: null,
            error: null
        };

        // สร้าง preview สำหรับ image
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fileObj.preview = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        uploadedFiles.value.push(fileObj);
    }

    // เริ่ม upload ทันที
    await startUpload();
};
</script>

<template>
    <Dialog v-model:visible="dialogVisible" modal header="Upload รูปภาพ / PDF" :style="{ width: '95vw', maxWidth: '1400px' }" :closable="!uploading && !confirming">
        <input ref="fileInput" type="file" multiple accept="image/*,application/pdf" style="display: none" @change="handleFileSelect" />

        <div class="space-y-4">
            <!-- Summary Statistics -->
            <div v-if="hasFiles" class="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <div class="text-center">
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ stats.total }}</div>
                    <div class="text-xs text-surface-600 dark:text-surface-400">ทั้งหมด</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.uploaded }}</div>
                    <div class="text-xs text-surface-600 dark:text-surface-400">สำเร็จ</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats.error }}</div>
                    <div class="text-xs text-surface-600 dark:text-surface-400">ล้มเหลว</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats.uploading }}</div>
                    <div class="text-xs text-surface-600 dark:text-surface-400">กำลัง upload</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-surface-500 dark:text-surface-400">{{ stats.pending }}</div>
                    <div class="text-xs text-surface-600 dark:text-surface-400">รอ upload</div>
                </div>
            </div>

            <!-- Toolbar: Upload + Search + Filters + Actions -->
            <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div class="flex items-center gap-2">
                    <Button label="เลือกไฟล์" icon="pi pi-upload" @click="openFileDialog" :disabled="uploading || confirming" size="small" />
                    <Button v-if="stats.error > 0" label="ลองใหม่ทั้งหมด" icon="pi pi-refresh" severity="warning" @click="retryAllErrors" :disabled="uploading || confirming" size="small" outlined />
                    <Button v-if="stats.error > 0" label="ลบ Error" icon="pi pi-trash" severity="danger" @click="removeAllErrors" :disabled="uploading || confirming" size="small" outlined />
                    <Button v-if="hasFiles" label="ล้างทั้งหมด" icon="pi pi-times" severity="secondary" @click="clearAll" :disabled="uploading || confirming" size="small" text />
                </div>

                <div v-if="hasFiles" class="flex items-center gap-2 w-full sm:w-auto">
                    <IconField class="flex-1 sm:flex-initial">
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="searchQuery" placeholder="ค้นหาชื่อไฟล์..." size="small" class="w-full sm:w-64" />
                    </IconField>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div v-if="hasFiles" class="flex gap-2 overflow-x-auto pb-2">
                <Button :label="`ทั้งหมด (${stats.total})`" :severity="statusFilter === 'all' ? 'primary' : 'secondary'" @click="statusFilter = 'all'" size="small" :outlined="statusFilter !== 'all'" />
                <Button :label="`สำเร็จ (${stats.uploaded})`" :severity="statusFilter === 'uploaded' ? 'success' : 'secondary'" @click="statusFilter = 'uploaded'" size="small" :outlined="statusFilter !== 'uploaded'" />
                <Button :label="`ล้มเหลว (${stats.error})`" :severity="statusFilter === 'error' ? 'danger' : 'secondary'" @click="statusFilter = 'error'" size="small" :outlined="statusFilter !== 'error'" />
                <Button :label="`กำลัง upload (${stats.uploading})`" :severity="statusFilter === 'uploading' ? 'info' : 'secondary'" @click="statusFilter = 'uploading'" size="small" :outlined="statusFilter !== 'uploading'" />
                <Button :label="`รอ upload (${stats.pending})`" :severity="statusFilter === 'pending' ? 'contrast' : 'secondary'" @click="statusFilter = 'pending'" size="small" :outlined="statusFilter !== 'pending'" />
            </div>

            <!-- Progress Bar -->
            <ProgressBar v-if="hasFiles" :value="uploadProgress" :show-value="true" class="h-4" />

            <!-- File Grid - Compact for 100+ items -->
            <div v-if="hasFiles" class="max-h-[600px] overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg bg-surface-50 dark:bg-surface-900 p-3 @container">
                <div v-if="filteredFiles.length === 0" class="text-center py-12 text-surface-500 dark:text-surface-400">
                    <i class="pi pi-filter-slash text-4xl mb-3"></i>
                    <p>ไม่พบไฟล์ที่ตรงกับการค้นหา</p>
                </div>
                <div v-else class="grid grid-cols-2 @sm:grid-cols-3 @md:grid-cols-4 @lg:grid-cols-5 @xl:grid-cols-6 gap-3">
                    <div v-for="fileObj in filteredFiles" :key="fileObj.id" class="relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden transition-all hover:shadow-lg group">
                        <!-- Image/PDF Preview -->
                        <div class="w-full h-full flex items-center justify-center p-1.5">
                            <img v-if="fileObj.preview" :src="fileObj.preview" :alt="fileObj.name" class="w-full h-full object-cover rounded-md" />
                            <img v-else-if="fileObj.type === 'application/pdf'" src="/demo/images/pdf-icon.svg" alt="PDF" class="w-3/5 h-3/5 object-contain" />
                            <i v-else class="pi pi-image text-5xl text-surface-400 dark:text-surface-500"></i>
                        </div>

                        <!-- Overlay with info -->
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-900/85 dark:from-surface-800/90 to-transparent p-2">
                            <div class="text-surface-0 text-[10px] truncate font-medium mb-0.5" :title="fileObj.name">
                                {{ fileObj.name }}
                            </div>
                            <div class="flex items-center justify-between gap-1">
                                <span class="text-surface-200 text-[9px]">{{ formatFileSize(fileObj.size) }}</span>
                                <div class="flex items-center gap-1">
                                    <i :class="['text-xs', getStatusIcon(fileObj.status), getStatusIconColor(fileObj.status)]"></i>
                                </div>
                            </div>
                        </div>

                        <!-- Status Badge - Top Left -->
                        <div class="absolute top-1.5 left-1.5">
                            <Tag :severity="getStatusColor(fileObj.status)" class="text-[9px] py-0.5 px-1.5" />
                        </div>

                        <!-- Action buttons - show on hover -->
                        <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button v-if="fileObj.status === 'error'" icon="pi pi-refresh" severity="warning" rounded size="small" @click="retryUpload(fileObj.id)" :disabled="uploading || confirming" title="ลองใหม่" class="!w-6 !h-6" />
                            <Button icon="pi pi-trash" severity="danger" rounded size="small" @click="removeFile(fileObj.id)" :disabled="uploading || confirming" title="ลบ" class="!w-6 !h-6" />
                        </div>

                        <!-- Loading overlay -->
                        <div v-if="fileObj.status === 'uploading'" class="absolute inset-0 bg-surface-900/70 dark:bg-surface-800/80 flex items-center justify-center">
                            <ProgressSpinner style="width: 35px; height: 35px" strokeWidth="4" />
                        </div>

                        <!-- Error overlay -->
                        <div v-if="fileObj.error" class="absolute inset-0 bg-red-900/20 dark:bg-red-800/30 pointer-events-none"></div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="py-8">
                <!-- Drag & Drop Zone -->
                <div
                    class="relative border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden"
                    :class="
                        isDragging
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-lg shadow-primary-500/20'
                            : 'border-primary-300 dark:border-primary-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 hover:shadow-md'
                    "
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                    @click="openFileDialog"
                >
                    <div class="p-16 text-center">
                        <!-- Text Section -->
                        <div class="mb-6">
                            <h3 class="text-2xl font-bold mb-2 transition-colors duration-300" :class="isDragging ? 'text-primary-700 dark:text-primary-300' : 'text-surface-800 dark:text-surface-100'">
                                {{ isDragging ? 'วางไฟล์ที่นี่เลย!' : 'ลากไฟล์มาวางที่นี่' }}
                            </h3>
                            <p class="text-sm mb-1 transition-colors duration-300" :class="isDragging ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-surface-600 dark:text-surface-400'">รองรับไฟล์: รูปภาพ (JPG, PNG) และ PDF</p>
                            <p class="text-xs text-surface-500 dark:text-surface-500">ขนาดไฟล์สูงสุด: 100MB | จำนวนไฟล์: ไม่จำกัด</p>
                        </div>

                        <!-- Divider -->
                        <div class="flex items-center gap-4 mb-6 max-w-xs mx-auto">
                            <div class="flex-1 h-px bg-surface-200 dark:bg-surface-700"></div>
                            <span class="text-xs text-surface-500 dark:text-surface-500 font-medium">หรือ</span>
                            <div class="flex-1 h-px bg-surface-200 dark:bg-surface-700"></div>
                        </div>

                        <!-- Button Section -->
                        <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
                            <Button label="เลือกไฟล์จากเครื่อง" icon="pi pi-folder-open" size="large" class="font-semibold" :class="isDragging ? 'scale-105' : ''" />
                            <Button label="วิธีใช้งาน" icon="pi pi-question-circle" severity="secondary" size="large" outlined @click.stop="showHelp" />
                        </div>
                    </div>

                    <!-- Animated border effect on drag -->
                    <div v-if="isDragging" class="absolute inset-0 rounded-2xl pointer-events-none border-2 border-primary-500" style="animation: pulse-border 1.5s ease-in-out infinite"></div>

                    <!-- Shimmer effect on drag -->
                    <div v-if="isDragging" class="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
                        <div class="absolute inset-0" style="background: linear-gradient(90deg, transparent 0%, rgba(var(--primary-500-rgb), 0.1) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 2s linear infinite"></div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div class="text-sm text-surface-600 dark:text-surface-400">
                    <span v-if="allUploaded && hasFiles">
                        <i class="pi pi-check-circle text-green-600 dark:text-green-400 mr-1"></i>
                        Upload สำเร็จ {{ stats.uploaded }} ไฟล์
                        <span v-if="stats.error > 0" class="text-red-600 dark:text-red-400 ml-2">
                            <i class="pi pi-times-circle mr-1"></i>
                            ล้มเหลว {{ stats.error }} ไฟล์
                        </span>
                    </span>
                    <span v-else-if="uploading">
                        <i class="pi pi-spin pi-spinner text-blue-600 dark:text-blue-400 mr-1"></i>
                        กำลัง upload {{ stats.uploading }} ไฟล์...
                    </span>
                    <span v-else-if="hasFiles">
                        <i class="pi pi-info-circle text-blue-600 dark:text-blue-400 mr-1"></i>
                        แสดง {{ filteredFiles.length }} / {{ stats.total }} ไฟล์
                    </span>
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <Button label="ยกเลิก" severity="secondary" @click="dialogVisible = false" :disabled="uploading || confirming" class="flex-1 sm:flex-initial" />
                    <Button label="ยืนยัน" icon="pi pi-check-circle" @click="handleConfirm" :disabled="!allUploaded || !hasFiles || hasErrors || uploading" :loading="confirming" class="flex-1 sm:flex-initial" />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.space-y-4 > * + * {
    margin-top: 1rem;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}
</style>
