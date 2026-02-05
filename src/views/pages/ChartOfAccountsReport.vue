<script setup>
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const accounts = ref([]);
const searchPopover = ref(null);
const chartOfAccounts = ref([]);

// Search filters
const fromAccountCode = ref(null);
const toAccountCode = ref(null);

// คำอธิบายประเภทต่างๆ
const accountCategoryTypes = {
    1: 'สินทรัพย์',
    2: 'หนี้สิน',
    3: 'ทุน',
    4: 'รายได้',
    5: 'ค่าใช้จ่าย'
};

const accountLevelTypes = {
    1: 'ระดับ 1',
    2: 'ระดับ 2',
    3: 'ระดับ 3',
    4: 'ระดับ 4',
    5: 'ระดับ 5'
};

const balanceTypes = {
    1: 'เดบิต',
    2: 'เครดิต'
};

// ตรวจสอบว่าเป็นบัญชีหลักหรือไม่
const isMainAccount = (account) => {
    return !account.consolidateaccountcode || account.consolidateaccountcode === '' || account.consolidateaccountcode === account.accountcode;
};

// Get account style based on level
const getAccountStyle = (data) => {
    const level = data.accountlevel || 1;
    return {
        fontWeight: level <= 2 ? 'bold' : 'normal'
    };
};

// Get account name with indentation based on level
const getIndentedAccountName = (data) => {
    const level = data.accountlevel || 1;
    const indent = '\u00A0\u00A0'.repeat(Math.max(0, level - 1));
    return indent + data.accountname;
};

// Load chart of accounts for dropdown
const loadChartOfAccounts = async () => {
    try {
        const response = await api.getChartOfAccounts({ limit: 2000, sort: 'accountcode:1' });
        if (response.success) {
            chartOfAccounts.value = response.data.map((account) => ({
                ...account,
                displayLabel: `${account.accountcode} - ${account.accountname}`
            }));
        }
    } catch (error) {
        console.error('Error loading chart of accounts:', error);
    }
};

// Fetch accounts data
const fetchAccounts = async () => {
    showLoading('กำลังโหลดข้อมูลรายงานผังบัญชี...');

    try {
        const params = {
            limit: 2000,
            sort: 'accountcode:1'
        };

        // Add accountcode range if selected
        if (fromAccountCode.value && toAccountCode.value) {
            params.accountcode = `${fromAccountCode.value.accountcode}:${toAccountCode.value.accountcode}`;
        } else if (fromAccountCode.value) {
            params.accountcode = fromAccountCode.value.accountcode;
        }

        const response = await api.getChartOfAccounts(params);

        if (response.success) {
            accounts.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: response.message || 'ไม่สามารถดึงข้อมูลรายงานได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching chart of accounts report:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

// Toggle search popover
const toggleSearchPopover = (event) => {
    searchPopover.value.toggle(event);
};

// Search and close popover
const searchAndClosePopover = () => {
    searchPopover.value.hide();
    fetchAccounts();
};

// Clear all filters
const clearFilters = () => {
    fromAccountCode.value = null;
    toAccountCode.value = null;
};

// Initialize on mount
onMounted(() => {
    loadChartOfAccounts();
    fetchAccounts();
});
</script>

<template>
    <div class="card bg-surface-card p-6 rounded-xl shadow-sm">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานรหัสผังบัญชี</span>
                <div class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-list mr-1"></i>
                    ทั้งหมด {{ accounts.length }} รายการ
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" severity="secondary" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4 text-center">
                <div class="font-bold text-xl mb-0">รายงานรหัสผังบัญชี</div>
                <p v-if="fromAccountCode && toAccountCode" class="text-sm text-surface-600 dark:text-surface-400">จาก {{ fromAccountCode.displayLabel }} ถึง {{ toAccountCode.displayLabel }}</p>
                <p v-else class="text-sm text-surface-600 dark:text-surface-400">แสดงทั้งหมด</p>
            </div>

            <!-- Report Table -->
            <DataTable :value="accounts" showGridlines :rowHover="true" scrollable scrollHeight="calc(100vh - 280px)" tableStyle="min-width: 60rem" stripedRows>
                <Column field="accountcode" header="รหัสบัญชี" style="width: 150px">
                    <template #body="{ data }">
                        <span class="text-primary" :class="{ 'font-black': isMainAccount(data) }">{{ data.accountcode }}</span>
                    </template>
                </Column>
                <Column field="accountname" header="ชื่อผังบัญชี" style="min-width: 300px">
                    <template #body="{ data }">
                        <span :style="getAccountStyle(data)">{{ getIndentedAccountName(data) }}</span>
                    </template>
                </Column>
                <Column field="accountcategory" header="หมวดบัญชี" style="width: 150px">
                    <template #body="{ data }">
                        <Tag :value="accountCategoryTypes[data.accountcategory] || 'ไม่ระบุ'" :severity="data.accountcategory <= 3 ? 'success' : 'warn'" />
                    </template>
                </Column>
                <Column field="accountlevel" header="ระดับบัญชี" style="width: 120px">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ accountLevelTypes[data.accountlevel] || data.accountlevel }}</span>
                    </template>
                </Column>
                <Column field="accountbalancetype" header="ด้านบัญชี" style="width: 120px">
                    <template #body="{ data }">
                        <Tag :value="balanceTypes[data.accountbalancetype] || 'ไม่ระบุ'" :severity="data.accountbalancetype === 1 ? 'info' : 'secondary'" />
                    </template>
                </Column>
                <Column field="consolidateaccountcode" header="รหัสผังบัญชีกลาง" style="min-width: 180px">
                    <template #body="{ data }">
                        <span class="text-surface-600 dark:text-surface-400">{{ data.consolidateaccountcode || '-' }}</span>
                    </template>
                </Column>

                <!-- Empty State -->
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-5xl text-surface-400 mb-4 block"></i>
                        <p class="text-surface-600 dark:text-surface-400 text-lg">ไม่พบข้อมูลรายงาน</p>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-96">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <!-- Account Code Range -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">จากผังบัญชี</label>
                        <Select v-model="fromAccountCode" :options="chartOfAccounts" optionLabel="displayLabel" placeholder="เลือกผังบัญชี..." filter showClear fluid>
                            <template #option="slotProps">
                                <div
                                    :class="{
                                        'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                        'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                        'text-surface-700 dark:text-surface-300': slotProps.option.accountlevel > 2
                                    }"
                                >
                                    {{ slotProps.option.displayLabel }}
                                </div>
                            </template>
                        </Select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงผังบัญชี</label>
                        <Select v-model="toAccountCode" :options="chartOfAccounts" optionLabel="displayLabel" placeholder="เลือกผังบัญชี..." filter showClear fluid>
                            <template #option="slotProps">
                                <div
                                    :class="{
                                        'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                        'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                        'text-surface-700 dark:text-surface-300': slotProps.option.accountlevel > 2
                                    }"
                                >
                                    {{ slotProps.option.displayLabel }}
                                </div>
                            </template>
                        </Select>
                    </div>
                </div>

                <div class="text-xs text-surface-500 dark:text-surface-400 -mt-2">
                    <i class="pi pi-info-circle mr-1"></i>
                    หากไม่เลือก จะแสดงทั้งหมด
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-between mt-2">
                    <Button label="ล้างเงื่อนไข" icon="pi pi-times" severity="secondary" text @click="clearFilters" />
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>
</template>

<style scoped lang="scss">
:deep(.p-datatable) {
    .p-datatable-tbody > tr:hover {
        background-color: var(--p-datatable-row-hover-background);
    }
}
</style>
