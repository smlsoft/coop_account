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
const organizationOptions = [
    { label: 'สำนักงานใหญ่', value: 1 },
    { label: 'สาขา', value: 2 }
];

// Function to get vatTypeOptions based on vatmode
const getVatTypeOptions = (vatmode) => {
    if (vatmode === 0) {
        // ภาษีซื้อ
        return [
            { label: 'ปกติ', value: 0 },
            { label: 'ขอคืนไม่ได้', value: 1 },
            { label: 'ไม่ถึงกำหนดชำระ', value: 2 }
        ];
    } else {
        // ภาษีขาย
        return [
            { label: 'ปกติ', value: 0 },
            { label: 'ไม่ถึงกำหนดชำระ', value: 1 }
        ];
    }
};

const vatModeOptions = [
    { label: 'ภาษีซื้อ', value: 0 },
    { label: 'ภาษีขาย', value: 1 }
];

// Reactive keys สำหรับ force re-render SelectButton เมื่อ block null value (per VAT entry)
const organizationKeys = ref({});
const vatModeKeys = ref({});
const vatTypeKeys = ref({});

// ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของ SelectButton โดยป้องกัน unselect
const handleOrganizationChange = (index, val) => {
    if (val !== null && val !== undefined) {
        vats.value[index].organization = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        organizationKeys.value[index] = (organizationKeys.value[index] || 0) + 1;
    }
};

const handleVatModeChange = (index, val) => {
    if (val !== null && val !== undefined) {
        vats.value[index].vatmode = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        vatModeKeys.value[index] = (vatModeKeys.value[index] || 0) + 1;
    }
};

const handleVatTypeChange = (index, val) => {
    if (val !== null && val !== undefined) {
        vats.value[index].vattype = val;
    } else {
        // Force re-render เพื่อให้ SelectButton แสดง UI ตามค่าปัจจุบัน
        vatTypeKeys.value[index] = (vatTypeKeys.value[index] || 0) + 1;
    }
};

// Local state
const localValue = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

const vats = computed({
    get: () => localValue.value.vats || [],
    set: (value) => {
        localValue.value = {
            ...localValue.value,
            vats: value
        };
    }
});

// Add new VAT entry
const addVatEntry = () => {
    const debtInfo = getDebtAccountInfo();

    // กำหนด vatmode ตามประเภทหนี้
    // debtaccounttype = 0 (ลูกหนี้) → vatmode = 1 (ภาษีขาย)
    // debtaccounttype = 1 (เจ้าหนี้) → vatmode = 0 (ภาษีซื้อ)
    const vatmode = localValue.value.debtaccounttype === 0 ? 1 : 0;

    // ใช้ docdate จาก JournalDailyInfoTab ถ้ามี ไม่เช่นนั้นใช้วันที่ปัจจุบัน
    const vatdate = localValue.value.docdate ? new Date(localValue.value.docdate) : new Date();

    const newEntry = {
        vatdocno: '',
        vatdate: vatdate,
        vattype: 0,
        vatmode: vatmode,
        vatperiod: vatdate.getMonth() + 1,
        vatyear: vatdate.getFullYear() + 543,
        vatbase: 0,
        vatrate: 7,
        vatamount: 0,
        exceptvat: 0,
        vatsubmit: false,
        remark: '',
        custtaxid: debtInfo.custtaxid,
        custname: debtInfo.custname,
        custtype: 0,
        organization: debtInfo.organization || 1, // ค่าเริ่มต้น = 1 (สำนักงานใหญ่)
        branchcode: debtInfo.branchcode,
        address: debtInfo.address
    };

    vats.value = [...vats.value, newEntry];
};

// Remove VAT entry
const removeVatEntry = (index) => {
    vats.value = vats.value.filter((_, i) => i !== index);
};

// Update year and period from vatdate
const updateYearAndPeriod = (index) => {
    const vat = vats.value[index];
    if (vat.vatdate) {
        const date = new Date(vat.vatdate);
        vats.value[index].vatyear = date.getFullYear() + 543; // พ.ศ.
        vats.value[index].vatperiod = date.getMonth() + 1; // 1-12
    }
};

// Watch for changes in vatbase or vatrate
const handleVatChange = (index) => {
    const vat = vats.value[index];
    const base = parseFloat(vat.vatbase) || 0;
    const rate = parseFloat(vat.vatrate) || 0;
    vats.value[index].vatamount = (base * rate) / 100;
};

