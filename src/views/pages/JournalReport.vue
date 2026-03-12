<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { getJournalBooks } from '@/services/api/journal';
import { generateAndDownloadJournalDailyExcel, generateAndOpenJournalDailyPDF, getJournalByDocNo, getJournalDailyReport } from '@/services/api/report';
import { getShop } from '@/services/api/shop';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const searchPopover = ref();
const downloadMenu = ref(null);
const loading = ref(false);
const downloading = ref(false);
const journalData = ref([]);
const pagination = ref(null);
const shopData = ref(null);
const totals = ref(null);

// Journal Detail Dialog
const journalDialogVisible = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);

// Search filters
const startDate = ref(null);
const endDate = ref(null);
const selectedBookCode = ref(null);
const rowsPerPage = ref(20);

// Journal Books for filter
const journalBooks = ref([]);
const journalBooksLoading = ref(false);

const rowsPerPageOptions = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 },
    { label: '100', value: 100 }
];

const downloadMenuItems = ref([
    { label: 'ดาวน์โหลด PDF', icon: 'pi pi-file-pdf', command: () => downloadPDF() },
    { label: 'ดาวน์โหลด Excel', icon: 'pi pi-file-excel', command: () => downloadExcel() }
]);

const isDownloadDisabled = computed(() => !journalData.value?.length || downloading.value);

const shopName = computed(() => shopData.value?.names?.find((n) => n.code === 'th')?.name || '');
const shopAddress = computed(() => shopData.value?.address?.find((a) => a.code === 'th')?.name || '');
const shopTaxId = computed(() => shopData.value?.settings?.taxid || '');

const fetchShopData = async () => {
    const shopid = localStorage.getItem('shopid');
    if (!shopid) return;
    try {
        const response = await getShop(shopid);
        if (response.success) shopData.value = response.data;
    } catch (error) {
        console.error('Error fetching shop data:', error);
    }
};

