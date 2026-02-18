<script setup>
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['update:modelValue']);

// Dropdown options
const taxTypeOptions = [
    { label: 'ภาษีถูกหัก ณ ที่จ่าย', value: 0 },
    { label: 'ภาษีหัก ณ ที่จ่าย', value: 1 }
];

const custTypeOptions = [
    { label: 'บุคคลธรรมดา', value: 0 },
    { label: 'นิติบุคคล', value: 1 }
];

// Reactive keys สำหรับ force re-render SelectButton เมื่อ block null value (per Tax entry)
const taxTypeKeys = ref({});
const custTypeKeys = ref({});

// ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของ SelectButton โดยป้องกัน unselect
const handleTaxTypeChange = (index, val) => {
    if (val !== null && val !== undefined) {
        taxes.value[index].taxtype = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        taxTypeKeys.value[index] = (taxTypeKeys.value[index] || 0) + 1;
    }
};

const handleCustTypeChange = (index, val) => {
    if (val !== null && val !== undefined) {
        taxes.value[index].custtype = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        custTypeKeys.value[index] = (custTypeKeys.value[index] || 0) + 1;
    }
};

// Local state
const localValue = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

const taxes = computed({
    get: () => localValue.value.taxes || [],
    set: (value) => {
        localValue.value = {
            ...localValue.value,
            taxes: value
        };
    }
});

// Get debt account info from JournalDailyInfoTab
const getDebtAccountInfo = () => {
    const debtAccount = localValue.value.debtaccountcode;
    if (debtAccount) {
        const thName = debtAccount.names?.find((n) => n.code === 'th')?.name || '';
        // personaltype: 1 = บุคคลธรรมดา, 2 = นิติบุคคล
        // custtype: 0 = บุคคลธรรมดา, 1 = นิติบุคคล
        // ดังนั้น custtype = personaltype - 1
        const personaltype = debtAccount.personaltype || 1;
        const custtype = personaltype === 2 ? 1 : 0;
        return {
            custname: thName || debtAccount.name || '',
            custtaxid: debtAccount.taxid || '',
            custtype: custtype,
            address: debtAccount.addressforbilling?.address?.[0] || ''
        };
    }
    return { custname: '', custtaxid: '', custtype: 0, address: '' };
};

// Add new tax entry
const addTaxEntry = () => {
    const debtInfo = getDebtAccountInfo();

    // ใช้ docdate จาก JournalDailyInfoTab ถ้ามี ไม่เช่นนั้นใช้วันที่ปัจจุบัน
    const taxdate = localValue.value.docdate ? new Date(localValue.value.docdate) : new Date();

    // กำหนด taxtype ตามประเภทหนี้
    // debtaccounttype = 0 (ลูกหนี้) → taxtype = 0 (ภาษีถูกหัก ณ ที่จ่าย)
    // debtaccounttype = 1 (เจ้าหนี้) → taxtype = 1 (ภาษีหัก ณ ที่จ่าย)
    const taxtype = localValue.value.debtaccounttype === 1 ? 1 : 0;

    const newEntry = {
        taxtype: taxtype,
        custtype: debtInfo.custtype || 0, // ค่าเริ่มต้น = 0 (บุคคลธรรมดา)
        taxdate: taxdate,
        taxdocno: '',
        custname: debtInfo.custname,
        custtaxid: debtInfo.custtaxid,
        address: debtInfo.address,
        details: [
            {
                description: '',
                taxbase: 0,
                taxrate: 0,
                taxamount: 0
            }
        ]
    };

    taxes.value = [...taxes.value, newEntry];
};

// Remove tax entry
const removeTaxEntry = (index) => {
    taxes.value = taxes.value.filter((_, i) => i !== index);
};

// Add detail row to tax entry
const addDetailRow = (taxIndex) => {
    const newDetail = {
        description: '',
        taxbase: 0,
        taxrate: 0,
        taxamount: 0
    };
    taxes.value[taxIndex].details = [...taxes.value[taxIndex].details, newDetail];
};

