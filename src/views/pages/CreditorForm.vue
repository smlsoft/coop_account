<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useDebtAccount } from '@/composables/useDebtAccount';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// ใช้ composable สำหรับ Creditor
const { config, personalTypeOptions, customerTypeOptions, fetchAccountById, createAccount, updateAccount } = useDebtAccount('creditor');

// ตรวจสอบ mode (create/edit)
const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => (isEditMode.value ? `แก้ไข${config.titleSingle}` : `เพิ่ม${config.titleSingle}`));

// ข้อมูลฟอร์ม
const formData = ref({
    guidfixed: '',
    code: '',
    name: '',
    personaltype: 1,
    taxid: '',
    customertype: 1,
    branchnumber: '00000',
    address: '',
    phoneprimary: ''
});

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states
const isCodeInvalid = ref(false);
const isNameInvalid = ref(false);
const isBranchNumberInvalid = ref(false);

/**
 * Reactive keys สำหรับ force re-render SelectButton เมื่อ block null value
 */
const personalTypeKey = ref(0);
const customerTypeKey = ref(0);

/**
 * ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของ SelectButton โดยป้องกัน unselect
 */
const handlePersonalTypeChange = (val) => {
    if (val !== null && val !== undefined) {
        formData.value.personaltype = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        personalTypeKey.value++;
    }
};

const handleCustomerTypeChange = (val) => {
    if (val !== null && val !== undefined) {
        formData.value.customertype = val;
        // อัพเดต branchnumber ตาม customertype
        if (val === 1) {
            formData.value.branchnumber = '00000';
        } else if (val === 2 && formData.value.branchnumber === '00000') {
            formData.value.branchnumber = '';
        }
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        customerTypeKey.value++;
    }
};

/**
 * ดึงข้อมูลสำหรับแก้ไข
 */
const fetchData = async () => {
    try {
        isLoading.value = true;
        const data = await fetchAccountById(route.params.id);

        if (data) {
            const thName = data.names?.find((n) => n.code === 'th');
            const address = data.addressforbilling?.address?.[0] || '';

            formData.value = {
                guidfixed: data.guidfixed || '',
                code: data.code || '',
                name: thName?.name || '',
                personaltype: data.personaltype || 1,
                taxid: data.taxid || '',
                customertype: data.customertype || 1,
                branchnumber: data.branchnumber || '00000',
                address: address,
                phoneprimary: data.addressforbilling?.phoneprimary || ''
            };
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        isLoading.value = false;
    }
};

/**
 * Validate form
 */
const validateForm = () => {
    isCodeInvalid.value = !formData.value.code || formData.value.code.trim() === '';
    isNameInvalid.value = !formData.value.name || formData.value.name.trim() === '';

    // Validate branchnumber only if customertype is 2 (สาขา)
    if (formData.value.customertype === 2) {
        isBranchNumberInvalid.value = !formData.value.branchnumber || formData.value.branchnumber.trim() === '';
    } else {
        isBranchNumberInvalid.value = false;
    }

    return !isCodeInvalid.value && !isNameInvalid.value && !isBranchNumberInvalid.value;
};

/**
 * เปิด dialog ยืนยันการบันทึก
 */
const openConfirmDialog = () => {
    if (validateForm()) {
        showConfirmDialog.value = true;
    }
};

/**
 * บันทึกข้อมูล
 */
const handleSave = async () => {
    if (!validateForm()) {
        return;
    }

    showConfirmDialog.value = false;
    isSaving.value = true;

    try {
        const payload = {
            code: formData.value.code,
            names: [
                {
                    code: 'th',
                    name: formData.value.name
                }
            ],
            taxid: formData.value.taxid || '',
            branchnumber: formData.value.branchnumber,
            addressforbilling: {
                address: [formData.value.address || ''],
                districtcode: '',
                phoneprimary: formData.value.phoneprimary || '',
                provincecode: '',
                subdistrictcode: '',
                zipcode: ''
            },
            personaltype: formData.value.personaltype,
            customertype: formData.value.customertype,
            groups: []
        };

        let success = false;
        if (isEditMode.value) {
            success = await updateAccount(formData.value.guidfixed, payload);
        } else {
            success = await createAccount(payload);
        }

        if (success) {
            showConfirmDialog.value = false;
        }
    } catch (error) {
        console.error('Error saving data:', error);
    } finally {
        isSaving.value = false;
    }
};

/**
 * ยกเลิกการบันทึก
 */
const handleCancel = () => {
    showConfirmDialog.value = false;
};

/**
 * Keyboard handler สำหรับ Ctrl + S
 */
const handleKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        openConfirmDialog();
    }
};

