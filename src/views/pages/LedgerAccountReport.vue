<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { useLoading } from '@/composables/useLoading';
import { getChartOfAccounts, getCreditors, getDebtors, getJournalBooks } from '@/services/api/journal';
import { getJournalByDocNo, getLedgerAccount } from '@/services/api/report';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const reportData = ref([]);
const searchPopover = ref(null);
const expandedRows = ref({});

// Journal Detail Dialog
const journalDialogVisible = ref(false);
const selectedJournal = ref(null);

// Search filters
const startDate = ref(null);
const endDate = ref(null);
const accountCodeFrom = ref(null);
const accountCodeTo = ref(null);
const debtAccountType = ref(null);
const debtAccountCode = ref(null);
const bookCode = ref(null);

// Dropdown options
const chartOfAccounts = ref([]);
const debtAccounts = ref([]);
const debtAccountsLoading = ref(false);
const journalBooks = ref([]);
const journalBooksLoading = ref(false);

// Debt account type options
const debtAccountTypes = ref([
    { label: 'ลูกหนี้', value: 'debtor' },
    { label: 'เจ้าหนี้', value: 'creditor' }
]);

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

// Format currency
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
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

// Filter and process report data
const filteredData = computed(() => {
    if (!reportData.value?.length) return [];

    return reportData.value.filter((account) => {
        const hasDetails = account.details && account.details.length > 0;
        const balance = account.balance || 0;

        // ถ้า balance = 0 และ ไม่มี details → ไม่แสดง
        if (balance === 0 && !hasDetails) {
            return false;
        }

        // นอกนั้นแสดงหมด
        return true;
    });
});

// Computed - flat table data with ยกมา/ยกไป rows
const tableData = computed(() => {
    if (!filteredData.value?.length) return [];

    const rows = [];

    filteredData.value.forEach((account) => {
        const hasDetails = account.details && account.details.length > 0;
        const hasBalance = account.balance !== 0;

        // Account header row
        rows.push({
            id: `account-${account.accountcode}`,
            rowType: 'account-header',
            accountcode: account.accountcode,
            accountname: account.accountname,
            balance: account.balance,
            nextbalance: account.nextbalance
        });

        // ยกมา row (แสดงเมื่อ balance != 0)
        if (hasBalance) {
            rows.push({
                id: `balance-${account.accountcode}`,
                rowType: 'balance-forward',
                parentAccountCode: account.accountcode,
                docdate: '',
                docno: 'ยกมา',
                accountdescription: '',
                debit: '',
                credit: '',
                amount: account.balance
            });
        }

        // Detail rows
        if (hasDetails) {
            account.details.forEach((detail, index) => {
                rows.push({
                    id: `detail-${account.accountcode}-${index}`,
                    rowType: 'detail',
                    parentAccountCode: account.accountcode,
                    docdate: detail.docdate,
                    docno: detail.docno,
                    accountdescription: detail.accountdescription,
                    debit: detail.debit,
                    credit: detail.credit,
                    amount: detail.amount
                });
            });
        }

        // ยกไป row (footer)
        rows.push({
            id: `account-footer-${account.accountcode}`,
            rowType: 'account-footer',
            accountcode: account.accountcode,
            nextbalance: account.nextbalance
        });
    });

    return rows;
});

// Load all chart of accounts at once (preload)
const loadAllChartOfAccounts = async () => {
    try {
        const response = await getChartOfAccounts({
            q: '',
            page: 1,
            limit: 1000,
            sort: 'accountcode:1'
        });

        if (response.data.success) {
            const accounts = response.data.data;

            // แปลงเป็น flat list โดย Level 1, 2 เป็น disabled items (headers)
            const flatList = accounts.map((item) => {
                if (item.accountlevel === 1) {
                    // Level 1 - หัวข้อหลัก (disabled, ไม่เยื้อง)
                    return {
                        ...item,
                        displayLabel: `📁 ${item.accountcode} - ${item.accountname}`,
                        disabled: true,
                        isHeader: true
                    };
                } else if (item.accountlevel === 2) {
                    // Level 2 - หัวข้อย่อย (disabled, เยื้อง 1 ระดับ)
                    return {
                        ...item,
                        displayLabel: `    📁 ${item.accountcode} - ${item.accountname}`,
                        disabled: true,
                        isHeader: true
                    };
                } else {
                    // Level 3, 4, 5 - รายการที่เลือกได้
                    const indent = item.accountlevel === 3 ? '        ' : item.accountlevel === 4 ? '            ' : '                ';
                    return {
                        ...item,
                        displayLabel: `${indent}${item.accountcode} ~ ${item.accountname}`,
                        disabled: false,
                        isHeader: false
                    };
                }
            });

            chartOfAccounts.value = flatList;
        }
    } catch (error) {
        console.error('Error loading chart of accounts:', error);
        chartOfAccounts.value = [];
    }
};