// Remove detail row from tax entry
const removeDetailRow = (taxIndex, detailIndex) => {
    taxes.value[taxIndex].details = taxes.value[taxIndex].details.filter((_, i) => i !== detailIndex);
};

// Calculate tax amount for detail
const calculateDetailTaxAmount = (taxIndex, detailIndex) => {
    const detail = taxes.value[taxIndex].details[detailIndex];
    const base = parseFloat(detail.taxbase) || 0;
    const rate = parseFloat(detail.taxrate) || 0;
    taxes.value[taxIndex].details[detailIndex].taxamount = (base * rate) / 100;
};

// Calculate total for a tax entry
const getTaxTotal = (tax) => {
    if (!tax.details || tax.details.length === 0) return { base: 0, amount: 0 };
    return {
        base: tax.details.reduce((sum, d) => sum + (parseFloat(d.taxbase) || 0), 0),
        amount: tax.details.reduce((sum, d) => sum + (parseFloat(d.taxamount) || 0), 0)
    };
};

// Format number display
const formatNumber = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toFixed(2);
};

// Track which input is currently being edited
const editingAmountCell = ref(null); // { taxIndex, detailIndex, field }
const editingValue = ref('');

// Format number for display (with commas and 2 decimals)
const formatAmountDisplay = (value) => {
    const num = parseFloat(value) || 0;
    if (num === 0) return '';
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Get display value - show raw value when editing, formatted when not
const getAmountDisplayValue = (taxIndex, detailIndex, field, value) => {
    if (editingAmountCell.value?.taxIndex === taxIndex && editingAmountCell.value?.detailIndex === detailIndex && editingAmountCell.value?.field === field) {
        return editingValue.value;
    }
    return formatAmountDisplay(value);
};

// Parse formatted string back to number
const parseAmountInput = (value) => {
    if (!value || value === '') return 0;
    // Remove commas and parse
    const cleaned = String(value).replace(/,/g, '');
    return parseFloat(cleaned) || 0;
};

// Handle amount input change
const handleAmountInput = (taxIndex, detailIndex, field, event) => {
    editingValue.value = event.target.value;
};

// Handle amount blur (format the display and save)
const handleAmountBlur = (taxIndex, detailIndex, field, event) => {
    const value = parseAmountInput(event.target.value);
    taxes.value[taxIndex].details[detailIndex][field] = value;
    // Recalculate taxamount if needed
    if (field === 'taxbase' || field === 'taxrate') {
        calculateDetailTaxAmount(taxIndex, detailIndex);
    }
    editingAmountCell.value = null;
    editingValue.value = '';
};

// Handle amount focus (select all text for easy editing)
const handleAmountFocus = (taxIndex, detailIndex, field, event) => {
    editingAmountCell.value = { taxIndex, detailIndex, field };
    // Show raw number value when focusing (without commas)
    const currentValue = taxes.value[taxIndex]?.details[detailIndex]?.[field] || 0;
    editingValue.value = currentValue === 0 ? '' : String(currentValue);
    nextTick(() => {
        event.target.value = editingValue.value;
        event.target.select();
    });
};

// Validation helpers
const isTaxDocNoInvalid = (tax) => !tax.taxdocno || tax.taxdocno.trim() === '';
const isCustNameInvalid = (tax) => !tax.custname || tax.custname.trim() === '';
const isCustTaxIdInvalid = (tax) => !tax.custtaxid || tax.custtaxid.trim() === '';
const isDetailDescriptionInvalid = (detail) => !detail.description || detail.description.trim() === '';
const isDetailTaxBaseInvalid = (detail) => !detail.taxbase || parseFloat(detail.taxbase) === 0;

// Watch for changes in debtaccountcode and update all tax entries
// ใช้ guidfixed เป็น primitive value เพื่อหลีกเลี่ยง infinite loop จาก deep watch
let lastDebtAccountGuid = null;
watch(
    () => localValue.value.debtaccountcode?.guidfixed,
    (newGuid) => {
        // ป้องกัน infinite loop โดยเปรียบเทียบ guid
        if (newGuid && newGuid !== lastDebtAccountGuid && taxes.value.length > 0) {
            lastDebtAccountGuid = newGuid;
            const debtInfo = getDebtAccountInfo();
            taxes.value = taxes.value.map((tax) => ({
                ...tax,
                custname: debtInfo.custname,
                custtaxid: debtInfo.custtaxid,
                custtype: debtInfo.custtype,
                address: debtInfo.address
            }));
        } else if (!newGuid) {
            lastDebtAccountGuid = null;
        }
    }
);

// หมายเหตุ: ลบ watch docdate ออก เพราะ JournalDailyInfoTab จัดการแล้ว
// การอัปเดต taxdate จะทำผ่าน parent component เพื่อป้องกัน infinite loop
</script>

<template>
    <div class="space-y-4">
        <!-- Header with Add Button -->
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">ภาษีหัก ณ ที่จ่าย</h3>
            <Button label="เพิ่มรายการภาษี" icon="pi pi-plus" @click="addTaxEntry" size="small" />
        </div>

        <!-- Summary -->
        <div v-if="taxes && taxes.length > 0" class="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ taxes.length }}</div>
                </div>
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">
                        {{ formatNumber(taxes.reduce((sum, t) => sum + getTaxTotal(t).base, 0)) }}
                    </div>
                </div>
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">รวมภาษีหัก ณ ที่จ่าย</div>
                    <div class="text-xl font-bold text-primary-600 dark:text-primary-400">
                        {{ formatNumber(taxes.reduce((sum, t) => sum + getTaxTotal(t).amount, 0)) }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="!taxes || taxes.length === 0" class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
            <i class="pi pi-percentage text-6xl text-surface-400 dark:text-surface-600 mb-4"></i>
            <h3 class="text-xl font-semibold mb-2 text-surface-700 dark:text-surface-300">ไม่มีรายการภาษีหัก ณ ที่จ่าย</h3>
            <p class="text-surface-500 dark:text-surface-400 mb-4">คลิกปุ่มด้านบนเพื่อเพิ่มรายการ</p>
        </div>

        <!-- Tax Entries -->
        <div v-else class="space-y-4">
            <Card v-for="(tax, taxIndex) in taxes" :key="taxIndex" class="border border-surface-200 dark:border-surface-700">
                <template #title>
                    <div class="flex justify-between items-center">
                        <span class="text-base">รายการที่ {{ taxIndex + 1 }}</span>
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="removeTaxEntry(taxIndex)" v-tooltip.left="'ลบรายการ'" />
                    </div>
                </template>
                <template #content>
                    <div class="space-y-4">
                        <!-- Tax Info -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- ภาษี -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">ภาษี</label>
                                <SelectButton :key="taxTypeKeys[taxIndex] || 0" :modelValue="tax.taxtype" @update:modelValue="handleTaxTypeChange(taxIndex, $event)" :options="taxTypeOptions" optionLabel="label" optionValue="value" fluid />
                            </div>

                            <!-- ประเภท -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">ประเภท</label>
                                <SelectButton :key="custTypeKeys[taxIndex] || 0" :modelValue="tax.custtype" @update:modelValue="handleCustTypeChange(taxIndex, $event)" :options="custTypeOptions" optionLabel="label" optionValue="value" fluid />
                            </div>

                            <!-- วันที่หัก ณ ที่จ่าย -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">วันที่หัก ณ ที่จ่าย</label>
                                <ThaiDatePicker v-model="tax.taxdate" dateFormat="dd/mm/yy" showIcon fluid />
                            </div>

                            <!-- เลขที่เอกสาร -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">เลขที่เอกสาร <span class="text-red-500">*</span></label>
                                <InputText v-model="tax.taxdocno" placeholder="เลขที่เอกสาร" :invalid="isTaxDocNoInvalid(tax)" />
                                <small v-if="isTaxDocNoInvalid(tax)" class="text-red-500">กรุณากรอกเลขที่เอกสาร</small>
                            </div>

                            <!-- ชื่อ -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">ชื่อ <span class="text-red-500">*</span></label>
                                <InputText v-model="tax.custname" placeholder="ชื่อ" :invalid="isCustNameInvalid(tax)" />
                                <small v-if="isCustNameInvalid(tax)" class="text-red-500">กรุณากรอกชื่อ</small>
                            </div>

                            <!-- เลขประจำตัวผู้เสียภาษี -->
                            <div class="flex flex-col gap-2">
                                <label class="font-medium text-sm">เลขประจำตัวผู้เสียภาษี/เลขที่บัตรประชาชน <span class="text-red-500">*</span></label>
                                <InputText v-model="tax.custtaxid" placeholder="เลขประจำตัวผู้เสียภาษี" maxlength="13" :invalid="isCustTaxIdInvalid(tax)" />
                                <small v-if="isCustTaxIdInvalid(tax)" class="text-red-500">กรุณากรอกเลขประจำตัวผู้เสียภาษี</small>
                            </div>

                            <!-- ที่อยู่ -->
                            <div class="flex flex-col gap-2 md:col-span-2">
                                <label class="font-medium text-sm">ที่อยู่</label>
                                <Textarea v-model="tax.address" rows="2" placeholder="ที่อยู่" />
                            </div>
                        </div>

                        <!-- Details Table -->
                        <div class="mt-4">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-semibold text-surface-900 dark:text-surface-0">รายละเอียด</h4>
                                <Button label="เพิ่มรายการ" icon="pi pi-plus" size="small" @click="addDetailRow(taxIndex)" />
                            </div>

                            <DataTable :value="tax.details" class="text-sm">
                                <Column field="description" header="รายละเอียด *">
                                    <template #body="{ data, index }">
                                        <InputText v-model="data.description" placeholder="รายละเอียด" class="w-full" :invalid="isDetailDescriptionInvalid(data)" />
                                    </template>
                                </Column>
                                <Column field="taxbase" header="ฐานภาษี *" style="width: 150px">
                                    <template #body="{ data, index }">
                                        <InputText
                                            :value="getAmountDisplayValue(taxIndex, index, 'taxbase', data.taxbase)"
                                            @input="handleAmountInput(taxIndex, index, 'taxbase', $event)"
                                            @blur="handleAmountBlur(taxIndex, index, 'taxbase', $event)"
                                            @focus="handleAmountFocus(taxIndex, index, 'taxbase', $event)"
                                            class="w-full text-right"
                                            placeholder="0.00"
                                            :invalid="isDetailTaxBaseInvalid(data)"
                                        />
                                    </template>
                                </Column>
                                <Column field="taxrate" header="อัตรา (%)" style="width: 120px">
                                    <template #body="{ data, index }">
                                        <InputText
                                            :value="getAmountDisplayValue(taxIndex, index, 'taxrate', data.taxrate)"
                                            @input="handleAmountInput(taxIndex, index, 'taxrate', $event)"
                                            @blur="handleAmountBlur(taxIndex, index, 'taxrate', $event)"
                                            @focus="handleAmountFocus(taxIndex, index, 'taxrate', $event)"
                                            class="w-full text-right"
                                            placeholder="0.00"
                                        />
                                    </template>
                                </Column>
                                <Column field="taxamount" header="ภาษีหัก ณ ที่จ่าย" style="width: 150px">
                                    <template #body="{ data }">
                                        <InputNumber v-model="data.taxamount" :minFractionDigits="2" :maxFractionDigits="2" inputClass="text-right" class="w-full bg-surface-100 dark:bg-surface-700" />
                                    </template>
                                </Column>
                                <Column style="width: 60px">
                                    <template #body="{ index }">
                                        <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeDetailRow(taxIndex, index)" :disabled="tax.details.length === 1" />
                                    </template>
                                </Column>
                            </DataTable>

                            <!-- Detail Total -->
                            <div class="mt-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                                <div class="flex justify-end gap-8">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-medium">รวมฐานภาษี:</span>
                                        <span class="text-lg font-bold">{{ formatNumber(getTaxTotal(tax).base) }}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-medium">รวมภาษีหัก ณ ที่จ่าย:</span>
                                        <span class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatNumber(getTaxTotal(tax).amount) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
