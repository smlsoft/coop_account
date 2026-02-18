<script setup>
import DialogApprove from '@/components/DialogApprove.vue';
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { deleteJournalByBatchId, deleteJournalEntry, getJournalBooks, getJournalEntries } from '@/services/api/journal';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();

// LocalStorage keys
const STORAGE_KEY = 'journal-entry-state';
const COLUMNS_STORAGE_KEY = 'journal-entry-columns'; // แยก key สำหรับ columns

const journals = ref([]);
const loading = ref(false);
const selectedJournal = ref(null);
const deleteDialogVisible = ref(false);
const deleting = ref(false);
const randomNumber = ref(0);
const expandedRows = ref([]);
const detailDialogVisible = ref(false);
const selectedDetailJournal = ref(null);

// Overlay Menu
const menu = ref();
const menuItems = ref([
    {
        label: 'ดูรายละเอียด',
        icon: 'pi pi-eye',
        command: () => {
            if (selectedJournal.value) {
                viewDetail(selectedJournal.value);
            }
        }
    },
    {
        label: 'แก้ไข',
        icon: 'pi pi-pencil',
        command: () => {
            if (selectedJournal.value) {
                handleEdit(selectedJournal.value);
            }
        }
    },
    {
        separator: true
    },
    {
        label: 'ลบ',
        icon: 'pi pi-trash',
        class: 'text-red-500',
        command: () => {
            if (selectedJournal.value) {
                openDeleteDialog(selectedJournal.value);
            }
        }
    }
]);

const toggleMenu = (event, journal) => {
    selectedJournal.value = journal;
    menu.value.toggle(event);
};

// Handle row double click to edit
const onRowDblClick = (event) => {
    handleEdit(event.data);
};

// Pagination
const currentPage = ref(1);
const totalRecords = ref(0);
const rowsPerPage = ref(10);

// Computed for DataTable first property
const first = computed(() => (currentPage.value - 1) * rowsPerPage.value);

// Filters with global search
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    docno: { value: null, matchMode: FilterMatchMode.CONTAINS },
    docdate: { value: null, matchMode: FilterMatchMode.DATE_IS }, // Placeholder for PrimeVue (not used)
    bookcode: { value: null, matchMode: FilterMatchMode.EQUALS },
    exdocrefno: { value: null, matchMode: FilterMatchMode.CONTAINS },
    exdocrefdate: { value: null, matchMode: FilterMatchMode.DATE_IS }, // Placeholder for PrimeVue (not used)
    accountperiod: { value: null, matchMode: FilterMatchMode.EQUALS },
    contactname: { value: null, matchMode: FilterMatchMode.CONTAINS },
    amount: { value: null, matchMode: FilterMatchMode.EQUALS },
    accountdescription: { value: null, matchMode: FilterMatchMode.CONTAINS },
    createdby: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// Journal Books for filter
const journalBooks = ref([]);
const journalBooksLoading = ref(false);

// Date range filter for docdate
const startDate = ref(null);
const endDate = ref(null);

// Date range filter for exdocrefdate
const exdocrefStartDate = ref(null);
const exdocrefEndDate = ref(null);

// Debounce timeout
const filterTimeout = ref(null);

// Current sort
const sortField = ref('docdate');
const sortOrder = ref(-1);

// Column visibility
const availableColumns = [
    { field: 'docno', header: 'เลขที่เอกสาร', visible: true },
    { field: 'docdate', header: 'วันที่เอกสาร', visible: true },
    { field: 'bookcode', header: 'สมุดรายวัน', visible: true },
    { field: 'exdocrefno', header: 'เลขที่เอกสารอ้างอิง', visible: true },
    { field: 'exdocrefdate', header: 'วันที่เอกสารอ้างอิง', visible: true },
    { field: 'accountperiod', header: 'งวด/ปี', visible: true },
    // { field: 'contactname', header: 'ชื่อ', visible: true },
    { field: 'amount', header: 'จำนวนเงิน', visible: true },
    { field: 'accountdescription', header: 'คำอธิบาย', visible: true },
    { field: 'createdby', header: 'สร้างโดย', visible: true }
];
const selectedColumns = ref(availableColumns.filter((col) => col.field !== 'accountperiod' && col.field !== 'exdocrefno' && col.field !== 'exdocrefdate' && col.field !== 'bookcode'));
const isColumnVisible = (field) => selectedColumns.value.some((col) => col.field === field);

