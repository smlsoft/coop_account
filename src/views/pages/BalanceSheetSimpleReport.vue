<script setup>
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { getAccountGroups } from '@/services/api/accountgroup';
import { generateAndDownloadBalanceSheetSimpleExcel, generateAndOpenBalanceSheetSimplePDF, getBalanceSheetSimple } from '@/services/api/report';
import { getShop } from '@/services/api/shop';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

// State
const loading = ref(false);
const downloading = ref(false);
const reportData = ref([]);
const shopData = ref(null);
const searchPopover = ref(null);
const downloadMenu = ref(null);

// Search filters
const fromDate = ref(null);
const endDate = ref(null);
const selectedAccountGroup = ref(null);
const compareYears = ref(false);
const compareYearsActive = ref(false);

// Account groups
const accountGroups = ref([]);
const accountGroupsLoading = ref(false);

// Download menu items
const downloadMenuItems = ref([
    { label: 'ดาวน์โหลด PDF', icon: 'pi pi-file-pdf', command: () => downloadPDF() },
    { label: 'ดาวน์โหลด Excel', icon: 'pi pi-file-excel', command: () => downloadExcel() }
]);

// Format date to YYYY-MM-DD for API
const formatDateForApi = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format date to Thai display format
const formatDateThai = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
};

// Format currency
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absValue);
    return value < 0 ? `(${formatted})` : formatted;
};

// Computed display date range
const displayDateRange = computed(() => {
    if (!fromDate.value && !endDate.value) return '';
    if (fromDate.value && endDate.value) {
        return `${formatDateThai(fromDate.value)} - ${formatDateThai(endDate.value)}`;
    }
    if (endDate.value) return formatDateThai(endDate.value);
    return '';
});

// Computed Thai Buddhist year from endDate
const currentYear = computed(() => {
    if (!endDate.value) return '';
    return new Date(endDate.value).getFullYear() + 543;
});

// Computed previous Thai Buddhist year
const prevYear = computed(() => {
    if (!endDate.value) return '';
    return new Date(endDate.value).getFullYear() + 542;
});

// Computed: is download disabled
const isDownloadDisabled = computed(() => !tableData.value?.length || downloading.value);
const shopName = computed(() => shopData.value?.names?.find((n) => n.code === 'th')?.name || '');
const shopAddress = computed(() => shopData.value?.address?.find((a) => a.code === 'th')?.name || '');
const shopTaxId = computed(() => shopData.value?.settings?.taxid || '');

// Fetch shop data
const fetchShopData = async () => {
    const shopid = localStorage.getItem('shopid');
    if (!shopid) return;
    try {
        const response = await getShop(shopid);
        if (response.success) shopData.value = response.data;
    } catch (error) {
        console.error('Error fetching shop data:', error);
    }
};

// Build API params
const buildParams = () => {
    const params = {
        shopid: localStorage.getItem('shopid') || '',
        fromdate: formatDateForApi(fromDate.value),
        enddate: formatDateForApi(endDate.value),
        shopname: shopName.value,
        taxid: shopTaxId.value,
        address: shopAddress.value
    };
    if (selectedAccountGroup.value) {
        params.accountgroup = selectedAccountGroup.value.code;
    }
    if (compareYears.value) {
        params.compareyears = true;
    }
    return params;
};

// Computed flat table data
const tableData = computed(() =>
    (reportData.value || []).map((item, index) => ({
        ...item,
        _id: item.accountcode ? `${item.accountcode}_${index}` : `${item.type}_${index}`
    }))
);

// Load account groups
const loadAccountGroups = async () => {
    accountGroupsLoading.value = true;
    try {
        const response = await getAccountGroups({ limit: 500, page: 1, sort: 'code:1' });
        if (response.success) {
            accountGroups.value = response.data.map((item) => ({
                ...item,
                displayLabel: `${item.code} ~ ${item.name1}`
            }));
        }
    } catch (error) {
        console.error('Error loading account groups:', error);
    } finally {
        accountGroupsLoading.value = false;
    }
};

// Initialize default dates (endDate = last day of current month)
const initDefaultDate = () => {
    const now = new Date();
    fromDate.value = null;
    endDate.value = new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

// Fetch report data
const fetchReport = async () => {
    if (!endDate.value) {
        toast.add({ severity: 'warn', summary: 'แจ้งเตือน', detail: 'กรุณาเลือกวันที่สิ้นสุด', life: 3000 });
        return;
    }

    loading.value = true;
    reportData.value = [];

    try {
        const response = await getBalanceSheetSimple(buildParams());
        if (response.success) {
            reportData.value = response.data || [];
            compareYearsActive.value = compareYears.value;
        } else {
            toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: response.message || 'ไม่สามารถดึงข้อมูลรายงานได้', life: 3000 });
        }
    } catch (error) {
        console.error('Error fetching balance sheet simple:', error);
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Download PDF
const downloadPDF = async () => {
    if (!endDate.value) return;
    downloading.value = true;
    try {
        const result = await generateAndOpenBalanceSheetSimplePDF(buildParams());
        if (!result.success) {
            toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: result.message || 'ไม่สามารถสร้าง PDF ได้', life: 3000 });
        }
    } catch (error) {
        console.error('Error downloading PDF:', error);
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการสร้าง PDF', life: 3000 });
    } finally {
        downloading.value = false;
    }
};

