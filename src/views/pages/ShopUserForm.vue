<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ตรวจสอบ mode (create/edit)
const isEditMode = computed(() => !!route.params.username);
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'));

// ข้อมูลฟอร์ม
const formData = ref({
    username: '',
    role: 0
});

// Role options
const roleOptions = ref([
    { label: 'User', value: 0 },
    { label: 'Admin', value: 1 },
    { label: 'Owner', value: 2 }
]);

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states
const isUsernameInvalid = ref(false);

/**
 * ดึงข้อมูลผู้ใช้งานสำหรับแก้ไข
 */
const fetchUserData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        // ดึงข้อมูลจาก API เฉพาะ username
        const response = await api.getShopUserByUsername(route.params.username);

        if (response.success && response.data) {
            formData.value = {
                username: response.data.username || '',
                role: response.data.role !== undefined ? response.data.role : 0
            };
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่พบข้อมูลผู้ใช้งาน',
                life: 3000
            });
            router.push({ name: 'shop-users' });
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'shop-users' });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * ตรวจสอบข้อมูลก่อนบันทึก
 */
const handleSubmit = () => {
    // Reset invalid states
    isUsernameInvalid.value = false;

    // Validation
    let hasError = false;

    if (!formData.value.username || !formData.value.username.trim()) {
        isUsernameInvalid.value = true;
        hasError = true;
    }

    if (hasError) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
            life: 3000
        });
        return;
    }

    // แสดง dialog ยืนยัน
    showConfirmDialog.value = true;
};

/**
 * ยืนยันการบันทึกข้อมูล
 */
const confirmSave = async () => {
    showConfirmDialog.value = false;

    try {
        isSaving.value = true;
        showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังเพิ่มผู้ใช้งาน...');

        // ดึง shopid จาก localStorage
        const shopId = localStorage.getItem('shopid') || '';

        const payload = {
            shopid: shopId,
            username: formData.value.username.trim(),
            role: formData.value.role
        };

        const response = await api.saveShopUserPermission(payload);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว',
                life: 3000
            });

            // กลับไปหน้ารายการ
            router.push({ name: 'shop-users' });
        }
    } catch (error) {
        console.error('Error saving user:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
            life: 3000
        });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

/**
 * ยกเลิกและกลับไปหน้ารายการ
 */
const handleCancel = () => {
    router.push({ name: 'shop-users' });
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(async () => {
    if (isEditMode.value) {
        await fetchUserData();
    }
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div class="flex items-center gap-3">
                    <Button icon="pi pi-arrow-left" text rounded @click="handleCancel" v-tooltip.top="'กลับ'" />
                    <div>
                        <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ pageTitle }}</div>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <ProgressSpinner />
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-6">
                <!-- Row 1: ชื่อผู้ใช้ -->
                <div class="flex flex-col gap-2">
                    <label for="username" class="font-semibold text-surface-900 dark:text-surface-0">
                        ชื่อผู้ใช้ (Username)
                        <span class="text-red-500">*</span>
                    </label>
                    <InputText id="username" v-model="formData.username" placeholder="กรอกชื่อผู้ใช้ (email หรือ username)" :invalid="isUsernameInvalid" fluid />
                    <small v-if="isUsernameInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle"></i>
                        กรุณากรอกชื่อผู้ใช้
                    </small>
                </div>

                <!-- Row 2: บทบาท -->
                <div class="flex flex-col gap-2">
                    <label for="role" class="font-semibold text-surface-900 dark:text-surface-0">
                        บทบาท (Role)
                        <span class="text-red-500">*</span>
                    </label>
                    <Select id="role" v-model="formData.role" :options="roleOptions" optionLabel="label" optionValue="value" placeholder="เลือกบทบาท..." fluid />
                    <small class="text-surface-500"> <strong>User</strong> - สามารถดูข้อมูลได้ | <strong>Admin</strong> - จัดการข้อมูลได้ | <strong>Owner</strong> - สิทธิ์เต็ม </small>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Enter)' : 'เพิ่ม (Enter)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.username" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขสิทธิ์ผู้ใช้งานหรือไม่?' : 'คุณต้องการเพิ่มผู้ใช้งานใหม่หรือไม่?'"
        confirmLabel="บันทึก (Enter)"
        cancelLabel="ยกเลิก"
        @close="showConfirmDialog = false"
        @confirm="confirmSave"
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
