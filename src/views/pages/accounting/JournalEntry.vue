<script setup>
import DialogApprove from '@/components/DialogApprove.vue';
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { deleteJournalEntry, getJournalEntries } from '@/services/api/journal';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();

// LocalStorage key
const STORAGE_KEY = 'journal-entry-state';

const journals = ref([]);
const loading = ref(false);
const selectedJournal = ref(null);
const deleteDialogVisible = ref(false);
const deleting = ref(false);
const randomNumber = ref(0);
const expandedRows = ref([]);
const detailDialogVisible = ref(false);
const selectedDetailJournal = ref(null);

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
    docdate: { value: null, matchMode: FilterMatchMode.DATE_IS },
    accountperiod: { value: null, matchMode: FilterMatchMode.EQUALS },
    contactname: { value: null, matchMode: FilterMatchMode.CONTAINS },
    amount: { value: null, matchMode: FilterMatchMode.EQUALS },
    accountdescription: { value: null, matchMode: FilterMatchMode.CONTAINS },
    createdby: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// Debounce timeout
const filterTimeout = ref(null);

// Current sort
const sortField = ref('docdate');
const sortOrder = ref(-1);

// Column visibility
const availableColumns = [
    { field: 'docno', header: 'เลขที่เอกสาร', visible: true },
    { field: 'docdate', header: 'วันที่เอกสาร', visible: true },
    { field: 'accountperiod', header: 'งวด/ปี', visible: true },
    { field: 'contactname', header: 'ชื่อ', visible: true },
    { field: 'amount', header: 'จำนวนเงิน', visible: true },
    { field: 'accountdescription', header: 'คำอธิบาย', visible: true },
    { field: 'createdby', header: 'สร้างโดย', visible: true }
];
const selectedColumns = ref(availableColumns.filter((col) => col.field !== 'accountperiod'));
const isColumnVisible = (field) => selectedColumns.value.some((col) => col.field === field);

