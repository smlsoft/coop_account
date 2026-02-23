<script setup>
import DialogForm from '@/components/DialogForm.vue';
import OcrTestDialog from '@/components/accounting/OcrTestDialog.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { formatAmountDisplay, parseAmountInput } from '@/utils/numberFormat';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ตรวจสอบ mode (create/edit)
const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => (isEditMode.value ? 'แก้ไขรูปแบบการบันทึกบัญชี' : 'เพิ่มรูปแบบการบันทึกบัญชี'));

// ข้อมูลฟอร์ม
const formData = ref({
    guidfixed: '',
    doccode: '',
    module: '',
    description: '',
    promptdescription: '',
    details: []
});

// Chart of Accounts data
const chartOfAccounts = ref([]);

// Ref for table
const detailTableRef = ref(null);

// Loading states
const isSaving = ref(false);
const isLoadingAccounts = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// OCR Test Dialog
const showOcrTestDialog = ref(false);

// Invalid states
const isDocCodeInvalid = ref(false);
const isDescriptionInvalid = ref(false);

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
 * ดึงข้อมูลรูปแบบการบันทึกบัญชีสำหรับแก้ไข
 */
const fetchFormatData = async () => {
    try {
        const response = await api.getDocumentFormatById(route.params.id);

        if (response.success) {
            formData.value = {
                guidfixed: response.data.guidfixed || '',
                doccode: response.data.doccode || '',
                module: response.data.module || '',
                description: response.data.description || '',
                promptdescription: response.data.promptdescription || '',
                details: (response.data.details || []).map((detail) => ({
                    ...detail,
                    selectedAccount: chartOfAccounts.value.find((acc) => acc.accountcode === detail.accountcode) || null
                }))
            };
        }
    } catch (error) {
        console.error('Error fetching format data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
        router.push({ name: 'document-formats' });
    }
};

/**
 * เพิ่มรายการ detail ใหม่
 */
const addDetail = () => {
    formData.value.details.push({
        accountcode: '',
        accountname: '',
        actioncode: '',
        detail: '',
        debit: 0,
        credit: 0,
        selectedAccount: null
    });
};

/**
 * ลบรายการ detail
 */
const removeDetail = (index) => {
    formData.value.details.splice(index, 1);
};

/**
 * ย้ายแถวขึ้น
 */
const moveRowUp = (index) => {
    if (index <= 0) return;
    const details = [...formData.value.details];
    [details[index - 1], details[index]] = [details[index], details[index - 1]];
    formData.value.details = details;
};

/**
 * ย้ายแถวลง
 */
const moveRowDown = (index) => {
    if (index >= formData.value.details.length - 1) return;
    const details = [...formData.value.details];
    [details[index], details[index + 1]] = [details[index + 1], details[index]];
    formData.value.details = details;
};

/**
 * เพิ่มแถวและ focus ไปยังแถวใหม่
 */
const addDetailAndFocus = () => {
    addDetail();
    nextTick(() => {
        const table = detailTableRef.value?.$el || document.querySelector('.detail-table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr[data-pc-section="bodyrow"]');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                const input = lastRow.querySelector('input');
                input?.focus();
            }
        }
    });
};

/**
 * ตรวจสอบว่าอยู่ในแถวสุดท้ายของตารางหรือไม่
 */
const isInLastRowOfTable = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const row = activeElement.closest('tr[data-pc-section="bodyrow"]');
    if (!row) return false;

    const tbody = row.closest('tbody');
    if (!tbody) return false;

    const rows = Array.from(tbody.querySelectorAll('tr[data-pc-section="bodyrow"]'));
    const currentIndex = rows.indexOf(row);

    return currentIndex === rows.length - 1;
};

/**
 * ตรวจสอบว่าอยู่ในช่องสุดท้ายของแถวหรือไม่
 */
const isInLastInputOfRow = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const row = activeElement.closest('tr[data-pc-section="bodyrow"]');
    if (!row) return false;

    const inputs = row.querySelectorAll('input:not([disabled])');
    const inputArray = Array.from(inputs);
    const currentIndex = inputArray.indexOf(activeElement);

    return currentIndex === inputArray.length - 1;
};

