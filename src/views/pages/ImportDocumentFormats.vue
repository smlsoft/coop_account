<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
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

// Master data - ใช้ Set สำหรับ O(1) lookup
const validAccountCodes = ref(new Set());

onMounted(async () => {
    try {
        const response = await api.getChartOfAccounts({ limit: 2000, page: 1 });
        if (response?.success && response.data) {
            validAccountCodes.value = new Set(response.data.map((acc) => acc.accountcode));
        }
    } catch (error) {
        console.error('Failed to fetch chart of accounts:', error);
        toast.add({ severity: 'warn', summary: 'โหลดผังบัญชีไม่สำเร็จ', detail: 'ไม่สามารถตรวจสอบรหัสบัญชีได้', life: 4000 });
    }
});

// Expand all rows by default when data loads
const expandedRows = ref({});

const expandAllRows = (data) => {
    const expanded = {};
    data.forEach((item) => {
        expanded[item.doccode] = true;
    });
    expandedRows.value = expanded;
};

// Constants
const TEMPLATE_URL = '/demo/file/template_journal_format.xlsx';

// Empty account object ตาม schema
const emptyAccount = () => ({
    guidfixed: '',
    accountcode: '',
    accountname: '',
    financialstatements: 0,
    accountcategory: 0,
    accountbalancetype: 0,
    accountgroup: '',
    accountlevel: 0,
    consolidateaccountcode: ''
});

// Download template
const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'template_journal_format.xlsx';
    link.click();
};

// Process file
const processFile = (file) => {
    if (!file) return;

    const validTypes = ['.xls', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const isValidType = validTypes.some((type) => file.name.endsWith(type) || file.type === type);

    if (!isValidType) {
        toast.add({ severity: 'warn', summary: 'รูปแบบไฟล์ไม่ถูกต้อง', detail: 'กรุณาเลือกไฟล์ Excel (.xls หรือ .xlsx)', life: 3000 });
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
            // range: 2 = skip แถว 1 (section header), แถว 2 (col header), แถว 3 (description hint)
            // อ่านเริ่มจากแถว 4 (index 3) โดยใช้แถว 2 เป็น header row
            const results = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 1 });

            const errorMsgs = [];
            // Group rows by DOCCODE
            const groupMap = new Map();

            results.forEach((row, rowIndex) => {
                // Skip แถว description hint (แถวแรกของ results คือ description row)
                if (rowIndex === 0) return;

                // Skip แถวว่าง (ทุก field ว่างหมด)
                const hasAnyValue = Object.values(row).some((v) => v !== '' && v !== null && v !== undefined);
                if (!hasAnyValue) return;

                const doccode = row['DOCCODE'] ? String(row['DOCCODE']).trim() : '';
                const description = row['DESCRIPTION'] ? String(row['DESCRIPTION']).trim() : '';
                const accountcode = row['ACCOUNTCODE'] ? String(row['ACCOUNTCODE']).trim() : '';
                const detail = row['DETAIL'] ? String(row['DETAIL']).trim() : '';
                const actioncode = row['ACTIONCODE'] ? String(row['ACTIONCODE']).trim() : '';
                const debit = row['DEBIT'] !== undefined ? String(row['DEBIT']) : '0';
                const credit = row['CREDIT'] !== undefined ? String(row['CREDIT']) : '0';

                // Validation ระดับแถว
                if (!doccode) {
                    errorMsgs.push({ name: 'DOCCODE ต้องไม่ว่าง', row: rowIndex + 3 });
                    return;
                }
                if (!description) {
                    errorMsgs.push({ name: 'DESCRIPTION ต้องไม่ว่าง', row: rowIndex + 3, doccode });
                    return;
                }
                if (!accountcode) {
                    errorMsgs.push({ name: 'ACCOUNTCODE ต้องไม่ว่าง', row: rowIndex + 3, doccode });
                    return;
                }

                // ตรวจสอบ accountcode ว่ามีในระบบไหม (ถ้าโหลด master สำเร็จ)
                if (validAccountCodes.value.size > 0 && !validAccountCodes.value.has(accountcode)) {
                    errorMsgs.push({ name: `รหัสบัญชี "${accountcode}" ไม่มีในระบบ`, row: rowIndex + 3, doccode });
                    return;
                }

                if (!groupMap.has(doccode)) {
                    groupMap.set(doccode, { doccode, description, details: [] });
                }

                groupMap.get(doccode).details.push({
                    accountcode,
                    actioncode,
                    detail,
                    debit,
                    credit,
                    isentryselfaccount: false,
                    accountdebit: emptyAccount(),
                    accountcredit: emptyAccount()
                });
            });

            // ตรวจ group ที่ไม่มี detail
            groupMap.forEach((value, key) => {
                if (value.details.length === 0) {
                    errorMsgs.push({ name: 'ต้องมีรายการบัญชีอย่างน้อย 1 รายการ', row: '-', doccode: key });
                }
            });

            errorMessages.value = errorMsgs;

            if (errorMsgs.length === 0) {
                importData.value = Array.from(groupMap.values());
                expandAllRows(importData.value);
                toast.add({
                    severity: 'success',
                    summary: 'อ่านไฟล์สำเร็จ',
                    detail: `พบรูปแบบการบันทึกบัญชี ${importData.value.length} รูปแบบ`,
                    life: 3000
                });
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์', life: 5000 });
        } finally {
            hideLoading();
        }
    };

    reader.onerror = () => {
        hideLoading();
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถอ่านไฟล์ได้', life: 3000 });
    };

    reader.readAsArrayBuffer(file);
};

