<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { getJournalBooks, getJournalEntries } from '@/services/api/journal';
import { getJournalByDocNo } from '@/services/api/report';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const searchPopover = ref();
const loading = ref(false);
const journalData = ref([]);
const pagination = ref(null);

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

// Rows per page options
const rowsPerPageOptions = [
    { label: '10 ', value: 10 },
    { label: '20 ', value: 20 },
    { label: '50 ', value: 50 },
    { label: '100 ', value: 100 }
];

// Initialize default dates (first and last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    startDate.value = new Date(year, month, 1);
    endDate.value = new Date(year, month + 1, 0);
};

const toggleSearchPopover = (event) => {
    searchPopover.value.toggle(event);
};

const clearFilters = () => {
    initDefaultDates();
    selectedBookCode.value = null;
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

// Get journal book name from code
const getJournalBookName = (bookcode) => {
    if (!bookcode) return null;
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book ? book.displayLabel : bookcode;
};

const formatDateThai = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
};

// Computed for display period
const displayPeriod = computed(() => {
    if (!startDate.value || !endDate.value) return '';
    return `${formatDateThai(startDate.value)} - ${formatDateThai(endDate.value)}`;
});

// Format date to YYYY-MM-DD for API
const formatDateForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

const fetchJournalData = async (page = 1) => {
    if (!startDate.value || !endDate.value) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกช่วงวันที่',
            life: 3000
        });
        return;
    }

    try {
        loading.value = true;

        const params = {
            limit: rowsPerPage.value,
            page: page,
            sort: 'docno:1',
            startdate: formatDateForApi(startDate.value),
            enddate: formatDateForApi(endDate.value)
        };

        // Add bookcode filter if selected
        if (selectedBookCode.value) {
            params.bookcode = selectedBookCode.value;
        }

        const response = await getJournalEntries(params);

        if (response.data.success) {
            journalData.value = response.data.data || [];
            pagination.value = response.data.pagination;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching journal data:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: error.message || 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Search and close popover
const searchAndClosePopover = () => {
    searchPopover.value.hide();
    fetchJournalData();
};

const changePage = (newPage) => {
    fetchJournalData(newPage);
};

// Handle click on docno to show journal detail
const onDocNoClick = async (docno) => {
    if (!docno) return;

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

// Computed - flat table data for DataTable
const tableData = computed(() => {
    if (!journalData.value?.length) return [];

    const rows = [];
    let rowIndex = 0;

    journalData.value.forEach((journal) => {
        rowIndex++;
        // Journal header row
        rows.push({
            id: `header-${journal.guidfixed}`,
            rowType: 'journal-header',
            rowIndex: rowIndex,
            docno: journal.docno,
            docdate: journal.docdate,
            accountyear: journal.accountyear,
            accountperiod: journal.accountperiod,
            accountdescription: journal.accountdescription,
            amount: journal.amount
        });

        // Detail rows
        if (journal.journaldetail && journal.journaldetail.length > 0) {
            journal.journaldetail.forEach((detail, index) => {
                rows.push({
                    id: `detail-${journal.guidfixed}-${index}`,
                    rowType: 'detail',
                    parentDocno: journal.docno,
                    accountcode: detail.accountcode,
                    accountname: detail.accountname,
                    debitamount: detail.debitamount,
                    creditamount: detail.creditamount
                });
            });
        }
    });

    return rows;
});

onMounted(async () => {
    // Load journal books
    await searchJournalBooks({ query: '' });

    initDefaultDates();
    fetchJournalData();
});
</script>

<template>
    <div class="card">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / รายงานรายวัน</span>
                <div v-if="displayPeriod" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ displayPeriod }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" />
            </div>
        </div>

        <!-- Report Header -->
        <div class="text-center mb-4">
            <div class="font-bold text-xl text-surface-900 dark:text-surface-0">รายงานรายวัน</div>
            <p class="text-sm text-surface-600 dark:text-surface-400">ตั้งแต่วันที่ {{ formatDateThai(startDate) }} ถึงวันที่ {{ formatDateThai(endDate) }}</p>
            <p v-if="selectedBookCode" class="text-sm text-surface-600 dark:text-surface-400">สมุดรายวัน: {{ getJournalBookName(selectedBookCode) }}</p>
        </div>

        <!-- Report Table -->
        <DataTable :value="tableData" dataKey="id" :loading="loading" scrollable scrollHeight="calc(100vh - 330px)" showGridlines size="small" class="journal-report-table">
            <!-- ลำดับ -->
            <Column header="#" style="width: 60px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: center' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'" class="font-medium text-surface-600 dark:text-surface-400">
                        {{ data.rowIndex }}
                    </span>
                </template>
            </Column>

            <!-- วันที่ -->
            <Column header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'">
                        {{ formatDateThai(data.docdate) }}
                    </span>
                </template>
            </Column>

            <!-- เลขที่เอกสาร -->
            <Column header="เลขที่เอกสาร" style="width: 200px" :pt="{ headerCell: { style: 'text-align: center' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'" class="font-semibold text-primary-600 dark:text-primary-400 cursor-pointer hover:underline" @click="onDocNoClick(data.docno)">
                        {{ data.docno }}
                    </span>
                </template>
            </Column>

            <!-- รหัสบัญชี / ปีบัญชี -->
            <Column header="รหัสบัญชี" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'" class="text-surface-600 dark:text-surface-400"> ปี {{ data.accountyear }} / งวด {{ data.accountperiod }} </span>
                    <span v-else-if="data.rowType === 'detail'" class="font-medium">
                        {{ data.accountcode }}
                    </span>
                </template>
            </Column>

            <!-- ชื่อบัญชี / รายละเอียด -->
            <Column header="ชื่อบัญชี" style="min-width: 150px" :pt="{ headerCell: { style: 'text-align: center' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'" class="text-surface-700 dark:text-surface-300">
                        {{ data.accountdescription || '-' }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'">
                        {{ data.accountname }}
                    </span>
                </template>
            </Column>

            <!-- เดบิต -->
            <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'" class="font-semibold">
                        {{ formatCurrency(data.amount) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail' && data.debitamount > 0" class="text-blue-600 dark:text-blue-400">
                        {{ formatCurrency(data.debitamount) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'" class="text-surface-400">-</span>
                </template>
            </Column>

            <!-- เครดิต -->
            <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.rowType === 'journal-header'"></span>
                    <span v-else-if="data.rowType === 'detail' && data.creditamount > 0" class="text-orange-600 dark:text-orange-400">
                        {{ formatCurrency(data.creditamount) }}
                    </span>
                    <span v-else-if="data.rowType === 'detail'" class="text-surface-400">-</span>
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

        <!-- Pagination -->
        <div v-if="pagination && journalData.length > 0" class="mt-4 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <span class="text-sm text-surface-600 dark:text-surface-400">แสดง</span>
                <Select v-model="rowsPerPage" :options="rowsPerPageOptions" optionLabel="label" optionValue="value" class="w-28" @change="fetchJournalData(1)" />
                <span class="text-sm text-surface-600 dark:text-surface-400"> จากทั้งหมด {{ pagination.total }} รายการ </span>
            </div>
            <div class="flex gap-2 items-center">
                <Button icon="pi pi-chevron-left" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)" severity="secondary" text />
                <span class="px-3 font-medium text-surface-700 dark:text-surface-300"> หน้า {{ pagination.page }} / {{ pagination.totalPage }} </span>
                <Button icon="pi pi-chevron-right" :disabled="pagination.page >= pagination.totalPage" @click="changePage(pagination.page + 1)" severity="secondary" text />
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
                    <ThaiDatePicker v-model="startDate" class="w-full" showIcon />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่ <span class="text-red-500">*</span></label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon />
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
</template>

<style scoped>
/* Header text center alignment */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}

/* Journal row hover styling */
.journal-report-table :deep(.p-datatable-tbody > tr) {
    transition: background-color 0.15s ease;
}

/* Light mode hover - สีฟ้าอ่อน */
.journal-report-table :deep(.p-datatable-tbody > tr:hover) {
    background-color: rgba(59, 130, 246, 0.08) !important;
}

/* Dark mode hover - สีฟ้าเข้มขึ้น */
html.dark .journal-report-table :deep(.p-datatable-tbody > tr:hover) {
    background-color: rgba(96, 165, 250, 0.15) !important;
}
p {
    margin: 0 0 0 0;
    line-height: 1.5;
}
</style>
