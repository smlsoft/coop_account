<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ข้อมูลรายได้อื่น ๆ
const incomes = ref([]);

// Pagination
const totalRecords = ref(0);
const currentPage = ref(1);
const rowsPerPage = ref(20);

// Search & Filter
const searchQuery = ref('');

// Loading states
const isLoading = ref(false);

// Dialog confirmation
const showDeleteDialog = ref(false);
const incomeToDelete = ref(null);

/**
 * ดึงข้อมูลรายได้อื่น ๆ
 */
const fetchIncomes = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'code:1'
        };

        const response = await api.getMasterIncomes(params);

        if (response.success) {
            incomes.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching incomes:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * จัดการเมื่อเปลี่ยนหน้า
 */
const onPageChange = (event) => {
    const page = event.page + 1;
    rowsPerPage.value = event.rows;
    fetchIncomes(page);
};

/**
 * ค้นหารายได้อื่น ๆ
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchIncomes(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มรายได้อื่น ๆ
 */
const openCreateDialog = () => {
    router.push({ name: 'other-income-create' });
};

/**
 * แก้ไขรายได้อื่น ๆ
 */
const editIncome = (income) => {
    router.push({ name: 'other-income-edit', params: { id: income.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบรายได้อื่น ๆ
 */
const confirmDelete = (income) => {
    incomeToDelete.value = income;
    showDeleteDialog.value = true;
};

/**
 * ลบรายได้อื่น ๆ
 */
const deleteIncome = async () => {
    showDeleteDialog.value = false;

    if (!incomeToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteMasterIncome(incomeToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบรายได้อื่น ๆ เรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchIncomes(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting income:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        incomeToDelete.value = null;
    }
};

/**
 * ดึงชื่อรายได้จาก names array
 */
const getIncomeName = (names) => {
    if (!names || !Array.isArray(names)) return '-';
    const thName = names.find((n) => n.code === 'th');
    return thName?.name || names[0]?.name || '-';
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchIncomes();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดรายได้อื่น ๆ</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการรายได้อื่น ๆ ของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มรายได้อื่น ๆ" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสหรือชื่อรายได้..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="incomes"
                :loading="isLoading"
                :paginator="true"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :lazy="true"
                @page="onPageChange"
                :rowsPerPageOptions="[20, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                class="w-full"
                responsiveLayout="scroll"
                stripedRows
                dataKey="guidfixed"
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายได้อื่น ๆ</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="code" header="รหัสรายได้" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column header="ชื่อรายได้" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ getIncomeName(data.names) }}</span>
                    </template>
                </Column>

                <Column field="accountcode" header="รหัสบัญชี" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.accountcode || '-' }}</span>
                    </template>
                </Column>

                <Column field="accountname" header="ชื่อบัญชี" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.accountname || '-' }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editIncome(data)" />
                            <Button icon="pi pi-trash" outlined rounded severity="danger" v-tooltip.top="'ลบ'" @click="confirmDelete(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>

    <!-- Confirm Delete Dialog -->
    <DialogForm
        :confirmDialog="showDeleteDialog"
        :textContent="incomeToDelete ? `คุณต้องการลบรายได้อื่น ๆ '${incomeToDelete.code} - ${getIncomeName(incomeToDelete.names)}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteIncome"
    />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
