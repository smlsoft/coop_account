<script setup>
import { computed, watch } from 'vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';

const props = defineProps({
    modelValue: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['update:modelValue']);

// Dropdown options
const organizationOptions = [
    { label: 'สำนักงานใหญ่', value: 0 },
    { label: 'สาขา', value: 1 }
];

const vatTypeOptions = [
    { label: 'ภาษีซื้อ', value: 0 },
    { label: 'ภาษีขาย', value: 1 }
];

const vatModeOptions = [
    { label: 'ปกติ', value: 0 },
    { label: 'ขอคืนไม่ได้', value: 1 },
    { label: 'ไม่ถึงกำหนดชำระ', value: 2 }
];

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

    // กำหนด vattype ตามประเภทหนี้
    // debtaccounttype = 0 (ลูกหนี้) → vattype = 1 (ภาษีขาย)
    // debtaccounttype = 1 (เจ้าหนี้) → vattype = 0 (ภาษีซื้อ)
    const vattype = localValue.value.debtaccounttype === 0 ? 1 : 0;

    // ใช้ docdate จาก JournalDailyInfoTab ถ้ามี ไม่เช่นนั้นใช้วันที่ปัจจุบัน
    const vatdate = localValue.value.docdate ? new Date(localValue.value.docdate) : new Date();

    const newEntry = {
        vatdocno: '',
        vatdate: vatdate,
        vattype: vattype,
        vatmode: 0,
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
        organization: debtInfo.organization,
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

// Watch for changes in debtaccounttype and update vattype in all vat entries
let lastDebtAccountType = null;
watch(
    () => localValue.value.debtaccounttype,
    (newType, oldType) => {
        // ป้องกัน infinite loop โดยตรวจสอบว่าค่าเปลี่ยนจริงๆ
        if (newType !== oldType && newType !== lastDebtAccountType && vats.value.length > 0) {
            lastDebtAccountType = newType;
            // debtaccounttype = 0 (ลูกหนี้) → vattype = 1 (ภาษีขาย)
            // debtaccounttype = 1 (เจ้าหนี้) → vattype = 0 (ภาษีซื้อ)
            const vattype = newType === 0 ? 1 : 0;
            vats.value = vats.value.map((vat) => ({
                ...vat,
                vattype: vattype
            }));
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
                            <SelectButton v-model="vat.organization" :options="organizationOptions" optionLabel="label" optionValue="value" fluid />
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
                            <InputNumber v-model="vat.vatbase" :minFractionDigits="2" :maxFractionDigits="2" @update:modelValue="handleVatChange(index)" :invalid="isVatBaseInvalid(vat)" />
                            <small v-if="isVatBaseInvalid(vat)" class="text-red-500">กรุณากรอกฐานภาษี</small>
                        </div>

                        <!-- อัตราภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">อัตราภาษี (%)</label>
                            <InputNumber v-model="vat.vatrate" :minFractionDigits="2" :maxFractionDigits="2" suffix=" %" @update:modelValue="handleVatChange(index)" />
                        </div>

                        <!-- ภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ภาษี</label>
                            <SelectButton v-model="vat.vattype" :options="vatTypeOptions" optionLabel="label" optionValue="value" fluid />
                        </div>

                        <!-- ประเภทภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ประเภทภาษี</label>
                            <SelectButton v-model="vat.vatmode" :options="vatModeOptions" optionLabel="label" optionValue="value" fluid />
                        </div>

                        <!-- ยอดภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ยอดภาษี</label>
                            <InputNumber v-model="vat.vatamount" :minFractionDigits="2" :maxFractionDigits="2" class="bg-surface-100 dark:bg-surface-700" />
                        </div>

                        <!-- ยอดยกเว้นภาษี -->
                        <div class="flex flex-col gap-2">
                            <label class="font-medium text-sm">ยอดยกเว้นภาษี</label>
                            <InputNumber v-model="vat.exceptvat" :minFractionDigits="2" :maxFractionDigits="2" />
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
