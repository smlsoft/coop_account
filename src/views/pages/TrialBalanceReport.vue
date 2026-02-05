<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { getJournalByDocNo, getLedgerAccount, getTrialBalanceSheet } from '@/services/api/report';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

// State
const loading = ref(false);
const reportData = ref(null);
const searchPopover = ref(null);
const expandedRows = ref({});
const ledgerDataCache = ref({});
const loadingLedger = ref({});

// Journal Detail Dialog
const journalDialogVisible = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);

// Search filters
const startDate = ref(null);
const endDate = ref(null);
const includeYearEndClosing = ref(0); // 0 = ไม่รวม, 1 = รวม

// Options for include year end closing
const icaOptions = [
    { label: 'ไม่รวม', value: 0 },
    { label: 'รวม', value: 1 }
];

// Initialize default dates (first and last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // First day of current month
    startDate.value = new Date(year, month, 1);

    // Last day of current month
    endDate.value = new Date(year, month + 1, 0);
};

// Format date to YYYY-MM-DD for API
const formatDateForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format date to Thai display format
const formatDateThai = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
};

// Format currency
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absValue);
    return value < 0 ? `(${formatted})` : formatted;
};

// Computed for display period
const displayPeriod = computed(() => {
    if (!startDate.value || !endDate.value) return '';
    return `${formatDateThai(startDate.value)} - ${formatDateThai(endDate.value)}`;
});

// Computed for account details
const accountDetails = computed(() => {
    return reportData.value?.data?.accountdetails || [];
});

// Computed for totals
const totals = computed(() => {
    if (!reportData.value?.data) return null;
    return {
        balanceDebit: reportData.value.data.totalbalancedebit || 0,
        balanceCredit: reportData.value.data.totalbalancecredit || 0,
        amountDebit: reportData.value.data.totalamountdebit || 0,
        amountCredit: reportData.value.data.totalamountcredit || 0,
        nextBalanceDebit: reportData.value.data.totalnextbalancedebit || 0,
        nextBalanceCredit: reportData.value.data.totalnextbalancecredit || 0
    };
});

// Fetch report data
const fetchReport = async () => {
    if (!startDate.value || !endDate.value) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกช่วงวันที่',
            life: 3000
        });
        return;
    }

    loading.value = true;
    expandedRows.value = {};
    ledgerDataCache.value = {};

    try {
        const params = {
            startdate: formatDateForApi(startDate.value),
            enddate: formatDateForApi(endDate.value),
            ica: includeYearEndClosing.value
        };

        const response = await getTrialBalanceSheet(params);

        if (response.success) {
            reportData.value = response;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: response.message || 'ไม่สามารถดึงข้อมูลรายงานได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching trial balance report:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Fetch ledger account data when row expands
const fetchLedgerAccount = async (accountCode) => {
    if (ledgerDataCache.value[accountCode]) {
        return;
    }

    loadingLedger.value[accountCode] = true;

    try {
        const params = {
            startdate: formatDateForApi(startDate.value),
            enddate: formatDateForApi(endDate.value),
            accountcode: `${accountCode}:${accountCode}`
        };

        const response = await getLedgerAccount(params);

        if (response.success && response.data?.length > 0) {
            ledgerDataCache.value[accountCode] = response.data[0];
        }
    } catch (error) {
        console.error('Error fetching ledger account:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีแยกประเภท',
            life: 3000
        });
    } finally {
        loadingLedger.value[accountCode] = false;
    }
};

// Handle row expand
const onRowExpand = (event) => {
    const accountCode = event.data.accountcode;
    fetchLedgerAccount(accountCode);
};

// Handle trial balance row click to toggle expand
const onTrialBalanceRowClick = (event) => {
    const accountCode = event.data.accountcode;

    if (expandedRows.value[accountCode]) {
        // Collapse row
        delete expandedRows.value[accountCode];
    } else {
        // Expand row
        expandedRows.value[accountCode] = true;
        fetchLedgerAccount(accountCode);
    }
};

// Handle ledger row click to show journal detail
const onLedgerRowClick = async (docno) => {
    loadingJournal.value = true;
    journalDialogVisible.value = true;

    try {
        const response = await getJournalByDocNo(docno);

        if (response.success && response.data) {
            selectedJournal.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่พบข้อมูลเอกสาร',
                life: 3000
            });
            journalDialogVisible.value = false;
        }
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร',
            life: 3000
        });
        journalDialogVisible.value = false;
    } finally {
        loadingJournal.value = false;
    }
};

