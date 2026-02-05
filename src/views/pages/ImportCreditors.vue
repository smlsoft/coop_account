<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import * as XLSX from 'xlsx';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const fileInput = ref(null);
const importData = ref([]);
const errorMessages = ref([]);
const showConfirmDialog = ref(false);
const isSaving = ref(false);
const isDragging = ref(false);

// Constants
const TEMPLATE_URL = '/demo/file/template_creditors.xlsx';

const personalTypeLabels = {
    1: 'บุคคลธรรมดา',
    2: 'นิติบุคคล'
};

const customerTypeLabels = {
    1: 'สำนักงานใหญ่',
    2: 'สาขา'
};

// Helper functions
const getPersonalTypeLabel = (code) => {
    return personalTypeLabels[code] || '-';
};

const getCustomerTypeLabel = (code) => {
    return customerTypeLabels[code] || '-';
};

// Convert AR_TYPE and BRANCH_TYPE values (0 → 1, 1 → 2)
const convertTypeValue = (value) => {
    if (value === 0 || value === '0') return 1;
    if (value === 1 || value === '1') return 2;
    return parseInt(value) || 1;
};

// Download template
const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'template_creditors.xlsx';
    link.click();
};

// Process file (shared logic for upload and drop)
const processFile = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['.xls', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const isValidType = validTypes.some((type) => file.name.endsWith(type) || file.type === type);

    if (!isValidType) {
        toast.add({
            severity: 'warn',
            summary: 'รูปแบบไฟล์ไม่ถูกต้อง',
            detail: 'กรุณาเลือกไฟล์ Excel (.xls หรือ .xlsx)',
            life: 3000
        });
        return;
    }

    showLoading('กำลังอ่านไฟล์...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Get raw data with header row (row 2 has field names)
            const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1 });

            // Row 0 = Thai headers (ignored)
            // Row 1 = Field names (CODE, NAME, AR_TYPE, etc.)
            // Row 2+ = Data
            if (rawData.length < 3) {
                toast.add({
                    severity: 'warn',
                    summary: 'ไฟล์ไม่มีข้อมูล',
                    detail: 'กรุณาตรวจสอบรูปแบบไฟล์',
                    life: 3000
                });
                hideLoading();
                return;
            }

            const headers = rawData[1]; // Field names row
            const headerMap = {};
            headers.forEach((header, index) => {
                if (header) {
                    headerMap[String(header).trim().toUpperCase()] = index;
                }
            });

            const dataRows = rawData.slice(2); // Data rows

            const parsedData = dataRows
                .filter((row) => row && row.length > 0 && row[headerMap['CODE']])
                .map((row) => ({
                    code: row[headerMap['CODE']] ? String(row[headerMap['CODE']]).trim() : '',
                    names: [
                        {
                            code: 'th',
                            name: row[headerMap['NAME']] ? String(row[headerMap['NAME']]).trim() : ''
                        }
                    ],
                    personaltype: convertTypeValue(row[headerMap['AR_TYPE']]),
                    taxid: row[headerMap['TAXID']] ? String(row[headerMap['TAXID']]).trim() : '',
                    customertype: convertTypeValue(row[headerMap['BRANCH_TYPE']]),
                    branchnumber: row[headerMap['BRANCH_CODE']] ? String(row[headerMap['BRANCH_CODE']]).trim() : '',
                    addressforbilling: {
                        address: [row[headerMap['ADDRESS']] ? String(row[headerMap['ADDRESS']]).trim() : ''],
                        phoneprimary: row[headerMap['TELEPHONE']] ? String(row[headerMap['TELEPHONE']]).trim() : ''
                    }
                }));

            errorMessages.value = [];

            if (verifyData(parsedData)) {
                importData.value = parsedData;
                toast.add({
                    severity: 'success',
                    summary: 'อ่านไฟล์สำเร็จ',
                    detail: `พบข้อมูล ${parsedData.length} รายการ`,
                    life: 3000
                });
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์',
                life: 5000
            });
        } finally {
            hideLoading();
        }
    };

    reader.onerror = () => {
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอ่านไฟล์ได้',
            life: 3000
        });
    };

    reader.readAsArrayBuffer(file);
};

