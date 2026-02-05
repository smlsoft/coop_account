<script setup>
import DialogApprove from '@/components/DialogApprove.vue';
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import { deleteJournalEntry, getJournalEntries } from '@/services/api/journal';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    duplicateDocnos: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'refresh']);

const router = useRouter();
const toast = useToast();

// State
const selectedDocno = ref(null);
const journals = ref([]);
const loadingJournals = ref(false);
const selectedJournal = ref(null);

// Detail dialog
const detailDialogVisible = ref(false);
const selectedDetailJournal = ref(null);

// Delete dialog
const deleteDialogVisible = ref(false);
const deleting = ref(false);
const randomNumber = ref(0);

// Computed
const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

// Watch for docno selection
watch(selectedDocno, async (docno) => {
    if (docno) {
        await fetchJournalsByDocno(docno);
    } else {
        journals.value = [];
    }
});

// Reset state when dialog closes
watch(
    () => props.visible,
    (visible) => {
        if (!visible) {
            selectedDocno.value = null;
            journals.value = [];
            selectedJournal.value = null;
        }
    }
);

// Fetch journals by docno
const fetchJournalsByDocno = async (docno) => {
    loadingJournals.value = true;
    try {
        const response = await getJournalEntries({
            docno: docno,
            limit: 1000,
            page: 1,
            sort: 'docdate:1'
        });

        if (response.data.success) {
            journals.value = response.data.data.map((journal) => ({
                ...journal,
                docdate: journal.docdate ? new Date(journal.docdate) : null
            }));
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
        loadingJournals.value = false;
    }
};

// Format functions
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

// Actions
const viewDetail = (journal) => {
    selectedDetailJournal.value = journal;
    detailDialogVisible.value = true;
};

const handleEdit = (journal) => {
    // เปิดหน้าแก้ไขใน tab ใหม่ แทนการ navigate ในหน้าเดิม
    const route = router.resolve({ name: 'journal-edit', params: { id: journal.guidfixed } });
    window.open(route.href, '_blank');
};

const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

const openDeleteDialog = (journal) => {
    selectedJournal.value = journal;
    randomNumber.value = generateRandomNumber();
    deleteDialogVisible.value = true;
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
            await fetchJournalsByDocno(selectedDocno.value);

            // If only one journal left, refresh the duplicate list
            if (journals.value.length <= 1) {
                emit('refresh');
            }
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
</script>

<template>
    <Dialog v-model:visible="dialogVisible" :modal="true" :dismissableMask="true" header="รายการเลขที่เอกสารซ้ำ" :style="{ width: '95vw', maxWidth: '1400px' }" :breakpoints="{ '960px': '95vw' }">
        <div class="flex gap-4" style="min-height: 500px">
            <!-- Left Panel: Duplicate Docno List -->
            <div class="w-80 border-r border-surface-200 dark:border-surface-700 pr-4">
                <div class="mb-4">
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-2">เลขที่เอกสารซ้ำ</h3>
                    <p class="text-sm text-surface-500">พบ {{ duplicateDocnos.length }} รายการ</p>
                </div>

                <div class="space-y-2 max-h-[400px] overflow-y-auto">
                    <div
                        v-for="item in duplicateDocnos"
                        :key="item.docno"
                        class="p-3 rounded-lg cursor-pointer border transition-colors"
                        :class="selectedDocno === item.docno ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500' : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700'"
                        @click="selectedDocno = item.docno"
                    >
                        <div class="flex justify-between items-center">
                            <div class="font-semibold text-primary-600 dark:text-primary-400">{{ item.docno }}</div>
                            <Badge :value="item.count" severity="danger" />
                        </div>
                    </div>
                </div>

                <div v-if="duplicateDocnos.length === 0" class="text-center py-8 text-surface-500">
                    <i class="pi pi-check-circle text-4xl text-green-500 mb-2 block"></i>
                    <p>ไม่มีเอกสารซ้ำ</p>
                </div>
            </div>

            <!-- Right Panel: Journal List -->
            <div class="flex-1">
                <div v-if="!selectedDocno" class="flex flex-col items-center justify-center h-full text-surface-400">
                    <i class="pi pi-arrow-left text-4xl mb-4"></i>
                    <p class="text-lg">เลือกเลขที่เอกสารจากด้านซ้าย</p>
                </div>

                <div v-else>
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">รายการบัญชี - {{ selectedDocno }}</h3>
                            <p class="text-sm text-surface-500">พบ {{ journals.length }} รายการ</p>
                        </div>
                        <Button icon="pi pi-refresh" label="รีเฟรช" severity="secondary" outlined size="small" :loading="loadingJournals" @click="fetchJournalsByDocno(selectedDocno)" />
                    </div>

                    <DataTable :value="journals" :loading="loadingJournals" dataKey="guidfixed" :rowHover="true" showGridlines class="text-sm">
                        <template #empty>
                            <div class="text-center py-8">
                                <i class="pi pi-inbox text-4xl text-surface-300 dark:text-surface-600 mb-2 block"></i>
                                <p class="text-surface-500">ไม่พบข้อมูล</p>
                            </div>
                        </template>

                        <template #loading>
                            <div class="text-center py-8">
                                <ProgressSpinner style="width: 40px; height: 40px" />
                                <p class="mt-2 text-surface-500">กำลังโหลด...</p>
                            </div>
                        </template>

                        <!-- Document Date -->
                        <Column field="docdate" header="วันที่" style="width: 120px">
                            <template #body="{ data }">
                                {{ formatDate(data.docdate) }}
                            </template>
                        </Column>

                        <!-- Document Number -->
                        <Column field="docno" header="เลขที่เอกสาร" style="width: 150px">
                            <template #body="{ data }">
                                <div class="font-semibold text-primary-600 dark:text-primary-400">{{ data.docno }}</div>
                            </template>
                        </Column>

                        <!-- Account Period -->
                        <Column field="accountperiod" header="งวด/ปี" style="width: 100px">
                            <template #body="{ data }">
                                <Tag :value="`${data.accountperiod}/${data.accountyear}`" severity="secondary" />
                            </template>
                        </Column>

                        <!-- Contact Name -->
                        <Column header="ชื่อ" style="width: 180px">
                            <template #body="{ data }">
                                <div v-tooltip.top="getContactName(data)" class="truncate">
                                    {{ getContactName(data) }}
                                </div>
                            </template>
                        </Column>

                        <!-- Amount -->
                        <Column field="amount" header="จำนวนเงิน" style="width: 130px">
                            <template #body="{ data }">
                                <div class="text-right font-semibold text-green-600 dark:text-green-400">
                                    {{ formatCurrency(data.amount) }}
                                </div>
                            </template>
                        </Column>

                        <!-- Description -->
                        <Column field="accountdescription" header="คำอธิบาย" style="min-width: 150px">
                            <template #body="{ data }">
                                <div v-tooltip.top="data.accountdescription" class="truncate">
                                    {{ data.accountdescription || '-' }}
                                </div>
                            </template>
                        </Column>

                        <!-- Created By -->
                        <Column field="createdby" header="ผู้สร้าง" style="width: 120px">
                            <template #body="{ data }">
                                <div class="text-sm">
                                    <div class="truncate">{{ data.createdby }}</div>
                                    <div class="text-xs text-surface-500">{{ formatDate(data.createdat) }}</div>
                                </div>
                            </template>
                        </Column>

                        <!-- Actions -->
                        <Column header="จัดการ" style="width: 130px" frozen alignFrozen="right">
                            <template #body="{ data }">
                                <div class="flex gap-1 justify-end">
                                    <Button icon="pi pi-eye" severity="info" text rounded size="small" @click="viewDetail(data)" v-tooltip.top="'ดูรายละเอียด'" />
                                    <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="handleEdit(data)" v-tooltip.top="'แก้ไข'" />
                                    <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="openDeleteDialog(data)" v-tooltip.top="'ลบ'" />
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </div>
    </Dialog>

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