// Watch for changes in vatdate
const handleDateChange = (index) => {
    updateYearAndPeriod(index);
};

// Get debt account info (custname, custtaxid, organization, branchcode, address) from JournalDailyInfoTab
const getDebtAccountInfo = () => {
    const debtAccount = localValue.value.debtaccountcode;
    if (debtAccount) {
        const thName = debtAccount.names?.find((n) => n.code === 'th')?.name || '';
        return {
            custname: thName || debtAccount.name || '',
            custtaxid: debtAccount.taxid || '',
            organization: debtAccount.customertype || 0,
            branchcode: debtAccount.branchnumber || '00000',
            address: debtAccount.addressforbilling?.address?.[0] || ''
        };
    }
    return { custname: '', custtaxid: '', organization: 0, branchcode: '00000', address: '' };
};

// Format number display
const formatNumber = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toFixed(2);
};

// Track which input is currently being edited
const editingAmountCell = ref(null); // { index, field }
const editingValue = ref('');

// Format number for display (with commas and 2 decimals)
const formatAmountDisplay = (value) => {
    const num = parseFloat(value) || 0;
    if (num === 0) return '';
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Get display value - show raw value when editing, formatted when not
const getAmountDisplayValue = (index, field, value) => {
    if (editingAmountCell.value?.index === index && editingAmountCell.value?.field === field) {
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
const handleAmountInput = (index, field, event) => {
    editingValue.value = event.target.value;
};

// Handle amount blur (format the display and save)
const handleAmountBlur = (index, field, event) => {
    const value = parseAmountInput(event.target.value);
    vats.value[index][field] = value;
    // Recalculate vatamount if needed
    if (field === 'vatbase' || field === 'vatrate') {
        handleVatChange(index);
    }
    editingAmountCell.value = null;
    editingValue.value = '';
};

// Handle amount focus (select all text for easy editing)
const handleAmountFocus = (index, field, event) => {
    editingAmountCell.value = { index, field };
    // Show raw number value when focusing (without commas)
    const currentValue = vats.value[index]?.[field] || 0;
    editingValue.value = currentValue === 0 ? '' : String(currentValue);
    nextTick(() => {
        event.target.value = editingValue.value;
        event.target.select();
    });
};

// Validation helpers
const isVatDocNoInvalid = (vat) => !vat.vatdocno || vat.vatdocno.trim() === '';
const isCustTaxIdInvalid = (vat) => !vat.custtaxid || vat.custtaxid.trim() === '';
const isCustNameInvalid = (vat) => !vat.custname || vat.custname.trim() === '';
const isVatBaseInvalid = (vat) => !vat.vatbase || parseFloat(vat.vatbase) === 0;

// Watch for changes in debtaccountcode and update all vat entries
// ใช้ guidfixed เป็น primitive value เพื่อหลีกเลี่ยง infinite loop จาก deep watch
let lastDebtAccountGuid = null;
watch(
    () => localValue.value.debtaccountcode?.guidfixed,
    (newGuid) => {
        // ป้องกัน infinite loop โดยเปรียบเทียบ guid
        if (newGuid && newGuid !== lastDebtAccountGuid && vats.value.length > 0) {
            lastDebtAccountGuid = newGuid;
            const debtInfo = getDebtAccountInfo();
            // Update all existing vat entries
            vats.value = vats.value.map((vat) => ({
                ...vat,
                custname: debtInfo.custname,
                custtaxid: debtInfo.custtaxid,
                organization: debtInfo.organization,
                branchcode: debtInfo.branchcode,
                address: debtInfo.address
            }));
        } else if (!newGuid) {
            lastDebtAccountGuid = null;
        }
    }
);

// Watch for changes in debtaccounttype and update vatmode in all vat entries
let lastDebtAccountType = null;
watch(
    () => localValue.value.debtaccounttype,
    (newType, oldType) => {
        // ป้องกัน infinite loop โดยตรวจสอบว่าค่าเปลี่ยนจริงๆ
        if (newType !== oldType && newType !== lastDebtAccountType) {
            lastDebtAccountType = newType;

            // อัปเดต vatmode และ vattype ของทุก vat entry ที่มีอยู่
            if (vats.value.length > 0) {
                // debtaccounttype = 0 (ลูกหนี้) → vatmode = 1 (ภาษีขาย)
                // debtaccounttype = 1 (เจ้าหนี้) → vatmode = 0 (ภาษีซื้อ)
                const vatmode = newType === 0 ? 1 : 0;
                // vatmode = 0 (ภาษีซื้อ) → vattype = 1 (ขอคืนไม่ได้)
                // vatmode = 1 (ภาษีขาย) → vattype = 0 (ปกติ)
                const vattype = vatmode === 0 ? 1 : 0;

                // ใช้ index-based update เพื่อให้ Vue track reactivity ได้ถูกต้อง
                vats.value.forEach((vat, index) => {
                    vats.value[index].vatmode = vatmode;
                    vats.value[index].vattype = vattype;
                });
            }
        }
    }
);

// หมายเหตุ: ลบ watch docdate ออก เพราะ JournalDailyInfoTab จัดการแล้ว
// การอัปเดต vatdate จะทำผ่าน parent component เพื่อป้องกัน infinite loop
</script>

<template>
    <div class="space-y-4">
        <!-- Header with Add Button -->
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">รายการภาษี</h3>
            <Button label="เพิ่มรายการภาษี" icon="pi pi-plus" @click="addVatEntry" size="small" />
        </div>

        <!-- Summary -->
        <div v-if="vats && vats.length > 0" class="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ vats.length }}</div>
                </div>
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ formatNumber(vats.reduce((sum, v) => sum + (parseFloat(v.vatbase) || 0), 0)) }}</div>
                </div>
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">รวมยอดภาษี</div>
                    <div class="text-xl font-bold text-primary-600 dark:text-primary-400">{{ formatNumber(vats.reduce((sum, v) => sum + (parseFloat(v.vatamount) || 0), 0)) }}</div>
                </div>
                <div>
                    <div class="text-sm text-surface-600 dark:text-surface-400">รวมยกเว้นภาษี</div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ formatNumber(vats.reduce((sum, v) => sum + (parseFloat(v.exceptvat) || 0), 0)) }}</div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="!vats || vats.length === 0" class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
            <i class="pi pi-file-edit text-6xl text-surface-400 dark:text-surface-600 mb-4"></i>
            <h3 class="text-xl font-semibold mb-2 text-surface-700 dark:text-surface-300">ไม่มีรายการภาษี</h3>
            <p class="text-surface-500 dark:text-surface-400 mb-4">คลิกปุ่มด้านบนเพื่อเพิ่มรายการภาษี</p>
        </div>

        <!-- VAT Entries -->
        <div v-else class="space-y-4">
            <Card v-for="(vat, index) in vats" :key="index" class="border border-surface-200 dark:border-surface-700">
                <template #title>
                    <div class="flex justify-between items-center">
                        <span class="text-base">รายการที่ {{ index + 1 }}</span>
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="removeVatEntry(index)" v-tooltip.left="'ลบรายการ'" />
                    </div>
                </template>
                <template #content>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- วันที่ใบกำกับ -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">วันที่ใบกำกับ</label>
                            <ThaiDatePicker v-model="vat.vatdate" dateFormat="dd/mm/yy" showIcon @update:modelValue="handleDateChange(index)" fluid />
                        </div>

                        <!-- เลขที่ใบกำกับ -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">เลขที่ใบกำกับ <span class="text-red-500">*</span></label>
                            <InputText v-model="vat.vatdocno" placeholder="เลขที่ใบกำกับ" :invalid="isVatDocNoInvalid(vat)" />
                            <small v-if="isVatDocNoInvalid(vat)" class="text-red-500">กรุณากรอกเลขที่ใบกำกับ</small>
                        </div>

                        <!-- ชื่อ -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ชื่อ <span class="text-red-500">*</span></label>
                            <InputText v-model="vat.custname" placeholder="ชื่อลูกค้า/ผู้ขาย" :invalid="isCustNameInvalid(vat)" />
                            <small v-if="isCustNameInvalid(vat)" class="text-red-500">กรุณากรอกชื่อ</small>
                        </div>

                        <!-- เลขประจำตัวผู้เสียภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">เลขประจำตัวผู้เสียภาษี/เลขที่บัตรประชาชน <span class="text-red-500">*</span></label>
                            <InputText v-model="vat.custtaxid" placeholder="เลขประจำตัวผู้เสียภาษี" maxlength="13" :invalid="isCustTaxIdInvalid(vat)" />
                            <small v-if="isCustTaxIdInvalid(vat)" class="text-red-500">กรุณากรอกเลขประจำตัวผู้เสียภาษี</small>
                        </div>

                        <!-- สถานประกอบการ -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">สถานประกอบการ</label>
                            <SelectButton :key="organizationKeys[index] || 0" :modelValue="vat.organization" @update:modelValue="handleOrganizationChange(index, $event)" :options="organizationOptions" optionLabel="label" optionValue="value" fluid />
                        </div>

                        <!-- ลำดับที่สาขา -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ลำดับที่สาขา</label>
                            <InputText v-model="vat.branchcode" placeholder="เช่น 00000, 00001" maxlength="5" />
                        </div>

                        <!-- ปีภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ปีภาษี (พ.ศ.)</label>
                            <InputNumber v-model="vat.vatyear" :useGrouping="false" disabled class="bg-surface-100 dark:bg-surface-700" />
                        </div>

                        <!-- เดือนภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">เดือนภาษี</label>
                            <InputNumber v-model="vat.vatperiod" :min="1" :max="12" :useGrouping="false" disabled class="bg-surface-100 dark:bg-surface-700" />
                        </div>

                        <!-- ฐานภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ฐานภาษี <span class="text-red-500">*</span></label>
                            <InputText
                                :value="getAmountDisplayValue(index, 'vatbase', vat.vatbase)"
                                @input="handleAmountInput(index, 'vatbase', $event)"
                                @blur="handleAmountBlur(index, 'vatbase', $event)"
                                @focus="handleAmountFocus(index, 'vatbase', $event)"
                                class="text-right"
                                placeholder="0.00"
                                :invalid="isVatBaseInvalid(vat)"
                            />
                            <small v-if="isVatBaseInvalid(vat)" class="text-red-500">กรุณากรอกฐานภาษี</small>
                        </div>

                        <!-- อัตราภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">อัตราภาษี (%)</label>
                            <InputText
                                :value="getAmountDisplayValue(index, 'vatrate', vat.vatrate)"
                                @input="handleAmountInput(index, 'vatrate', $event)"
                                @blur="handleAmountBlur(index, 'vatrate', $event)"
                                @focus="handleAmountFocus(index, 'vatrate', $event)"
                                class="text-right"
                                placeholder="0.00"
                            />
                        </div>

                        <!-- ประเภทภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ประเภทภาษี</label>
                            <SelectButton :key="vatModeKeys[index] || 0" :modelValue="vat.vatmode" @update:modelValue="handleVatModeChange(index, $event)" :options="vatModeOptions" optionLabel="label" optionValue="value" fluid />
                        </div>

                        <!-- ภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ภาษี</label>
                            <SelectButton :key="vatTypeKeys[index] || 0" :modelValue="vat.vattype" @update:modelValue="handleVatTypeChange(index, $event)" :options="getVatTypeOptions(vat.vatmode)" optionLabel="label" optionValue="value" fluid />
                        </div>

                        <!-- ยอดภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ยอดภาษี</label>
                            <InputNumber v-model="vat.vatamount" :minFractionDigits="2" :maxFractionDigits="2" class="bg-surface-100 dark:bg-surface-700" />
                        </div>

                        <!-- ยอดยกเว้นภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ยอดยกเว้นภาษี</label>
                            <InputText
                                :value="getAmountDisplayValue(index, 'exceptvat', vat.exceptvat)"
                                @input="handleAmountInput(index, 'exceptvat', $event)"
                                @blur="handleAmountBlur(index, 'exceptvat', $event)"
                                @focus="handleAmountFocus(index, 'exceptvat', $event)"
                                class="text-right"
                                placeholder="0.00"
                            />
                        </div>

                        <!-- หมายเหตุ (full width) -->
                        <div class="flex flex-col gap-2 md:col-span-2">
                            <label class="font-medium text-sm">หมายเหตุ</label>
                            <Textarea v-model="vat.remark" rows="3" placeholder="หมายเหตุ" />
                        </div>

                        <!-- ยืนยัน -->
                        <div class="flex items-center gap-2 md:col-span-2">
                            <Checkbox v-model="vat.vatsubmit" :binary="true" :inputId="'vatsubmit-' + index" />
                            <label :for="'vatsubmit-' + index" class="font-medium text-sm cursor-pointer">ยื่นเพิ่ม</label>
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
