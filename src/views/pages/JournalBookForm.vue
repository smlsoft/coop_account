<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ตรวจสอบ mode (create/edit)
const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขสมุดรายวัน' : 'เพิ่มสมุดรายวัน'));

// ข้อมูลฟอร์ม
const formData = ref({
    guidfixed: '',
    code: '',
    name1: '',
    name2: '',
    name3: '',
    name4: '',
    name5: ''
});

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states
const isCodeInvalid = ref(false);
const isName1Invalid = ref(false);

/**
 * ดึงข้อมูลสมุดรายวันสำหรับแก้ไข
 */
const fetchJournalBookData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const response = await api.getJournalBookById(route.params.id);

        if (response.success) {
            formData.value = { ...response.data };
        }
    } catch (error) {
        console.error('Error fetching journal book data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'journal-books' });
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
    isCodeInvalid.value = false;
    isName1Invalid.value = false;

    // Validation
    let hasError = false;

    if (!formData.value.code || !formData.value.code.trim()) {
        isCodeInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.name1 || !formData.value.name1.trim()) {
        isName1Invalid.value = true;
        hasError = true;
    }

    if (hasError) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกรหัสสมุดรายวันและชื่อสมุดรายวัน',
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
        showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังสร้างสมุดรายวัน...');

        const payload = {
            guidfixed: formData.value.guidfixed || '',
            code: formData.value.code,
            name1: formData.value.name1,
            name2: formData.value.name2 || '',
            name3: formData.value.name3 || '',
            name4: formData.value.name4 || '',
            name5: formData.value.name5 || ''
        };

        let response;
        if (isEditMode.value) {
            response = await api.updateJournalBook(route.params.id, payload);
        } else {
            response = await api.createJournalBook(payload);
        }

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'สร้างสมุดรายวันเรียบร้อยแล้ว',
                life: 3000
            });

            // กลับไปหน้ารายการ
            router.push({ name: 'journal-books' });
        }
    } catch (error) {
        console.error('Error saving journal book:', error);
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
    router.push({ name: 'journal-books' });
};

/**
 * Keyboard handler สำหรับ Ctrl + S
 */
const handleKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSubmit();
    }
};

// โหลดข้อมูลเมื่อเป็น edit mode
onMounted(() => {
    if (isEditMode.value) {
        fetchJournalBookData();
    }
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
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
            <form v-else @submit.prevent="handleSubmit" @keydown.enter.prevent class="flex flex-col gap-6">
                <!-- Row 1: รหัสสมุดรายวัน และ ชื่อสมุดรายวัน -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="code" class="font-semibold text-surface-900 dark:text-surface-0">
                            รหัสสมุดรายวัน
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="code" v-model="formData.code" placeholder="กรอกรหัสสมุดรายวัน" :invalid="isCodeInvalid" />
                        <small v-if="isCodeInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกรหัสสมุดรายวัน
                        </small>
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="name1" class="font-semibold text-surface-900 dark:text-surface-0">
                            ชื่อสมุดรายวัน
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="name1" v-model="formData.name1" placeholder="กรอกชื่อสมุดรายวัน" :invalid="isName1Invalid" />
                        <small v-if="isName1Invalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกชื่อสมุดรายวัน
                        </small>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Ctrl + S)' : 'สร้าง (Ctrl + S)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.code || !formData.name1" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขสมุดรายวันหรือไม่?' : 'คุณต้องการสร้างสมุดรายวันใหม่หรือไม่?'"
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
