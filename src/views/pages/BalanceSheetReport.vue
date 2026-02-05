<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { useLoading } from '@/composables/useLoading';
import { getBalanceSheet, getJournalByDocNo, getLedgerAccount } from '@/services/api/report';
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
const endDate = ref(null);

// Initialize default dates (last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
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
    if (!endDate.value) return '';
    return `ณ วันที่ ${formatDateThai(endDate.value)}`;
});

// Computed for totals from API
const totalAssetAmount = computed(() => {
    return reportData.value?.data?.totalassetamount || 0;
});

const totalLiabilityAmount = computed(() => {
    return reportData.value?.data?.totalliabilityamount || 0;
});

const totalOwnerEquityAmount = computed(() => {
    return reportData.value?.data?.totalownersequityamount || 0;
});

const totalLiabilityAndOwnerEquityAmount = computed(() => {
    return reportData.value?.data?.totalliabilityandownersequityamount || 0;
});

// Flatten data for DataTable
const tableData = computed(() => {
    if (!reportData.value?.data) return [];

    const result = [];
    const data = reportData.value.data;

    // สินทรัพย์ (Assets)
    if (data.assets && data.assets.length > 0) {
        result.push({
            id: 'asset-header',
            rowType: 'section-header',
            label: 'สินทรัพย์',
            amount: null
        });

        data.assets.forEach((item, index) => {
            result.push({
                id: `asset-${index}`,
                rowType: 'item',
                accountLevel: item.accountlevel,
                accountCode: item.accountcode,
                accountName: item.accountname,
                amount: item.amount
            });
        });

        result.push({
            id: 'asset-total',
            rowType: 'section-total',
            label: 'รวมสินทรัพย์',
            amount: totalAssetAmount.value
        });
    }

    // หนี้สิน (Liabilities)
    if (data.liabilities && data.liabilities.length > 0) {
        result.push({
            id: 'liability-header',
            rowType: 'section-header',
            label: 'หนี้สิน',
            amount: null
        });

        data.liabilities.forEach((item, index) => {
            result.push({
                id: `liability-${index}`,
                rowType: 'item',
                accountLevel: item.accountlevel,
                accountCode: item.accountcode,
                accountName: item.accountname,
                amount: item.amount
            });
        });

        result.push({
            id: 'liability-total',
            rowType: 'section-total',
            label: 'รวมหนี้สิน',
            amount: totalLiabilityAmount.value
        });
    }

    // ส่วนของเจ้าของ (Owner's Equity)
    result.push({
        id: 'equity-header',
        rowType: 'section-header',
        label: 'ส่วนของเจ้าของ',
        amount: null
    });

    if (data.ownesequities && data.ownesequities.length > 0) {
        data.ownesequities.forEach((item, index) => {
            result.push({
                id: `equity-${index}`,
                rowType: 'item',
                accountLevel: item.accountlevel || 4,
                accountCode: item.accountcode,
                accountName: item.accountname,
                amount: item.amount
            });
        });
    }

    result.push({
        id: 'equity-total',
        rowType: 'section-total',
        label: 'รวมส่วนของเจ้าของ',
        amount: totalOwnerEquityAmount.value
    });

    // Total Liabilities and Owner's Equity
    result.push({
        id: 'total-liability-equity',
        rowType: 'grand-total',
        label: 'รวมหนี้สินและส่วนของเจ้าของ',
        amount: totalLiabilityAndOwnerEquityAmount.value
    });

    return result;
});

// Get indent style based on account level
const getIndentStyle = (level) => {
    if (!level) return {};
    const indent = (level - 1) * 20; // 20px per level
    return { paddingLeft: `${indent}px` };
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

    try {
        showLoading();

        const params = {
            enddate: formatDateForApi(endDate.value),
            accountgroup: '',
            ica: 0
        };

        const response = await getBalanceSheet(params);

        if (response.success) {
            reportData.value = response;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ผิดพลาด',
                detail: response.message || 'ไม่สามารถโหลดรายงานได้',
                life: 5000
            });
        }
    } catch (error) {
        console.error('Error fetching balance sheet report:', error);
        toast.add({
            severity: 'error',
            summary: 'ผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการโหลดรายงาน',
            life: 5000
        });
    } finally {
        hideLoading();
    }
};

// Fetch ledger account data
const fetchLedgerAccount = async (accountCode) => {
    const cacheKey = accountCode;

    // Check if data already in cache
    if (ledgerDataCache.value[cacheKey]) {
        return ledgerDataCache.value[cacheKey];
    }

    try {
        loadingLedger.value[cacheKey] = true;

        const params = {
            accountcode: accountCode,
            startdate: '2017-01-01', // วันที่ 01/01/2560 (ค่า default สำหรับงบแสดงฐานะการเงิน)
            enddate: formatDateForApi(endDate.value)
        };

        const response = await getLedgerAccount(params);

        if (response.success) {
            ledgerDataCache.value[cacheKey] = response.data;
            return response.data;
        }
    } catch (error) {
        console.error('Error fetching ledger account:', error);
        toast.add({
            severity: 'error',
            summary: 'ผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลบัญชีแยกประเภทได้',
            life: 3000
        });
    } finally {
        loadingLedger.value[cacheKey] = false;
    }

    return null;
};