// Import file from FileUpload component
const handleFileUpload = (event) => {
    const file = event.files?.[0];
    processFile(file);
};

// Drag & Drop handlers
const onDragOver = (event) => {
    event.preventDefault();
    isDragging.value = true;
};

const onDragLeave = () => {
    isDragging.value = false;
};

const onDrop = (event) => {
    event.preventDefault();
    isDragging.value = false;

    const file = event.dataTransfer?.files?.[0];
    processFile(file);
};

// Verify data
const verifyData = (data) => {
    const errors = [];
    const codes = data.map((item) => item.code);
    const uniqueCodes = [...new Set(codes)];

    uniqueCodes.forEach((code) => {
        const duplicates = data.filter((item) => item.code === code);

        if (duplicates.length > 1) {
            errors.push({
                word: 'รหัสเจ้าหนี้ซ้ำ',
                code: code
            });
        } else if (duplicates.length === 1) {
            const item = duplicates[0];

            if (!item.code) {
                errors.push({
                    word: 'รหัสเจ้าหนี้ไม่สามารถเว้นว่างได้',
                    code: '-'
                });
            }

            if (!item.names[0]?.name) {
                errors.push({
                    word: 'ชื่อเจ้าหนี้ไม่สามารถเว้นว่างได้',
                    code: item.code
                });
            }
        }
    });

    errorMessages.value = errors;
    return errors.length === 0;
};

// Clear data
const clearData = () => {
    importData.value = [];
    errorMessages.value = [];
    if (fileInput.value) {
        fileInput.value.clear();
    }
};

// Confirm save
const openConfirmDialog = () => {
    showConfirmDialog.value = true;
};

const closeConfirmDialog = () => {
    showConfirmDialog.value = false;
};