// Download Excel
const downloadExcel = async () => {
    if (!endDate.value) return;
    downloading.value = true;
    try {
        const result = await generateAndDownloadBalanceSheetSimpleExcel(buildParams());
        if (!result.success) {
            toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: result.message || 'ไม่สามารถสร้าง Excel ได้', life: 3000 });
        }
    } catch (error) {
        console.error('Error downloading Excel:', error);
        toast.add({ severity: 'error', summary: 'ข้อผิดพลาด', detail: 'เกิดข้อผิดพลาดในการสร้าง Excel', life: 3000 });
    } finally {
        downloading.value = false;
    }
};

// Toggle search popover
const toggleSearchPopover = (event) => {
    searchPopover.value.toggle(event);
};

// Search and close popover
const searchAndClosePopover = () => {
    searchPopover.value.hide();
    fetchReport();
};

// Clear filters
const clearFilters = () => {
    selectedAccountGroup.value = null;
    compareYears.value = false;
    initDefaultDate();
};

// Row class
const getRowClass = (data) => {
    if (data.type === 'category_header') return '!bg-primary-100 dark:!bg-primary-900/30';
    return '';
};

// Initialize on mount
onMounted(async () => {
    initDefaultDate();
    await Promise.all([fetchShopData(), loadAccountGroups()]);
    fetchReport();
});
</script>

