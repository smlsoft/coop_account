<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { getJournal12Columns, getJournalByDocNo, getLedgerAccount } from '@/services/api/report';
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
const selectedMonth = ref(null); // เก็บเดือนที่เลือก expand

// Journal Detail Dialog
const journalDialogVisible = ref(false);
const selectedJournal = ref(null);

// Search filters
const endDate = ref(null);

// Shop info (from localStorage)
const shopId = ref(localStorage.getItem('shopid') || '');
const shopName = ref(localStorage.getItem('shop_name') || '');
const shopTaxId = ref('');
const shopAddress = ref('');

// Initialize default end date (last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Last day of current month at 23:59:59
    const lastDay = new Date(year, month + 1, 0);
    lastDay.setHours(23, 59, 59, 999);
    endDate.value = lastDay;
};

// Format date to YYYY-MM-DD HH:mm:ss for API
const formatDateTimeForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

// Format currency - negative values with parentheses
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const absNum = Math.abs(num);
    const formatted = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absNum);

    return num < 0 ? `(${formatted})` : formatted;
};

// Check if value is negative
const isNegative = (value) => {
    if (value === null || value === undefined) return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num < 0;
};

// Computed for display period
const displayPeriod = computed(() => {
    if (!endDate.value) return '';
    return `สิ้นสุด ณ ${formatDateThai(endDate.value)}`;
});

// Computed for month columns
const monthColumns = computed(() => {
    return reportData.value?.monthRange || [];
});

// Build table data with expandable items
const tableData = computed(() => {
    if (!reportData.value) return [];

    const rows = [];

    // รายได้
    rows.push({ rowType: 'header', label: 'รายได้', accountcode: '', id: 'revenue-header' });
    (reportData.value.revenue?.items || []).forEach((item) => {
        rows.push({ ...item, rowType: 'item', id: `revenue-${item.accountcode}` });
    });
    rows.push({
        rowType: 'subtotal',
        label: 'รวมรายได้',
        accountcode: '',
        monthTotals: reportData.value.revenue?.summary?.monthTotals || {},
        grandTotal: reportData.value.revenue?.summary?.grandTotal || 0,
        id: 'revenue-subtotal'
    });

    // ต้นทุนขาย
    rows.push({ rowType: 'header', label: 'ต้นทุนขาย', accountcode: '', id: 'cost-header' });
    (reportData.value.costOfSales?.items || []).forEach((item) => {
        rows.push({ ...item, rowType: 'item', id: `cost-${item.accountcode}` });
    });
    rows.push({
        rowType: 'subtotal',
        label: 'รวมต้นทุนขาย',
        accountcode: '',
        monthTotals: reportData.value.costOfSales?.summary?.monthTotals || {},
        grandTotal: reportData.value.costOfSales?.summary?.grandTotal || 0,
        id: 'cost-subtotal'
    });

    // กำไรขั้นต้น
    rows.push({
        rowType: 'total',
        label: 'กำไรขั้นต้น',
        accountcode: '',
        monthTotals: reportData.value.grossProfit?.monthTotals || {},
        grandTotal: reportData.value.grossProfit?.grandTotal || 0,
        id: 'gross-profit'
    });

    // ค่าใช้จ่าย
    rows.push({ rowType: 'header', label: 'ค่าใช้จ่าย', accountcode: '', id: 'expense-header' });
    (reportData.value.expense?.items || []).forEach((item) => {
        rows.push({ ...item, rowType: 'item', id: `expense-${item.accountcode}` });
    });
    rows.push({
        rowType: 'subtotal',
        label: 'รวมค่าใช้จ่าย',
        accountcode: '',
        monthTotals: reportData.value.expense?.summary?.monthTotals || {},
        grandTotal: reportData.value.expense?.summary?.grandTotal || 0,
        id: 'expense-subtotal'
    });

    // กำไรสุทธิ
    rows.push({
        rowType: 'net-profit',
        label: 'กำไร(ขาดทุน)สุทธิ',
        accountcode: '',
        monthTotals: reportData.value.netProfit?.monthTotals || {},
        grandTotal: reportData.value.netProfit?.grandTotal || 0,
        id: 'net-profit'
    });

    return rows;
});