// Get ledger data for account
const getLedgerData = (accountCode) => {
    return ledgerDataCache.value[accountCode];
};

// Check if ledger is loading
const isLedgerLoading = (accountCode) => {
    return loadingLedger.value[accountCode] || false;
};

// Toggle search popover
const toggleSearchPopover = (event) => {
    searchPopover.value.toggle(event);
};

// Search and close popover
const searchAndClosePopover = () => {
    searchPopover.value.hide();
    fetchReport();
};

// Get row class based on account level for indentation
const getRowClass = (data) => {
    const level = data.accountlevel || 1;
    return {
        'font-bold': level <= 2,
        'text-surface-600 dark:text-surface-400': level > 3
    };
};

// Get account name with indentation based on level
const getIndentedName = (data) => {
    const level = data.accountlevel || 1;
    const indent = '  '.repeat(Math.max(0, level - 1));
    return indent + data.accountname;
};

// Initialize on mount
onMounted(() => {
    initDefaultDates();
    fetchReport();
});
</script>

<template>
    <div class="card bg-surface-card p-6 rounded-xl shadow-sm">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบทดลอง</span>
                <div v-if="displayPeriod" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ displayPeriod }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" severity="secondary" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4 text-center">
                <div class="font-bold text-xl mb-0">งบทดลอง</div>
                <p class="text-sm text-surface-600 dark:text-surface-400">ตั้งแต่วันที่ {{ formatDateThai(startDate) }} ถึงวันที่ {{ formatDateThai(endDate) }}</p>
                <p v-if="includeYearEndClosing === 1" class="text-sm text-surface-600 dark:text-surface-400">(รวมรายการปิดบัญชีสิ้นปี)</p>
            </div>

            <!-- Report Table -->
            <DataTable
                v-model:expandedRows="expandedRows"
                :value="accountDetails"
                :loading="loading"
                dataKey="accountcode"
                showGridlines
                size="small"
                :rowHover="true"
                scrollable
                scrollHeight="calc(100vh - 315px)"
                @row-expand="onRowExpand"
                @row-click="onTrialBalanceRowClick"
                class="trial-balance-table"
            >
                <Column expander style="width: 3rem" />
                <Column field="accountcode" header="รหัสบัญชี" style="width: 120px">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ data.accountcode }}</span>
                    </template>
                </Column>
                <Column field="accountname" header="ชื่อบัญชี" style="min-width: 250px">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)" style="white-space: pre">{{ getIndentedName(data) }}</span>
                    </template>
                </Column>
                <ColumnGroup type="header">
                    <Row>
                        <Column header="" :rowspan="2" :pt="{ headerCell: { style: 'width: 3rem' } }" />
                        <Column header="รหัสบัญชี" :rowspan="2" :pt="{ headerCell: { style: 'width: 120px; text-align: center' } }" />
                        <Column header="ชื่อบัญชี" :rowspan="2" :pt="{ headerCell: { style: 'min-width: 250px; text-align: center' } }" />
                        <Column header="ยอดยกมา" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                        <Column header="ยอดประจำงวด" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                        <Column header="ยอดสะสม" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                    </Row>
                    <Row>
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                    </Row>
                </ColumnGroup>

                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.balancedebitamount) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.balancecreditamount) }}</span>
                    </template>
                </Column>
                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.debitamount) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.creditamount) }}</span>
                    </template>
                </Column>
                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.nextbalancedebitamount) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.nextbalancecreditamount) }}</span>
                    </template>
                </Column>

                <!-- Expansion Template -->
                <template #expansion="{ data }">
                    <div class="p-4 bg-surface-50 dark:bg-surface-900">
                        <!-- Loading State -->
                        <div v-if="isLedgerLoading(data.accountcode)" class="flex justify-center py-4">
                            <ProgressSpinner style="width: 40px; height: 40px" />
                        </div>

                        <!-- Ledger Data -->
                        <div v-else-if="getLedgerData(data.accountcode)">
                            <div class="mb-3 font-semibold text-surface-900 dark:text-surface-0">
                                <i class="pi pi-list mr-2"></i>
                                บัญชีแยกประเภท: {{ getLedgerData(data.accountcode).accountcode }} - {{ getLedgerData(data.accountcode).accountname }}
                            </div>

                            <DataTable :value="getLedgerData(data.accountcode).details || []" size="small" showGridlines :rowHover="true" class="ledger-table" @row-click="(e) => onLedgerRowClick(e.data.docno)">
                                <Column field="docdate" header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ formatDateThai(detail.docdate) }}
                                    </template>
                                </Column>
                                <Column field="docno" header="เลขที่เอกสาร" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        <span class="text-sm">{{ detail.docno }}</span>
                                    </template>
                                </Column>
                                <Column field="accountdescription" header="รายละเอียด" style="min-width: 250px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ detail.accountdescription || '-' }}
                                    </template>
                                </Column>
                                <Column field="debit" header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.debit > 0" class="text-blue-600 dark:text-blue-400">
                                            {{ formatCurrency(detail.debit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="credit" header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.credit > 0" class="text-orange-600 dark:text-orange-400">
                                            {{ formatCurrency(detail.credit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="amount" header="ยอดรวม" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span :class="detail.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                                            {{ formatCurrency(detail.amount) }}
                                        </span>
                                    </template>
                                </Column>

                                <template #empty>
                                    <div class="text-center py-4 text-surface-500">ไม่พบรายการเคลื่อนไหว</div>
                                </template>
                            </DataTable>
                        </div>

                        <!-- No Data -->
                        <div v-else class="text-center py-4 text-surface-500">ไม่พบข้อมูลบัญชีแยกประเภท</div>
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
                <template #footer v-if="totals">
                    <table class="footer-table w-full">
                        <tr class="bg-surface-100 dark:bg-surface-800 font-bold text-sm">
                            <td style="width: 3rem"></td>
                            <td style="width: 120px" class="text-center py-2">รวม</td>
                            <td style="min-width: 250px"></td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.balanceDebit) }}</td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.balanceCredit) }}</td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.amountDebit) }}</td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.amountCredit) }}</td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.nextBalanceDebit) }}</td>
                            <td class="text-right py-2" style="width: 130px">{{ formatCurrency(totals.nextBalanceCredit) }}</td>
                        </tr>
                    </table>
                </template>
            </DataTable>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1">จากวันที่</label>
                    <ThaiDatePicker v-model="startDate" class="w-full" showIcon />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">ถึงวันที่</label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">รวมรายการปิดบัญชีสิ้นปี</label>
                    <Select v-model="includeYearEndClosing" :options="icaOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <div class="flex justify-end mt-2">
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Journal Detail Dialog -->
    <JournalDetailDialog v-model:visible="journalDialogVisible" :journal="selectedJournal" />

    <!-- Loading Dialog -->
    <LoadingDialog :visible="loading" message="กำลังโหลดข้อมูล..." />
</template>

<style scoped>
/* Style for indentation */
:deep(.p-datatable-tbody > tr > td) {
    vertical-align: middle;
}

/* Footer styling */
:deep(.p-datatable-footer) {
    padding: 0 !important;
    border-top: 2px solid var(--p-surface-300);
}

:deep(.dark .p-datatable-footer) {
    border-top-color: var(--p-surface-600);
}

/* Footer table styling */
.footer-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

/* Expansion row styling */
:deep(.p-datatable-row-expansion > td) {
    padding: 0 !important;
}

/* Trial balance table styling - clickable rows */
.trial-balance-table :deep(.p-datatable-tbody > tr:not(.p-datatable-row-expansion)) {
    cursor: pointer;
}

/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}

/* Ledger table styling */
.ledger-table :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
}

.ledger-table :deep(.p-datatable-tbody > tr:hover) {
    background: var(--p-surface-100);
}

:deep(.dark) .ledger-table :deep(.p-datatable-tbody > tr:hover) {
    background: var(--p-surface-800);
}
</style>