// Watch filters with debounce
watch(
    filters,
    () => {
        if (filterTimeout.value) {
            clearTimeout(filterTimeout.value);
        }
        filterTimeout.value = setTimeout(() => {
            currentPage.value = 1; // Reset to first page when filter changes
            fetchJournals();
        }, 800);
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

        // Add active filters (exclude global)
        Object.entries(filters.value).forEach(([key, filter]) => {
            if (key !== 'global' && filter.value !== null && filter.value !== '') {
                // Special handling for contactname - send to both creditorname and debtorname
                if (key === 'contactname') {
                    params.creditorname = filter.value;
                    params.debtorname = filter.value;
                }
                // Format date to yyyy-MM-dd
                else if (filter.value instanceof Date) {
                    const year = filter.value.getFullYear();
                    const month = String(filter.value.getMonth() + 1).padStart(2, '0');
                    const day = String(filter.value.getDate()).padStart(2, '0');
                    params[key] = `${year}-${month}-${day}`;
                } else {
                    params[key] = filter.value;
                }
            }
        });

        const response = await getJournalEntries(params);

        if (response.data.success) {
            // Convert date strings to Date objects for proper filtering
            journals.value = response.data.data.map((journal) => ({
                ...journal,
                docdate: journal.docdate ? new Date(journal.docdate) : null
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
        const response = await deleteJournalEntry(selectedJournal.value.guidfixed);

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบรายการบัญชีเรียบร้อยแล้ว',
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
        accountperiod: { value: null, matchMode: FilterMatchMode.EQUALS },
        amount: { value: null, matchMode: FilterMatchMode.EQUALS },
        accountdescription: { value: null, matchMode: FilterMatchMode.CONTAINS },
        createdby: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
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
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
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

const hasActiveFilter = computed(() => {
    return Object.values(filters.value).some((f) => f.value !== null && f.value !== '');
});

// Save state to localStorage
const saveState = () => {
    const state = {
        currentPage: currentPage.value,
        rowsPerPage: rowsPerPage.value,
        sortField: sortField.value,
        sortOrder: sortOrder.value,
        filters: {
            global: filters.value.global.value,
            docno: filters.value.docno.value,
            docdate: filters.value.docdate.value ? filters.value.docdate.value.toISOString() : null,
            accountperiod: filters.value.accountperiod.value,
            amount: filters.value.amount.value,
            accountdescription: filters.value.accountdescription.value,
            createdby: filters.value.createdby.value
        },
        lastRoute: route.path
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// Load state from localStorage
const loadState = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;

        const state = JSON.parse(saved);

        // ตรวจสอบว่ามาจากหน้า accounting pages เท่านั้น (entry หรือ form)
        const isFromAccountingPages = state.lastRoute && (state.lastRoute.startsWith('/accounting/entry') || state.lastRoute.startsWith('/accounting/form'));

        if (!isFromAccountingPages) {
            // ถ้ามาจาก menu อื่น ให้ clear state
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }

        // Restore state
        currentPage.value = state.currentPage || 1;
        rowsPerPage.value = state.rowsPerPage || 10;
        sortField.value = state.sortField || 'docdate';
        sortOrder.value = state.sortOrder || -1;

        // Restore filters (รวม Date object)
        filters.value.global.value = state.filters.global;
        filters.value.docno.value = state.filters.docno;
        filters.value.docdate.value = state.filters.docdate ? new Date(state.filters.docdate) : null;
        filters.value.accountperiod.value = state.filters.accountperiod;
        filters.value.amount.value = state.filters.amount;
        filters.value.accountdescription.value = state.filters.accountdescription;
        filters.value.createdby.value = state.filters.createdby;

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

// Save state when filters, pagination, or sort changes
watch(
    [filters, currentPage, rowsPerPage, sortField, sortOrder],
    () => {
        saveState();
    },
    { deep: true }
);

// Save state before leaving the page
onBeforeUnmount(() => {
    saveState();
});

onMounted(async () => {
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
                <Button label="เพิ่มรายการ" icon="pi pi-plus" @click="handleCreate" severity="success" />
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
                showGridlines
                class="journal-table"
            >
                <!-- Header with Global Search -->
                <template #header>
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
                <Column expander style="width: 50px" />

                <!-- Document Date -->
                <Column v-if="isColumnVisible('docdate')" field="docdate" header="วันที่" sortable dataType="date" style="width: 120px" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        {{ formatDate(data.docdate) }}
                    </template>
                    <template #filter="{ filterModel }">
                        <ThaiDatePicker v-model="filterModel.value" dateFormat="dd/mm/yy" placeholder="เลือกวันที่" />
                    </template>
                </Column>

                <!-- Document Number -->
                <Column v-if="isColumnVisible('docno')" field="docno" header="เลขที่เอกสาร" sortable style="width: 150px" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="font-semibold text-primary-600 dark:text-primary-400">{{ data.docno }}</div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาเลขที่..." />
                    </template>
                </Column>

                <!-- Account Period -->
                <Column v-if="isColumnVisible('accountperiod')" field="accountperiod" header="งวด/ปี" sortable style="width: 100px" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <Tag :value="`${data.accountperiod}/${data.accountyear}`" severity="secondary" />
                    </template>
                    <template #filter="{ filterModel }">
                        <InputNumber v-model="filterModel.value" placeholder="งวด" />
                    </template>
                </Column>

                <!-- Contact Name (ชื่อลูกหนี้/เจ้าหนี้) -->
                <Column v-if="isColumnVisible('contactname')" field="contactname" header="ชื่อ" style="width: 180px" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div v-tooltip.top="getContactName(data)" class="truncate">
                            {{ getContactName(data) }}
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาชื่อ..." />
                    </template>
                </Column>

                <!-- Amount -->
                <Column v-if="isColumnVisible('amount')" field="amount" header="จำนวนเงิน" sortable dataType="numeric" style="width: 130px" :showFilterMatchModes="false">
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
                <Column v-if="isColumnVisible('accountdescription')" field="accountdescription" header="คำอธิบาย" style="width: 200px" :showFilterMatchModes="false">
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
                <Column v-if="isColumnVisible('createdby')" field="createdby" header="ผู้สร้าง" sortable style="width: 150px" :showFilterMatchModes="false">
                    <template #body="{ data }">
                        <div class="text-sm">
                            <div class="text-surface-900 dark:text-surface-0 truncate">{{ data.createdby }}</div>
                            <div class="text-xs text-surface-500 dark:text-surface-400">{{ formatDate(data.createdat) }}</div>
                        </div>
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="ค้นหาผู้สร้าง..." />
                    </template>
                </Column>

                <!-- Actions Column -->
                <Column header="จัดการ" style="width: 130px" frozen alignFrozen="right">
                    <template #body="{ data }">
                        <div class="flex gap-1 justify-end">
                            <Button icon="pi pi-eye" severity="info" text rounded @click="viewDetail(data)" v-tooltip.top="'ดูรายละเอียด'" />
                            <Button icon="pi pi-pencil" severity="secondary" text rounded @click="handleEdit(data)" v-tooltip.top="'แก้ไข'" />
                            <Button icon="pi pi-trash" severity="danger" text rounded @click="openDeleteDialog(data)" v-tooltip.top="'ลบ'" />
                        </div>
                    </template>
                </Column>

                <!-- Expansion Template -->
                <template #expansion="slotProps">
                    <div class="p-5">
                        <h5 class="mb-4">รายละเอียดบัญชี - {{ slotProps.data.docno }}</h5>
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
        title="ยืนยันการลบรายการบัญชี"
        mode="delete"
        @close="deleteDialogVisible = false"
        @confirm-job="confirmDelete"
        @confirm-job-false="confirmDeleteFalse"
    />
</template>

<style scoped></style>
