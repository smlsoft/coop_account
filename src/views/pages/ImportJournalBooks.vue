<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import * as XLSX from 'xlsx';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

const fileInput = ref(null);
const importData = ref([]);
const errorMessages = ref([]);
const showConfirmDialog = ref(false);
const isSaving = ref(false);
const isDragging = ref(false);

const TEMPLATE_URL = '/demo/file/template_journal_book.xlsx';

const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'template_journal_book.xlsx';
    link.click();
};

const processFile = (file) => {
    if (!file) return;

    const validTypes = ['.xls', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.some((t) => file.name.endsWith(t) || file.type === t)) {
        toast.add({ severity: 'warn', summary: 'รูปแบบไฟล์ไม่ถูกต้อง', detail: 'กรุณาเลือกไฟล์ Excel (.xls หรือ .xlsx)', life: 3000 });
        return;
    }

    showLoading('กำลังอ่านไฟล์...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            // header:1 = array mode, แถว 0=title, แถว 1=คำอธิบาย, แถว 2+=ข้อมูลจริง
            const results = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1 });

            const errorMsgs = [];
            const items = [];

            results.forEach((row, rowIndex) => {
                // Skip 2 แถวแรก (title + คำอธิบาย field)
                if (rowIndex < 2) return;

                // Skip แถวว่าง
                const hasAnyValue = row.some((v) => v !== '' && v !== null && v !== undefined);
                if (!hasAnyValue) return;

                const code = row[0] ? String(row[0]).trim() : '';
                const name1 = row[1] ? String(row[1]).trim() : '';

                if (!code) {
                    errorMsgs.push({ name: 'CODE ต้องไม่ว่าง', row: rowIndex + 1 });
                    return;
                }
                if (!name1) {
                    errorMsgs.push({ name: 'NAME1 ต้องไม่ว่าง', row: rowIndex + 1, code });
                    return;
                }

                items.push({ code, name1 });
            });

            // ตรวจ code ซ้ำใน file
            const codeSet = new Set();
            items.forEach((item) => {
                if (codeSet.has(item.code)) {
                    errorMsgs.push({ name: `รหัสสมุดรายวัน "${item.code}" ซ้ำในไฟล์`, row: '-' });
                }
                codeSet.add(item.code);
            });

            errorMessages.value = errorMsgs;

            if (errorMsgs.length === 0) {
                importData.value = items;
                toast.add({ severity: 'success', summary: 'อ่านไฟล์สำเร็จ', detail: `พบสมุดรายวัน ${items.length} รายการ`, life: 3000 });
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

const handleFileUpload = (event) => processFile(event.files?.[0]);
const onDragOver = (event) => { event.preventDefault(); isDragging.value = true; };
const onDragLeave = () => { isDragging.value = false; };
const onDrop = (event) => { event.preventDefault(); isDragging.value = false; processFile(event.dataTransfer?.files?.[0]); };

const clearData = () => {
    importData.value = [];
    errorMessages.value = [];
    if (fileInput.value) fileInput.value.clear();
};

const openConfirmDialog = () => { showConfirmDialog.value = true; };
const closeConfirmDialog = () => { showConfirmDialog.value = false; };

const confirmSave = async () => {
    showConfirmDialog.value = false;
    try {
        isSaving.value = true;
        showLoading('กำลังนำเข้าข้อมูล...');

        const response = await api.importJournalBooks(importData.value);

        if (response?.success) {
            const count = response.data?.length || importData.value.length;
            toast.add({ severity: 'success', summary: 'นำเข้าข้อมูลสำเร็จ', detail: `นำเข้าสมุดรายวัน ${count} รายการ`, life: 5000 });
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
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">นำเข้าสมุดรายวัน</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">นำเข้าข้อมูลสมุดรายวันจากไฟล์ Excel</p>
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
                        แถวที่ {{ error.row }}{{ error.code ? ` (${error.code})` : '' }}: {{ error.name }}
                    </li>
                </ul>
            </div>

            <!-- Data Table -->
            <DataTable
                v-if="hasData && !hasErrors"
                :value="importData"
                :paginator="true"
                :rows="20"
                :rowsPerPageOptions="[20, 50, 100]"
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

                <Column field="code" header="รหัสสมุดรายวัน" style="width: 200px">
                    <template #body="{ data }">
                        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ data.code }}</span>
                    </template>
                </Column>

                <Column field="name1" header="ชื่อสมุดรายวัน" style="min-width: 200px" />
            </DataTable>

            <!-- Drop Zone -->
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
                        รองรับการนำเข้าสมุดรายวัน (CODE, NAME1)
                    </p>
                </div>
            </div>
        </div>
    </div>

    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="`ต้องการบันทึกนำเข้าสมุดรายวัน ${importData.length} รายการ?`"
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
