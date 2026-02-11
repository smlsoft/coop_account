<script setup>
import DialogForm from '@/components/DialogForm.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ตรวจสอบ mode (create/edit)
const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขงวดบัญชี' : 'เพิ่มงวดบัญชี'));

// Tab mode: manual หรือ auto
const activeTabIndex = ref(0);

// ข้อมูลฟอร์ม Manual
const formData = ref({
    guidfixed: '',
    startdate: null,
    enddate: null,
    period: 1,
    description: '',
    isdisabled: false
});

// ข้อมูลฟอร์ม Auto
const autoFormData = ref({
    periodType: 'month', // month, quarter, year
    startdate: null,
    startPeriod: 1,
    periodCount: 12
});

// Preview data for auto generation
const previewData = ref([]);

// Period type options
const periodTypeOptions = ref([
    { label: 'เดือน', value: 'month' },
    { label: 'ไตรมาส (+3 เดือน)', value: 'quarter' },
    { label: 'ปี (+12 เดือน)', value: 'year' }
]);

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states - Manual
const isStartDateInvalid = ref(false);
const isEndDateInvalid = ref(false);
const isPeriodInvalid = ref(false);

// Invalid states - Auto
const isAutoStartDateInvalid = ref(false);
const isAutoStartPeriodInvalid = ref(false);
const isAutoPeriodCountInvalid = ref(false);

/**
 * ดึงข้อมูลงวดบัญชีสำหรับแก้ไข
 */
const fetchPeriodData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const response = await api.getAccountPeriodById(route.params.id);

        if (response.success) {
            formData.value = {
                ...response.data,
                startdate: response.data.startdate ? new Date(response.data.startdate) : null,
                enddate: response.data.enddate ? new Date(response.data.enddate) : null
            };
        }
    } catch (error) {
        console.error('Error fetching account period data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'accounting-periods' });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * Format Date เป็น YYYY-MM-DD
 */
const formatDateToString = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * คำนวณวันสิ้นสุดเดือน
 */
const getEndOfMonth = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
};

/**
 * เพิ่มเดือน
 */
const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

/**
 * Generate preview data สำหรับ auto mode
 */
const generatePreview = () => {
    if (!autoFormData.value.startdate || !autoFormData.value.startPeriod || !autoFormData.value.periodCount) {
        previewData.value = [];
        return;
    }

    const result = [];
    let currentDate = new Date(autoFormData.value.startdate);
    let currentPeriod = autoFormData.value.startPeriod;

    // กำหนดจำนวนเดือนตามประเภท
    let monthsPerPeriod = 1;
    if (autoFormData.value.periodType === 'quarter') {
        monthsPerPeriod = 3;
    } else if (autoFormData.value.periodType === 'year') {
        monthsPerPeriod = 12;
    }

    for (let i = 0; i < autoFormData.value.periodCount; i++) {
        // คำนวณวันเริ่มต้น (วันที่ 1 ของเดือน)
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        // คำนวณวันสิ้นสุด
        let endDate;
        if (monthsPerPeriod === 1) {
            // สำหรับรายเดือน: สิ้นสุดวันสุดท้ายของเดือน
            endDate = getEndOfMonth(startDate);
        } else {
            // สำหรับไตรมาส/ปี: สิ้นสุดวันสุดท้ายของเดือนสุดท้าย
            const lastMonthStart = addMonths(startDate, monthsPerPeriod - 1);
            endDate = getEndOfMonth(lastMonthStart);
        }

        result.push({
            period: currentPeriod,
            startdate: formatDateToString(startDate),
            enddate: formatDateToString(endDate),
            description: '',
            isdisabled: false
        });

        // เลื่อนไปงวดถัดไป
        currentDate = addMonths(currentDate, monthsPerPeriod);
        currentPeriod++;
    }

    previewData.value = result;
};

// Watch auto form changes to update preview
watch(
    () => [autoFormData.value.periodType, autoFormData.value.startdate, autoFormData.value.startPeriod, autoFormData.value.periodCount],
    () => {
        generatePreview();
    },
    { deep: true }
);

/**
 * ตรวจสอบข้อมูลก่อนบันทึก - Manual
 */
const validateManualForm = () => {
    isStartDateInvalid.value = false;
    isEndDateInvalid.value = false;
    isPeriodInvalid.value = false;

    let hasError = false;

    if (!formData.value.startdate) {
        isStartDateInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.enddate) {
        isEndDateInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.period || formData.value.period < 1) {
        isPeriodInvalid.value = true;
        hasError = true;
    }

    if (hasError) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
            life: 3000
        });
        return false;
    }

    // ตรวจสอบวันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด
    if (formData.value.startdate > formData.value.enddate) {
        toast.add({
            severity: 'warn',
            summary: 'ข้อมูลไม่ถูกต้อง',
            detail: 'วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด',
            life: 3000
        });
        return false;
    }

    return true;
};