// Watch filters with debounce
watch(
    filters,
    (newFilters, oldFilters) => {
        // ตรวจสอบว่า docdate หรือ exdocrefdate เปลี่ยนแปลงหรือไม่
        const docdateChanged = newFilters.docdate?.value !== oldFilters?.docdate?.value;
        const exdocrefdateChanged = newFilters.exdocrefdate?.value !== oldFilters?.exdocrefdate?.value;

        // ถ้า date filters ถูก clear (เป็น null) ให้ clear date range ด้วย
        if (docdateChanged && newFilters.docdate?.value === null) {
            startDate.value = null;
            endDate.value = null;
        }
        if (exdocrefdateChanged && newFilters.exdocrefdate?.value === null) {
            exdocrefStartDate.value = null;
            exdocrefEndDate.value = null;
        }

        // ถ้า date filters เปลี่ยน ให้ fetch ทันที (จากปุ่ม Apply หรือ Clear ของ DataTable)
        if (docdateChanged || exdocrefdateChanged) {
            currentPage.value = 1;
            fetchJournals();
        } else {
            // สำหรับ filter อื่นๆ ใช้ debounce
            if (filterTimeout.value) {
                clearTimeout(filterTimeout.value);
            }
            filterTimeout.value = setTimeout(() => {
                currentPage.value = 1;
                fetchJournals();
            }, 800);
        }
    },
    { deep: true }
);

// Watch pagination and sort (immediate, no debounce)
watch([currentPage, rowsPerPage, sortField, sortOrder], () => {
    fetchJournals();
});

const fetchJournals = async () => {
    try {
        loading.value = true;

        const params = {
            page: currentPage.value,
            limit: rowsPerPage.value,
            sort: `${sortField.value}:${sortOrder.value}`
        };

        // Add active filters (exclude global, docdate, exdocrefdate - we handle these separately)
        Object.entries(filters.value).forEach(([key, filter]) => {
            if (key !== 'global' && key !== 'docdate' && key !== 'exdocrefdate' && filter.value !== null && filter.value !== '') {
                // Special handling for contactname - send to both creditorname and debtorname
                if (key === 'contactname') {
                    params.creditorname = filter.value;
                    params.debtorname = filter.value;
                } else {
                    // bookcode จะเป็น string code อยู่แล้ว (จาก optionValue="code")
                    params[key] = filter.value;
                }
            }
        });

        // Handle docdate filtering
        // ถ้ามีทั้ง startDate และ endDate = ใช้ range
        // ถ้ามีแค่ startDate = ใช้ docdate (วันเดียว)
        if (startDate.value && endDate.value) {
            // Range mode
            const startYear = startDate.value.getFullYear();
            const startMonth = String(startDate.value.getMonth() + 1).padStart(2, '0');
            const startDay = String(startDate.value.getDate()).padStart(2, '0');
            params.startdate = `${startYear}-${startMonth}-${startDay}`;

            const endYear = endDate.value.getFullYear();
            const endMonth = String(endDate.value.getMonth() + 1).padStart(2, '0');
            const endDay = String(endDate.value.getDate()).padStart(2, '0');
            params.enddate = `${endYear}-${endMonth}-${endDay}`;
        } else if (startDate.value) {
            // Single date mode
            const year = startDate.value.getFullYear();
            const month = String(startDate.value.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.value.getDate()).padStart(2, '0');
            params.docdate = `${year}-${month}-${day}`;
        }

        // Handle exdocrefdate filtering
        // ถ้ามีทั้ง exdocrefStartDate และ exdocrefEndDate = ใช้ range
        // ถ้ามีแค่ exdocrefStartDate = ใช้ exdocrefdate (วันเดียว)
        if (exdocrefStartDate.value && exdocrefEndDate.value) {
            // Range mode
            const startYear = exdocrefStartDate.value.getFullYear();
            const startMonth = String(exdocrefStartDate.value.getMonth() + 1).padStart(2, '0');
            const startDay = String(exdocrefStartDate.value.getDate()).padStart(2, '0');
            params.exdocrefstartdate = `${startYear}-${startMonth}-${startDay}`;

            const endYear = exdocrefEndDate.value.getFullYear();
            const endMonth = String(exdocrefEndDate.value.getMonth() + 1).padStart(2, '0');
            const endDay = String(exdocrefEndDate.value.getDate()).padStart(2, '0');
            params.exdocrefenddate = `${endYear}-${endMonth}-${endDay}`;
        } else if (exdocrefStartDate.value) {
            // Single date mode
            const year = exdocrefStartDate.value.getFullYear();
            const month = String(exdocrefStartDate.value.getMonth() + 1).padStart(2, '0');
            const day = String(exdocrefStartDate.value.getDate()).padStart(2, '0');
            params.exdocrefdate = `${year}-${month}-${day}`;
        }

        const response = await getJournalEntries(params);

        if (response.data.success) {
            // Convert date strings to Date objects for proper filtering
            journals.value = response.data.data.map((journal) => ({
                ...journal,
                docdate: journal.docdate ? new Date(journal.docdate) : null,
                exdocrefdate: journal.exdocrefdate ? new Date(journal.exdocrefdate) : null
            }));
            totalRecords.value = response.data.pagination?.total || 0;
        }
    } catch (error) {
        console.error('Error fetching journals:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const onPage = (event) => {
    currentPage.value = event.page + 1;
    rowsPerPage.value = event.rows;
    // fetchJournals จะถูกเรียกโดย watch อัตโนมัติ
};

const onSort = (event) => {
    sortField.value = event.sortField;
    sortOrder.value = event.sortOrder;
    // fetchJournals จะถูกเรียกโดย watch อัตโนมัติ
};

const openDeleteDialog = (journal) => {
    selectedJournal.value = journal;
    randomNumber.value = generateRandomNumber();
    deleteDialogVisible.value = true;
};

const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

const confirmDeleteFalse = () => {
    randomNumber.value = generateRandomNumber();
    toast.add({
        severity: 'error',
        summary: 'ตัวเลขไม่ถูกต้อง',
        detail: 'กรุณากรอกตัวเลขใหม่',
        life: 3000
    });
};

const confirmDelete = async () => {
    if (!selectedJournal.value?.guidfixed) return;

    deleting.value = true;

    try {
        let response;
        let successMessage = 'ลบรายการบัญชีเรียบร้อยแล้ว';

        // ตรวจสอบว่ามี batchid หรือไม่
        if (selectedJournal.value.batchid) {
            // ลบทั้ง batch (รายการจาก Statement)
            response = await deleteJournalByBatchId(selectedJournal.value.batchid);
            successMessage = 'ลบรายการบัญชีจาก Statement ทั้งหมดเรียบร้อยแล้ว';

            console.log(`Deleting batch: ${selectedJournal.value.batchid}`);
        } else {
            // ลบรายการเดียว
            response = await deleteJournalEntry(selectedJournal.value.guidfixed);

            console.log(`Deleting single entry: ${selectedJournal.value.guidfixed}`);
        }

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: successMessage,
                life: 3000
            });

            deleteDialogVisible.value = false;
            selectedJournal.value = null;

            // Refresh data
            await fetchJournals();
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถลบรายการบัญชีได้',
            life: 3000
        });
    } finally {
        deleting.value = false;
    }
};

