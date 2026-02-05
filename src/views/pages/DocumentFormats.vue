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

// ข้อมูลรูปแบบการบันทึกบัญชี
const documentFormats = ref([]);

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
const formatToDelete = ref(null);

/**
 * ดึงข้อมูลรูปแบบการบันทึกบัญชี
 */
const fetchDocumentFormats = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value,
            sort: 'doccode:1'
        };

        const response = await api.getDocumentFormats(params);

        if (response.success) {
            documentFormats.value = response.data;
            totalRecords.value = response.pagination?.total || 0;
            currentPage.value = response.pagination?.page || 1;
        }
    } catch (error) {
        console.error('Error fetching document formats:', error);
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
    fetchDocumentFormats(page);
};

/**
 * ค้นหารูปแบบการบันทึกบัญชี
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchDocumentFormats(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มรูปแบบการบันทึกบัญชี
 */
const openCreateDialog = () => {
    router.push({ name: 'document-format-create' });
};

/**
 * แก้ไขรูปแบบการบันทึกบัญชี
 */
const editFormat = (format) => {
    router.push({ name: 'document-format-edit', params: { id: format.guidfixed } });
};

/**
 * เปิด dialog ยืนยันการลบรูปแบบการบันทึกบัญชี
 */
const confirmDelete = (format) => {
    formatToDelete.value = format;
    showDeleteDialog.value = true;
};

/**
 * ลบรูปแบบการบันทึกบัญชี
 */
const deleteFormat = async () => {
    showDeleteDialog.value = false;

    if (!formatToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteDocumentFormat(formatToDelete.value.guidfixed);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบรูปแบบการบันทึกบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchDocumentFormats(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting document format:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        formatToDelete.value = null;
    }
};

/**
 * นับจำนวนรายละเอียด
 */
const getDetailsCount = (details) => {
    if (!details || !Array.isArray(details)) return 0;
    return details.length;
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchDocumentFormats();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดรูปแบบการบันทึกบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการรูปแบบการบันทึกบัญชีของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มรูปแบบ" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหารหัสหรือคำอธิบาย..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="documentFormats"
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
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรูปแบบการบันทึกบัญชี</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="doccode" header="รหัสเอกสาร" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.doccode }}</span>
                    </template>
                </Column>

                <Column field="description" header="คำอธิบาย" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.description || '-' }}</span>
                    </template>
                </Column>

                <Column header="รายการ" :sortable="false" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Badge :value="getDetailsCount(data.details)" severity="secondary" />
                    </template>
                </Column>

                <Column field="promptdescription" header="Prompt Description" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400 text-sm">{{ data.promptdescription || '-' }}</span>
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="editFormat(data)" />
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
        :textContent="formatToDelete ? `คุณต้องการลบรูปแบบการบันทึกบัญชี '${formatToDelete.doccode} - ${formatToDelete.description || ''}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteFormat"
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
