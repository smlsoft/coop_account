<script setup>
import LoadingDialog from '@/components/LoadingDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { useAccountStatusReport } from '@/composables/useAccountStatusReport';
import { onMounted } from 'vue';

// Use composable for Creditor (Accounts Payable)
const {
    // State
    reportData,
    currentPage,
    itemsPerPage,
    fromDate,
    toDate,
    selectedAccount,
    selectedCustomer,
    searchPopover,
    chartOfAccounts,
    customers,
    customersLoading,

    // Constants
    itemsPerPageOptions,

    // Computed
    shopName,
    shopAddress,
    shopTaxId,
    totalPages,
    getTotalBeginningBalance,
    getTotalDebitAmount,
    getTotalCreditAmount,
    getTotalEndingBalance,
    isDownloadDisabled,

    // Methods
    goToPage,
    toggleSearchPopover,
    searchAndClosePopover,
    formatCurrency,
    downloadPDF,
    initReport
} = useAccountStatusReport('payable'); // 'payable' = เจ้าหนี้

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
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / รายงานสถานะเจ้าหนี้</span>
                <div v-if="fromDate && toDate" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ fromDate.toLocaleDateString('th-TH') }} - {{ toDate.toLocaleDateString('th-TH') }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="ดาวน์โหลด PDF" icon="pi pi-file-pdf" @click="downloadPDF" severity="primary" :disabled="isDownloadDisabled" />
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" severity="secondary" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4">
                <!-- ส่วนหัวตรงกลาง -->
                <div class="flex justify-center items-center flex-col">
                    <div class="font-bold text-xl mb-0">รายงานสถานะเจ้าหนี้</div>
                    <p class="mb-3">{{ fromDate?.toLocaleDateString('th-TH') }} - {{ toDate?.toLocaleDateString('th-TH') }}</p>
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

            <!-- Report Table -->
            <DataTable :value="reportData" showGridlines size="small" :rowHover="true">
                <Column header="ลำดับ" style="width: 60px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: center' } }">
                    <template #body="{ index }">
                        {{ (currentPage - 1) * itemsPerPage + index + 1 }}
                    </template>
                </Column>
                <Column field="customerid" header="รหัสเจ้าหนี้" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                    <template #body="{ data }">
                        {{ data.customerid || '-' }}
                    </template>
                </Column>
                <Column field="customername" header="ชื่อเจ้าหนี้" style="min-width: 250px" :pt="{ headerCell: { style: 'text-align: center' } }">
                    <template #body="{ data }">
                        {{ data.customername || '-' }}
                    </template>
                </Column>
                <Column header="ยอดยกมา" style="width: 150px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        {{ formatCurrency(data.beginning_balance) }}
                    </template>
                </Column>
                <Column header="ยอดเดบิต" style="width: 150px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        {{ formatCurrency(data.debit_amount) }}
                    </template>
                </Column>
                <Column header="ยอดเครดิต" style="width: 150px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        {{ formatCurrency(data.credit_amount) }}
                    </template>
                </Column>
                <Column header="ยอดยกไป" style="width: 150px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        {{ formatCurrency(data.ending_balance) }}
                    </template>
                </Column>

                <!-- Empty State -->
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
                        <p class="text-sm text-surface-500 dark:text-surface-500">กรุณาเลือกผังบัญชีเพื่อดูรายงาน</p>
                    </div>
                </template>

                <!-- Footer -->
                <template #footer v-if="reportData.length > 0">
                    <div class="flex items-center font-bold text-sm">
                        <div class="flex-1 text-center" style="margin-left: 60px">รวม</div>
                        <div class="text-right" style="width: 150px">{{ formatCurrency(getTotalBeginningBalance) }}</div>
                        <div class="text-right" style="width: 150px">{{ formatCurrency(getTotalDebitAmount) }}</div>
                        <div class="text-right" style="width: 150px">{{ formatCurrency(getTotalCreditAmount) }}</div>
                        <div class="text-right" style="width: 150px">{{ formatCurrency(getTotalEndingBalance) }}</div>
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
        <div class="p-4 w-96">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <!-- Date Range -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากวันที่ <span class="text-red-500">*</span></label>
                        <ThaiDatePicker v-model="fromDate" class="w-full" showIcon />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่ <span class="text-red-500">*</span></label>
                        <ThaiDatePicker v-model="toDate" class="w-full" showIcon />
                    </div>
                </div>

                <!-- Account Code -->
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ผังบัญชี <span class="text-red-500">*</span></label>
                    <Select v-model="selectedAccount" :options="chartOfAccounts" optionLabel="displayLabel" optionDisabled="disabled" placeholder="เลือกผังบัญชี..." filter showClear fluid>
                        <template #option="slotProps">
                            <div
                                :class="{
                                    'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                    'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                    'text-surface-700 dark:text-surface-300': !slotProps.option.disabled
                                }"
                            >
                                {{ slotProps.option.displayLabel }}
                            </div>
                        </template>
                    </Select>
                </div>

                <!-- Creditor Account -->
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">เจ้าหนี้</label>
                    <Select v-model="selectedCustomer" :options="customers" optionLabel="displayLabel" :loading="customersLoading" placeholder="เลือกเจ้าหนี้..." filter showClear fluid />
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end mt-2">
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>
    <!-- Loading Dialog -->
    <LoadingDialog />
</template>

<style scoped>
/* ทำให้แถวคลิกได้ */
:deep(.p-datatable-tbody > tr) {
    cursor: default;
}

/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
