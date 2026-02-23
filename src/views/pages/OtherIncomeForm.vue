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
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขรายได้อื่น ๆ' : 'เพิ่มรายได้อื่น ๆ'));

// ข้อมูลฟอร์ม
const formData = ref({
    guidfixed: '',
    code: '',
    names: [{ code: 'th', name: '' }],
    accountcode: '',
    accountname: ''
});

// Chart of Accounts data
const chartOfAccounts = ref([]);
const selectedAccount = ref(null);

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);
const isLoadingAccounts = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states
const isCodeInvalid = ref(false);
const isNameInvalid = ref(false);
const isAccountInvalid = ref(false);

/**
 * โหลด Chart of Accounts
 */
const loadChartOfAccounts = async () => {
    try {
        isLoadingAccounts.value = true;

        const response = await api.getChartOfAccounts({
            limit: 1000,
            page: 1,
            sort: 'accountcode:1'
        });

        if (response.success) {
            const accounts = response.data;

            // สร้าง flat list พร้อม display label
            chartOfAccounts.value = accounts.map((item) => {
                if (item.accountlevel === 1) {
                    return {
                        ...item,
                        displayLabel: `📁 ${item.accountcode} - ${item.accountname}`,
                        disabled: true,
                        isHeader: true
                    };
                } else if (item.accountlevel === 2) {
                    return {
                        ...item,
                        displayLabel: `    📁 ${item.accountcode} - ${item.accountname}`,
                        disabled: true,
                        isHeader: true
                    };
                } else {
                    const indent = item.accountlevel === 3 ? '        ' : item.accountlevel === 4 ? '            ' : '                ';
                    return {
                        ...item,
                        displayLabel: `${indent}${item.accountcode} ~ ${item.accountname}`,
                        disabled: false,
                        isHeader: false
                    };
                }
            });
        }
    } catch (error) {
        console.error('Error loading chart of accounts:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลผังบัญชีได้',
            life: 3000
        });
    } finally {
        isLoadingAccounts.value = false;
    }
};

/**
 * ดึงข้อมูลรายได้อื่น ๆ สำหรับแก้ไข
 */