const handleCreate = () => {
    router.push({ name: 'journal-create' });
};

const handleEdit = (journal) => {
    router.push({ name: 'journal-edit', params: { id: journal.guidfixed } });
};

const clearFilters = () => {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        docno: { value: null, matchMode: FilterMatchMode.CONTAINS },
        docdate: { value: null, matchMode: FilterMatchMode.DATE_IS },
        bookcode: { value: null, matchMode: FilterMatchMode.EQUALS },
        exdocrefno: { value: null, matchMode: FilterMatchMode.CONTAINS },
        exdocrefdate: { value: null, matchMode: FilterMatchMode.DATE_IS },
        accountperiod: { value: null, matchMode: FilterMatchMode.EQUALS },
        contactname: { value: null, matchMode: FilterMatchMode.CONTAINS },
        amount: { value: null, matchMode: FilterMatchMode.EQUALS },
        accountdescription: { value: null, matchMode: FilterMatchMode.CONTAINS },
        createdby: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
    // Clear date range filters
    startDate.value = null;
    endDate.value = null;
    // Clear exdocrefdate range filters
    exdocrefStartDate.value = null;
    exdocrefEndDate.value = null;
};

const expandAll = () => {
    expandedRows.value = journals.value.reduce((acc, j) => {
        acc[j.guidfixed] = true;
        return acc;
    }, {});
};

const collapseAll = () => {
    expandedRows.value = {};
};

const viewDetail = (journal) => {
    selectedDetailJournal.value = journal;
    detailDialogVisible.value = true;
};

