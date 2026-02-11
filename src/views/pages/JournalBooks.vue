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

// ข้อมูลสมุดรายวัน
const journalBooks = ref([]);
const selectedJournalBooks = ref([]);

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
const journalBookToDelete = ref(null);

/**
 * ดึงข้อมูลสมุดรายวัน
 */
const fetchJournalBooks = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'code:1'
        };

        const response = await api.getJournalBooks(params);

        if (response.success) {
            journalBooks.value = response.data;
            totalRecords.value = response.pagination.total;
            currentPage.value = response.pagination.page;
        }
    } catch (error) {
        console.error('Error fetching journal books:', error);
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
    fetchJournalBooks(page);
};

/**
 * ค้นหาสมุดรายวัน
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchJournalBooks(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มสมุดรายวัน
 */
const openCreateDialog = () => {
    router.push({ name: 'journal-book-create' });
};

/**
 * แก้ไขสมุดรายวัน
 */
const editJournalBook = (journalBook) => {
    router.push({ name: 'journal-book-edit', params: { id: journalBook.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบสมุดรายวัน
 */
const confirmDelete = (journalBook) => {
    journalBookToDelete.value = journalBook;
    showDeleteDialog.value = true;
};

/**
 * ลบสมุดรายวัน
 */
const deleteJournalBook = async () => {
    showDeleteDialog.value = false;

    if (!journalBookToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteJournalBook(journalBookToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบสมุดรายวันเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchJournalBooks(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting journal book:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        journalBookToDelete.value = null;
    }
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchJournalBooks();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดสมุดรายวัน</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการสมุดรายวันของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มสมุดรายวัน" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสหรือชื่อสมุดรายวัน..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="journalBooks"
                :loading="isLoading"
                :paginator="true"
                :rows="rowsPerPage"
                :totalRecords="totalRecords"
                :lazy="true"
                @page="onPageChange"
                @row-dblclick="editJournalBook($event.data)"
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
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลสมุดรายวัน</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="code" header="รหัสสมุดรายวัน" :sortable="false" style="min-width: 12rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.code }}</span>
                    </template>
                </Column>

                <Column field="name1" header="ชื่อสมุดรายวัน" :sortable="false" style="min-width: 20rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.name1 }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editJournalBook(data)" />
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
        :textContent="journalBookToDelete ? `คุณต้องการลบสมุดรายวัน '${journalBookToDelete.code} - ${journalBookToDelete.name1}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteJournalBook"
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
