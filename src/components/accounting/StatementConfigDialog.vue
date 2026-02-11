<script setup>
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import { getChartOfAccounts, getJournalBooks } from '@/services/api/journal';
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'save']);

const journalBooks = ref([]);
const chartOfAccounts = ref([]);

// Form data
const config = ref({
    journalBook: null,
    referenceDate: null,
    referenceNo: '',
    passbookAccount: null,
    reversalAccount: null
});

// Validation
const errors = ref({
    journalBook: false,
    passbookAccount: false,
    reversalAccount: false
});

// โหลดข้อมูล Journal Books
const loadJournalBooks = async () => {
    try {
        const response = await getJournalBooks({ limit: 100 });
        if (response.data?.success) {
            journalBooks.value = response.data.data || [];
        }
    } catch (error) {
        console.error('Error loading journal books:', error);
    }
};

// โหลดข้อมูล Chart of Accounts แบบ flat list (pattern จาก LedgerAccountReport)
const loadAllChartOfAccounts = async () => {
    try {
        const response = await getChartOfAccounts({
            q: '',
            page: 1,
            limit: 1000,
            sort: 'accountcode:1'
        });

        if (response.data?.success) {
            const accounts = response.data.data || [];

            chartOfAccounts.value = accounts.map((item) => {
                if (item.accountlevel === 1) {
                    return {
                        ...item,
                        displayLabel: `\u{1F4C1} ${item.accountcode} - ${item.accountname}`,
                        disabled: true,
                        isHeader: true
                    };
                } else if (item.accountlevel === 2) {
                    return {
                        ...item,
                        displayLabel: `    \u{1F4C1} ${item.accountcode} - ${item.accountname}`,
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
        chartOfAccounts.value = [];
    }
};

// Validate form
const validateForm = () => {
    errors.value = {
        journalBook: !config.value.journalBook,
        passbookAccount: !config.value.passbookAccount,
        reversalAccount: !config.value.reversalAccount
    };

    return !Object.values(errors.value).some((error) => error);
};

// Handle save
const handleSave = () => {
    if (!validateForm()) {
        return;
    }

    emit('save', {
        bookCode: config.value.journalBook.code,
        bookName: config.value.journalBook.name1,
        referenceDate: config.value.referenceDate,
        referenceNo: config.value.referenceNo,
        passbookAccount: config.value.passbookAccount,
        reversalAccount: config.value.reversalAccount
    });
};

// Handle close
const handleClose = () => {
    emit('update:visible', false);
};

// Reset form
const resetForm = () => {
    config.value = {
        journalBook: null,
        referenceDate: null,
        referenceNo: '',
        passbookAccount: null,
        reversalAccount: null
    };
    errors.value = {
        journalBook: false,
        passbookAccount: false,
        reversalAccount: false
    };
};

// Watch visible to reset form when dialog opens
watch(
    () => props.visible,
    (newValue) => {
        if (newValue) {
            resetForm();
        }
    }
);

onMounted(() => {
    loadJournalBooks();
    loadAllChartOfAccounts();
});
</script>

<template>
    <Dialog :visible="visible" modal :closable="!loading" :dismissableMask="false" header="กำหนดค่าการบันทึกรายการบัญชี" class="w-full max-w-3xl" @update:visible="handleClose" @keydown.enter="handleSave">
        <div class="flex flex-col gap-4 p-4">
            <!-- สมุดรายวัน -->
            <div class="flex flex-col gap-2">
                <label class="font-medium">สมุดรายวัน <span class="text-red-500">*</span></label>
                <Dropdown v-model="config.journalBook" :options="journalBooks" optionLabel="name1" placeholder="เลือกสมุดรายวัน" filter :invalid="errors.journalBook" :disabled="loading" class="w-full" @keydown.enter="handleSave">
                    <template #option="slotProps">
                        <div>{{ slotProps.option.code }} - {{ slotProps.option.name1 }}</div>
                    </template>
                    <template #value="slotProps">
                        <div v-if="slotProps.value">{{ slotProps.value.code }} - {{ slotProps.value.name1 }}</div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                </Dropdown>
                <small v-if="errors.journalBook" class="text-red-500">กรุณาเลือกสมุดรายวัน</small>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <!-- วันที่เอกสารอ้างอิง -->
                <div class="flex flex-col gap-2">
                    <label class="font-medium">วันที่เอกสารอ้างอิง</label>
                    <ThaiDatePicker v-model="config.referenceDate" placeholder="เลือกวันที่" :disabled="loading" dateFormat="dd/mm/yy" showIcon />
                </div>

                <!-- เลขที่เอกสารอ้างอิง -->
                <div class="flex flex-col gap-2">
                    <label class="font-medium">เลขที่เอกสารอ้างอิง</label>
                    <InputText v-model="config.referenceNo" placeholder="กรอกเลขที่เอกสาร" :disabled="loading" @keydown.enter="handleSave" />
                </div>
            </div>

            <!-- ผังบัญชีสมุดเงินฝาก -->
            <div class="flex flex-col gap-2">
                <label class="font-medium">ผังบัญชีสมุดเงินฝาก (บัญชีธนาคาร) <span class="text-red-500">*</span></label>
                <Select
                    v-model="config.passbookAccount"
                    :options="chartOfAccounts"
                    optionLabel="displayLabel"
                    optionDisabled="disabled"
                    placeholder="เลือกผังบัญชี..."
                    filter
                    showClear
                    fluid
                    :invalid="errors.passbookAccount"
                    :disabled="loading"
                    @keydown.enter="handleSave"
                >
                    <template #option="slotProps">
                        <div
                            :class="{
                                'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                'text-surface-700 dark:text-surface-300': !slotProps.option.disabled
                            }"
                        >
                            {{ slotProps.option.displayLabel }}
                        </div>
                    </template>
                    <template #value="slotProps">
                        <div v-if="slotProps.value">{{ slotProps.value.accountcode }} - {{ slotProps.value.accountname }}</div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                </Select>
                <small v-if="errors.passbookAccount" class="text-red-500">กรุณาเลือกผังบัญชีสมุดเงินฝาก</small>
            </div>

            <!-- ผังบัญชีกลับรายการ -->
            <div class="flex flex-col gap-2">
                <label class="font-medium">ผังบัญชีกลับรายการ (รับ/จ่าย) <span class="text-red-500">*</span></label>
                <Select
                    v-model="config.reversalAccount"
                    :options="chartOfAccounts"
                    optionLabel="displayLabel"
                    optionDisabled="disabled"
                    placeholder="เลือกผังบัญชี..."
                    filter
                    showClear
                    fluid
                    :invalid="errors.reversalAccount"
                    :disabled="loading"
                    @keydown.enter="handleSave"
                >
                    <template #option="slotProps">
                        <div
                            :class="{
                                'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                'text-surface-700 dark:text-surface-300': !slotProps.option.disabled
                            }"
                        >
                            {{ slotProps.option.displayLabel }}
                        </div>
                    </template>
                    <template #value="slotProps">
                        <div v-if="slotProps.value">{{ slotProps.value.accountcode }} - {{ slotProps.value.accountname }}</div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                </Select>
                <small v-if="errors.reversalAccount" class="text-red-500">กรุณาเลือกผังบัญชีกลับรายการ</small>
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" severity="secondary" @click="handleClose" :disabled="loading" />
            <Button label="สร้างรายการบัญชี (Enter)" icon="pi pi-save" @click="handleSave" :loading="loading" :disabled="loading" />
        </template>
    </Dialog>
</template>
