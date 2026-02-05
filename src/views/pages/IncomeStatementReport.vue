<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { useLoading } from '@/composables/useLoading';
import { getJournalByDocNo, getLedgerAccount, getProfitAndLoss } from '@/services/api/report';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
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

// Initialize default dates (first and last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    startDate.value = new Date(year, month, 1);
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

// Format currency with parentheses for negative values
const formatCurrencyWithParentheses = (value) => {
    if (value === null || value === undefined) return '-';
    const absValue = Math.abs(value);
    const formattedValue = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absValue);

    if (value < 0) {
        return `(${formattedValue})`;
    }
    return formattedValue;
};

// Computed for display period
const displayPeriod = computed(() => {
    if (!startDate.value || !endDate.value) return '';
    return `${formatDateThai(startDate.value)} - ${formatDateThai(endDate.value)}`;
});

// Computed for totals
const totalIncomeAmount = computed(() => {
    return reportData.value?.data?.totalincomeamount || 0;
});

const totalExpenseAmount = computed(() => {
    return reportData.value?.data?.totalexpenseamount || 0;
});

const profitAndLossAmount = computed(() => {
    return reportData.value?.data?.profitandlossamount || 0;
});

// Computed - flat table data with row types for consistent column structure
const tableData = computed(() => {
    if (!reportData.value?.data) return [];

    const rows = [];

    // Income Header
    rows.push({
        id: 'income-header',
        rowType: 'header',
        sortOrder: 1,
        accountcode: '',
        accountname: 'รายได้',
        amount: null
    });

    // Income Items
    const incomes = reportData.value.data.incomes || [];
    incomes.forEach((item) => {
        rows.push({
            id: `income-${item.accountcode}`,
            rowType: 'item',
            sortOrder: 1,
            accountcode: item.accountcode,
            accountname: item.accountname,
            accountlevel: item.accountlevel,
            amount: item.amount
        });
    });

    // Income Total
    rows.push({
        id: 'income-total',
        rowType: 'total',
        sortOrder: 1,
        accountcode: '',
        accountname: 'รวมรายได้',
        amount: totalIncomeAmount.value
    });

    // Expense Header
    rows.push({
        id: 'expense-header',
        rowType: 'header',
        sortOrder: 2,
        accountcode: '',
        accountname: 'ค่าใช้จ่าย',
        amount: null
    });

    // Expense Items
    const expenses = reportData.value.data.expenses || [];
    expenses.forEach((item) => {
        rows.push({
            id: `expense-${item.accountcode}`,
            rowType: 'item',
            sortOrder: 2,
            accountcode: item.accountcode,
            accountname: item.accountname,
            accountlevel: item.accountlevel,
            amount: item.amount
        });
    });

    // Expense Total
    rows.push({
        id: 'expense-total',
        rowType: 'total',
        sortOrder: 2,
        accountcode: '',
        accountname: 'รวมค่าใช้จ่าย',
        amount: totalExpenseAmount.value
    });

    // Profit/Loss
    rows.push({
        id: 'profit-loss',
        rowType: 'profit-loss',
        sortOrder: 3,
        accountcode: '',
        accountname: 'กำไร (ขาดทุน) สุทธิ',
        amount: profitAndLossAmount.value
    });

    return rows;
});

// Check if row is expandable (only item rows)
const isRowExpandable = (rowData) => {
    return rowData.rowType === 'item';
};