/**
 * Keyboard handler สำหรับ Tab ในแถวสุดท้าย
 */
const handleKeydown = (event) => {
    // Handle Ctrl + S
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSubmit();
        return;
    }

    // Handle Tab in last row
    if (event.key === 'Tab' && !event.shiftKey) {
        if (isInLastRowOfTable() && isInLastInputOfRow()) {
            event.preventDefault();
            addDetailAndFocus();
        }
    }
};

/**
 * เมื่อเลือกบัญชีใน detail
 */
const onAccountSelect = (index, account) => {
    if (account) {
        formData.value.details[index].accountcode = account.accountcode;
        formData.value.details[index].accountname = account.accountname;
        if (!formData.value.details[index].detail) {
            formData.value.details[index].detail = account.accountname;
        }
    } else {
        formData.value.details[index].accountcode = '';
        formData.value.details[index].accountname = '';
    }
};

/**
 * ตรวจสอบข้อมูลก่อนบันทึก
 */
const handleSubmit = () => {
    // Reset invalid states
    isDocCodeInvalid.value = false;
    isDescriptionInvalid.value = false;

    // Validation
    let hasError = false;

    if (!formData.value.doccode || !formData.value.doccode.trim()) {
        isDocCodeInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.description || !formData.value.description.trim()) {
        isDescriptionInvalid.value = true;
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
        showLoading(isEditMode.value ? 'กำลังบันทึกข้อมูล...' : 'กำลังสร้างรูปแบบการบันทึกบัญชี...');

        // กรองแถวที่ไม่มี accountcode ออก และลบ selectedAccount
        // แปลง debit และ credit เป็น string ตามที่ API ต้องการ
        const filteredDetails = formData.value.details
            .filter((detail) => detail.accountcode && detail.accountcode.trim() !== '')
            .map((detail) => {
                const { selectedAccount, ...rest } = detail;
                void selectedAccount;
                return {
                    ...rest,
                    debit: String(rest.debit || 0),
                    credit: String(rest.credit || 0)
                };
            });

        const payload = {
            guidfixed: formData.value.guidfixed || '',
            doccode: formData.value.doccode,
            module: 'GL',
            description: formData.value.description,
            promptdescription: formData.value.promptdescription,
            details: filteredDetails
        };

        let response;
        if (isEditMode.value) {
            response = await api.updateDocumentFormat(route.params.id, payload);
        } else {
            response = await api.createDocumentFormat(payload);
        }

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'สร้างรูปแบบการบันทึกบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // กลับไปหน้ารายการ
            router.push({ name: 'document-formats' });
        }
    } catch (error) {
        console.error('Error saving document format:', error);
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
    router.push({ name: 'document-formats' });
};

/**
 * เปิด OCR Test Dialog
 */
const openOcrTestDialog = () => {
    // ตรวจสอบว่ามีข้อมูลพื้นฐานครบหรือไม่
    if (!formData.value.doccode || !formData.value.description) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณากรอกรหัสและคำอธิบายก่อนทดสอบ',
            life: 3000
        });
        return;
    }

    showOcrTestDialog.value = true;
};

/**
 * Get template data for OCR testing
 */
const templateData = computed(() => ({
    doccode: formData.value.doccode,
    description: formData.value.description,
    details: formData.value.details
        .filter((d) => d.accountcode)
        .map((d) => ({
            accountcode: d.accountcode,
            detail: d.detail || ''
        })),
    promptdescription: formData.value.promptdescription
}));

/**
 * คำนวณรวมเดบิตและเครดิต
 */
const totalDebit = computed(() => {
    return formData.value.details.reduce((sum, d) => sum + (parseFloat(d.debit) || 0), 0);
});

const totalCredit = computed(() => {
    return formData.value.details.reduce((sum, d) => sum + (parseFloat(d.credit) || 0), 0);
});

const isBalanced = computed(() => {
    return Math.abs(totalDebit.value - totalCredit.value) < 0.01;
});

/**
 * Format number display
 */
const formatNumber = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toFixed(2);
};

// Track which amount cell is being edited
const editingAmountCell = ref(null); // { index, field }
const editingValue = ref('');