// Get month value from item
const getMonthValue = (item, monthKey) => {
    if (item.rowType === 'subtotal' || item.rowType === 'total' || item.rowType === 'net-profit') {
        return item.monthTotals?.[monthKey] || 0;
    }
    return item[monthKey] || 0;
};

// Get total value
const getTotalValue = (item) => {
    if (item.rowType === 'subtotal' || item.rowType === 'total' || item.rowType === 'net-profit') {
        return item.grandTotal || 0;
    }
    return item.total_amount || 0;
};

// Fetch report data
const fetchReport = async () => {
    if (!endDate.value) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกวันที่',
            life: 3000
        });
        return;
    }

    loading.value = true;
    expandedRows.value = {};
    ledgerDataCache.value = {};

    try {
        const params = {
            endDate: formatDateTimeForApi(endDate.value),
            shopid: shopId.value,
            shopname: shopName.value,
            taxid: shopTaxId.value,
            address: shopAddress.value
        };

        const response = await getJournal12Columns(params);

        if (response.success) {
            reportData.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: response.msg || 'ไม่สามารถดึงข้อมูลรายงานได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching journal 12 columns report:', error);
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

// Fetch ledger account data
const fetchLedgerAccount = async (accountCode, monthKey) => {
    const cacheKey = `${accountCode}-${monthKey}`;
    if (ledgerDataCache.value[cacheKey]) {
        return;
    }

    loadingLedger.value[cacheKey] = true;

    try {
        // แปลง monthKey เป็นวันที่
        const [year, month] = monthKey.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);

        const params = {
            startdate: formatDateForApi(startDate),
            enddate: formatDateForApi(endDate),
            accountcode: `${accountCode}:${accountCode}`
        };

        const response = await getLedgerAccount(params);

        if (response.success && response.data?.length > 0) {
            ledgerDataCache.value[cacheKey] = response.data[0];
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
        loadingLedger.value[cacheKey] = false;
    }
};

// Handle row click to show ledger detail
const onMonthClick = (item, monthKey) => {
    if (item.rowType !== 'item') return;

    const accountCode = item.accountcode;

    // ตรวจสอบว่า expand อยู่แล้วหรือไม่
    if (expandedRows.value[item.id] && selectedMonth.value[item.id] === monthKey) {
        // ถ้า expand อยู่แล้วและเป็นเดือนเดิม ให้ปิด
        delete expandedRows.value[item.id];
        delete selectedMonth.value[item.id];
    } else {
        // Expand row และเก็บเดือนที่เลือก
        expandedRows.value[item.id] = true;
        if (!selectedMonth.value) selectedMonth.value = {};
        selectedMonth.value[item.id] = monthKey;
        fetchLedgerAccount(accountCode, monthKey);
    }
};

// Handle ledger row click to show journal detail
const onLedgerRowClick = async (docno) => {
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
    }
};

// Get ledger data for account and month
const getLedgerData = (accountCode, monthKey) => {
    const cacheKey = `${accountCode}-${monthKey}`;
    return ledgerDataCache.value[cacheKey];
};

