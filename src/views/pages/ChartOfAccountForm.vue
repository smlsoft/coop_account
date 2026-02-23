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
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขผังบัญชี' : 'เพิ่มผังบัญชี'));

// ข้อมูลฟอร์ม
const formData = ref({
    guidfixed: '',
    accountcode: '',
    accountname: '',
    accountcategory: 1,
    financialstatements: 1,
    accountlevel: 1,
    consolidateaccountcode: '',
    accountbalancetype: 1,
    accountgroup: ''
});

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Options สำหรับ dropdown
const accountCategoryOptions = [
    { label: 'สินทรัพย์', value: 1 },
    { label: 'หนี้สิน', value: 2 },
    { label: 'ทุน', value: 3 },
    { label: 'รายได้', value: 4 },
    { label: 'ค่าใช้จ่าย', value: 5 }
];

const financialStatementsOptions = [
    { label: 'ทั่วไป', value: 1 },
    { label: 'ต้นทุนขาย', value: 2 }
];

const accountLevelOptions = [
    { label: 'ระดับ 1', value: 1 },
    { label: 'ระดับ 2', value: 2 },
    { label: 'ระดับ 3', value: 3 },
    { label: 'ระดับ 4', value: 4 },
    { label: 'ระดับ 5', value: 5 }
];

const accountBalanceTypeOptions = [
    { label: 'เดบิต', value: 1 },
    { label: 'เครดิต', value: 2 }
];

/**
 * ดึงข้อมูลผังบัญชีสำหรับแก้ไข
 */
const fetchAccountData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const response = await api.getChartOfAccountById(route.params.id);

        if (response.success) {
            formData.value = { ...response.data };
        }
    } catch (error) {
        console.error('Error fetching account data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'chart-of-accounts' });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * บันทึกข้อมูล
 */
const handleSubmit = () => {
    // Validation
    if (!formData.value.accountcode || !formData.value.accountname) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกรหัสผังบัญชีและชื่อบัญชี',
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
        showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังสร้างผังบัญชี...');

        const payload = {
            guidfixed: formData.value.guidfixed || '',
            accountcode: formData.value.accountcode,
            accountname: formData.value.accountname,
            accountcategory: formData.value.accountcategory,
            financialstatements: formData.value.financialstatements,
            accountlevel: formData.value.accountlevel,
            consolidateaccountcode: formData.value.consolidateaccountcode || '',
            accountbalancetype: formData.value.accountbalancetype,
            accountgroup: formData.value.accountgroup || ''
        };

        let response;
        if (isEditMode.value) {
            response = await api.updateChartOfAccount(route.params.id, payload);
        } else {
            response = await api.createChartOfAccount(payload);
        }

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'สร้างผังบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // กลับไปหน้ารายการ
            router.push({ name: 'chart-of-accounts' });
        }
    } catch (error) {
        console.error('Error saving account:', error);
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
    router.push({ name: 'chart-of-accounts' });
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
        fetchAccountData();
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
                <!-- Row 1: รหัสผังบัญชี และ ชื่อบัญชี -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="accountcode" class="font-semibold text-surface-900 dark:text-surface-0">
                            รหัสผังบัญชี
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="accountcode" v-model="formData.accountcode" placeholder="กรอกรหัสผังบัญชี" />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="accountname" class="font-semibold text-surface-900 dark:text-surface-0">
                            ชื่อบัญชี
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="accountname" v-model="formData.accountname" placeholder="กรอกชื่อบัญชี" />
                    </div>
                </div>

                <!-- Row 2: หมวดบัญชี และ ผลกระทบต่องบการเงิน -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="accountcategory" class="font-semibold text-surface-900 dark:text-surface-0"> หมวดบัญชี </label>
                        <Select id="accountcategory" v-model="formData.accountcategory" :options="accountCategoryOptions" optionLabel="label" optionValue="value" placeholder="เลือกหมวดบัญชี" />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="financialstatements" class="font-semibold text-surface-900 dark:text-surface-0"> ผลกระทบต่องบการเงิน </label>
                        <Select id="financialstatements" v-model="formData.financialstatements" :options="financialStatementsOptions" optionLabel="label" optionValue="value" placeholder="เลือกผลกระทบต่องบการเงิน" />
                    </div>
                </div>

                <!-- Row 3: ระดับบัญชี และ ด้านบัญชี -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="accountlevel" class="font-semibold text-surface-900 dark:text-surface-0"> ระดับบัญชี </label>
                        <Select id="accountlevel" v-model="formData.accountlevel" :options="accountLevelOptions" optionLabel="label" optionValue="value" placeholder="เลือกระดับบัญชี" />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="accountbalancetype" class="font-semibold text-surface-900 dark:text-surface-0"> ด้านบัญชี </label>
                        <Select id="accountbalancetype" v-model="formData.accountbalancetype" :options="accountBalanceTypeOptions" optionLabel="label" optionValue="value" placeholder="เลือกด้านบัญชี" />
                    </div>
                </div>

                <!-- Row 4: รหัสผังบัญชีกลาง -->
                <div class="flex flex-col gap-2">
                    <label for="consolidateaccountcode" class="font-semibold text-surface-900 dark:text-surface-0">รหัสผังบัญชีกลาง</label>
                    <InputText id="consolidateaccountcode" v-model="formData.consolidateaccountcode" placeholder="กรอกรหัสผังบัญชีกลาง (ถ้ามี)" />
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Ctrl + S)' : 'สร้าง (Ctrl + S)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.accountcode || !formData.accountname" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขผังบัญชีหรือไม่?' : 'คุณต้องการสร้างผังบัญชีใหม่หรือไม่?'"
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