<template>
    <div class="card">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / งบแสดงฐานะการเงิน แบบย่อ</span>
                <div v-if="displayDateRange" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ displayDateRange }}
                </div>
            </div>
            <div class="flex gap-2">
                <Menu ref="downloadMenu" :model="downloadMenuItems" :popup="true" />
                <Button label="ดาวน์โหลด" icon="pi pi-download" iconPos="left" @click="downloadMenu.toggle($event)" severity="secondary" :disabled="isDownloadDisabled" :loading="downloading" />
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" />
            </div>
        </div>

        <!-- Report Header -->
        <div class="text-center mb-4">
            <div class="font-bold text-xl text-surface-900 dark:text-surface-0">งบแสดงฐานะการเงิน แบบย่อ</div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">ณ วันที่ {{ displayDateRange }}</p>
        </div>

        <!-- DataTable -->
        <DataTable :value="tableData" dataKey="_id" :loading="loading" size="small" scrollable scrollHeight="calc(100vh - 285px)" tableStyle="min-width: 50rem" :rowClass="getRowClass">
            <!-- Account Name -->
            <Column header="รายการ" style="min-width: 400px">
                <template #body="{ data }">
                    <div
                        :style="{ paddingLeft: `${data.depth * 16}px` }"
                        :class="{
                            'font-bold text-primary-700 dark:text-primary-300': data.type === 'category_header',
                            'font-bold text-primary-600 dark:text-primary-400': data.type === 'category_total' && data.accountname !== 'สินทรัพย์สุทธิ / ส่วนของผู้ถือหุ้น',
                            'font-bold text-primary-900 dark:text-primary-100': (data.type === 'category_total' && data.accountname === 'สินทรัพย์สุทธิ / ส่วนของผู้ถือหุ้น') || data.type === 'grand_total',
                            'font-semibold text-surface-800 dark:text-surface-200 italic': data.type === 'subtotal',
                            'font-semibold text-surface-800 dark:text-surface-200': data.isBold && data.type === 'account',
                            'text-surface-600 dark:text-surface-400': !data.isBold && data.type === 'account'
                        }"
                    >
                        {{ data.accountname }}
                        <span v-if="data.accountcode" class="ml-2 text-xs text-surface-400 dark:text-surface-500">({{ data.accountcode }})</span>
                    </div>
                </template>
            </Column>

            <!-- Balance Current Year -->
            <Column :header="compareYearsActive ? `จำนวนเงิน (บาท) ${currentYear}` : 'จำนวนเงิน (บาท)'" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.balance !== null && data.balance !== undefined">
                        <span v-if="data.type === 'grand_total'" class="font-bold text-lg text-primary-900 dark:text-primary-100 underline decoration-double underline-offset-4" :class="{ 'text-red-600 dark:text-red-400': data.balance < 0 }">
                            {{ formatCurrency(data.balance) }}
                        </span>
                        <span
                            v-else-if="data.type === 'category_total' && data.accountname === 'สินทรัพย์สุทธิ / ส่วนของผู้ถือหุ้น'"
                            class="font-bold text-lg text-primary-900 dark:text-primary-100 underline decoration-double underline-offset-4"
                            :class="{ 'text-red-600 dark:text-red-400': data.balance < 0 }"
                        >
                            {{ formatCurrency(data.balance) }}
                        </span>
                        <span v-else-if="data.type === 'category_total'" class="font-bold text-primary-600 dark:text-primary-400 underline underline-offset-4" :class="{ 'text-red-600 dark:text-red-400': data.balance < 0 }">
                            {{ formatCurrency(data.balance) }}
                        </span>
                        <span v-else-if="data.type === 'subtotal'" class="font-semibold text-surface-900 dark:text-surface-0 underline underline-offset-2" :class="{ 'text-red-600 dark:text-red-400': data.balance < 0 }">
                            {{ formatCurrency(data.balance) }}
                        </span>
                        <span v-else class="text-surface-700 dark:text-surface-300" :class="{ 'text-red-600 dark:text-red-400': data.balance < 0 }">
                            {{ formatCurrency(data.balance) }}
                        </span>
                    </span>
                </template>
            </Column>

            <!-- Balance Prev Year (compareYears only) -->
            <Column v-if="compareYearsActive" :header="`จำนวนเงิน (บาท) ${prevYear}`" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                <template #body="{ data }">
                    <span v-if="data.balance_prev !== null && data.balance_prev !== undefined">
                        <span v-if="data.type === 'grand_total'" class="font-bold text-lg text-primary-900 dark:text-primary-100 underline decoration-double underline-offset-4" :class="{ 'text-red-600 dark:text-red-400': data.balance_prev < 0 }">
                            {{ formatCurrency(data.balance_prev) }}
                        </span>
                        <span
                            v-else-if="data.type === 'category_total' && data.accountname === 'สินทรัพย์สุทธิ / ส่วนของผู้ถือหุ้น'"
                            class="font-bold text-lg text-primary-900 dark:text-primary-100 underline decoration-double underline-offset-4"
                            :class="{ 'text-red-600 dark:text-red-400': data.balance_prev < 0 }"
                        >
                            {{ formatCurrency(data.balance_prev) }}
                        </span>
                        <span v-else-if="data.type === 'category_total'" class="font-bold text-primary-600 dark:text-primary-400 underline underline-offset-4" :class="{ 'text-red-600 dark:text-red-400': data.balance_prev < 0 }">
                            {{ formatCurrency(data.balance_prev) }}
                        </span>
                        <span v-else-if="data.type === 'subtotal'" class="font-semibold text-surface-900 dark:text-surface-0 underline underline-offset-2" :class="{ 'text-red-600 dark:text-red-400': data.balance_prev < 0 }">
                            {{ formatCurrency(data.balance_prev) }}
                        </span>
                        <span v-else class="text-surface-700 dark:text-surface-300" :class="{ 'text-red-600 dark:text-red-400': data.balance_prev < 0 }">
                            {{ formatCurrency(data.balance_prev) }}
                        </span>
                    </span>
                </template>
            </Column>

            <!-- Empty State -->
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
                    <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
                </div>
            </template>
        </DataTable>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3 text-surface-900 dark:text-surface-0">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ตั้งแต่วันที่</label>
                    <ThaiDatePicker v-model="fromDate" class="w-full" showIcon showClear />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">ถึงวันที่ <span class="text-red-500">*</span></label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon @enter="searchAndClosePopover" />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1 text-surface-700 dark:text-surface-300">กลุ่มบัญชี</label>
                    <Select v-model="selectedAccountGroup" :options="accountGroups" optionLabel="displayLabel" placeholder="เลือกกลุ่มบัญชี..." :loading="accountGroupsLoading" showClear filter filterPlaceholder="พิมพ์ค้นหา..." class="w-full" />
                </div>

                <div class="flex items-center justify-between">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-300">เปรียบเทียบปีก่อนหน้า</label>
                    <ToggleSwitch v-model="compareYears" />
                </div>

                <div class="flex justify-between mt-2">
                    <Button label="ล้างเงื่อนไข" icon="pi pi-times" severity="secondary" text @click="clearFilters" />
                    <Button label="ค้นหา (Enter)" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Loading Dialog -->
    <LoadingDialog :visible="loading || downloading" :message="downloading ? 'กำลังสร้างไฟล์...' : 'กำลังโหลดข้อมูล...'" />
</template>

<style scoped></style>