/**
 * ตรวจสอบข้อมูลก่อนบันทึก - Auto
 */
const validateAutoForm = () => {
    isAutoStartDateInvalid.value = false;
    isAutoStartPeriodInvalid.value = false;
    isAutoPeriodCountInvalid.value = false;

    let hasError = false;

    if (!autoFormData.value.startdate) {
        isAutoStartDateInvalid.value = true;
        hasError = true;
    }

    if (!autoFormData.value.startPeriod || autoFormData.value.startPeriod < 1) {
        isAutoStartPeriodInvalid.value = true;
        hasError = true;
    }

    if (!autoFormData.value.periodCount || autoFormData.value.periodCount < 1) {
        isAutoPeriodCountInvalid.value = true;
        hasError = true;
    }

    if (hasError) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
            life: 3000
        });
        return false;
    }

    if (previewData.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่มีข้อมูล',
            detail: 'ไม่สามารถสร้างรายการงวดบัญชีได้',
            life: 3000
        });
        return false;
    }

    return true;
};

/**
 * Handle form submit
 */
const handleSubmit = () => {
    if (activeTabIndex.value === 0) {
        // Manual mode
        if (!validateManualForm()) return;
    } else {
        // Auto mode
        if (!validateAutoForm()) return;
    }

    showConfirmDialog.value = true;
};

/**
 * ยืนยันการบันทึกข้อมูล
 */
const confirmSave = async () => {
    showConfirmDialog.value = false;

    try {
        isSaving.value = true;

        if (activeTabIndex.value === 0) {
            // Manual mode
            showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังสร้างงวดบัญชี...');

            const payload = {
                startdate: formatDateToString(formData.value.startdate),
                enddate: formatDateToString(formData.value.enddate),
                period: formData.value.period,
                description: formData.value.description || '',
                isdisabled: formData.value.isdisabled
            };

            let response;
            if (isEditMode.value) {
                response = await api.updateAccountPeriod(route.params.id, payload);
            } else {
                response = await api.createAccountPeriod(payload);
            }

            if (response.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'สร้างงวดบัญชีเรียบร้อยแล้ว',
                    life: 3000
                });

                router.push({ name: 'accounting-periods' });
            }
        } else {
            // Auto mode - Bulk create
            showLoading('กำลังสร้างงวดบัญชี...');

            const response = await api.createAccountPeriodBulk(previewData.value);

            if (response.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: `สร้างงวดบัญชี ${previewData.value.length} รายการเรียบร้อยแล้ว`,
                    life: 3000
                });

                router.push({ name: 'accounting-periods' });
            }
        }
    } catch (error) {
        console.error('Error saving account period:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
            life: 3000
        });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

/**
 * ยกเลิกและกลับไปหน้ารายการ
 */
const handleCancel = () => {
    router.push({ name: 'accounting-periods' });
};

/**
 * Format วันที่เป็น DD/MM/YYYY
 */
const formatDisplayDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * Keyboard handler สำหรับ Ctrl + S
 */
const handleKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSubmit();
    }
};