const fetchIncomeData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const response = await api.getMasterIncomeById(route.params.id);

        if (response.success) {
            formData.value = {
                guidfixed: response.data.guidfixed || '',
                code: response.data.code || '',
                names: response.data.names || [{ code: 'th', name: '' }],
                accountcode: response.data.accountcode || '',
                accountname: response.data.accountname || ''
            };

            // ตั้งค่า selectedAccount ถ้ามี accountcode
            if (formData.value.accountcode && chartOfAccounts.value.length > 0) {
                selectedAccount.value = chartOfAccounts.value.find((acc) => acc.accountcode === formData.value.accountcode) || null;
            }
        }
    } catch (error) {
        console.error('Error fetching income data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'other-incomes' });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * เมื่อเลือกบัญชี
 */
const onAccountSelect = (account) => {
    if (account) {
        formData.value.accountcode = account.accountcode;
        formData.value.accountname = account.accountname;
    } else {
        formData.value.accountcode = '';
        formData.value.accountname = '';
    }
};

/**
 * ดึงชื่อรายได้ภาษาไทย
 */
const getThaiName = () => {
    const thName = formData.value.names.find((n) => n.code === 'th');
    return thName?.name || '';
};

/**
 * ตั้งค่าชื่อรายได้ภาษาไทย
 */
const setThaiName = (value) => {
    const thNameIndex = formData.value.names.findIndex((n) => n.code === 'th');
    if (thNameIndex >= 0) {
        formData.value.names[thNameIndex].name = value;
    } else {
        formData.value.names.push({ code: 'th', name: value });
    }
};

/**
 * ตรวจสอบข้อมูลก่อนบันทึก
 */
const handleSubmit = () => {
    // Reset invalid states
    isCodeInvalid.value = false;
    isNameInvalid.value = false;
    isAccountInvalid.value = false;

    // Validation
    let hasError = false;

    if (!formData.value.code || !formData.value.code.trim()) {
        isCodeInvalid.value = true;
        hasError = true;
    }

    if (!getThaiName() || !getThaiName().trim()) {
        isNameInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.accountcode) {
        isAccountInvalid.value = true;
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
        showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังสร้างรายได้อื่น ๆ...');

        const payload = {
            guidfixed: formData.value.guidfixed || '',
            code: formData.value.code,
            names: formData.value.names,
            accountcode: formData.value.accountcode,
            accountname: formData.value.accountname
        };

        let response;
        if (isEditMode.value) {
            response = await api.updateMasterIncome(route.params.id, payload);
        } else {
            response = await api.createMasterIncome(payload);
        }

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'สร้างรายได้อื่น ๆ เรียบร้อยแล้ว',
                life: 3000
            });

            // กลับไปหน้ารายการ
            router.push({ name: 'other-incomes' });
        }
    } catch (error) {
        console.error('Error saving income:', error);
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
    router.push({ name: 'other-incomes' });
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

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(async () => {
    await loadChartOfAccounts();

    if (isEditMode.value) {
        await fetchIncomeData();
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
            <form v-else @submit.prevent class="flex flex-col gap-6">
                <!-- Row 1: รหัสรายได้ และ ชื่อรายได้ -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/3">
                        <label for="code" class="font-semibold text-surface-900 dark:text-surface-0">
                            รหัสรายได้
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="code" v-model="formData.code" placeholder="กรอกรหัสรายได้" :invalid="isCodeInvalid" fluid />
                        <small v-if="isCodeInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกรหัสรายได้
                        </small>
                    </div>

                    <div class="flex flex-col gap-2 md:w-2/3">
                        <label for="name" class="font-semibold text-surface-900 dark:text-surface-0">
                            ชื่อรายได้
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="name" :modelValue="getThaiName()" @update:modelValue="setThaiName" placeholder="กรอกชื่อรายได้" :invalid="isNameInvalid" fluid />
                        <small v-if="isNameInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกชื่อรายได้
                        </small>
                    </div>
                </div>

                <!-- Row 2: รหัสบัญชี -->
                <div class="flex flex-col gap-2">
                    <label for="accountcode" class="font-semibold text-surface-900 dark:text-surface-0">
                        รหัสบัญชี
                        <span class="text-red-500">*</span>
                    </label>
                    <Select
                        id="accountcode"
                        v-model="selectedAccount"
                        :options="chartOfAccounts"
                        optionLabel="displayLabel"
                        optionDisabled="disabled"
                        placeholder="เลือกรหัสบัญชี..."
                        filter
                        showClear
                        :loading="isLoadingAccounts"
                        :invalid="isAccountInvalid"
                        @update:modelValue="onAccountSelect"
                        fluid
                    >
                        <template #option="slotProps">
                            <div
                                :class="{
                                    'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                    'font-medium text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                    'text-surface-700 dark:text-surface-300': slotProps.option.accountlevel >= 3
                                }"
                            >
                                {{ slotProps.option.displayLabel }}
                            </div>
                        </template>
                    </Select>
                    <small v-if="isAccountInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                        <i class="pi pi-exclamation-circle"></i>
                        กรุณาเลือกรหัสบัญชี
                    </small>
                </div>

                <!-- Row 3: ชื่อบัญชี (แสดงอัตโนมัติ) -->
                <div class="flex flex-col gap-2">
                    <label for="accountname" class="font-semibold text-surface-900 dark:text-surface-0">ชื่อบัญชี</label>
                    <InputText id="accountname" v-model="formData.accountname" placeholder="ชื่อบัญชี (แสดงอัตโนมัติ)" disabled fluid />
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Ctrl + S)' : 'สร้าง (Ctrl + S)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.code || !getThaiName() || !formData.accountcode" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขรายได้อื่น ๆ หรือไม่?' : 'คุณต้องการสร้างรายได้อื่น ๆ ใหม่หรือไม่?'"
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
