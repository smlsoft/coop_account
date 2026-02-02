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

// ข้อมูลค่าใช้จ่ายอื่น ๆ
const expenses = ref([]);

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
const expenseToDelete = ref(null);

/**
 * ดึงข้อมูลค่าใช้จ่ายอื่น ๆ
 */
const fetchExpenses = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'code:1'
        };

        const response = await api.getMasterExpenses(params);

        if (response.success) {
            expenses.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching expenses:', error);
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
    fetchExpenses(page);
};

/**
 * ค้นหาค่าใช้จ่ายอื่น ๆ
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchExpenses(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มค่าใช้จ่ายอื่น ๆ
 */
const openCreateDialog = () => {
    router.push({ name: 'other-expense-create' });
};

/**
 * แก้ไขค่าใช้จ่ายอื่น ๆ
 */
const editExpense = (expense) => {
    router.push({ name: 'other-expense-edit', params: { id: expense.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบค่าใช้จ่ายอื่น ๆ
 */
const confirmDelete = (expense) => {
    expenseToDelete.value = expense;
    showDeleteDialog.value = true;
};

/**
 * ลบค่าใช้จ่ายอื่น ๆ
 */
const deleteExpense = async () => {
    showDeleteDialog.value = false;

    if (!expenseToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteMasterExpense(expenseToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบค่าใช้จ่ายอื่น ๆ เรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchExpenses(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        expenseToDelete.value = null;
    }
};

/**
 * ดึงชื่อค่าใช้จ่ายจาก names array
 */
const getExpenseName = (names) => {
    if (!names || !Array.isArray(names)) return '-';
    const thName = names.find((n) => n.code === 'th');
    return thName?.name || names[0]?.name || '-';
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchExpenses();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดค่าใช้จ่ายอื่น ๆ</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการค่าใช้จ่ายอื่น ๆ ของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มค่าใช้จ่ายอื่น ๆ" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสหรือชื่อค่าใช้จ่าย..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="expenses"
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
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลค่าใช้จ่ายอื่น ๆ</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="code" header="รหัสค่าใช้จ่าย" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column header="ชื่อค่าใช้จ่าย" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ getExpenseName(data.names) }}</span>
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
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editExpense(data)" />
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
        :textContent="expenseToDelete ? `คุณต้องการลบค่าใช้จ่ายอื่น ๆ '${expenseToDelete.code} - ${getExpenseName(expenseToDelete.names)}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteExpense"
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