const confirmSave = async () => {
    showConfirmDialog.value = false;

    try {
        isSaving.value = true;
        showLoading('กำลังนำเข้าข้อมูล...');

        const response = await api.importCreditors(importData.value);

        if (response.success) {
            const createdCount = response.created?.length || 0;
            const updatedCount = response.updated?.length || 0;

            toast.add({
                severity: 'success',
                summary: 'นำเข้าข้อมูลสำเร็จ',
                detail: `สร้างรายการใหม่ ${createdCount} รายการ และปรับปรุง ${updatedCount} รายการ`,
                life: 5000
            });

            clearData();
        }
    } catch (error) {
        console.error('Error importing:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถนำเข้าข้อมูลได้',
            life: 5000
        });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">นำเข้าข้อมูลเจ้าหนี้</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">นำเข้าข้อมูลเจ้าหนี้จากไฟล์ Excel</p>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-3">
                <Button label="ดาวน์โหลด Template" icon="pi pi-download" severity="secondary" @click="downloadTemplate" />

                <Button v-if="importData.length > 0" label="บันทึกนำเข้า" icon="pi pi-save" severity="success" :loading="isSaving" @click="openConfirmDialog" />

                <Button v-if="importData.length > 0" label="ยกเลิก" icon="pi pi-times" severity="danger" outlined @click="clearData" />
            </div>

            <!-- Error Messages -->
            <div v-if="errorMessages.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="pi pi-exclamation-triangle text-red-500 text-xl"></i>
                    <span class="font-semibold text-red-700 dark:text-red-400">ไม่สามารถทำรายการได้ กรุณาตรวจสอบข้อมูล</span>
                </div>
                <ul class="list-disc list-inside space-y-1">
                    <li v-for="(error, index) in errorMessages" :key="index" class="text-red-600 dark:text-red-400">{{ error.word }} - รหัสเจ้าหนี้: {{ error.code }}</li>
                </ul>
            </div>

            <!-- Data Table -->
            <DataTable
                v-if="importData.length > 0"
                :value="importData"
                :paginator="true"
                :rows="20"
                :rowsPerPageOptions="[10, 20, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                responsiveLayout="scroll"
                stripedRows
                class="w-full"
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูล</p>
                    </div>
                </template>

                <Column field="code" header="รหัสเจ้าหนี้" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column header="ชื่อเจ้าหนี้" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span>{{ data.names[0]?.name || '-' }}</span>
                    </template>
                </Column>

                <Column field="personaltype" header="ประเภทบุคคล" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="getPersonalTypeLabel(data.personaltype)" :severity="data.personaltype === 1 ? 'info' : 'success'" />
                    </template>
                </Column>

                <Column field="taxid" header="เลขประจำตัวผู้เสียภาษี" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.taxid || '-' }}</span>
                    </template>
                </Column>

                <Column field="customertype" header="ประเภทสาขา" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="getCustomerTypeLabel(data.customertype)" :severity="data.customertype === 1 ? 'secondary' : 'warn'" />
                    </template>
                </Column>

                <Column field="branchnumber" header="รหัสสาขา" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.branchnumber || '-' }}</span>
                    </template>
                </Column>

                <Column header="ที่อยู่" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.addressforbilling?.address?.[0] || '-' }}</span>
                    </template>
                </Column>

                <Column header="โทรศัพท์" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.addressforbilling?.phoneprimary || '-' }}</span>
                    </template>
                </Column>
            </DataTable>

            <!-- Drop Zone / Empty State -->
            <div
                v-if="importData.length === 0 && errorMessages.length === 0"
                class="rounded-border border-2 border-dashed border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 transition-all duration-300 cursor-pointer"
                :class="isDragging ? 'border-primary bg-primary-50 dark:bg-primary-900/20 scale-[1.01]' : 'hover:border-primary hover:bg-surface-100 dark:hover:bg-surface-700'"
                @dragover="onDragOver"
                @dragleave="onDragLeave"
                @drop="onDrop"
            >
                <div class="flex flex-col items-center justify-center py-12 px-8">
                    <!-- Icon -->
                    <div class="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300" :class="isDragging ? 'bg-primary-100 dark:bg-primary-900/30 scale-110' : 'bg-surface-100 dark:bg-surface-700'">
                        <i class="pi pi-file-excel text-4xl transition-all duration-300" :class="isDragging ? 'text-primary' : 'text-surface-400'"></i>
                    </div>

                    <!-- Text -->
                    <div class="text-center">
                        <p class="text-xl font-semibold mb-2" :class="isDragging ? 'text-primary' : 'text-surface-700 dark:text-surface-200'">
                            {{ isDragging ? 'ปล่อยไฟล์เพื่อนำเข้า' : 'ลากไฟล์ Excel มาวางที่นี่' }}
                        </p>
                        <p class="text-surface-500 dark:text-surface-400 text-sm">หรือคลิกปุ่มด้านล่างเพื่อเลือกไฟล์</p>
                    </div>

                    <!-- Upload Button -->
                    <FileUpload ref="fileInput" mode="basic" accept=".xls,.xlsx" :auto="true" :customUpload="true" @uploader="handleFileUpload" chooseLabel="เลือกไฟล์" chooseIcon="pi pi-upload" class="mt-4" />

                    <!-- File info -->
                    <div class="flex items-center gap-4 mt-6 text-surface-400 text-xs">
                        <Chip class="bg-surface-100 dark:bg-surface-700">
                            <i class="pi pi-file mr-1"></i>
                            .xls, .xlsx
                        </Chip>
                        <Button label="ดาวน์โหลด Template" icon="pi pi-download" text size="small" @click="downloadTemplate" />
                    </div>

                    <!-- Note -->
                    <p class="text-surface-400 text-xs mt-4 flex items-center gap-1">
                        <i class="pi pi-info-circle"></i>
                        หากรหัสเจ้าหนี้มีอยู่แล้ว ระบบจะปรับปรุงข้อมูลให้อัตโนมัติ
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirm Dialog -->
    <DialogForm :confirmDialog="showConfirmDialog" :textContent="`ต้องการบันทึกนำเข้าเจ้าหนี้ ${importData.length} รายการ?`" confirmLabel="บันทึก (Enter)" @close="closeConfirmDialog" @confirm="confirmSave" />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
