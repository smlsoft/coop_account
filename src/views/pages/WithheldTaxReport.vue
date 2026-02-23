<script setup>
import JournalDetailPanel from '@/components/accounting/JournalDetailPanel.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useWithheldTaxReport } from '@/composables/useWithheldTaxReport';
import { onMounted } from 'vue';

// Use the withheld tax report composable
const {
    // State
    reportData,
    currentPage,
    itemsPerPage,
    fromDate,
    toDate,
    expandedRows,
    searchPopover,

    // Constants
    itemsPerPageOptions,

    // Computed
    shopName,
    shopAddress,
    shopTaxId,
    totalPages,
    paginatedData,
    getTotalTaxBase,
    getTotalTaxAmount,
    isDownloadDisabled,

    // Methods
    goToPage,
    toggleSearchPopover,
    searchAndClosePopover,
    formatDateThai,
    formatCurrency,
    onRowClick,
    downloadPDF,
    initReport
} = useWithheldTaxReport();

// Initialize component
onMounted(async () => {
    await initReport();
});
</script>

<template>
    <div class="card bg-surface-card p-6 rounded-xl shadow-sm">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานภาษี / ภาษีถูกหัก ณ ที่จ่าย</span>
                <div v-if="fromDate && toDate" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ formatDateThai(fromDate) }} - {{ formatDateThai(toDate) }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="ดาวน์โหลด PDF" icon="pi pi-file-pdf" @click="downloadPDF" severity="primary" :disabled="isDownloadDisabled" />
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4">
                <!-- ส่วนหัวตรงกลาง -->
                <div class="flex justify-center items-center flex-col">
                    <div class="font-bold text-xl mb-0">รายงานภาษีถูกหัก ณ ที่จ่าย</div>
                    <p class="mb-3" v-if="fromDate && toDate">{{ formatDateThai(fromDate) }} - {{ formatDateThai(toDate) }}</p>
                </div>

                <!-- ส่วนข้อมูลบรรทัดที่ 1 -->
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <span class="font-bold">ชื่อสถานประกอบการ:</span>
                        {{ shopName }}
                    </div>
                    <div>
                        <span class="font-bold">เลขประจำตัวผู้เสียภาษี:</span>
                        {{ shopTaxId }}
                    </div>
                </div>

                <!-- ส่วนข้อมูลบรรทัดที่ 2 -->
                <div class="flex justify-between items-center">
                    <div><span class="font-bold">ที่อยู่:</span> {{ shopAddress }}</div>
                    <div><span class="font-bold">สาขา:</span> (สำนักงานใหญ่)</div>
                </div>
            </div>

            <!-- Report Table with Expand -->
            <DataTable v-model:expandedRows="expandedRows" :value="paginatedData" dataKey="_uniqueId" showGridlines size="small" :rowHover="true" @row-click="onRowClick">
                <Column expander style="width: 3rem" />
                <Column header="ลำดับ" style="width: 60px">
                    <template #body="{ index }">
                        {{ (currentPage - 1) * itemsPerPage + index + 1 }}
                    </template>
                </Column>
                <Column field="custname" header="ชื่อผู้มีเงินได้" style="min-width: 180px">
                    <template #body="{ data }">
                        {{ data.custname || '-' }}
                    </template>
                </Column>
                <Column field="address" header="ที่อยู่ผู้มีเงินได้" style="min-width: 200px">
                    <template #body="{ data }">
                        {{ data.address || '-' }}
                    </template>
                </Column>
                <Column field="custtaxid" header="เลขประจำตัวผู้เสียภาษี" style="width: 150px">
                    <template #body="{ data }">
                        {{ data.custtaxid || '-' }}
                    </template>
                </Column>
                <Column field="taxdate" header="วันที่ได้รับ" style="width: 100px">
                    <template #body="{ data }">
                        {{ formatDateThai(data.taxdate) }}
                    </template>
                </Column>
                <Column header="ประเภทเงินได้ที่จ่าย" style="min-width: 150px">
                    <template #body="{ data }">
                        {{ data.details?.[0]?.description || '-' }}
                    </template>
                </Column>
                <Column header="อัตราภาษี (%)" style="width: 100px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ data.details?.[0]?.taxrate || '0' }}
                    </template>
                </Column>
                <Column header="จำนวนเงิน" style="width: 130px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.details?.[0]?.taxbase || 0) }}
                    </template>
                </Column>
                <Column header="ภาษี" style="width: 130px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.details?.[0]?.taxamount || 0) }}
                    </template>
                </Column>

                <!-- Expand Row Template -->
                <template #expansion="{ data }">
                    <div class="p-3 bg-surface-50 dark:bg-surface-900">
                        <JournalDetailPanel :docno="data.docno" />
                    </div>
                </template>

                <!-- Empty State -->
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
                    </div>
                </template>

                <!-- Footer -->
                <template #footer v-if="reportData.length > 0">
                    <div class="flex items-center font-bold text-sm">
                        <div class="flex-1 text-center" style="margin-left: 3rem">รวม</div>
                        <div class="text-right" style="width: 130px">{{ formatCurrency(getTotalTaxBase) }}</div>
                        <div class="text-right" style="width: 130px">{{ formatCurrency(getTotalTaxAmount) }}</div>
                    </div>
                </template>
            </DataTable>

            <!-- Pagination Controls -->
            <div v-if="reportData.length > 0" class="flex justify-between items-center mt-3">
                <div class="flex items-center">
                    <span class="mr-2">รายการต่อหน้า:</span>
                    <Select v-model="itemsPerPage" :options="itemsPerPageOptions" optionLabel="label" optionValue="value" class="w-auto" />
                </div>
                <div class="flex items-center">
                    <Button icon="pi pi-angle-double-left" text @click="goToPage(1)" :disabled="currentPage === 1" class="mr-1" />
                    <Button icon="pi pi-angle-left" text @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="mr-1" />
                    <span class="mx-2">หน้า {{ currentPage }} จาก {{ totalPages }}</span>
                    <Button icon="pi pi-angle-right" text @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="ml-1" />
                    <Button icon="pi pi-angle-double-right" text @click="goToPage(totalPages)" :disabled="currentPage === totalPages" class="ml-1" />
                </div>
            </div>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4" style="min-width: 450px">
            <h3 class="text-lg font-semibold mb-4">เลือกช่วงวันที่</h3>
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium text-sm">จากวันที่</label>
                    <ThaiDatePicker v-model="fromDate" dateFormat="dd/mm/yy" :showIcon="true" :showButtonBar="true" placeholder="เลือกวันที่เริ่มต้น" fluid />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium text-sm">ถึงวันที่</label>
                    <ThaiDatePicker v-model="toDate" dateFormat="dd/mm/yy" :showIcon="true" :showButtonBar="true" placeholder="เลือกวันที่สิ้นสุด" fluid />
                </div>
                <div class="flex gap-2 mt-2">
                    <Button icon="pi pi-search" label="ค้นหา" @click="searchAndClosePopover" class="flex-1" severity="primary" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Loading Dialog -->
    <LoadingDialog />
</template>

<style scoped>
/* จำเป็นสำหรับ expansion row */
:deep(.p-datatable-row-expansion > td) {
    padding: 0 !important;
}

/* ทำให้แถวคลิกได้ */
:deep(.p-datatable-tbody > tr) {
    cursor: pointer;
}
</style>
