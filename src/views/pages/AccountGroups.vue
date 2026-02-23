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

// ข้อมูลกลุ่มบัญชี
const accountGroups = ref([]);
const selectedAccountGroups = ref([]);

// Pagination
const totalRecords = ref(0);
const currentPage = ref(1);
const rowsPerPage = ref(10);

// Search & Filter
const searchQuery = ref('');

// Loading states
const isLoading = ref(false);

// Dialog confirmation
const showDeleteDialog = ref(false);
const accountGroupToDelete = ref(null);

/**
 * ดึงข้อมูลกลุ่มบัญชี
 */
const fetchAccountGroups = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'code:1'
        };

        const response = await api.getAccountGroups(params);

        if (response.success) {
            accountGroups.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching account groups:', error);
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
    fetchAccountGroups(page);
};

/**
 * ค้นหากลุ่มบัญชี
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchAccountGroups(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มกลุ่มบัญชี
 */
const openCreateDialog = () => {
    router.push({ name: 'account-group-create' });
};

/**
 * แก้ไขกลุ่มบัญชี
 */
const editAccountGroup = (accountGroup) => {
    router.push({ name: 'account-group-edit', params: { id: accountGroup.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบกลุ่มบัญชี
 */
const confirmDelete = (accountGroup) => {
    accountGroupToDelete.value = accountGroup;
    showDeleteDialog.value = true;
};

/**
 * ลบกลุ่มบัญชี
 */
const deleteAccountGroup = async () => {
    showDeleteDialog.value = false;

    if (!accountGroupToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteAccountGroup(accountGroupToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบกลุ่มบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchAccountGroups(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting account group:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        accountGroupToDelete.value = null;
    }
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchAccountGroups();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กลุ่มบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการกลุ่มบัญชีของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มกลุ่มบัญชี" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสหรือชื่อกลุ่มบัญชี..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="accountGroups"
                :loading="isLoading"
                :paginator="true"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :lazy="true"
                @page="onPageChange"
                @row-dblclick="editAccountGroup($event.data)"
                :rowsPerPageOptions="[10, 25, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                :globalFilterFields="['code', 'name1']"
                selectionMode="single"
                class="w-full"
                responsiveLayout="scroll"
                stripedRows
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลกลุ่มบัญชี</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="code" header="รหัสกลุ่มบัญชี" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column field="name1" header="ชื่อกลุ่มบัญชี" :sortable="false" style="min-width: 20rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.name1 }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editAccountGroup(data)" />
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
        :textContent="accountGroupToDelete ? `คุณต้องการลบกลุ่มบัญชี '${accountGroupToDelete.code} - ${accountGroupToDelete.name1}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteAccountGroup"
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
