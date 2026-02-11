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

// ข้อมูลงวดบัญชี
const accountPeriods = ref([]);
const selectedPeriods = ref([]);

// Pagination
const totalRecords = ref(0);
const currentPage = ref(1);
const rowsPerPage = ref(12);

// Search & Filter
const searchQuery = ref('');

// Loading states
const isLoading = ref(false);

// Dialog confirmation
const showDeleteDialog = ref(false);
const periodToDelete = ref(null);
const showBulkDeleteDialog = ref(false);

/**
 * ดึงข้อมูลงวดบัญชี
 */
const fetchAccountPeriods = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'period:-1'
        };

        const response = await api.getAccountPeriods(params);

        if (response.success) {
            accountPeriods.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching account periods:', error);
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
    fetchAccountPeriods(page);
};

/**
 * ค้นหางวดบัญชี
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchAccountPeriods(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มงวดบัญชี
 */
const openCreateDialog = () => {
    router.push({ name: 'accounting-period-create' });
};

/**
 * แก้ไขงวดบัญชี
 */
const editPeriod = (period) => {
    router.push({ name: 'accounting-period-edit', params: { id: period.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบงวดบัญชี
 */
const confirmDelete = (period) => {
    periodToDelete.value = period;
    showDeleteDialog.value = true;
};

/**
 * ลบงวดบัญชี
 */
const deletePeriod = async () => {
    showDeleteDialog.value = false;

    if (!periodToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteAccountPeriod(periodToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบงวดบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchAccountPeriods(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting account period:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        periodToDelete.value = null;
    }
};

/**
 * เปิด dialog ยืนยันการลบหลายรายการ
 */
const confirmBulkDelete = () => {
    if (selectedPeriods.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกรายการที่ต้องการลบ',
            life: 3000
        });
        return;
    }
    showBulkDeleteDialog.value = true;
};

/**
 * ลบงวดบัญชีหลายรายการ
 */
const bulkDeletePeriods = async () => {
    showBulkDeleteDialog.value = false;

    if (selectedPeriods.value.length === 0) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const ids = selectedPeriods.value.map((p) => p.guidfixed);
        const response = await api.deleteAccountPeriodBulk(ids);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `ลบงวดบัญชี ${selectedPeriods.value.length} รายการเรียบร้อยแล้ว`,
                life: 3000
            });

            selectedPeriods.value = [];
            // โหลดข้อมูลใหม่
            await fetchAccountPeriods(currentPage.value);
        }
    } catch (error) {
        console.error('Error bulk deleting account periods:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

/**
 * Toggle สถานะเปิด/ปิดงวดบัญชี
 */
const togglePeriodStatus = async (period, newValue) => {
    // newValue คือค่าใหม่ที่ต้องการ (true = เปิด, false = ปิด)
    // isdisabled คือ true = ปิด, false = เปิด (กลับกัน)
    const newIsdisabled = !newValue;

    try {
        showLoading('กำลังอัปเดตสถานะ...');

        const payload = {
            startdate: period.startdate,
            enddate: period.enddate,
            period: period.period,
            description: period.description || '',
            isdisabled: newIsdisabled
        };

        const response = await api.updateAccountPeriod(period.guidfixed, payload);

        if (response.success) {
            // อัปเดตค่าใน array หลัง API สำเร็จ
            period.isdisabled = newIsdisabled;
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: newIsdisabled ? 'ปิดงวดบัญชีเรียบร้อยแล้ว' : 'เปิดงวดบัญชีเรียบร้อยแล้ว',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error toggling period status:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถอัปเดตสถานะได้',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

/**
 * Format วันที่เป็น DD/MM/YYYY
 */
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchAccountPeriods();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดงวดบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการงวดบัญชีของกิจการ</p>
                </div>
                <div class="flex gap-2">
                    <Button v-if="selectedPeriods.length > 0" label="ลบที่เลือก" icon="pi pi-trash" severity="danger" outlined @click="confirmBulkDelete" />
                    <Button label="เพิ่มงวดบัญชี" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหางวดบัญชี..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                v-model:selection="selectedPeriods"
                :value="accountPeriods"
                :loading="isLoading"
                :paginator="true"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :lazy="true"
                @page="onPageChange"
                @row-dblclick="editPeriod($event.data)"
                :rowsPerPageOptions="[12, 25, 50, 100]"
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
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลงวดบัญชี</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

                <Column field="period" header="งวดที่" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.period }}</span>
                    </template>
                </Column>

                <Column field="startdate" header="วันที่เริ่มต้น" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ formatDate(data.startdate) }}</span>
                    </template>
                </Column>

                <Column field="enddate" header="วันที่สิ้นสุด" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ formatDate(data.enddate) }}</span>
                    </template>
                </Column>

                <Column field="description" header="รายละเอียด" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.description || '-' }}</span>
                    </template>
                </Column>

                <Column field="isdisabled" header="สถานะ" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <ToggleSwitch :modelValue="!data.isdisabled" @update:modelValue="(val) => togglePeriodStatus(data, val)" />
                            <Tag :value="data.isdisabled ? 'ปิด' : 'เปิด'" :severity="data.isdisabled ? 'danger' : 'success'" />
                        </div>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editPeriod(data)" />
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
        :textContent="periodToDelete ? `คุณต้องการลบงวดบัญชีที่ ${periodToDelete.period} หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deletePeriod"
    />

    <!-- Confirm Bulk Delete Dialog -->
    <DialogForm
        :confirmDialog="showBulkDeleteDialog"
        :textContent="`คุณต้องการลบงวดบัญชี ${selectedPeriods.length} รายการที่เลือกหรือไม่?`"
        confirmLabel="ลบทั้งหมด (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showBulkDeleteDialog = false"
        @confirm="bulkDeletePeriods"
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