// โหลดข้อมูลเมื่อเป็น edit mode
onMounted(() => {
    if (isEditMode.value) {
        fetchData();
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
                    <Button icon="pi pi-arrow-left" text rounded @click="$router.push(config.route)" v-tooltip.top="'กลับ'" />
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
                <!-- Row 1: รหัสเจ้าหนี้ และ ชื่อเจ้าหนี้ -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="code" class="font-semibold text-surface-900 dark:text-surface-0">
                            รหัส{{ config.titleSingle }}
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="code" v-model="formData.code" :placeholder="`กรอกรหัส${config.titleSingle}`" :invalid="isCodeInvalid" />
                        <small v-if="isCodeInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกรหัส{{ config.titleSingle }}
                        </small>
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="name" class="font-semibold text-surface-900 dark:text-surface-0">
                            ชื่อ{{ config.titleSingle }}
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="name" v-model="formData.name" :placeholder="`กรอกชื่อ${config.titleSingle}`" :invalid="isNameInvalid" />
                        <small v-if="isNameInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกชื่อ{{ config.titleSingle }}
                        </small>
                    </div>
                </div>

                <!-- Row 2: ประเภทบุคคล และ เลขที่บัตรประชาชน -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="personaltype" class="font-semibold text-surface-900 dark:text-surface-0">ประเภทบุคคล</label>
                        <SelectButton :key="personalTypeKey" :modelValue="formData.personaltype" @update:modelValue="handlePersonalTypeChange" :options="personalTypeOptions" optionLabel="label" optionValue="value" fluid />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="taxid" class="font-semibold text-surface-900 dark:text-surface-0">เลขที่บัตรประชาชน/เลขที่ผู้เสียภาษี</label>
                        <InputText id="taxid" v-model="formData.taxid" placeholder="กรอกเลขที่บัตรประชาชน/เลขที่ผู้เสียภาษี" maxlength="13" />
                    </div>
                </div>

                <!-- Row 3: ประเภทสาขา และ หมายเลขสาขา -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="customertype" class="font-semibold text-surface-900 dark:text-surface-0">ประเภทสาขา</label>
                        <SelectButton :key="customerTypeKey" :modelValue="formData.customertype" @update:modelValue="handleCustomerTypeChange" :options="customerTypeOptions" optionLabel="label" optionValue="value" fluid />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="branchnumber" class="font-semibold text-surface-900 dark:text-surface-0">
                            หมายเลขสาขา
                            <span v-if="formData.customertype === 2" class="text-red-500">*</span>
                        </label>
                        <InputText id="branchnumber" v-model="formData.branchnumber" placeholder="กรอกหมายเลขสาขา" :disabled="formData.customertype === 1" :invalid="isBranchNumberInvalid" maxlength="5" />
                        <small v-if="formData.customertype === 1" class="text-surface-500 dark:text-surface-400">สำนักงานใหญ่ใช้หมายเลข 00000</small>
                        <small v-if="isBranchNumberInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกหมายเลขสาขา
                        </small>
                    </div>
                </div>

                <!-- Row 4: ที่อยู่ และ หมายเลขโทรศัพท์ -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="address" class="font-semibold text-surface-900 dark:text-surface-0">ที่อยู่</label>
                        <Textarea id="address" v-model="formData.address" rows="3" placeholder="กรอกที่อยู่" />
                    </div>

                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="phoneprimary" class="font-semibold text-surface-900 dark:text-surface-0">หมายเลขโทรศัพท์</label>
                        <InputText id="phoneprimary" v-model="formData.phoneprimary" placeholder="กรอกหมายเลขโทรศัพท์" maxlength="20" />
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Ctrl + S)' : 'สร้าง (Ctrl + S)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.code || !formData.name" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? `คุณต้องการบันทึกการแก้ไข${config.titleSingle}หรือไม่?` : `คุณต้องการสร้าง${config.titleSingle}ใหม่หรือไม่?`"
        confirmLabel="บันทึก (Enter)"
        cancelLabel="ยกเลิก"
        @close="handleCancel"
        @confirm="handleSave"
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