// Handle row expand
const onRowExpand = (event) => {
    fetchLedgerAccount(event.data.accountCode);
};

// Handle row click to toggle expand
const onRowClick = (event) => {
    const rowId = event.data.id;

    if (expandedRows.value[rowId]) {
        delete expandedRows.value[rowId];
    } else {
        expandedRows.value[rowId] = true;
        fetchLedgerAccount(event.data.accountCode);
    }
};

// Check if row is expandable (only item rows)
const isRowExpandable = (rowData) => {
    return rowData.rowType === 'item';
};

// Get ledger data from cache
const getLedgerData = (accountCode) => {
    return ledgerDataCache.value[accountCode];
};

// Check if ledger is loading
const isLedgerLoading = (accountCode) => {
    return loadingLedger.value[accountCode] === true;
};

// Handle ledger row click
const onLedgerRowClick = async (docno) => {
    loadingJournal.value = true;
    journalDialogVisible.value = true;

    try {
        const response = await getJournalByDocNo({ docno });

        if (response.success && response.data) {
            selectedJournal.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ผิดพลาด',
                detail: 'ไม่พบข้อมูลเอกสาร',
                life: 3000
            });
            journalDialogVisible.value = false;
        }
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        toast.add({
            severity: 'error',
            summary: 'ผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร',
            life: 3000
        });
        journalDialogVisible.value = false;
    } finally {
        loadingJournal.value = false;
    }
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
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบแสดงฐานะการเงิน</span>
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
            <div class="font-bold text-xl text-surface-900 dark:text-surface-0">งบแสดงฐานะการเงิน</div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">{{ displayPeriod }}</p>
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
                    'font-bold': data.rowType === 'section-header' || data.rowType === 'section-total' || data.rowType === 'grand-total',
                    'bg-surface-100 dark:bg-surface-800': data.rowType === 'grand-total'
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
                    <div v-if="data.rowType === 'section-header'" class="text-lg font-bold">
                        {{ data.label }}
                    </div>
                    <div v-else-if="data.rowType === 'item'" :style="getIndentStyle(data.accountLevel)">
                        <span class="text-surface-700 dark:text-surface-300">{{ data.accountName }}</span>
                        <span v-if="data.accountCode" class="ml-2 text-xs font-mono text-surface-500 dark:text-surface-400">({{ data.accountCode }})</span>
                    </div>
                    <div v-else-if="data.rowType === 'section-total' || data.rowType === 'grand-total'" class="text-right font-bold">
                        {{ data.label }}
                    </div>
                </template>
            </Column>

            <!-- Amount Column -->
            <Column header="จำนวนเงิน (บาท)" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'section-header' || data.rowType === 'spacer'"></span>
                    <span v-else-if="data.rowType === 'section-total'" class="text-surface-900 dark:text-surface-0 underline underline-offset-4">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else-if="data.rowType === 'grand-total'" class="text-lg underline underline-offset-4">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else class="text-surface-700 dark:text-surface-300">{{ formatCurrencyWithParentheses(data.amount) }}</span>
                </template>
            </Column>

            <!-- Expansion Row Template -->
            <template #expansion="{ data }">
                <div v-if="data.rowType === 'item' && data.accountCode" class="p-4 bg-surface-50 dark:bg-surface-900">
                    <!-- Loading State -->
                    <div v-if="isLedgerLoading(data.accountCode)" class="flex justify-center py-4">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                    </div>

                    <!-- Ledger Data -->
                    <div v-else-if="getLedgerData(data.accountCode)">
                        <div class="mb-3 font-semibold text-surface-900 dark:text-surface-0">
                            <i class="pi pi-list mr-2"></i>
                            บัญชีแยกประเภท: {{ data.accountCode }} - {{ data.accountName }}
                        </div>

                        <DataTable :value="getLedgerData(data.accountCode).details || []" size="small" showGridlines :rowHover="true" @row-click="(e) => onLedgerRowClick(e.data.docno)">
                            <Column field="docdate" header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                <template #body="{ data: detail }">
                                    {{ formatDateThai(detail.docdate) }}
                                </template>
                            </Column>
                            <Column field="docno" header="เลขที่เอกสาร" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                <template #body="{ data: detail }">
                                    <span class="font-mono text-sm cursor-pointer text-primary-600 dark:text-primary-400 hover:underline">{{ detail.docno }}</span>
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
        <JournalDetailDialog v-model:visible="journalDialogVisible" :journal="selectedJournal" :loading="loadingJournal" />
    </div>
</template>

<style scoped>
/* Custom styles for balance sheet specific styling */
</style>
