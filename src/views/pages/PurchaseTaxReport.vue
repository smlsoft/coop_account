<script setup>
import JournalDetailPanel from '@/components/accounting/JournalDetailPanel.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useTaxReport } from '@/composables/useTaxReport';
import { TAX_MODE } from '@/constants/taxReport';
import { onMounted } from 'vue';

// Use the shared tax report composable for Purchase Tax
const {
    // State
    reportData,
    currentPage,
    itemsPerPage,
    selectedYear,
    selectedMonth,
    expandedRows,
    searchPopover,

    // Constants
    monthOptions,
    itemsPerPageOptions,

    // Computed
    shopName,
    shopAddress,
    shopTaxId,
    yearOptions,
    totalPages,
    paginatedData,
    getTotalExceptVat,
    getTotalVatBase,
    getTotalVatAmount,
    getTotalAmount,
    isDownloadDisabled,

    // Methods
    goToPage,
    toggleSearchPopover,
    searchAndClosePopover,
    formatDateThai,
    formatCurrency,
    getPeriodName,
    onRowClick,
    downloadPDF,
    initReport
} = useTaxReport(TAX_MODE.PURCHASE);

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
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานภาษี / ภาษีซื้อ</span>
                <div v-if="selectedYear && selectedMonth" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ getPeriodName(selectedMonth) }} {{ selectedYear }}
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
                    <div class="font-bold text-xl mb-0">รายงานภาษีซื้อ</div>
                    <p class="mb-3">เดือนภาษี{{ getPeriodName(selectedMonth) }} ปีภาษี {{ selectedYear }}</p>
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
            <DataTable :key="'purchase-tax-table'" v-model:expandedRows="expandedRows" :value="paginatedData" dataKey="_uniqueId" showGridlines size="small" :rowHover="true" @row-click="onRowClick">
                <Column expander style="width: 3rem" />
                <Column header="ลำดับ" style="width: 60px">
                    <template #body="{ index }">
                        {{ (currentPage - 1) * itemsPerPage + index + 1 }}
                    </template>
                </Column>
                <Column field="vatdate" header="วันที่" style="width: 100px">
                    <template #body="{ data }">
                        {{ formatDateThai(data.vatdate) }}
                    </template>
                </Column>
                <Column field="vatdocno" header="เลขที่ใบกำกับ" style="min-width: 120px">
                    <template #body="{ data }">
                        {{ data.vatdocno || '-' }}
                    </template>
                </Column>
                <Column field="custname" header="ชื่อผู้ขายสินค้า/ผู้ให้บริการ" style="min-width: 200px">
                    <template #body="{ data }">
                        {{ data.custname || '-' }}
                    </template>
                </Column>
                <Column field="custtaxid" header="เลขประจำตัวผู้เสียภาษี" style="width: 150px">
                    <template #body="{ data }">
                        {{ data.custtaxid || '-' }}
                    </template>
                </Column>
                <Column header="สำนักงานใหญ่" style="width: 120px">
                    <template #body="{ data }">
                        {{ data.organization === 1 ? 'สำนักงานใหญ่' : data.branchcode }}
                    </template>
                </Column>
                <Column header="ยอดยกเว้นภาษี" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.exceptvat || 0) }}
                    </template>
                </Column>
                <Column header="มูลค่าสินค้า/บริการ" style="width: 130px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.vatbase) }}
                    </template>
                </Column>
                <Column header="จำนวนเงินภาษี" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.vatamount) }}
                    </template>
                </Column>
                <Column header="รวมทั้งสิ้น" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.total) }}
                    </template>
                </Column>
                <Column header="ยื่นเพิ่มเติม" style="width: 100px">
                    <template #body="{ data }">
                        {{ data.vatsubmit ? 'ยื่นเพิ่มเติม' : '' }}
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
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalExceptVat) }}</div>
                        <div class="text-right" style="width: 130px">{{ formatCurrency(getTotalVatBase) }}</div>
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalVatAmount) }}</div>
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalAmount) }}</div>
                        <div style="width: 100px"></div>
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
        <div class="p-3">
            <div class="flex items-center gap-2">
                <Select v-model="selectedMonth" :options="monthOptions" optionLabel="label" optionValue="value" placeholder="เดือน" class="w-34" />
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="ปี" class="w-28" />
                <Button icon="pi pi-search" @click="searchAndClosePopover" size="medium" />
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