const formatDate = (dateString) => {
    if (!dateString) return '-';

    // Handle string format
    if (typeof dateString === 'string' && dateString === '0001-01-01T00:00:00Z') return '-';

    // Handle Date object
    const date = dateString instanceof Date ? dateString : new Date(dateString);

    // Check if year is 0001 (invalid date)
    if (date.getFullYear() === 1) return '-';

    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const getTotalDebit = (journal) => {
    return journal.journaldetail?.reduce((sum, item) => sum + (item.debitamount || 0), 0) || 0;
};

const getTotalCredit = (journal) => {
    return journal.journaldetail?.reduce((sum, item) => sum + (item.creditamount || 0), 0) || 0;
};

// เพิ่มฟังก์ชันสำหรับดึงชื่อลูกหนี้/เจ้าหนี้
const getContactName = (data) => {
    if (data.debtaccounttype === 0) {
        // ลูกหนี้
        if (data.debtor && data.debtor.names && data.debtor.names.length > 0) {
            const thaiName = data.debtor.names.find((n) => n.code === 'th');
            return thaiName ? thaiName.name : '-';
        }
        return '-';
    } else if (data.debtaccounttype === 1) {
        // เจ้าหนี้
        if (data.creditor && data.creditor.names && data.creditor.names.length > 0) {
            const thaiName = data.creditor.names.find((n) => n.code === 'th');
            return thaiName ? thaiName.name : '-';
        }
        return '-';
    }
    return '-';
};

// เพิ่มฟังก์ชันสำหรับดึงชื่อสมุดรายวันจาก code
const getJournalBookName = (bookcode) => {
    if (!bookcode) return '-';
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book ? book.displayLabel : bookcode;
};

const hasActiveFilter = computed(() => {
    const hasRegularFilter = Object.values(filters.value).some((f) => f.value !== null && f.value !== '');
    const hasDateRangeFilter = startDate.value !== null || endDate.value !== null;
    const hasExdocrefDateRangeFilter = exdocrefStartDate.value !== null || exdocrefEndDate.value !== null;
    return hasRegularFilter || hasDateRangeFilter || hasExdocrefDateRangeFilter;
});

// Active filters for display
const activeFilters = computed(() => {
    const active = [];

    // Global search
    if (filters.value.global?.value) {
        active.push({
            label: 'ค้นหาทั่วไป',
            value: filters.value.global.value,
            field: 'global'
        });
    }

    // Document number
    if (filters.value.docno?.value) {
        active.push({
            label: 'เลขที่เอกสาร',
            value: filters.value.docno.value,
            field: 'docno'
        });
    }

    // Document date range
    if (startDate.value || endDate.value) {
        const start = startDate.value ? formatDate(startDate.value) : 'ไม่ระบุ';
        const end = endDate.value ? formatDate(endDate.value) : 'ไม่ระบุ';
        active.push({
            label: 'วันที่เอกสาร',
            value: `${start} - ${end}`,
            field: 'docdate'
        });
    }

    // Journal book
    if (filters.value.bookcode?.value) {
        const bookName = getJournalBookName(filters.value.bookcode.value);
        active.push({
            label: 'สมุดรายวัน',
            value: bookName,
            field: 'bookcode'
        });
    }

    // External doc ref number
    if (filters.value.exdocrefno?.value) {
        active.push({
            label: 'เลขที่เอกสารอ้างอิง',
            value: filters.value.exdocrefno.value,
            field: 'exdocrefno'
        });
    }

    // External doc ref date range
    if (exdocrefStartDate.value || exdocrefEndDate.value) {
        const start = exdocrefStartDate.value ? formatDate(exdocrefStartDate.value) : 'ไม่ระบุ';
        const end = exdocrefEndDate.value ? formatDate(exdocrefEndDate.value) : 'ไม่ระบุ';
        active.push({
            label: 'วันที่เอกสารอ้างอิง',
            value: `${start} - ${end}`,
            field: 'exdocrefdate'
        });
    }

    // Account period
    if (filters.value.accountperiod?.value) {
        active.push({
            label: 'งวด/ปี',
            value: filters.value.accountperiod.value,
            field: 'accountperiod'
        });
    }

    // Contact name
    if (filters.value.contactname?.value) {
        active.push({
            label: 'ชื่อ',
            value: filters.value.contactname.value,
            field: 'contactname'
        });
    }

    // Amount
    if (filters.value.amount?.value) {
        active.push({
            label: 'จำนวนเงิน',
            value: formatCurrency(filters.value.amount.value),
            field: 'amount'
        });
    }

    // Description
    if (filters.value.accountdescription?.value) {
        active.push({
            label: 'คำอธิบาย',
            value: filters.value.accountdescription.value,
            field: 'accountdescription'
        });
    }

    // Created by
    if (filters.value.createdby?.value) {
        active.push({
            label: 'สร้างโดย',
            value: filters.value.createdby.value,
            field: 'createdby'
        });
    }

    return active;
});

// Remove specific filter
const removeFilter = (field) => {
    if (field === 'docdate') {
        startDate.value = null;
        endDate.value = null;
        filters.value.docdate.value = null;
    } else if (field === 'exdocrefdate') {
        exdocrefStartDate.value = null;
        exdocrefEndDate.value = null;
        filters.value.exdocrefdate.value = null;
    } else if (filters.value[field]) {
        filters.value[field].value = null;
    }
};

// Delete dialog title (เปลี่ยนตามว่ามี batchid หรือไม่)
const deleteDialogTitle = computed(() => {
    if (selectedJournal.value?.batchid) {
        return 'ยืนยันการลบรายการบัญชีทั้งหมดจาก Statement';
    }
    return 'ยืนยันการลบรายการบัญชี';
});

// Save state to localStorage
const saveState = () => {
    // Save main state (filters, pagination, sort, dates)
    const state = {
        currentPage: currentPage.value,
        rowsPerPage: rowsPerPage.value,
        sortField: sortField.value,
        sortOrder: sortOrder.value,
        filters: {
            global: filters.value.global.value,
            docno: filters.value.docno.value,
            bookcode: filters.value.bookcode.value,
            exdocrefno: filters.value.exdocrefno.value,
            accountperiod: filters.value.accountperiod.value,
            contactname: filters.value.contactname.value,
            amount: filters.value.amount.value,
            accountdescription: filters.value.accountdescription.value,
            createdby: filters.value.createdby.value
        },
        startDate: startDate.value ? startDate.value.toISOString() : null,
        endDate: endDate.value ? endDate.value.toISOString() : null,
        exdocrefStartDate: exdocrefStartDate.value ? exdocrefStartDate.value.toISOString() : null,
        exdocrefEndDate: exdocrefEndDate.value ? exdocrefEndDate.value.toISOString() : null,
        lastRoute: route.path
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Save selected columns separately (จะไม่โดน reset)
    const columnsState = {
        selectedColumns: selectedColumns.value.map((col) => col.field)
    };
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columnsState));
};

