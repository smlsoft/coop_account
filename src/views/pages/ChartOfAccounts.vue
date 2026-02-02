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

// ข้อมูลผังบัญชี
const accounts = ref([]);
const selectedAccounts = ref([]);

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
const accountToDelete = ref(null);

// คำอธิบายประเภทต่างๆ
const accountCategoryTypes = {
    1: 'สินทรัพย์',
    2: 'หนี้สิน',
    3: 'ทุน',
    4: 'รายได้',
    5: 'ค่าใช้จ่าย'
};

const accountLevelTypes = {
    1: 'ระดับ 1',
    2: 'ระดับ 2',
    3: 'ระดับ 3',
    4: 'ระดับ 4',
    5: 'ระดับ 5'
};

const balanceTypes = {
    1: 'เดบิต',
    2: 'เครดิต'
};

/**
 * ดึงข้อมูลผังบัญชี
 */
const fetchAccounts = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'accountcode:1'
        };

        const response = await api.getChartOfAccounts(params);

        if (response.success) {
            accounts.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching accounts:', error);
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
    fetchAccounts(page);
};

/**
 * ค้นหาผังบัญชี
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchAccounts(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มผังบัญชี
 */
const openCreateDialog = () => {
    router.push({ name: 'chart-of-account-create' });
};

/**
 * แก้ไขผังบัญชี
 */
const editAccount = (account) => {
    router.push({ name: 'chart-of-account-edit', params: { id: account.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบผังบัญชี
 */
const confirmDelete = (account) => {
    accountToDelete.value = account;
    showDeleteDialog.value = true;
};

/**
 * ลบผังบัญชี
 */
const deleteAccount = async () => {
    showDeleteDialog.value = false;

    if (!accountToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteChartOfAccount(accountToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบผังบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchAccounts(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        accountToDelete.value = null;
    }
};

/**
 * ตรวจสอบว่าเป็นบัญชีหลักหรือไม่
 * บัญชีหลัก = บัญชีที่ไม่มี consolidateaccountcode หรือ consolidateaccountcode เป็นค่าว่าง
 */
const isMainAccount = (account) => {
    return !account.consolidateaccountcode || account.consolidateaccountcode === '' || account.consolidateaccountcode === account.accountcode;
};

/**
 * คำนวณ padding-left สำหรับการเยื้องตาม level
 */
const getIndentPadding = (level) => {
    if (level <= 1) return '0px';
    return `${(level - 1) * 20}px`;
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
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดรหัสบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการผังบัญชีของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มผังบัญชี" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสบัญชีหรือชื่อบัญชี..." class="w-full" />
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
                :globalFilterFields="['accountcode', 'accountname']"
                class="w-full"
                responsiveLayout="scroll"
                stripedRows
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลผังบัญชี</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="accountcode" header="รหัสบัญชี" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary" :class="{ 'font-black': isMainAccount(data) }">{{ data.accountcode }}</span>
                    </template>
                </Column>

                <Column field="accountname" header="ชื่อผังบัญชี" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span :style="{ paddingLeft: getIndentPadding(data.accountlevel) }" :class="{ 'font-black': isMainAccount(data) }">{{ data.accountname }}</span>
                    </template>
                </Column>

                <Column field="accountcategory" header="หมวดบัญชี" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="accountCategoryTypes[data.accountcategory] || 'ไม่ระบุ'" :severity="data.accountcategory <= 3 ? 'success' : 'warn'" />
                    </template>
                </Column>

                <Column field="accountlevel" header="ระดับบัญชี" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ accountLevelTypes[data.accountlevel] || data.accountlevel }}</span>
                    </template>
                </Column>

                <Column field="accountbalancetype" header="ด้านบัญชี" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag :value="balanceTypes[data.accountbalancetype] || 'ไม่ระบุ'" :severity="data.accountbalancetype === 1 ? 'info' : 'secondary'" />
                    </template>
                </Column>

                <Column field="consolidateaccountcode" header="รหัสผังบัญชีกลาง" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.consolidateaccountcode || '-' }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editAccount(data)" />
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
        :textContent="accountToDelete ? `คุณต้องการลบผังบัญชี '${accountToDelete.accountcode} - ${accountToDelete.accountname}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteAccount"
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