// Get indent style based on account level
const getIndentStyle = (level) => {
    if (!level) return {};
    const indent = (level - 1) * 20; // 20px per level
    return { paddingLeft: `${indent}px` };
};

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

    showLoading('กำลังโหลดข้อมูลงบกำไรขาดทุน...');
    expandedRows.value = {};
    ledgerDataCache.value = {};

    try {
        const params = {
            startdate: formatDateForApi(startDate.value),
            enddate: formatDateForApi(endDate.value)
        };

        const response = await getProfitAndLoss(params);

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
        console.error('Error fetching profit and loss report:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

// Fetch ledger account data
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
    fetchLedgerAccount(event.data.accountcode);
};

// Handle row click to toggle expand
const onRowClick = (event) => {
    const rowId = event.data.id;

    if (expandedRows.value[rowId]) {
        delete expandedRows.value[rowId];
    } else {
        expandedRows.value[rowId] = true;
        fetchLedgerAccount(event.data.accountcode);
    }
};

// Handle ledger row click
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

// Initialize on mount
onMounted(() => {
    initDefaultDates();
    fetchReport();
});
</script>

<template>
    <div class="card">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบกำไรขาดทุน</span>
                <div v-if="displayPeriod" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ displayPeriod }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" severity="secondary" />
            </div>
        </div>

        <!-- Report Header -->
        <div class="text-center mb-4">
            <div class="font-bold text-xl text-surface-900 dark:text-surface-0">งบกำไรขาดทุน</div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">ตั้งแต่วันที่ {{ formatDateThai(startDate) }} ถึงวันที่ {{ formatDateThai(endDate) }}</p>
        </div>

        <!-- Report Table -->
        <DataTable
            v-model:expandedRows="expandedRows"
            :value="tableData"
            dataKey="id"
            scrollable
            scrollHeight="calc(100vh - 285px)"
            tableStyle="min-width: 50rem"
            :rowClass="
                (data) => ({
                    'font-bold': data.rowType === 'header' || data.rowType === 'total' || data.rowType === 'profit-loss',
                    'bg-surface-100 dark:bg-surface-800': data.rowType === 'profit-loss'
                })
            "
            @row-expand="onRowExpand"
            @row-click="(e) => isRowExpandable(e.data) && onRowClick(e)"
        >
            <!-- Expander Column -->
            <Column style="width: 3rem">
                <template #body="{ data }">
                    <button v-if="data.rowType === 'item'" class="p-row-toggler" @click.stop="onRowClick({ data })">
                        <i :class="expandedRows[data.id] ? 'pi pi-chevron-up' : 'pi pi-chevron-right'"></i>
                    </button>
                </template>
            </Column>

            <Column header="รายการ" style="min-width: 400px">
                <template #body="{ data }">
                    <div v-if="data.rowType === 'header'" class="text-lg font-bold">
                        {{ data.accountname }}
                    </div>
                    <div v-else-if="data.rowType === 'item'" :style="getIndentStyle(data.accountlevel)">
                        <span class="text-surface-700 dark:text-surface-300">{{ data.accountname }}</span>
                        <span v-if="data.accountcode" class="ml-2 text-xs text-surface-500 dark:text-surface-400">({{ data.accountcode }})</span>
                    </div>
                    <div v-else-if="data.rowType === 'total' || data.rowType === 'profit-loss'" class="text-right font-bold">
                        {{ data.accountname }}
                    </div>
                </template>
            </Column>

            <!-- Amount Column -->
            <Column header="จำนวนเงิน (บาท)" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'header'"></span>
                    <span v-else-if="data.rowType === 'total'" class="text-surface-900 dark:text-surface-0 underline underline-offset-4">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else-if="data.rowType === 'profit-loss'" class="text-lg underline underline-offset-4">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else class="text-surface-700 dark:text-surface-300">{{ formatCurrencyWithParentheses(data.amount) }}</span>
                </template>
            </Column>

            <!-- Expansion Row Template -->
            <template #expansion="{ data }">
                <div v-if="data.rowType === 'item' && data.accountcode" class="p-4 bg-surface-50 dark:bg-surface-900">
                    <!-- Loading State -->
                    <div v-if="isLedgerLoading(data.accountcode)" class="flex justify-center py-4">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                    </div>

                    <!-- Ledger Data -->
                    <div v-else-if="getLedgerData(data.accountcode)">
                        <div class="mb-3 font-semibold text-surface-900 dark:text-surface-0">
                            <i class="pi pi-list mr-2"></i>
                            บัญชีแยกประเภท: {{ data.accountcode }} - {{ data.accountname }}
                        </div>

                        <DataTable :value="getLedgerData(data.accountcode).details || []" size="small" showGridlines :rowHover="true" @row-click="(e) => onLedgerRowClick(e.data.docno)">
                            <Column field="docdate" header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                <template #body="{ data: detail }">
                                    {{ formatDateThai(detail.docdate) }}
                                </template>
                            </Column>
                            <Column field="docno" header="เลขที่เอกสาร" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                <template #body="{ data: detail }">
                                    <span class="text-sm cursor-pointer text-primary-600 dark:text-primary-400 hover:underline">{{ detail.docno }}</span>
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
                                        {{ formatCurrencyWithParentheses(detail.debit) }}
                                    </span>
                                    <span v-else class="text-surface-400">-</span>
                                </template>
                            </Column>
                            <Column field="credit" header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                <template #body="{ data: detail }">
                                    <span v-if="detail.credit > 0" class="text-orange-600 dark:text-orange-400">
                                        {{ formatCurrencyWithParentheses(detail.credit) }}
                                    </span>
                                    <span v-else class="text-surface-400">-</span>
                                </template>
                            </Column>
                            <Column field="amount" header="ยอดรวม" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                <template #body="{ data: detail }">
                                    <span :class="detail.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                                        {{ formatCurrencyWithParentheses(detail.amount) }}
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
        </DataTable>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากวันที่</label>
                    <ThaiDatePicker v-model="startDate" class="w-full" showIcon />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่</label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon />
                </div>

                <div class="flex justify-end mt-2">
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Journal Detail Dialog -->
    <JournalDetailDialog v-model:visible="journalDialogVisible" :journal="selectedJournal" />
</template>
<style scoped>
/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