const initDefaultDates = () => {
    const now = new Date();
    startDate.value = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate.value = new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const toggleSearchPopover = (event) => searchPopover.value.toggle(event);
const clearFilters = () => {
    initDefaultDates();
    selectedBookCode.value = null;
};

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

const getJournalBookName = (bookcode) => {
    if (!bookcode) return null;
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book ? book.displayLabel : bookcode;
};

const getBookName1 = (bookcode) => {
    if (!bookcode) return '-';
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book ? book.name1 : bookcode;
};

const formatDateThai = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear() + 543}`;
};

const displayPeriod = computed(() => {
    if (!startDate.value || !endDate.value) return '';
    return `${formatDateThai(startDate.value)} - ${formatDateThai(endDate.value)}`;
});

const formatDateForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === 0) return '-';
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const buildParams = (extra = {}) => {
    const shopid = localStorage.getItem('shopid') || '';
    const params = {
        shopid,
        fromdate: formatDateForApi(startDate.value),
        todate: formatDateForApi(endDate.value),
        shopname: shopName.value,
        taxid: shopTaxId.value,
        address: shopAddress.value
    };
    if (selectedBookCode.value) params.book_code = selectedBookCode.value;
    return { ...params, ...extra };
};

const fetchJournalData = async (page = 0) => {
    if (!startDate.value || !endDate.value) {
        toast.add({ severity: 'warn', summary: 'แจ้งเตือน', detail: 'กรุณาเลือกช่วงวันที่', life: 3000 });
        return;
    }
    try {
        loading.value = true;
        const response = await getJournalDailyReport(buildParams({ offset: page * rowsPerPage.value, limit: rowsPerPage.value }));
        if (response.success) {
            journalData.value = response.data || [];
            pagination.value = response.pagination;
            totals.value = {
                amount: response.totalsumamount,
                debit: response.totalsumdebit,
                credit: response.totalsumcredit
            };
        } else {
            toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'ไม่สามารถโหลดข้อมูลได้', life: 3000 });
        }
    } catch (error) {
        console.error('Error fetching journal data:', error);
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: error.message || 'ไม่สามารถโหลดข้อมูลได้', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const downloadPDF = async () => {
    if (!startDate.value || !endDate.value) return;
    downloading.value = true;
    try {
        const result = await generateAndOpenJournalDailyPDF(buildParams());
        if (!result.success) toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: result.message || 'ไม่สามารถสร้าง PDF ได้', life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการสร้าง PDF', life: 3000 });
    } finally {
        downloading.value = false;
    }
};

const downloadExcel = async () => {
    if (!startDate.value || !endDate.value) return;
    downloading.value = true;
    try {
        const result = await generateAndDownloadJournalDailyExcel(buildParams());
        if (!result.success) toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: result.message || 'ไม่สามารถสร้าง Excel ได้', life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการสร้าง Excel', life: 3000 });
    } finally {
        downloading.value = false;
    }
};

const searchAndClosePopover = () => {
    searchPopover.value.hide();
    fetchJournalData();
};

const changePage = (newPage) => fetchJournalData(newPage);

const onDocNoClick = async (docno) => {
    if (!docno) return;
    loadingJournal.value = true;
    journalDialogVisible.value = true;
    try {
        const response = await getJournalByDocNo(docno);
        if (response.success && response.data) {
            selectedJournal.value = response.data;
        } else {
            toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'ไม่พบข้อมูลเอกสาร', life: 3000 });
            journalDialogVisible.value = false;
        }
    } catch {
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร', life: 3000 });
        journalDialogVisible.value = false;
    } finally {
        loadingJournal.value = false;
    }
};

onMounted(async () => {
    await Promise.all([searchJournalBooks({ query: '' }), fetchShopData()]);
    initDefaultDates();
    fetchJournalData();
});
</script>

<template>
    <div class="card">
        <!-- Page Header -->
        <div class="mb-4 flex items-center justify-between gap-4">
            <div>
                <span class="text-xl font-semibold text-surface-900 dark:text-surface-0">รายงานรายวัน</span>
                <div v-if="displayPeriod" class="mt-1 text-sm text-surface-500 dark:text-surface-400">
                    <i class="pi pi-calendar mr-1"></i>{{ displayPeriod }}
                    <span v-if="selectedBookCode" class="ml-2">· {{ getJournalBookName(selectedBookCode) }}</span>
                </div>
            </div>

            <div class="flex gap-2">
                <!-- Summary Totals -->
                <div v-if="totals" class="flex gap-2 flex-1">
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800">
                        <i class="pi pi-calculator text-sm text-surface-500 dark:text-surface-400"></i>
                        <div>
                            <div class="text-xs text-surface-500 dark:text-surface-400 font-medium leading-none mb-0.5">มูลค่ารวม</div>
                            <div class="text-sm font-bold text-surface-900 dark:text-surface-0 tabular-nums leading-none">{{ formatCurrency(totals.amount) }}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <i class="pi pi-arrow-circle-right text-sm text-blue-500"></i>
                        <div>
                            <div class="text-xs text-blue-600 dark:text-blue-400 font-medium leading-none mb-0.5">รวมเดบิต</div>
                            <div class="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums leading-none">{{ formatCurrency(totals.debit) }}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                        <i class="pi pi-arrow-circle-left text-sm text-orange-500"></i>
                        <div>
                            <div class="text-xs text-orange-600 dark:text-orange-400 font-medium leading-none mb-0.5">รวมเครดิต</div>
                            <div class="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums leading-none">{{ formatCurrency(totals.credit) }}</div>
                        </div>
                    </div>
                </div>
                <Menu ref="downloadMenu" :model="downloadMenuItems" :popup="true" />
                <Button label="ดาวน์โหลด" icon="pi pi-download" severity="secondary" :disabled="isDownloadDisabled" :loading="downloading" @click="downloadMenu.toggle($event)" />
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" />
            </div>
        </div>

        <!-- Report Table -->
        <div class="table-wrapper">
            <table class="report-table">
                <thead>
                    <tr>
                        <th class="col-no">#</th>
                        <th class="col-date">วันที่</th>
                        <th class="col-docno">เลขที่เอกสาร / รหัสบัญชี</th>
                        <th class="col-book">สมุดรายวัน / ชื่อบัญชี</th>
                        <th class="col-desc2">คำอธิบาย</th>
                        <th class="col-account text-right">เดบิต</th>
                        <th class="col-desc text-right">เครดิต</th>
                    </tr>
                </thead>
                <tbody v-if="!loading">
                    <template v-if="journalData.length === 0">
                        <tr>
                            <td colspan="9" class="empty-cell">
                                <i class="pi pi-book text-3xl block mb-2 text-surface-300"></i>
                                ไม่พบข้อมูลรายงาน
                            </td>
                        </tr>
                    </template>
                    <template v-for="(journal, idx) in journalData" :key="journal.docno + idx">
                        <!-- แถว journal header -->
                        <tr class="tr-journal">
                            <td class="col-no text-center text-surface-400 text-xs">{{ (pagination?.page ?? 0) * rowsPerPage + idx + 1 }}</td>
                            <td class="col-date">
                                <span class="text-sm font-medium">{{ formatDateThai(journal.docdate) }}</span>
                            </td>
                            <td class="col-docno">
                                <button class="docno-link" @click="onDocNoClick(journal.docno)">{{ journal.docno }}</button>
                            </td>
                            <td class="col-book">
                                <div class="text-sm font-medium text-surface-800 dark:text-surface-100">{{ getBookName1(journal.bookcode) }}</div>
                            </td>
                            <td class="col-desc2" colspan="3">
                                <div v-if="journal.debtor_name" class="text-sm text-surface-800 dark:text-surface-100">{{ journal.debtor_name }} {{ journal.accountdescription }}</div>
                                <div v-if="journal.creditor_name" class="text-sm text-surface-800 dark:text-surface-100">{{ journal.creditor_name }} {{ journal.accountdescription }}</div>
                            </td>
                        </tr>
                        <!-- แถว detail -->
                        <tr v-for="(detail, didx) in journal.journaldetail" :key="`d-${idx}-${didx}`" class="tr-detail">
                            <td class="col-no"></td>
                            <td class="col-date"></td>
                            <td class="col-docno">
                                <span class="account-code">{{ detail.accountcode }}</span>
                            </td>
                            <td class="col-book">
                                <span class="text-sm text-surface-700 dark:text-surface-300">{{ detail.accountname }}</span>
                            </td>
                            <td class="col-desc2"></td>
                            <td class="col-account text-right">
                                <span v-if="detail.debitamount > 0" class="debit-amount">{{ formatCurrency(detail.debitamount) }}</span>
                                <span v-else class="text-surface-300 dark:text-surface-600 text-xs">-</span>
                            </td>
                            <td class="col-desc text-right">
                                <span v-if="detail.creditamount > 0" class="credit-amount">{{ formatCurrency(detail.creditamount) }}</span>
                                <span v-else class="text-surface-300 dark:text-surface-600 text-xs">-</span>
                            </td>
                        </tr>
                        <!-- แถวรวม debit/credit ของ journal นี้ -->
                        <tr class="tr-subtotal">
                            <td colspan="5" class="text-right text-xs text-surface-400 pr-3">รวม</td>
                            <td class="col-account text-right">
                                <span class="debit-amount font-semibold">{{ formatCurrency(journal.journaldetail.reduce((s, d) => s + (d.debitamount || 0), 0)) }}</span>
                            </td>
                            <td class="col-desc text-right">
                                <span class="credit-amount font-semibold">{{ formatCurrency(journal.journaldetail.reduce((s, d) => s + (d.creditamount || 0), 0)) }}</span>
                            </td>
                        </tr>
                    </template>
                </tbody>
                <tbody v-else>
                    <tr v-for="i in 5" :key="i">
                        <td colspan="9" class="p-2">
                            <Skeleton height="32px" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination && pagination.total > 0" class="mt-4 flex flex-wrap justify-between items-center gap-3">
            <div class="flex items-center gap-2">
                <span class="text-sm text-surface-600 dark:text-surface-400">แสดง</span>
                <Select v-model="rowsPerPage" :options="rowsPerPageOptions" optionLabel="label" optionValue="value" class="w-24" @change="fetchJournalData(0)" />
                <span class="text-sm text-surface-600 dark:text-surface-400"
                    >จากทั้งหมด <strong>{{ pagination.total }}</strong> รายการ</span
                >
            </div>
            <div class="flex items-center gap-2">
                <Button icon="pi pi-chevron-left" severity="secondary" text :disabled="pagination.page <= 0" @click="changePage(pagination.page - 1)" />
                <span class="text-sm font-medium text-surface-700 dark:text-surface-300">หน้า {{ pagination.page + 1 }} / {{ pagination.totalPage }}</span>
                <Button icon="pi pi-chevron-right" severity="secondary" text :disabled="pagination.page >= pagination.totalPage - 1" @click="changePage(pagination.page + 1)" />
            </div>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากวันที่ <span class="text-red-500">*</span></label>
                    <ThaiDatePicker v-model="startDate" class="w-full" showIcon @enter="searchAndClosePopover" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่ <span class="text-red-500">*</span></label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon @enter="searchAndClosePopover" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">สมุดรายวัน</label>
                    <AutoComplete
                        :modelValue="selectedBookCode"
                        @update:modelValue="selectedBookCode = $event?.code || $event"
                        :suggestions="journalBooks"
                        optionLabel="displayLabel"
                        :loading="journalBooksLoading"
                        @complete="searchJournalBooks"
                        placeholder="เลือกสมุดรายวัน"
                        dropdown
                        showClear
                        forceSelection
                        fluid
                    >
                        <template #option="{ option }">
                            <div>{{ option.displayLabel }}</div>
                        </template>
                    </AutoComplete>
                </div>
                <div class="flex justify-between mt-2">
                    <Button label="ล้างเงื่อนไข" icon="pi pi-times" severity="secondary" text @click="clearFilters" />
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Journal Detail Dialog -->
    <JournalDetailDialog v-model:visible="journalDialogVisible" :journal="selectedJournal" />

    <!-- Loading Dialog -->
    <LoadingDialog :visible="downloading" message="กำลังสร้างไฟล์..." />
</template>

<style scoped>
p {
    margin: 0;
}

/* ==============================
   Table Wrapper (scroll)
   ============================== */
.table-wrapper {
    overflow: auto;
    max-height: calc(100vh - 275px);
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
}

:root[class*='app-dark'] .table-wrapper {
    border-color: var(--p-surface-700);
}

/* ==============================
   Report Table
   ============================== */
.report-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.83rem;
}

/* Sticky header */
.report-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--p-surface-100);
    border-bottom: 2px solid var(--p-surface-300);
    padding: 8px 10px;
    font-weight: 600;
    font-size: 0.78rem;
    color: var(--p-surface-600);
    white-space: nowrap;
    /* ป้องกัน gap ระหว่าง sticky กับ content */
    box-shadow: 0 1px 0 var(--p-surface-300);
}

:root[class*='app-dark'] .report-table thead th {
    background-color: var(--p-surface-800);
    border-bottom-color: var(--p-surface-600);
    color: var(--p-surface-300);
    box-shadow: 0 1px 0 var(--p-surface-600);
}

/* Column widths */
.col-no {
    width: 36px;
    text-align: center;
}

.col-date {
    width: 110px;
    white-space: nowrap;
}

.col-docno {
    width: 160px;
    white-space: nowrap;
}

.col-book {
    width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.col-desc2 {
    width: auto;
}

.col-account {
    width: 130px;
    white-space: nowrap;
    text-align: right;
}

.col-desc {
    width: 130px;
    white-space: nowrap;
    text-align: right;
}

.col-amount {
    width: 120px;
    white-space: nowrap;
    text-align: right;
}

/* ==============================
   Journal Header Row
   ============================== */
.tr-journal {
    background-color: var(--p-primary-50);
    border-top: 2px solid var(--p-surface-200);
}

:root[class*='app-dark'] .tr-journal {
    background-color: var(--p-primary-950);
    border-top-color: var(--p-surface-700);
}

.tr-journal td {
    padding: 8px 10px;
    vertical-align: middle;
}

.tr-journal:hover {
    background-color: var(--p-primary-100) !important;
}

:root[class*='app-dark'] .tr-journal:hover {
    background-color: var(--p-primary-900) !important;
}

/* ==============================
   Detail Row
   ============================== */
.tr-detail {
    background-color: var(--p-surface-0);
    border-bottom: 1px solid var(--p-surface-100);
}

:root[class*='app-dark'] .tr-detail {
    background-color: var(--p-surface-900);
    border-bottom-color: var(--p-surface-800);
}

.tr-detail td {
    padding: 6px 10px;
    vertical-align: middle;
}

.tr-detail:hover {
    background-color: var(--p-surface-50) !important;
}

:root[class*='app-dark'] .tr-detail:hover {
    background-color: var(--p-surface-800) !important;
}

/* ==============================
   Elements
   ============================== */
.docno-link {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--p-primary-color);
    text-decoration: underline;
    text-underline-offset: 2px;
}

.docno-link:hover {
    color: var(--p-primary-hover-color);
}

.account-code {
    display: inline-block;
    font-family: monospace;
    font-size: 0.78rem;
    background-color: var(--p-surface-100);
    color: var(--p-surface-600);
    padding: 1px 5px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
}

:root[class*='app-dark'] .account-code {
    background-color: var(--p-surface-800);
    color: var(--p-surface-300);
}

.debit-amount {
    color: var(--p-blue-700);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
}

:root[class*='app-dark'] .debit-amount {
    color: var(--p-blue-300);
}

.credit-amount {
    color: var(--p-orange-700);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
}

:root[class*='app-dark'] .credit-amount {
    color: var(--p-orange-300);
}

/* ==============================
   Subtotal Row
   ============================== */
.tr-subtotal {
    background-color: var(--p-surface-50);
    border-top: 1px dashed var(--p-surface-300);
    border-bottom: 2px solid var(--p-surface-300);
}

:root[class*='app-dark'] .tr-subtotal {
    background-color: var(--p-surface-850, var(--p-surface-800));
    border-top-color: var(--p-surface-600);
    border-bottom-color: var(--p-surface-600);
}

.tr-subtotal td {
    padding: 5px 10px;
    font-size: 0.8rem;
}

.empty-cell {
    text-align: center;
    padding: 60px 0;
    color: var(--p-surface-400);
}
</style>