// Search debt accounts based on type
const searchDebtAccounts = async (event) => {
    debtAccountsLoading.value = true;
    try {
        const apiCall = debtAccountType.value === 'creditor' ? getCreditors : getDebtors;
        const response = await apiCall({ q: event.query, page: 1, limit: 20 });

        if (response.data.success) {
            debtAccounts.value = response.data.data.map((item) => {
                const thName = item.names?.find((n) => n.code === 'th')?.name || '';
                return {
                    ...item,
                    displayLabel: `${item.code} ~ ${thName}`
                };
            });
        }
    } catch (error) {
        console.error('Error fetching debt accounts:', error);
    } finally {
        debtAccountsLoading.value = false;
    }
};

// Search journal books
const searchJournalBooks = async (event) => {
    journalBooksLoading.value = true;
    try {
        const response = await getJournalBooks({ q: event.query, page: 1, limit: 20 });
        if (response.data.success) {
            journalBooks.value = response.data.data.map((item) => ({
                ...item,
                displayLabel: `${item.code} ~ ${item.name1}`
            }));
        }
    } catch (error) {
        console.error('Error fetching journal books:', error);
    } finally {
        journalBooksLoading.value = false;
    }
};

// Clear debt account when type changes
const onDebtAccountTypeChange = () => {
    debtAccountCode.value = null;
    debtAccounts.value = [];
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

    showLoading('กำลังโหลดข้อมูลงบบัญชีแยกประเภท...');
    expandedRows.value = {};

    try {
        const params = {
            startdate: formatDateForApi(startDate.value),
            enddate: formatDateForApi(endDate.value)
        };

        // Add account code range if selected
        if (accountCodeFrom.value && accountCodeTo.value) {
            params.accountcode = `${accountCodeFrom.value.accountcode}:${accountCodeTo.value.accountcode}`;
        } else if (accountCodeFrom.value) {
            params.accountcode = accountCodeFrom.value.accountcode;
        }

        // Add debtor/creditor code if selected
        if (debtAccountType.value && debtAccountCode.value) {
            if (debtAccountType.value === 'debtor') {
                params.debtorcode = debtAccountCode.value.code;
            } else {
                params.creditorcode = debtAccountCode.value.code;
            }
        }

        // Add book code if selected
        if (bookCode.value) {
            params.bookcode = bookCode.value.code;
        }

        const response = await getLedgerAccount(params);

        if (response.success) {
            reportData.value = response.data || [];
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: response.message || 'ไม่สามารถดึงข้อมูลรายงานได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching ledger account report:', error);
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

// Handle detail row click to view journal
const onDetailRowClick = async (docno) => {
    if (!docno) return;

    showLoading('กำลังโหลดข้อมูลเอกสาร...');
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
        hideLoading();
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

// Clear all filters
const clearFilters = () => {
    accountCodeFrom.value = null;
    accountCodeTo.value = null;
    debtAccountType.value = null;
    debtAccountCode.value = null;
    bookCode.value = null;
    initDefaultDates();
};

// Initialize on mount
onMounted(async () => {
    initDefaultDates();
    await loadAllChartOfAccounts(); // โหลดผังบัญชีทั้งหมดครั้งเดียว
    fetchReport();
});
</script>

<template>
    <div class="card">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบบัญชีแยกประเภท</span>
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
            <div class="font-bold text-xl text-surface-900 dark:text-surface-0">งบบัญชีแยกประเภท</div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">ตั้งแต่วันที่ {{ formatDateThai(startDate) }} ถึงวันที่ {{ formatDateThai(endDate) }}</p>
        </div>

        <!-- Report Table -->
        <DataTable :value="tableData" dataKey="id" scrollable scrollHeight="calc(100vh - 285px)" tableStyle="min-width: 60rem">
            <!-- Account Code Column -->
            <Column header="รหัสบัญชี" style="width: 150px">
                <template #body="{ data }">
                    <div v-if="data.rowType === 'account-header'" class="font-bold text-primary-600 dark:text-primary-400">
                        {{ data.accountcode }}
                    </div>
                    <div v-else></div>
                </template>
            </Column>

            <!-- Account Name / Date Column -->
            <Column header="ชื่อบัญชี / วันที่" style="min-width: 200px">
                <template #body="{ data }">
                    <div v-if="data.rowType === 'account-header'" class="font-bold text-surface-900 dark:text-surface-0">
                        {{ data.accountname }}
                    </div>
                    <div v-else-if="data.rowType === 'balance-forward'" class="text-surface-500 dark:text-surface-400 italic"></div>
                    <div v-else-if="data.rowType === 'detail'">
                        {{ formatDateThai(data.docdate) }}
                    </div>
                    <div v-else></div>
                </template>
            </Column>

            <!-- Document Number Column -->
            <Column header="เลขที่เอกสาร" style="width: 180px">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'balance-forward'" class="font-semibold text-surface-600 dark:text-surface-400"> ยกมา </span>
                    <span v-else-if="data.rowType === 'account-footer'" class="font-semibold text-surface-600 dark:text-surface-400"> ยกไป </span>
                    <span v-else-if="data.rowType === 'detail' && data.docno" class="text-sm cursor-pointer text-primary-600 dark:text-primary-400 hover:underline" @click="onDetailRowClick(data.docno)">
                        {{ data.docno }}
                    </span>
                </template>
            </Column>

            <!-- Description Column -->
            <Column header="รายละเอียด" style="min-width: 250px">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'detail'">{{ data.accountdescription || '-' }}</span>
                </template>
            </Column>

            <!-- Debit Column -->
            <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'detail' && data.debit > 0" class="text-blue-600 dark:text-blue-400">
                        {{ formatCurrency(data.debit) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'" class="text-surface-400">-</span>
                    <span v-else-if="data.rowType === 'balance-forward' || data.rowType === 'account-footer'" class="text-surface-400">-</span>
                </template>
            </Column>

            <!-- Credit Column -->
            <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'detail' && data.credit > 0" class="text-orange-600 dark:text-orange-400">
                        {{ formatCurrency(data.credit) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'" class="text-surface-400">-</span>
                    <span v-else-if="data.rowType === 'balance-forward' || data.rowType === 'account-footer'" class="text-surface-400">-</span>
                </template>
            </Column>

            <!-- Balance Column -->
            <Column header="ยอดคงเหลือ" style="width: 150px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'balance-forward'" class="font-semibold text-surface-700 dark:text-surface-300">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'" :class="data.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                        {{ formatCurrencyWithParentheses(data.amount) }}
                    </span>
                    <span v-else-if="data.rowType === 'account-footer'" class="font-bold underline underline-offset-4 text-surface-900 dark:text-surface-0">
                        {{ formatCurrencyWithParentheses(data.nextbalance) }}
                    </span>
                </template>
            </Column>

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
        <div class="p-4 w-96">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <!-- Date Range -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากวันที่ <span class="text-red-500">*</span></label>
                        <ThaiDatePicker v-model="startDate" class="w-full" showIcon />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่ <span class="text-red-500">*</span></label>
                        <ThaiDatePicker v-model="endDate" class="w-full" showIcon />
                    </div>
                </div>

                <!-- Account Code Range -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากผังบัญชี</label>
                        <Select v-model="accountCodeFrom" :options="chartOfAccounts" optionLabel="displayLabel" optionDisabled="disabled" placeholder="เลือกผังบัญชี..." filter showClear fluid>
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
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงผังบัญชี</label>
                        <Select v-model="accountCodeTo" :options="chartOfAccounts" optionLabel="displayLabel" optionDisabled="disabled" placeholder="เลือกผังบัญชี..." filter showClear fluid>
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
                </div>

                <!-- Debt Account Type -->
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ประเภท</label>
                    <Select v-model="debtAccountType" :options="debtAccountTypes" optionLabel="label" optionValue="value" placeholder="เลือกประเภท" showClear fluid @change="onDebtAccountTypeChange" />
                </div>

                <!-- Debt Account -->
                <div v-if="debtAccountType">
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">
                        {{ debtAccountType === 'creditor' ? 'เจ้าหนี้' : 'ลูกหนี้' }}
                    </label>
                    <AutoComplete
                        v-model="debtAccountCode"
                        :suggestions="debtAccounts"
                        optionLabel="displayLabel"
                        :loading="debtAccountsLoading"
                        @complete="searchDebtAccounts"
                        :placeholder="`ค้นหา${debtAccountType === 'creditor' ? 'เจ้าหนี้' : 'ลูกหนี้'}...`"
                        dropdown
                        showClear
                        forceSelection
                        fluid
                    />
                </div>

                <!-- Journal Book -->
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">สมุดรายวัน</label>
                    <AutoComplete v-model="bookCode" :suggestions="journalBooks" optionLabel="displayLabel" :loading="journalBooksLoading" @complete="searchJournalBooks" placeholder="ค้นหาสมุดรายวัน..." dropdown showClear forceSelection fluid />
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-between mt-2">
                    <Button label="ล้างเงื่อนไข" icon="pi pi-times" severity="secondary" text @click="clearFilters" />
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
