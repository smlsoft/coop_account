<script setup>
import DialogApprove from '@/components/DialogApprove.vue';
import DialogConfigJob from '@/components/DialogConfigJob.vue';
import DialogForm from '@/components/DialogForm.vue';
import TaskDataTable from '@/components/TaskDataTable.vue';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

// Data list state
const tasks = ref([]);
const totalItemsCount = ref(0);
const loading = ref(false);

// Pagination state
const firstPage = ref(0);
const currentPage = ref(1);
const perPage = ref(10);
const filters = ref('');

// Create job dialog state
const dialogCreateJob = ref(false);
const jobDate = ref(new Date());
const jobId = ref('');
const jobIdValid = ref(false);
const jobName = ref('');
const jobNameValid = ref(false);
const jobDescription = ref('');
const modelConfirmUploadImage = ref(false);
const responseId = ref('');
const savingJob = ref(false);

// Config job dialog state
const dialogConfigJob = ref(false);
const dataConfigJob = ref({});

// Cancel/Delete job dialog state
const randomNumber = ref(0);
const dialogJobCancel = ref(false);
const dialogJobDelete = ref(false);

// Computed
const canDeleteJob = computed(() => {
    return dataConfigJob.value.parentguidfixed === '';
});

const canCancelJob = computed(() => {
    return dataConfigJob.value.parentguidfixed !== '';
});

// Utils
const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
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

const formatDateInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Fetch tasks
const fetchTasks = async () => {
    loading.value = true;
    try {
        const params = {
            page: currentPage.value,
            limit: perPage.value
        };

        if (filters.value.trim()) {
            params.q = filters.value.trim();
        }

        const response = await api.getTasks(params);

        if (response.data.success) {
            tasks.value = response.data.data || [];
            totalItemsCount.value = response.data.pagination?.total || 0;
            firstPage.value = (currentPage.value - 1) * perPage.value;
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Generate task ID
const getGenerateTaskID = async () => {
    try {
        const response = await api.generateTaskId();
        if (response.data.success) {
            jobId.value = response.data.data;
        }
    } catch (error) {
        console.error('Error generating task ID:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถสร้างเลขที่งานได้',
            life: 3000
        });
    }
};

// Show create job dialog
const showDialogCreateJob = () => {
    getGenerateTaskID();
    jobDate.value = new Date();
    dialogCreateJob.value = true;
};

// Close create job dialog
const closeDialogCreateJob = () => {
    clearDataForm();
    dialogCreateJob.value = false;
};

// Clear form data
const clearDataForm = () => {
    jobId.value = '';
    jobIdValid.value = false;
    jobName.value = '';
    jobNameValid.value = false;
    jobDescription.value = '';
};

// Save job
const saveJob = async () => {
    jobNameValid.value = false;
    jobIdValid.value = false;

    if (jobName.value.trim() === '') {
        jobNameValid.value = true;
        return;
    }
    if (jobId.value === '') {
        jobIdValid.value = true;
        return;
    }

    savingJob.value = true;

    const data = {
        code: jobId.value,
        name: jobName.value.trim(),
        description: jobDescription.value.trim(),
        status: 0
    };

    try {
        const response = await api.createTask(data);
        if (response.data.success) {
            responseId.value = response.data.id;
            closeDialogCreateJob();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'สร้างงานเรียบร้อยแล้ว',
                life: 3000
            });
            fetchTasks();
            setTimeout(() => {
                modelConfirmUploadImage.value = true;
            }, 100);
        }
    } catch (error) {
        console.error('Error saving job:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'บันทึกไม่สำเร็จ ' + (error.response?.data?.message || error.message),
            life: 3000
        });
    } finally {
        savingJob.value = false;
    }
};

// Handle Enter key for Create Job Dialog
const handleCreateJobKeyPress = (event) => {
    if (event.key === 'Enter' && dialogCreateJob.value && !savingJob.value) {
        event.preventDefault();
        saveJob();
    }
};

// Watch Create Job Dialog visibility
watch(dialogCreateJob, (newValue) => {
    if (newValue) {
        window.addEventListener('keypress', handleCreateJobKeyPress);
    } else {
        window.removeEventListener('keypress', handleCreateJobKeyPress);
    }
});

