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

// ข้อมูลผู้ใช้งาน
const users = ref([]);

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
const userToDelete = ref(null);

/**
 * ดึงข้อมูลผู้ใช้งาน
 */
const fetchUsers = async (page = 1) => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const params = {
            page: page,
            limit: rowsPerPage.value,
            q: searchQuery.value
        };

        const response = await api.getShopUsers(params);

        if (response.success) {
            users.value = response.data;
            totalRecords.value = response.pagination?.total || response.data.length;
            currentPage.value = response.pagination?.page || page;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
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
    fetchUsers(page);
};

/**
 * ค้นหาผู้ใช้งาน
 */
const handleSearch = () => {
    currentPage.value = 1;
    fetchUsers(1);
};

/**
 * ล้างการค้นหา
 */
const clearSearch = () => {
    searchQuery.value = '';
    handleSearch();
};

/**
 * เปิดหน้าเพิ่มผู้ใช้งาน
 */
const openCreateDialog = () => {
    router.push({ name: 'shop-user-create' });
};

/**
 * ไปหน้าแก้ไขผู้ใช้งาน
 */
const navigateToEdit = (user) => {
    router.push({ name: 'shop-user-edit', params: { username: user.username } });
};

/**
 * เปิด dialog ยืนยันการลบผู้ใช้งาน
 */
const confirmDelete = (user) => {
    userToDelete.value = user;
    showDeleteDialog.value = true;
};

/**
 * ลบผู้ใช้งาน
 */
const deleteUser = async () => {
    showDeleteDialog.value = false;

    if (!userToDelete.value) return;

    try {
        showLoading('กำลังลบข้อมูล...');

        const response = await api.deleteShopUser(userToDelete.value.username);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบผู้ใช้งานเรียบร้อยแล้ว',
                life: 3000
            });

            // โหลดข้อมูลใหม่
            await fetchUsers(currentPage.value);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้',
            life: 3000
        });
    } finally {
        hideLoading();
        userToDelete.value = null;
    }
};

/**
 * แปลง role เป็นข้อความ
 */
const getRoleLabel = (role) => {
    switch (role) {
        case 0:
            return 'User';
        case 1:
            return 'Admin';
        case 2:
            return 'Owner';
        default:
            return 'Unknown';
    }
};

/**
 * แปลง role เป็น severity สำหรับ Tag
 */
const getRoleSeverity = (role) => {
    switch (role) {
        case 0:
            return 'info';
        case 1:
            return 'warn';
        case 2:
            return 'success';
        default:
            return 'secondary';
    }
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchUsers();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">กำหนดผู้ใช้งานในระบบ</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการผู้ใช้งานและสิทธิ์การเข้าถึงของกิจการ</p>
                </div>
                <div>
                    <Button label="เพิ่มผู้ใช้งาน" icon="pi pi-plus" @click="openCreateDialog" />
                </div>
            </div>

            <!-- Search Bar -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหาชื่อผู้ใช้..." class="w-full" />
                        <InputIcon v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
                    </IconField>
                </div>
                <div>
                    <Button label="ค้นหา" icon="pi pi-search" @click="handleSearch" />
                </div>
            </div>

            <!-- Data Table -->
            <DataTable
                :value="users"
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
                dataKey="username"
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-users text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลผู้ใช้งาน</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-8">
                        <ProgressSpinner />
                        <p class="text-surface-600 dark:text-surface-400 mt-3">กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <Column field="username" header="ชื่อผู้ใช้" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-primary font-semibold">{{ data.username }}</span>
                    </template>
                </Column>

                <Column field="userprofilename" header="ชื่อโปรไฟล์" :sortable="false" style="min-width: 15rem">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.userprofilename || '-' }}</span>
                    </template>
                </Column>

                <Column field="role" header="บทบาท" :sortable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag :value="getRoleLabel(data.role)" :severity="getRoleSeverity(data.role)" />
                    </template>
                </Column>

                <Column header="จัดการ" :exportable="false" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" outlined rounded severity="info" v-tooltip.top="'แก้ไข'" @click="navigateToEdit(data)" />
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
        :textContent="userToDelete ? `คุณต้องการลบผู้ใช้งาน '${userToDelete.username}' หรือไม่?` : ''"
        confirmLabel="ลบ (Enter)"
        cancelLabel="ยกเลิก"
        severity="danger"
        @close="showDeleteDialog = false"
        @confirm="deleteUser"
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