const getAmountDisplayValue = (index, field, value) => {
    if (editingAmountCell.value?.index === index && editingAmountCell.value?.field === field) {
        return editingValue.value;
    }
    return formatAmountDisplay(value);
};

const handleAmountInput = (index, field, event) => {
    editingValue.value = event.target.value;
};

const handleAmountBlur = (index, field, event) => {
    const value = parseAmountInput(event.target.value);
    formData.value.details[index][field] = value;
    editingAmountCell.value = null;
    editingValue.value = '';
};

const handleAmountFocus = (index, field, event) => {
    editingAmountCell.value = { index, field };
    const currentValue = formData.value.details[index]?.[field] || 0;
    editingValue.value = currentValue === 0 ? '' : String(currentValue);
    nextTick(() => {
        event.target.value = editingValue.value;
        event.target.select();
    });
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(async () => {
    try {
        showLoading('กำลังโหลดข้อมูล...');

        // โหลดข้อมูลทั้งหมดพร้อมกัน
        await loadChartOfAccounts();

        if (isEditMode.value) {
            await fetchFormatData();
        }
    } finally {
        hideLoading();
    }

    // เพิ่ม event listener สำหรับ Tab ในแถวสุดท้าย
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
            <!-- Form -->
            <form @submit.prevent="handleSubmit" @keydown.enter.prevent class="flex flex-col gap-6">
                <!-- Row 1: รหัสเอกสาร   -->
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex flex-col gap-2 md:w-1/3">
                        <label for="doccode" class="font-semibold text-surface-900 dark:text-surface-0">
                            รหัสเอกสาร
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="doccode" v-model="formData.doccode" placeholder="กรอกรหัสเอกสาร" :invalid="isDocCodeInvalid" fluid />
                        <small v-if="isDocCodeInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกรหัสเอกสาร
                        </small>
                    </div>

                    <div class="flex flex-col gap-2 md:w-2/3">
                        <label for="description" class="font-semibold text-surface-900 dark:text-surface-0">
                            คำอธิบาย
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="description" v-model="formData.description" placeholder="กรอกคำอธิบาย" :invalid="isDescriptionInvalid" fluid />
                        <small v-if="isDescriptionInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกคำอธิบาย
                        </small>
                    </div>
                </div>

                <!-- Row 2: Prompt Description -->
                <div class="flex flex-col gap-2">
                    <label for="promptdescription" class="font-semibold text-surface-900 dark:text-surface-0">Prompt Description</label>
                    <Textarea id="promptdescription" v-model="formData.promptdescription" rows="3" placeholder="กรอก Prompt Description" fluid />
                </div>

                <!-- Details Section -->
                <div class="flex flex-col gap-4">
                    <div class="flex justify-between items-center">
                        <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">รายละเอียดการบันทึกบัญชี</div>
                        <Button label="เพิ่มรายการ" icon="pi pi-plus" size="small" @click="addDetail" />
                    </div>

                    <!-- Empty State -->
                    <div v-if="formData.details.length === 0" class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
                        <i class="pi pi-list text-4xl text-surface-400 dark:text-surface-600 mb-3"></i>
                        <h4 class="text-lg font-semibold mb-2 text-surface-700 dark:text-surface-300">ไม่มีรายการบัญชี</h4>
                        <p class="text-surface-500 dark:text-surface-400 mb-3">คลิกปุ่มด้านบนเพื่อเพิ่มรายการ</p>
                    </div>

                    <!-- Details Table -->
                    <DataTable ref="detailTableRef" v-else :value="formData.details" class="text-sm detail-table" dataKey="accountcode">
                        <Column field="actioncode" header="Action Code" style="width: 120px">
                            <template #body="{ data }">
                                <InputText v-model="data.actioncode" placeholder="" class="w-full" />
                            </template>
                        </Column>

                        <Column header="รหัสบัญชี" style="min-width: 150px">
                            <template #body="{ data, index }">
                                <Select
                                    v-model="data.selectedAccount"
                                    :options="chartOfAccounts"
                                    optionLabel="displayLabel"
                                    optionDisabled="disabled"
                                    placeholder="เลือกรหัสบัญชี..."
                                    filter
                                    showClear
                                    :loading="isLoadingAccounts"
                                    @update:modelValue="onAccountSelect(index, $event)"
                                    class="w-full"
                                >
                                    <template #value="slotProps">
                                        <span v-if="slotProps.value">{{ slotProps.value.accountcode }}</span>
                                        <span v-else class="text-surface-400 dark:text-surface-500">เลือกรหัสบัญชี...</span>
                                    </template>
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
                            </template>
                        </Column>

                        <Column field="detail" header="รายละเอียด" style="min-width: 150px">
                            <template #body="{ data }">
                                <InputText v-model="data.detail" placeholder="รายละเอียด" class="w-full" />
                            </template>
                        </Column>

                        <Column field="debit" header="เดบิต" style="width: 130px">
                            <template #body="{ data, index }">
                                <InputText
                                    :value="getAmountDisplayValue(index, 'debit', data.debit)"
                                    @input="handleAmountInput(index, 'debit', $event)"
                                    @blur="handleAmountBlur(index, 'debit', $event)"
                                    @focus="handleAmountFocus(index, 'debit', $event)"
                                    :disabled="data.actioncode === 'CR'"
                                    class="text-right w-full"
                                    placeholder="0.00"
                                />
                            </template>
                        </Column>

                        <Column field="credit" header="เครดิต" style="width: 130px">
                            <template #body="{ data, index }">
                                <InputText
                                    :value="getAmountDisplayValue(index, 'credit', data.credit)"
                                    @input="handleAmountInput(index, 'credit', $event)"
                                    @blur="handleAmountBlur(index, 'credit', $event)"
                                    @focus="handleAmountFocus(index, 'credit', $event)"
                                    :disabled="data.actioncode === 'DR'"
                                    class="text-right w-full"
                                    placeholder="0.00"
                                />
                            </template>
                        </Column>

                        <Column header="จัดการ" style="width: 120px">
                            <template #body="{ index }">
                                <div class="flex gap-1 justify-center">
                                    <Button icon="pi pi-arrow-up" severity="secondary" text size="small" @click="moveRowUp(index)" :disabled="index === 0" v-tooltip.top="'ย้ายขึ้น'" />
                                    <Button icon="pi pi-arrow-down" severity="secondary" text size="small" @click="moveRowDown(index)" :disabled="index === formData.details.length - 1" v-tooltip.top="'ย้ายลง'" />
                                    <Button icon="pi pi-trash" severity="danger" text size="small" @click="removeDetail(index)" v-tooltip.top="'ลบ'" />
                                </div>
                            </template>
                        </Column>
                    </DataTable>

                    <!-- Summary -->
                    <div v-if="formData.details.length > 0" class="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                        <div class="flex justify-end gap-8">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">รวมเดบิต:</span>
                                <span class="text-lg font-bold">{{ formatNumber(totalDebit) }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">รวมเครดิต:</span>
                                <span class="text-lg font-bold">{{ formatNumber(totalCredit) }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <Tag :value="isBalanced ? 'สมดุล' : 'ไม่สมดุล'" :severity="isBalanced ? 'success' : 'danger'" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end items-center pt-4 border-t border-surface">
                    <!-- <Button label="ทดสอบ Prompt OCR" icon="pi pi-play-circle" severity="info" @click="openOcrTestDialog" outlined /> -->
                    <Button type="submit" :label="isEditMode ? 'บันทึก (Ctrl + S)' : 'สร้าง (Ctrl + S)'" icon="pi pi-save" :loading="isSaving" :disabled="!formData.doccode || !formData.description" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm
        :confirmDialog="showConfirmDialog"
        :textContent="isEditMode ? 'คุณต้องการบันทึกการแก้ไขรูปแบบการบันทึกบัญชี หรือไม่?' : 'คุณต้องการสร้างรูปแบบการบันทึกบัญชีใหม่ หรือไม่?'"
        confirmLabel="บันทึก (Enter)"
        cancelLabel="ยกเลิก"
        @close="showConfirmDialog = false"
        @confirm="confirmSave"
    />

    <!-- OCR Test Dialog -->
    <OcrTestDialog :visible="showOcrTestDialog" :template-data="templateData" @update:visible="showOcrTestDialog = $event" @close="showOcrTestDialog = false" />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