// Navigate to detail page
const goToDetail = () => {
    router.push({
        name: 'image-upload-detail',
        params: { id: responseId.value }
    });
};

// Row select handler
const handleRowSelect = (data) => {
    router.push({
        name: 'image-upload-detail',
        params: { id: data.guidfixed }
    });
};

// Show config job dialog
const showDialogConfigJob = (data) => {
    dialogConfigJob.value = true;
    dataConfigJob.value = { ...data };
};

// Update job data
const updateDataJob = async (data) => {
    if (data.name === dataConfigJob.value.name && data.description === dataConfigJob.value.description) {
        dialogConfigJob.value = false;
        return;
    }

    loading.value = true;

    try {
        const updatedData = {
            ...dataConfigJob.value,
            name: data.name,
            description: data.description
        };

        const response = await api.updateTask(dataConfigJob.value.guidfixed, updatedData);
        if (response.data.success) {
            dialogConfigJob.value = false;
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'บันทึกข้อมูลสำเร็จ',
                life: 3000
            });
            fetchTasks();
        }
    } catch (error) {
        console.error('Error updating job:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'บันทึกไม่สำเร็จ ' + (error.response?.data?.message || error.message),
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Cancel job
const cancelJob = () => {
    randomNumber.value = generateRandomNumber();
    dialogJobCancel.value = true;
};

// Delete job
const deleteJob = () => {
    randomNumber.value = generateRandomNumber();
    dialogJobDelete.value = true;
};

// Regenerate random number on wrong input
const confirmJobFalse = () => {
    randomNumber.value = generateRandomNumber();
    toast.add({
        severity: 'error',
        summary: 'ตัวเลขไม่ถูกต้อง',
        detail: 'กรุณากรอกตัวเลขใหม่',
        life: 3000
    });
};

// Update job status (for cancel)
const jobUpdateStatus = async (status) => {
    loading.value = true;
    try {
        const response = await api.updateTaskStatus(dataConfigJob.value.guidfixed, {
            status
        });
        if (response.data.success) {
            dialogJobCancel.value = false;
            dialogConfigJob.value = false;
            dataConfigJob.value = {};
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ยกเลิกงานเรียบร้อยแล้ว',
                life: 3000
            });
            fetchTasks();
        }
    } catch (error) {
        console.error('Error updating job status:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ยกเลิกไม่สำเร็จ ' + (error.response?.data?.message || error.message),
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Delete job from server
const jobDelete = async () => {
    loading.value = true;
    try {
        const response = await api.deleteTask(dataConfigJob.value.guidfixed);
        if (response.data.success) {
            dialogJobDelete.value = false;
            dialogConfigJob.value = false;
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบงานเรียบร้อยแล้ว',
                life: 3000
            });
            fetchTasks();
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ลบไม่สำเร็จ ' + (error.response?.data?.message || error.message),
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Page change handler
const handlePage = (page, rows) => {
    currentPage.value = page;
    perPage.value = rows;
    firstPage.value = (page - 1) * rows;

    // บันทึกค่าเข้า localStorage
    localStorage.setItem('images_job_upload_currentPage', page.toString());
    localStorage.setItem('images_job_upload_perPage', rows.toString());

    fetchTasks();
};

// Search handler
const handleSearch = (searchText) => {
    filters.value = searchText;
    currentPage.value = 1;
    firstPage.value = 0;
    fetchTasks();
};

onMounted(() => {
    // ดึงค่า perPage และ currentPage จาก localStorage
    const savedPerPage = localStorage.getItem('images_job_upload_perPage');
    const savedCurrentPage = localStorage.getItem('images_job_upload_currentPage');

    if (savedPerPage) {
        perPage.value = parseInt(savedPerPage, 10);
    }

    if (savedCurrentPage) {
        currentPage.value = parseInt(savedCurrentPage, 10);
        firstPage.value = (currentPage.value - 1) * perPage.value;
    }

    fetchTasks();
});

onUnmounted(() => {
    window.removeEventListener('keypress', handleCreateJobKeyPress);
});
</script>

<template>
    <div>
        <Toast />

        <!-- Main Content -->
        <div class="card">
            <h4 class="mb-4">อัพโหลดรูปภาพเอกสาร</h4>
            <TaskDataTable
                :modeMenu="1"
                :dataList="tasks"
                :loading="loading"
                :firstPage="firstPage"
                :totalItemsCount="totalItemsCount"
                :filters="filters"
                @onRowSelect="handleRowSelect"
                @showDialogCreateJob="showDialogCreateJob"
                @showDialogConfigJob="showDialogConfigJob"
                @search="handleSearch"
                @onPage="handlePage"
            />
        </div>

        <!-- Create Job Dialog -->
        <Dialog v-model:visible="dialogCreateJob" :style="{ width: '480px' }" :modal="true" :draggable="false" :closable="!savingJob" class="p-fluid">
            <template #header>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <i class="pi pi-plus text-primary text-lg"></i>
                    </div>
                    <div>
                        <p class="text-ml text-surface-500 m-0">สร้างงานใหม่</p>
                    </div>
                </div>
            </template>

            <div class="flex flex-col gap-5 py-2">
                <!-- Date/Time -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">วันที่สร้าง</label>
                    <div class="flex items-center gap-2 px-3 py-2.5 bg-surface-100 dark:bg-surface-800 rounded-lg">
                        <i class="pi pi-calendar text-surface-500"></i>
                        <span class="text-surface-700 dark:text-surface-300">{{ formatDateInput(jobDate) }}</span>
                    </div>
                </div>

                <!-- Job ID -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">เลขที่งาน</label>
                    <div class="flex items-center gap-2 px-3 py-2.5 bg-surface-100 dark:bg-surface-800 rounded-lg">
                        <i class="pi pi-hashtag text-surface-500"></i>
                        <span class="text-surface-700 dark:text-surface-300 font-mono">{{ jobId || 'กำลังสร้าง...' }}</span>
                    </div>
                </div>

                <!-- Job Name -->
                <div class="flex flex-col gap-2">
                    <label for="jobName" class="text-sm font-medium text-surface-700 dark:text-surface-200"> ชื่องาน <span class="text-red-500">*</span> </label>
                    <InputText id="jobName" v-model="jobName" placeholder="ระบุชื่องาน เช่น ใบเสร็จเดือน ม.ค. 2567" :invalid="jobNameValid" autofocus />
                    <small v-if="jobNameValid" class="text-red-500">กรุณากรอกชื่องาน</small>
                </div>

                <!-- Description -->
                <div class="flex flex-col gap-2">
                    <label for="jobDescription" class="text-sm font-medium text-surface-700 dark:text-surface-200">หมายเหตุ</label>
                    <Textarea id="jobDescription" v-model="jobDescription" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" :autoResize="true" rows="3" />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="ยกเลิก" severity="secondary" text @click="closeDialogCreateJob" :disabled="savingJob" />
                    <Button label="สร้างงาน (Enter)" icon="pi pi-save" @click="saveJob" :loading="savingJob" />
                </div>
            </template>
        </Dialog>

        <!-- Config Job Dialog -->
        <DialogConfigJob v-model:visible="dialogConfigJob" :jobData="dataConfigJob" :loading="loading" @save="updateDataJob" @cancel="cancelJob" @delete="deleteJob" />

        <!-- Confirm Upload Dialog -->
        <DialogForm :confirmDialog="modelConfirmUploadImage" :textContent="'ต้องการไปหน้าอัพโหลดเอกสารเลยหรือไม่?'" confirmLabel="ไปอัพโหลด (Enter)" cancelLabel="ภายหลัง" @close="modelConfirmUploadImage = false" @confirm="goToDetail()" />

        <!-- Cancel Job Dialog -->
        <DialogApprove mode="cancel" title="ยืนยันการยกเลิกงาน" :randomNumber="randomNumber" :confirmDialog="dialogJobCancel" @close="dialogJobCancel = false" @confirmJob="jobUpdateStatus(5)" @confirmJobFalse="confirmJobFalse()" />

        <!-- Delete Job Dialog -->
        <DialogApprove mode="delete" title="ยืนยันการลบงาน" :randomNumber="randomNumber" :confirmDialog="dialogJobDelete" @close="dialogJobDelete = false" @confirmJob="jobDelete()" @confirmJobFalse="confirmJobFalse()" />
    </div>
</template>