// Check if ledger is loading
const isLedgerLoading = (accountCode, monthKey) => {
    const cacheKey = `${accountCode}-${monthKey}`;
    return loadingLedger.value[cacheKey] || false;
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

// Get row class
const getRowClass = (data) => {
    return {
        'font-bold bg-surface-100 dark:bg-surface-800': data.rowType === 'header',
        'font-bold bg-surface-50 dark:bg-surface-700': data.rowType === 'subtotal',
        'font-bold bg-primary-100 dark:bg-primary-900/30': data.rowType === 'total',
        'font-bold bg-green-50 dark:bg-green-900/30 border-y-2 border-green-400 dark:border-green-700': data.rowType === 'net-profit'
    };
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
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบกำไรขาดทุน 12 เดือน</span>
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
        <div v-if="reportData">
            <!-- Report Header -->
            <div class="mb-4 text-center">
                <div class="font-bold text-xl text-surface-900 dark:text-surface-0">งบกำไรขาดทุน 12 เดือน</div>
                <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">สำหรับระยะเวลา 12 เดือน {{ displayPeriod }}</p>
            </div>

            <!-- Report Table -->
            <DataTable v-model:expandedRows="expandedRows" :value="tableData" dataKey="id" scrollable scrollHeight="calc(100vh - 285px)" size="small" showGridlines :rowClass="getRowClass">
                <!-- Account Name Column -->
                <Column field="label" header="รายการ" style="min-width: 200px" frozen>
                    <template #body="{ data }">
                        <span v-if="data.rowType === 'header'">{{ data.label }}</span>
                        <span v-else-if="data.rowType === 'item'" class="pl-4">{{ data.accountname }}</span>
                        <span v-else class="text-right block">{{ data.label }}</span>
                    </template>
                </Column>

                <!-- Account Code Column -->
                <Column field="accountcode" header="รหัสบัญชี" style="width: 120px" frozen>
                    <template #body="{ data }">
                        <div class="text-center">
                            <span v-if="data.rowType === 'item'" class="font-mono font-bold text-primary-600 dark:text-primary-400">{{ data.accountcode }}</span>
                        </div>
                    </template>
                </Column>

                <!-- Month Columns (Dynamic) -->
                <Column v-for="month in monthColumns" :key="month.key" :header="month.displayName" style="width: 100px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <div
                            :class="[
                                'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2 py-1 rounded',
                                { 'text-red-600 dark:text-red-400': isNegative(getMonthValue(data, month.key)) },
                                { 'font-semibold': data.rowType !== 'item' },
                                { 'bg-primary-100 dark:bg-primary-900/30': data.rowType === 'item' && expandedRows[data.id] && selectedMonth[data.id] === month.key }
                            ]"
                            @click="onMonthClick(data, month.key)"
                        >
                            {{ formatCurrency(getMonthValue(data, month.key)) }}
                        </div>
                    </template>
                </Column>

                <!-- Total Column -->
                <Column header="รวม" style="width: 120px" frozen alignFrozen="right" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="['font-bold', { 'text-red-600 dark:text-red-400': isNegative(getTotalValue(data)) }]">
                            {{ formatCurrency(getTotalValue(data)) }}
                        </span>
                    </template>
                </Column>

                <!-- Expansion Template -->
                <template #expansion="{ data }">
                    <div v-if="data.rowType === 'item' && selectedMonth[data.id]" class="p-4 bg-surface-50 dark:bg-surface-900">
                        <!-- Loading State -->
                        <div v-if="isLedgerLoading(data.accountcode, selectedMonth[data.id])" class="flex justify-center py-4">
                            <ProgressSpinner style="width: 40px; height: 40px" />
                        </div>

                        <!-- Ledger Data -->
                        <div v-else-if="getLedgerData(data.accountcode, selectedMonth[data.id])">
                            <div class="mb-3 font-semibold text-surface-900 dark:text-surface-0">
                                <i class="pi pi-list mr-2"></i>
                                บัญชีแยกประเภท: {{ data.accountcode }} - {{ data.accountname }}
                                <span class="text-sm text-surface-500 dark:text-surface-400 ml-2"> ({{ monthColumns.find((m) => m.key === selectedMonth[data.id])?.displayName }}) </span>
                            </div>

                            <DataTable :value="getLedgerData(data.accountcode, selectedMonth[data.id]).details || []" size="small" showGridlines :rowHover="true" @row-click="(e) => onLedgerRowClick(e.data.docno)">
                                <Column field="docdate" class="cursor-pointer" header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ formatDateThai(detail.docdate) }}
                                    </template>
                                </Column>
                                <Column field="docno" class="cursor-pointer" header="เลขที่เอกสาร" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        <span class="font-mono text-sm cursor-pointer text-primary-600 dark:text-primary-400 hover:underline">{{ detail.docno }}</span>
                                    </template>
                                </Column>
                                <Column field="accountdescription" class="cursor-pointer" header="รายละเอียด" style="min-width: 250px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ detail.accountdescription || '-' }}
                                    </template>
                                </Column>
                                <Column field="debit" class="cursor-pointer" header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.debit > 0" class="text-blue-600 dark:text-blue-400">
                                            {{ formatCurrency(detail.debit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="credit" class="cursor-pointer" header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.credit > 0" class="text-orange-600 dark:text-orange-400">
                                            {{ formatCurrency(detail.credit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="amount" class="cursor-pointer" header="ยอดรวม" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
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
            </DataTable>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-8">
            <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
            <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ณ วันที่</label>
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

    <!-- Loading Dialog -->
    <LoadingDialog :visible="loading" message="กำลังโหลดข้อมูล..." />
</template>

<style scoped>
/* Header text center alignment */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