// โหลดข้อมูลเมื่อเป็น edit mode
onMounted(() => {
    if (isEditMode.value) {
        fetchPeriodData();
    }
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div class="flex items-center gap-3">
                    <Button icon="pi pi-arrow-left" text rounded @click="handleCancel" v-tooltip.top="'กลับ'" />
                    <div>
                        <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ pageTitle }}</div>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <ProgressSpinner />
            </div>

            <!-- Form -->
            <div v-else>
                <!-- Tab Menu (แสดงเฉพาะ create mode) -->
                <TabView v-if="!isEditMode" v-model:activeIndex="activeTabIndex" class="mb-4">
                    <TabPanel header="กำหนดเอง">
                        <!-- Manual Form -->
                        <form @submit.prevent="handleSubmit" class="flex flex-col gap-6 pt-4">
                            <!-- Row 1: วันที่เริ่มต้น และ วันที่สิ้นสุด -->
                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex flex-col gap-2 md:w-1/2">
                                    <label for="startdate" class="font-semibold text-surface-900 dark:text-surface-0">
                                        วันที่เริ่มต้น
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <ThaiDatePicker id="startdate" v-model="formData.startdate" dateFormat="dd/mm/yy" placeholder="เลือกวันที่เริ่มต้น" showIcon :invalid="isStartDateInvalid" class="w-full" fluid />
                                    <small v-if="isStartDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาเลือกวันที่เริ่มต้น
                                    </small>
                                </div>

                                <div class="flex flex-col gap-2 md:w-1/2">
                                    <label for="enddate" class="font-semibold text-surface-900 dark:text-surface-0">
                                        วันที่สิ้นสุด
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <ThaiDatePicker id="enddate" v-model="formData.enddate" dateFormat="dd/mm/yy" placeholder="เลือกวันที่สิ้นสุด" showIcon :invalid="isEndDateInvalid" class="w-full" fluid />
                                    <small v-if="isEndDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาเลือกวันที่สิ้นสุด
                                    </small>
                                </div>
                            </div>

                            <!-- Row 2: งวดที่ และ รายละเอียด -->
                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex flex-col gap-2 md:w-1/4">
                                    <label for="period" class="font-semibold text-surface-900 dark:text-surface-0">
                                        งวดที่
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <InputNumber id="period" v-model="formData.period" :min="1" placeholder="ระบุงวดที่" :invalid="isPeriodInvalid" class="w-full" fluid />
                                    <small v-if="isPeriodInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาระบุงวดที่
                                    </small>
                                </div>

                                <div class="flex flex-col gap-2 md:w-3/4">
                                    <label for="description" class="font-semibold text-surface-900 dark:text-surface-0"> รายละเอียด </label>
                                    <InputText id="description" v-model="formData.description" placeholder="กรอกรายละเอียด (ถ้ามี)" class="w-full" fluid />
                                </div>
                            </div>

                            <!-- Row 3: สถานะ -->
                            <div class="flex flex-col gap-2">
                                <label class="font-semibold text-surface-900 dark:text-surface-0">สถานะ</label>
                                <div class="flex items-center gap-3">
                                    <ToggleSwitch v-model="formData.isdisabled" :trueValue="false" :falseValue="true" />
                                    <span :class="formData.isdisabled ? 'text-red-500' : 'text-green-500'">
                                        {{ formData.isdisabled ? 'ปิดงวดบัญชี' : 'เปิดงวดบัญชี' }}
                                    </span>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                                <Button type="submit" label="สร้าง (Ctrl + S)" icon="pi pi-save" :loading="isSaving" :disabled="!formData.startdate || !formData.enddate || !formData.period" />
                            </div>
                        </form>
                    </TabPanel>

                    <TabPanel header="สร้างอัตโนมัติ">
                        <!-- Auto Form -->
                        <form @submit.prevent="handleSubmit" class="flex flex-col gap-6 pt-4">
                            <!-- Row 1: ประเภท และ จากวันที่ -->
                            <div class="flex flex-col md:flex-row gap-6">
                                <div class="flex flex-col gap-2 md:w-1/3">
                                    <label for="periodType" class="font-semibold text-surface-900 dark:text-surface-0">
                                        ประเภทงวด
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <Select id="periodType" v-model="autoFormData.periodType" :options="periodTypeOptions" optionLabel="label" optionValue="value" placeholder="เลือกประเภทงวด" class="w-full" fluid />
                                </div>

                                <div class="flex flex-col gap-2 md:w-1/3">
                                    <label for="autoStartdate" class="font-semibold text-surface-900 dark:text-surface-0">
                                        จากวันที่
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <ThaiDatePicker id="autoStartdate" v-model="autoFormData.startdate" dateFormat="dd/mm/yy" placeholder="เลือกวันที่เริ่มต้น" showIcon :invalid="isAutoStartDateInvalid" class="w-full" fluid />
                                    <small v-if="isAutoStartDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาเลือกวันที่
                                    </small>
                                </div>

                                <div class="flex flex-col gap-2 md:w-1/6">
                                    <label for="startPeriod" class="font-semibold text-surface-900 dark:text-surface-0">
                                        เริ่มต้นงวด
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <InputNumber id="startPeriod" v-model="autoFormData.startPeriod" :min="1" placeholder="งวดที่" :invalid="isAutoStartPeriodInvalid" class="w-full" fluid />
                                    <small v-if="isAutoStartPeriodInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาระบุ
                                    </small>
                                </div>

                                <div class="flex flex-col gap-2 md:w-1/6">
                                    <label for="periodCount" class="font-semibold text-surface-900 dark:text-surface-0">
                                        จำนวนงวด
                                        <span class="text-red-500">*</span>
                                    </label>
                                    <InputNumber id="periodCount" v-model="autoFormData.periodCount" :min="1" :max="100" placeholder="จำนวน" :invalid="isAutoPeriodCountInvalid" class="w-full" fluid />
                                    <small v-if="isAutoPeriodCountInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <i class="pi pi-exclamation-circle"></i>
                                        กรุณาระบุ
                                    </small>
                                </div>
                            </div>

                            <!-- Preview Table -->
                            <div v-if="previewData.length > 0" class="flex flex-col gap-2">
                                <label class="font-semibold text-surface-900 dark:text-surface-0"> ตัวอย่างข้อมูลที่จะสร้าง ({{ previewData.length }} รายการ) </label>
                                <DataTable :value="previewData" class="w-full" stripedRows scrollable scrollHeight="300px">
                                    <Column field="period" header="งวดที่" style="min-width: 6rem"></Column>
                                    <Column field="startdate" header="วันที่เริ่มต้น" style="min-width: 10rem">
                                        <template #body="{ data }">
                                            {{ formatDisplayDate(data.startdate) }}
                                        </template>
                                    </Column>
                                    <Column field="enddate" header="วันที่สิ้นสุด" style="min-width: 10rem">
                                        <template #body="{ data }">
                                            {{ formatDisplayDate(data.enddate) }}
                                        </template>
                                    </Column>
                                </DataTable>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                                <Button type="submit" :label="`สร้าง ${previewData.length} งวด (Enter)`" icon="pi pi-save" :loading="isSaving" :disabled="previewData.length === 0" />
                            </div>
                        </form>
                    </TabPanel>
                </TabView>

                <!-- Edit Mode - Only Manual Form -->
                <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-6">
                    <!-- Row 1: วันที่เริ่มต้น และ วันที่สิ้นสุด -->
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="flex flex-col gap-2 md:w-1/2">
                            <label for="startdate" class="font-semibold text-surface-900 dark:text-surface-0">
                                วันที่เริ่มต้น
                                <span class="text-red-500">*</span>
                            </label>
                            <ThaiDatePicker id="startdate" v-model="formData.startdate" dateFormat="dd/mm/yy" placeholder="เลือกวันที่เริ่มต้น" showIcon :invalid="isStartDateInvalid" class="w-full" />
                            <small v-if="isStartDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                <i class="pi pi-exclamation-circle"></i>
                                กรุณาเลือกวันที่เริ่มต้น
                            </small>
                        </div>

                        <div class="flex flex-col gap-2 md:w-1/2">
                            <label for="enddate" class="font-semibold text-surface-900 dark:text-surface-0">
                                วันที่สิ้นสุด
                                <span class="text-red-500">*</span>
                            </label>
                            <ThaiDatePicker id="enddate" v-model="formData.enddate" dateFormat="dd/mm/yy" placeholder="เลือกวันที่สิ้นสุด" showIcon :invalid="isEndDateInvalid" class="w-full" fluid />
                            <small v-if="isEndDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                <i class="pi pi-exclamation-circle"></i>
                                กรุณาเลือกวันที่สิ้นสุด
                            </small>
                        </div>
                    </div>

                    <!-- Row 2: งวดที่ และ รายละเอียด -->
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="flex flex-col gap-2 md:w-1/4">
                            <label for="period" class="font-semibold text-surface-900 dark:text-surface-0">
                                งวดที่
                                <span class="text-red-500">*</span>
                            </label>
                            <InputNumber id="period" v-model="formData.period" :min="1" placeholder="ระบุงวดที่" :invalid="isPeriodInvalid" class="w-full" fluid />
                            <small v-if="isPeriodInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                                <i class="pi pi-exclamation-circle"></i>
                                กรุณาระบุงวดที่
                            </small>
                        </div>

                        <div class="flex flex-col gap-2 md:w-3/4">
                            <label for="description" class="font-semibold text-surface-900 dark:text-surface-0"> รายละเอียด </label>
                            <InputText id="description" v-model="formData.description" placeholder="กรอกรายละเอียด (ถ้ามี)" class="w-full" fluid />
                        </div>
                    </div>

                    <!-- Row 3: สถานะ -->
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold text-surface-900 dark:text-surface-0">สถานะ</label>
                        <div class="flex items-center gap-3">
                            <ToggleSwitch v-model="formData.isdisabled" :trueValue="false" :falseValue="true" />
                            <span :class="formData.isdisabled ? 'text-red-500' : 'text-green-500'">
                                {{ formData.isdisabled ? 'ปิดงวดบัญชี' : 'เปิดงวดบัญชี' }}
                            </span>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                        <Button type="submit" label="บันทึก (Ctrl + S)" icon="pi pi-save" :loading="isSaving" :disabled="!formData.startdate || !formData.enddate || !formData.period" />
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขงวดบัญชีหรือไม่?' : activeTabIndex === 0 ? 'คุณต้องการสร้างงวดบัญชีใหม่หรือไม่?' : `คุณต้องการสร้างงวดบัญชี ${previewData.length} รายการหรือไม่?`"
        confirmLabel="บันทึก (Enter)"
        cancelLabel="ยกเลิก"
        @close="showConfirmDialog = false"
        @confirm="confirmSave"
    />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