// Load state from localStorage
const loadState = () => {
    try {
        // Load selected columns first (ไม่โดน reset)
        const savedColumns = localStorage.getItem(COLUMNS_STORAGE_KEY);
        if (savedColumns) {
            try {
                const columnsState = JSON.parse(savedColumns);
                if (columnsState.selectedColumns && Array.isArray(columnsState.selectedColumns)) {
                    selectedColumns.value = availableColumns.filter((col) => columnsState.selectedColumns.includes(col.field));
                    console.log('[JournalEntry] Restored selected columns:', columnsState.selectedColumns);
                }
            } catch (error) {
                console.error('Error loading columns state:', error);
            }
        }

        // Load main state
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            console.log('[JournalEntry] No saved state found');
            return false;
        }

        const state = JSON.parse(saved);
        console.log('[JournalEntry] Loaded state:', state);
        console.log('[JournalEntry] Current route:', route.path);
        console.log('[JournalEntry] Last route:', state.lastRoute);

        // ตรวจสอบว่ามาจากหน้า accounting entry เท่านั้น (ไม่รวม entry-from-image, entry-from-statement)
        // เก็บ state เฉพาะ: /accounting/entry (exact) หรือ /accounting/entry/:id (edit page)
        const isFromEntryPages =
            state.lastRoute === '/accounting/entry' || // หน้า list
            (state.lastRoute.startsWith('/accounting/entry/') && state.lastRoute.split('/').length === 4); // หน้า edit: /accounting/entry/:id
        console.log('[JournalEntry] Is from entry pages?', isFromEntryPages);

        if (!isFromEntryPages) {
            // ถ้ามาจาก menu อื่น ให้ clear state (แต่ไม่ clear columns)
            console.log('[JournalEntry] Clearing state - came from different menu');
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }

        console.log('[JournalEntry] Restoring state - came from entry pages');

        // Restore state
        currentPage.value = state.currentPage || 1;
        rowsPerPage.value = state.rowsPerPage || 10;
        sortField.value = state.sortField || 'docdate';
        sortOrder.value = state.sortOrder || -1;

        // Restore filters
        filters.value.global.value = state.filters.global;
        filters.value.docno.value = state.filters.docno;
        filters.value.bookcode.value = state.filters.bookcode;
        filters.value.exdocrefno.value = state.filters.exdocrefno;
        filters.value.accountperiod.value = state.filters.accountperiod;
        filters.value.contactname.value = state.filters.contactname;
        filters.value.amount.value = state.filters.amount;
        filters.value.accountdescription.value = state.filters.accountdescription;
        filters.value.createdby.value = state.filters.createdby;

        // Restore date range filters
        startDate.value = state.startDate ? new Date(state.startDate) : null;
        endDate.value = state.endDate ? new Date(state.endDate) : null;

        // Restore exdocrefdate range filters
        exdocrefStartDate.value = state.exdocrefStartDate ? new Date(state.exdocrefStartDate) : null;
        exdocrefEndDate.value = state.exdocrefEndDate ? new Date(state.exdocrefEndDate) : null;

        return true;
    } catch (error) {
        console.error('Error loading state:', error);
        localStorage.removeItem(STORAGE_KEY);
        return false;
    }
};

