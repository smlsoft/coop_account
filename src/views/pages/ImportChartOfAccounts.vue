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
const TEMPLATE_URL = '/demo/file/template_chartofaccount.xls';

const accountBalanceTypeLabels = {
    1: 'เดบิต',
    2: 'เครดิต'
};

const accountCategoryLabels = {
    1: 'สินทรัพย์',
    2: 'หนี้สิน',
    3: 'ทุน',
    4: 'รายได้',
    5: 'ค่าใช้จ่าย'
};

const accountLevelLabels = {
    1: 'ระดับ 1',
    2: 'ระดับ 2',
    3: 'ระดับ 3',
    4: 'ระดับ 4',
    5: 'ระดับ 5'
};

// Helper functions
const isMainAccount = (account) => {
    return !account.consolidateaccountcode || account.consolidateaccountcode === '' || account.consolidateaccountcode === account.accountcode;
};

const getIndentPadding = (level) => {
    if (level <= 1) return '0px';
    return `${(level - 1) * 20}px`;
};

const getAccountLevelLabel = (code) => {
    return accountLevelLabels[code] || code;
};
const getAccountBalanceTypeLabel = (code) => {
    return accountBalanceTypeLabels[code] || 'ไม่พบข้อมูล';
};

const getAccountCategoryLabel = (code) => {
    return accountCategoryLabels[code] || 'ไม่พบข้อมูล';
};

const checkSpecialString = (str) => {
    if (!str) return false;
    // อนุญาตให้ใช้ ( ) / ได้
    const specialChars = /[!@#$%^&*+=\[\]{};':"\\|,.<>?]/;
    return specialChars.test(str);
};

const removeDuplicates = (arr) => {
    return [...new Set(arr)];
};

// Download template
const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'template_chartofaccount.xls';
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
            const results = XLSX.utils.sheet_to_json(worksheet, { raw: true });

            const parsedData = results.map((row) => ({
                accountbalancetype: row.balance_mode ? parseInt(String(row.balance_mode).trim()) : null,
                accountcategory: row.account_type ? parseInt(String(row.account_type).trim()) : null,
                accountcode: row.account_code ? String(row.account_code).trim() : '',
                accountgroup: row.account_group ? String(row.account_group).trim() : '',
                accountname: row.account_name ? String(row.account_name).trim() : '',
                consolidateaccountcode: row.main_account ? String(row.main_account).trim() : '',
                accountlevel: row.account_level ? parseInt(String(row.account_level).trim()) : null,
                financialstatements: row.financial_statements ? parseInt(String(row.financial_statements).trim()) : 1
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
    const accountCodes = data.map((item) => item.accountcode);
    const uniqueCodes = removeDuplicates(accountCodes);

    uniqueCodes.forEach((code) => {
        const duplicates = data.filter((item) => item.accountcode === code);

        if (duplicates.length > 1) {
            errors.push({
                word: 'รหัสผังบัญชีซ้ำ',
                acc_code: code
            });
        } else if (duplicates.length === 1) {
            const item = duplicates[0];

            if (checkSpecialString(item.accountcode)) {
                errors.push({
                    word: 'รหัสผังบัญชีไม่สามารถใช้อักษรพิเศษได้',
                    acc_code: item.accountcode
                });
            }

            if (checkSpecialString(item.accountname)) {
                errors.push({
                    word: `ชื่อผังบัญชี "${item.accountname}" ไม่สามารถใช้อักษรพิเศษได้`,
                    acc_code: item.accountcode
                });
            }

            if (item.consolidateaccountcode && checkSpecialString(item.consolidateaccountcode)) {
                errors.push({
                    word: `รหัสผังบัญชีกลาง "${item.consolidateaccountcode}" ไม่สามารถใช้อักษรพิเศษได้`,
                    acc_code: item.accountcode
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

        const response = await api.importChartOfAccounts(importData.value);

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
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">นำเข้าข้อมูลผังบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">นำเข้าข้อมูลผังบัญชีจากไฟล์ Excel</p>
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
                    <li v-for="(error, index) in errorMessages" :key="index" class="text-red-600 dark:text-red-400">{{ error.word }} - รหัสผังบัญชี: {{ error.acc_code }}</li>
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

                <Column field="accountcode" header="รหัสบัญชี" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary" :class="{ 'font-black': isMainAccount(data) }">{{ data.accountcode }}</span>
                    </template>
                </Column>

                <Column field="accountname" header="ชื่อผังบัญชี" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span :style="{ paddingLeft: getIndentPadding(data.accountlevel) }" :class="{ 'font-black': isMainAccount(data) }">{{ data.accountname }}</span>
                    </template>
                </Column>

                <Column field="accountcategory" header="หมวดบัญชี" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="getAccountCategoryLabel(data.accountcategory)" :severity="data.accountcategory <= 3 ? 'success' : 'warn'" />
                    </template>
                </Column>

                <Column field="accountlevel" header="ระดับบัญชี" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ getAccountLevelLabel(data.accountlevel) }}</span>
                    </template>
                </Column>

                <Column field="accountbalancetype" header="ด้านบัญชี" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag :value="getAccountBalanceTypeLabel(data.accountbalancetype)" :severity="data.accountbalancetype === 1 ? 'info' : 'secondary'" />
                    </template>
                </Column>

                <Column field="consolidateaccountcode" header="รหัสผังบัญชีกลาง" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.consolidateaccountcode || '-' }}</span>
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
                        หากรหัสบัญชีมีอยู่แล้ว ระบบจะปรับปรุงข้อมูลให้อัตโนมัติ
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirm Dialog -->
    <DialogForm :confirmDialog="showConfirmDialog" :textContent="`ต้องการบันทึกนำเข้าผังบัญชี ${importData.length} รายการ?`" confirmLabel="บันทึก (Enter)" @close="closeConfirmDialog" @confirm="confirmSave" />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
