<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useDebtAccount } from '@/composables/useDebtAccount';
import { onMounted, ref } from 'vue';

// ใช้ composable สำหรับ Debtor
const { config, accounts, totalRecords, currentPage, rowsPerPage, searchQuery, isLoading, personalTypes, customerTypes, fetchAccounts, onPageChange, handleSearch, clearSearch, navigateToCreate, navigateToEdit, deleteAccount, getAccountName } =
    useDebtAccount('debtor');

// Dialog confirmation
const showDeleteDialog = ref(false);
const accountToDelete = ref(null);

/**
 * เปิด dialog ยืนยันการลบ
 */
const confirmDelete = (account) => {
    accountToDelete.value = account;
    showDeleteDialog.value = true;
};

/**
 * ยืนยันการลบ
 */
const handleConfirmDelete = async () => {
    if (accountToDelete.value) {
        await deleteAccount(accountToDelete.value.guidfixed);
        showDeleteDialog.value = false;
        accountToDelete.value = null;
    }
};

/**
 * ยกเลิกการลบ
 */
const handleCancelDelete = () => {
    showDeleteDialog.value = false;
    accountToDelete.value = null;
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchAccounts();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ config.title }}</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการข้อมูล{{ config.titleSingle }}ของกิจการ</p>
                </div>
                <div>
                    <Button :label="`เพิ่ม${config.titleSingle}`" icon="pi pi-plus" @click="navigateToCreate" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" :placeholder="`ค้นหารหัสหรือชื่อ${config.titleSingle}...`" class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="accounts"
                :loading="isLoading"
                :paginator="true"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :lazy="true"
                @page="onPageChange"
                :rowsPerPageOptions="[10, 25, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                class="w-full"
                responsiveLayout="scroll"
                stripedRows
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูล{{ config.titleSingle }}</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="code" :header="`รหัส${config.titleSingle}`" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column field="name" :header="`ชื่อ${config.titleSingle}`" :sortable="false" style="min-width: 20rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.names?.find((n) => n.code === 'th')?.name || '-' }}</span>
                    </template>
                </Column>

                <Column field="taxid" header="เลขที่ผู้เสียภาษี" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.taxid || '-' }}</span>
                    </template>
                </Column>

                <Column field="personaltype" header="ประเภทบุคคล" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="personalTypes[data.personaltype] || 'ไม่ระบุ'" :severity="data.personaltype === 1 ? 'info' : 'success'" />
                    </template>
                </Column>

                <Column field="customertype" header="ประเภทสาขา" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="customerTypes[data.customertype] || 'ไม่ระบุ'" :severity="data.customertype === 1 ? 'primary' : 'warn'" />
                    </template>
                </Column>

                <Column field="branchnumber" header="หมายเลขสาขา" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.branchnumber || '-' }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="navigateToEdit(data.guidfixed)" />
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
        :textContent="accountToDelete ? `คุณต้องการลบ${config.titleSingle} '${getAccountName(accountToDelete)}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="handleCancelDelete"
        @confirm="handleConfirmDelete"
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