// Handle file upload
const handleFileUpload = (event) => {
    const file = event.files?.[0];
    processFile(file);
};

// Drag & Drop
const onDragOver = (event) => {
    event.preventDefault();
    isDragging.value = true;
};
const onDragLeave = () => { isDragging.value = false; };
const onDrop = (event) => {
    event.preventDefault();
    isDragging.value = false;
    processFile(event.dataTransfer?.files?.[0]);
};

// Clear data
const clearData = () => {
    importData.value = [];
    errorMessages.value = [];
    if (fileInput.value) fileInput.value.clear();
};

// Confirm save
const openConfirmDialog = () => { showConfirmDialog.value = true; };
const closeConfirmDialog = () => { showConfirmDialog.value = false; };

const confirmSave = async () => {
    showConfirmDialog.value = false;
    try {
        isSaving.value = true;
        showLoading('กำลังนำเข้าข้อมูล...');

        const postData = importData.value.map((item) => ({
            doccode: item.doccode,
            module: 'GL',
            description: item.description,
            promptdescription: '',
            details: item.details
        }));

        const response = await api.importDocumentFormats(postData);

        if (response?.success) {
            const count = response.data?.length || postData.length;
            toast.add({ severity: 'success', summary: 'นำเข้าข้อมูลสำเร็จ', detail: `นำเข้ารูปแบบการบันทึกบัญชี ${count} รูปแบบ`, life: 5000 });
            clearData();
        }
    } catch (error) {
        console.error('Error importing:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: error.response?.data?.message || 'ไม่สามารถนำเข้าข้อมูลได้', life: 5000 });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

const hasData = computed(() => importData.value.length > 0);
const hasErrors = computed(() => errorMessages.value.length > 0);
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">นำเข้ารูปแบบการบันทึกบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">นำเข้าข้อมูลรูปแบบการบันทึกบัญชีจากไฟล์ Excel</p>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-3">
                <Button label="ดาวน์โหลด Template" icon="pi pi-download" severity="secondary" @click="downloadTemplate" />
                <Button v-if="hasData && !hasErrors" label="บันทึกนำเข้า" icon="pi pi-save" severity="success" :loading="isSaving" @click="openConfirmDialog" />
                <Button v-if="hasData || hasErrors" label="ยกเลิก" icon="pi pi-times" severity="danger" outlined @click="clearData" />
            </div>

            <!-- Error Messages -->
            <div v-if="hasErrors" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="pi pi-exclamation-triangle text-red-500 text-xl"></i>
                    <span class="font-semibold text-red-700 dark:text-red-400">ไม่สามารถทำรายการได้ กรุณาตรวจสอบข้อมูล</span>
                </div>
                <ul class="list-disc list-inside space-y-1">
                    <li v-for="(error, index) in errorMessages" :key="index" class="text-red-600 dark:text-red-400">
                        แถวที่ {{ error.row }}{{ error.doccode ? ` (${error.doccode})` : '' }}: {{ error.name }}
                    </li>
                </ul>
            </div>

            <!-- Data Table Preview -->
            <DataTable
                v-if="hasData && !hasErrors"
                :value="importData"
                v-model:expandedRows="expandedRows"
                dataKey="doccode"
                :paginator="true"
                :rows="10"
                :rowsPerPageOptions="[10, 25, 50]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                responsiveLayout="scroll"
                stripedRows
                :rowHover="true"
                class="w-full"
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูล</p>
                    </div>
                </template>

                <Column expander style="width: 48px" />

                <Column field="doccode" header="รหัสรูปแบบ" style="width: 140px">
                    <template #body="{ data }">
                        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ data.doccode }}</span>
                    </template>
                </Column>

                <Column field="description" header="ชื่อรูปแบบ" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="truncate" v-tooltip.top="data.description">{{ data.description }}</div>
                    </template>
                </Column>

                <!-- Expanded row: แสดง detail ตารางย่อย -->
                <template #expansion="{ data }">
                    <div class="px-4 py-2">
                        <DataTable :value="data.details" size="small" stripedRows class="w-full">
                            <Column field="accountcode" header="รหัสบัญชี" style="width: 130px">
                                <template #body="{ data: d }">
                                    <span class="font-semibold text-primary-600 dark:text-primary-400">{{ d.accountcode }}</span>
                                </template>
                            </Column>
                            <Column field="actioncode" header="Action Code" style="width: 120px">
                                <template #body="{ data: d }">
                                    <span class="text-surface-500">{{ d.actioncode || '-' }}</span>
                                </template>
                            </Column>
                            <Column field="detail" header="คำอธิบายรายการ" style="min-width: 200px" />
                            <Column field="debit" header="เดบิต" style="width: 100px">
                                <template #body="{ data: d }">
                                    <span class="text-right block">{{ d.debit }}</span>
                                </template>
                            </Column>
                            <Column field="credit" header="เครดิต" style="width: 100px">
                                <template #body="{ data: d }">
                                    <span class="text-right block">{{ d.credit }}</span>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </template>
            </DataTable>

            <!-- Drop Zone / Empty State -->
            <div
                v-if="!hasData && !hasErrors"
                class="rounded-border border-2 border-dashed border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 transition-all duration-300 cursor-pointer"
                :class="isDragging ? 'border-primary bg-primary-50 dark:bg-primary-900/20 scale-[1.01]' : 'hover:border-primary hover:bg-surface-100 dark:hover:bg-surface-700'"
                @dragover="onDragOver"
                @dragleave="onDragLeave"
                @drop="onDrop"
            >
                <div class="flex flex-col items-center justify-center py-12 px-8">
                    <div class="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300" :class="isDragging ? 'bg-primary-100 dark:bg-primary-900/30 scale-110' : 'bg-surface-100 dark:bg-surface-700'">
                        <i class="pi pi-file-excel text-4xl transition-all duration-300" :class="isDragging ? 'text-primary' : 'text-surface-400'"></i>
                    </div>
                    <div class="text-center">
                        <p class="text-xl font-semibold mb-2" :class="isDragging ? 'text-primary' : 'text-surface-700 dark:text-surface-200'">
                            {{ isDragging ? 'ปล่อยไฟล์เพื่อนำเข้า' : 'ลากไฟล์ Excel มาวางที่นี่' }}
                        </p>
                        <p class="text-surface-500 dark:text-surface-400 text-sm">หรือคลิกปุ่มด้านล่างเพื่อเลือกไฟล์</p>
                    </div>
                    <FileUpload ref="fileInput" mode="basic" accept=".xls,.xlsx" :auto="true" :customUpload="true" @uploader="handleFileUpload" chooseLabel="เลือกไฟล์" chooseIcon="pi pi-upload" class="mt-4" />
                    <div class="flex items-center gap-4 mt-6 text-surface-400 text-xs">
                        <Chip class="bg-surface-100 dark:bg-surface-700">
                            <i class="pi pi-file mr-1"></i>
                            .xls, .xlsx
                        </Chip>
                        <Button label="ดาวน์โหลด Template" icon="pi pi-download" text size="small" @click="downloadTemplate" />
                    </div>
                    <p class="text-surface-400 text-xs mt-4 flex items-center gap-1">
                        <i class="pi pi-info-circle"></i>
                        รองรับการนำเข้ารูปแบบการบันทึกบัญชี พร้อมรายการบัญชีในแต่ละรูปแบบ
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirm Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="`ต้องการบันทึกนำเข้ารูปแบบการบันทึกบัญชี ${importData.length} รูปแบบ?`"
        confirmLabel="บันทึก (Enter)"
        @close="closeConfirmDialog"
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