const goBack = () => {
    router.push({ name: 'dashboard' });
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

// Save state when filters, pagination, sort, or selected columns changes
watch(
    [filters, currentPage, rowsPerPage, sortField, sortOrder, startDate, endDate, exdocrefStartDate, exdocrefEndDate, selectedColumns],
    () => {
        saveState();
    },
    { deep: true }
);

// Track navigation - update lastRoute when leaving this page
onBeforeRouteLeave((to) => {
    // อัพเดท lastRoute ใน localStorage ให้เป็นหน้าปลายทางที่กำลังจะไป
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            state.lastRoute = to.path;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            console.log('[JournalEntry] Updated lastRoute to:', to.path);
        } catch (error) {
            console.error('Error updating lastRoute:', error);
        }
    }
});

// Save state before leaving the page
onBeforeUnmount(() => {
    saveState();
});

onMounted(async () => {
    // Load journal books
    await searchJournalBooks({ query: '' });

    // Load saved state
    loadState();

    // Fetch ทุกกรณี (ไม่ว่าจะมี state หรือไม่)
    await fetchJournals();
});
</script>

<template>
    <div>
        <Toast />

        <div class="card">
            <!-- Header with Actions -->
            <div class="flex justify-between items-center mb-5">
                <div class="flex items-center gap-3">
                    <div class="text-2xl font-bold m-0 text-surface-900 dark:text-surface-0">บันทึกรายการบัญชี</div>
                </div>
                <Button label="เพิ่มรายการ" icon="pi pi-plus" @click="handleCreate" />
            </div>

            <!-- DataTable with Advanced Features -->
            <DataTable
                v-model:filters="filters"
                v-model:expandedRows="expandedRows"
                v-model:selection="selectedJournal"
                :value="journals"
                :loading="loading"
                :lazy="true"
                :paginator="true"
                :first="first"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :rowsPerPageOptions="[10, 25, 50]"
                filterDisplay="menu"
                :globalFilterFields="['docno', 'accountdescription', 'debtorname', 'createdby']"
                dataKey="guidfixed"
                :rowHover="true"
                sortMode="single"
                :sortField="sortField"
                :sortOrder="sortOrder"
                @page="onPage"
                @sort="onSort"
                @row-dblclick="onRowDblClick"
                showGridlines
                scrollable
                scrollHeight="calc(100vh - 325px)"
                class="journal-table"
            >
                <!-- Header with Global Search -->
                <template #header>
                    <div class="flex flex-col gap-3">
                        <div class="flex justify-between flex-wrap gap-3">
                            <div class="flex gap-2">
                                <Button type="button" icon="pi pi-plus" label="Expand All" text @click="expandAll" />
                                <Button type="button" icon="pi pi-minus" label="Collapse All" text @click="collapseAll" />
                                <MultiSelect v-model="selectedColumns" :options="availableColumns" optionLabel="header" placeholder="เลือกคอลัมน์" :maxSelectedLabels="2" />
                            </div>
                            <div class="flex gap-2">
                                <Button type="button" icon="pi pi-refresh" label="รีเฟรช" outlined @click="fetchJournals" :loading="loading" />
                                <Button type="button" icon="pi pi-filter-slash" label="ล้างตัวกรอง" outlined @click="clearFilters" :disabled="!hasActiveFilter" />
                            </div>
                        </div>

                        <!-- Active Filters Indicator -->
                        <div v-if="hasActiveFilter" class="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                            <div class="flex items-start gap-3">
                                <i class="pi pi-filter text-primary-600 dark:text-primary-400 text-lg mt-0.5"></i>
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-sm font-semibold text-primary-900 dark:text-primary-100"> กำลังกรองข้อมูล ({{ activeFilters.length }} เงื่อนไข) • พบ {{ totalRecords.toLocaleString() }} รายการ </span>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Chip
                                            v-for="filter in activeFilters"
                                            :key="filter.field"
                                            :label="`${filter.label}: ${filter.value}`"
                                            removable
                                            @remove="removeFilter(filter.field)"
                                            class="bg-primary-100 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <template #empty>
                    <div class="text-center py-12">
                        <i class="pi pi-inbox text-6xl text-surface-300 dark:text-surface-600 mb-4 block"></i>
                        <p class="text-xl text-surface-500 dark:text-surface-400 font-semibold mb-2">ไม่พบข้อมูลรายการบัญชี</p>
                        <p class="text-surface-400 dark:text-surface-500 text-sm">ลองปรับเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-12">Loading journals data. Please wait.</div>
                </template>

                <!-- Expander Column -->
                <Column expander style="width: 3rem" />

                <!-- Document Date -->
                <Column v-if="isColumnVisible('docdate')" field="docdate" header="วันที่" sortable dataType="date" style="min-width: 10rem" :showFilterMatchModes="false" :showApplyButton="true" :showClearButton="true">
                    <template #body="{ data }">
                        {{ formatDate(data.docdate) }}
                    </template>
                    <template #filter="{ filterModel }">
                        <div class="flex flex-col gap-2">
                            <ThaiDatePicker v-model="startDate" dateFormat="dd/mm/yy" placeholder="วันที่เริ่มต้น" @update:modelValue="filterModel.value = startDate" />
                            <ThaiDatePicker v-model="endDate" dateFormat="dd/mm/yy" placeholder="วันที่สิ้นสุด (ถ้ามี)" @update:modelValue="filterModel.value = startDate" />
                        </div>
                    </template>
                </Column>

                <!-- Document Number -->
                <Column v-if="isColumnVisible('docno')" field="docno" header="เลขที่เอกสาร" sortable style="min-width: 12rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="font-semibold text-primary-600 dark:text-primary-400">{{ data.docno }}</div>
                            <Tag v-if="data.batchid" value="Statement" severity="info" class="text-xs" icon="pi pi-file-pdf" />
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาเลขที่..." />
                    </template>
                </Column>

                <!-- Journal Book (Book Code) -->
                <Column v-if="isColumnVisible('bookcode')" field="bookcode" header="สมุดรายวัน" sortable style="min-width: 14rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div v-tooltip.top="getJournalBookName(data.bookcode)" class="truncate text-surface-700 dark:text-surface-300">
                            {{ getJournalBookName(data.bookcode) }}
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <AutoComplete
                            :modelValue="filterModel.value"
                            @update:modelValue="filterModel.value = $event?.code || $event"
                            :suggestions="journalBooks"
                            optionLabel="displayLabel"
                            :loading="journalBooksLoading"
                            @complete="searchJournalBooks"
                            placeholder="ค้นหาสมุด..."
                            dropdown
                            showClear
                            forceSelection
                            fluid
                        >
                            <template #option="{ option }">
                                <div>{{ option.displayLabel }}</div>
                            </template>
                        </AutoComplete>
                    </template>
                </Column>

                <!-- External Document Reference Number -->
                <Column v-if="isColumnVisible('exdocrefno')" field="exdocrefno" header="เลขที่เอกสารอ้างอิง" sortable style="min-width: 12rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="text-surface-700 dark:text-surface-300">{{ data.exdocrefno || '-' }}</div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาเลขที่อ้างอิง..." />
                    </template>
                </Column>

                <!-- External Document Reference Date -->
                <Column v-if="isColumnVisible('exdocrefdate')" field="exdocrefdate" header="วันที่เอกสารอ้างอิง" sortable dataType="date" style="min-width: 10rem" :showFilterMatchModes="false" :showApplyButton="true" :showClearButton="true">
                    <template #body="{ data }">
                        {{ formatDate(data.exdocrefdate) }}
                    </template>
                    <template #filter="{ filterModel }">
                        <div class="flex flex-col gap-2">
                            <ThaiDatePicker v-model="exdocrefStartDate" dateFormat="dd/mm/yy" placeholder="วันที่เริ่มต้น" @update:modelValue="filterModel.value = exdocrefStartDate" />
                            <ThaiDatePicker v-model="exdocrefEndDate" dateFormat="dd/mm/yy" placeholder="วันที่สิ้นสุด (ถ้ามี)" @update:modelValue="filterModel.value = exdocrefStartDate" />
                        </div>
                    </template>
                </Column>

                <!-- Account Period -->
                <Column v-if="isColumnVisible('accountperiod')" field="accountperiod" header="งวด/ปี" sortable style="min-width: 8rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <Tag :value="`${data.accountperiod}/${data.accountyear}`" severity="secondary" />
                    </template>
                    <template #filter="{ filterModel }">
                        <InputNumber v-model="filterModel.value" placeholder="งวด" />
                    </template>
                </Column>

                <!-- Contact Name (ชื่อลูกหนี้/เจ้าหนี้) - ซ่อนไว้ชั่วคราว
                <Column v-if="isColumnVisible('contactname')" field="contactname" header="ชื่อ" style="min-width: 12rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div v-tooltip.top="getContactName(data)" class="truncate">
                            {{ getContactName(data) }}
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาชื่อ..." />
                    </template>
                </Column>
                -->

                <!-- Amount -->
                <Column v-if="isColumnVisible('amount')" field="amount" header="จำนวนเงิน" sortable dataType="numeric" style="min-width: 10rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="text-right font-semibold text-green-600 dark:text-green-400">
                            {{ formatCurrency(data.amount) }}
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputNumber v-model="filterModel.value" mode="decimal" :minFractionDigits="2" placeholder="จำนวนเงิน" />
                    </template>
                </Column>

                <!-- Description -->
                <Column v-if="isColumnVisible('accountdescription')" field="accountdescription" header="คำอธิบาย" style="min-width: 14rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div v-tooltip.top="data.accountdescription" class="truncate">
                            {{ data.accountdescription || '-' }}
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาคำอธิบาย..." />
                    </template>
                </Column>

                <!-- Created By -->
                <Column v-if="isColumnVisible('createdby')" field="createdby" header="ผู้สร้าง" sortable style="min-width: 10rem" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="text-sm">
                            <div v-tooltip.top="data.createdby" class="text-surface-900 dark:text-surface-0 truncate">{{ data.createdby }}</div>
                            <div class="text-xs text-surface-500 dark:text-surface-400">{{ formatDate(data.createdat) }}</div>
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาผู้สร้าง..." />
                    </template>
                </Column>

                <!-- Actions Column with Overlay Menu -->
                <Column header="จัดการ" style="width: 5rem">
                    <template #body="{ data }">
                        <div class="flex justify-center">
                            <Button icon="pi pi-ellipsis-v" text rounded @click="toggleMenu($event, data)" v-tooltip.top="'ตัวเลือก'" />
                        </div>
                    </template>
                </Column>

                <!-- Expansion Template -->
                <template #expansion="slotProps">
                    <div class="p-5">
                        <div class="mb-4">รายละเอียดบัญชี - {{ slotProps.data.docno }}</div>
                        <DataTable v-if="slotProps.data.journaldetail && slotProps.data.journaldetail.length > 0" :value="slotProps.data.journaldetail" size="small">
                            <Column field="accountcode" header="รหัสบัญชี" :style="{ width: '150px' }">
                                <template #body="slotProps">
                                    <span class="font-semibold">{{ slotProps.data.accountcode }}</span>
                                </template>
                            </Column>
                            <Column field="accountname" header="ชื่อบัญชี"></Column>
                            <Column field="debitamount" header="เดบิต" :style="{ width: '150px' }">
                                <template #body="slotProps">
                                    <div class="text-right">
                                        <span v-if="slotProps.data.debitamount > 0" class="font-semibold text-primary-600 dark:text-primary-400">
                                            {{ formatCurrency(slotProps.data.debitamount) }}
                                        </span>
                                        <span v-else class="text-surface-400 dark:text-surface-500">-</span>
                                    </div>
                                </template>
                            </Column>
                            <Column field="creditamount" header="เครดิต" :style="{ width: '150px' }">
                                <template #body="slotProps">
                                    <div class="text-right">
                                        <span v-if="slotProps.data.creditamount > 0" class="font-semibold text-slate-600 dark:text-slate-400">
                                            {{ formatCurrency(slotProps.data.creditamount) }}
                                        </span>
                                        <span v-else class="text-surface-400 dark:text-surface-500">-</span>
                                    </div>
                                </template>
                            </Column>
                            <template #footer>
                                <div class="flex justify-end gap-8 font-bold">
                                    <div class="text-primary-700 dark:text-primary-400">รวมเดบิต: {{ formatCurrency(getTotalDebit(slotProps.data)) }}</div>
                                    <div class="text-slate-700 dark:text-slate-400">รวมเครดิต: {{ formatCurrency(getTotalCredit(slotProps.data)) }}</div>
                                </div>
                            </template>
                        </DataTable>
                        <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
                            <i class="pi pi-info-circle text-3xl mb-2 block"></i>
                            <p class="m-0">ไม่มีรายละเอียดบัญชี</p>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>

    <!-- Detail Dialog -->
    <JournalDetailDialog v-model:visible="detailDialogVisible" :journal="selectedDetailJournal" />

    <!-- Delete Dialog -->
    <DialogApprove
        :confirm-dialog="deleteDialogVisible"
        :random-number="randomNumber"
        :loading="deleting"
        :title="deleteDialogTitle"
        mode="delete"
        @close="deleteDialogVisible = false"
        @confirm-job="confirmDelete"
        @confirm-job-false="confirmDeleteFalse"
    />

    <!-- Overlay Menu -->
    <Menu ref="menu" :model="menuItems" :popup="true" />
</template>

<style scoped>
/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
