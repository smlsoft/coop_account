<script setup>
import JournalDetailPanel from '@/components/accounting/JournalDetailPanel.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// Expanded rows
const expandedRows = ref({});

// ข้อมูลกิจการ
const shopData = ref(null);
const shopId = ref(localStorage.getItem('shopid') || '');

// ข้อมูลรายงาน
const reportData = ref([]);
const totalRecords = ref(0);

// Pagination (Server-side)
const currentPage = ref(1);
const itemsPerPage = ref(10);
const itemsPerPageOptions = ref([
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '30', value: 30 },
    { label: '50', value: 50 },
    { label: 'ทั้งหมด', value: 9999 }
]);

// Filter
const selectedYear = ref(null);
const selectedMonth = ref(null);

// Popover ref
const searchPopover = ref(null);

// Year options (ปีปัจจุบัน + ย้อนหลัง 9 ปี = รวม 10 ปี)
const yearOptions = computed(() => {
    const currentYear = new Date().getFullYear() + 543;
    const years = [];
    for (let i = 0; i < 10; i++) {
        years.push({
            label: `${currentYear - i}`,
            value: currentYear - i
        });
    }
    return years;
});

// Month options
const monthOptions = ref([
    { label: 'มกราคม', value: 1 },
    { label: 'กุมภาพันธ์', value: 2 },
    { label: 'มีนาคม', value: 3 },
    { label: 'เมษายน', value: 4 },
    { label: 'พฤษภาคม', value: 5 },
    { label: 'มิถุนายน', value: 6 },
    { label: 'กรกฎาคม', value: 7 },
    { label: 'สิงหาคม', value: 8 },
    { label: 'กันยายน', value: 9 },
    { label: 'ตุลาคม', value: 10 },
    { label: 'พฤศจิกายน', value: 11 },
    { label: 'ธันวาคม', value: 12 }
]);

/**
 * Computed properties สำหรับข้อมูลกิจการ
 */
const shopName = computed(() => shopData.value?.names?.find((n) => n.code === 'th')?.name || '');
const shopAddress = computed(() => shopData.value?.address?.find((a) => a.code === 'th')?.name || '');
const shopTaxId = computed(() => shopData.value?.settings?.taxid || '');

/**
 * ดึงข้อมูลกิจการ
 */
const fetchShopData = async () => {
    if (!shopId.value) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่พบรหัสกิจการ กรุณาเลือกกิจการใหม่',
            life: 3000
        });
        return false;
    }

    try {
        const response = await api.getShop(shopId.value);
        if (response.success) {
            shopData.value = response.data;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error fetching shop data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลกิจการได้',
            life: 3000
        });
        return false;
    }
};

/**
 * คำนวณวันที่เริ่มต้นและสิ้นสุดจากปีและเดือน
 */
const getDateRange = (year, month) => {
    const adYear = year - 543;
    const fromDateStr = `${adYear}-${String(month).padStart(2, '0')}-01 00:00:00`;
    const lastDay = new Date(adYear, month, 0).getDate();
    const toDateStr = `${adYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
    return { fromdate: fromDateStr, todate: toDateStr };
};

/**
 * ดึงข้อมูลรายงานภาษีซื้อ
 * @param {boolean} resetPage - รีเซ็ตหน้ากลับไปหน้าที่ 1 หรือไม่
 */
const fetchReport = async (resetPage = false) => {
    if (!shopData.value) {
        const success = await fetchShopData();
        if (!success) return;
    }

    if (resetPage) {
        currentPage.value = 1;
    }

    try {
        showLoading('กำลังโหลดข้อมูลรายงาน...');

        const { fromdate, todate } = getDateRange(selectedYear.value, selectedMonth.value);

        // คำนวณ offset จาก currentPage และ itemsPerPage
        const limit = itemsPerPage.value === 9999 ? 9999 : itemsPerPage.value;
        const offset = itemsPerPage.value === 9999 ? 0 : (currentPage.value - 1) * itemsPerPage.value;

        const params = {
            limit,
            offset,
            mode: 0,
            year: selectedYear.value,
            period: selectedMonth.value,
            fromdate,
            todate,
            shopid: shopId.value,
            shopname: shopName.value,
            taxid: shopTaxId.value,
            address: shopAddress.value
        };

        console.log('API Request params:', params); // Debug log

        const response = await api.getJournalVat(params);

        if (response.success) {
            reportData.value = response.data || [];
            // สมมติว่า API ส่ง total มา ถ้าไม่มีให้ใช้ความยาวของ data
            totalRecords.value = response.total || response.data?.length || 0;

            if (resetPage) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: `พบข้อมูล ${totalRecords.value} รายการ`,
                    life: 3000
                });
            }
        }
    } catch (error) {
        console.error('Error fetching report:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลรายงานได้',
            life: 3000
        });
    } finally {
        hideLoading();
    }
};

/**
 * Pagination - Server Side
 */
const totalPages = computed(() => {
    if (itemsPerPage.value === 9999) return 1;
    return Math.ceil(totalRecords.value / itemsPerPage.value);
});

const paginatedData = computed(() => {
    // ใช้ข้อมูลจาก reportData โดยตรง เพราะ API ส่งมาแค่หน้าที่ request
    return reportData.value;
});

const goToPage = (page) => {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
    }
};

// Watch itemsPerPage changes - รีเซ็ตหน้าและดึงข้อมูลใหม่
watch(itemsPerPage, () => {
    if (selectedYear.value && selectedMonth.value) {
        fetchReport(true);
    }
});

// Watch currentPage changes - ดึงข้อมูลหน้าใหม่
watch(currentPage, (newPage, oldPage) => {
    // ไม่ดึงข้อมูลถ้าเป็นการเปลี่ยนจาก itemsPerPage (จะดึงจาก watch itemsPerPage แล้ว)
    if (newPage !== oldPage && selectedYear.value && selectedMonth.value) {
        fetchReport(false);
    }
});

/**
 * เปิด/ปิด popover ค้นหา
 */
const toggleSearchPopover = (event) => {
    searchPopover.value.toggle(event);
};

/**
 * ค้นหาและปิด popover
 */
const searchAndClosePopover = () => {
    if (!selectedYear.value || !selectedMonth.value) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณาเลือกข้อมูล',
            detail: 'กรุณาเลือกปีและเดือนที่ต้องการค้นหา',
            life: 3000
        });
        return;
    }

    searchPopover.value.hide();
    fetchReport(true); // รีเซ็ตหน้ากลับไปหน้า 1
};

/**
 * จัดรูปแบบวันที่แบบไทย (วัน/เดือน/ปี)
 */
const formatDateThai = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * จัดรูปแบบตัวเลข
 */
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00';
    return parseFloat(value).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * แปลง period เป็นชื่อเดือน
 */
const getPeriodName = (period) => {
    const month = monthOptions.value.find((m) => m.value === period);
    return month ? month.label : '';
};

/**
 * จัดการการคลิกแถวเพื่อขยาย/หดข้อมูล
 */
const onRowClick = (event) => {
    const docno = event.data.docno;
    if (expandedRows.value[docno]) {
        delete expandedRows.value[docno];
    } else {
        expandedRows.value[docno] = true;
    }
};

/**
 * คำนวณยอดรวม
 */
const getTotalExceptVat = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.exceptvat || 0), 0));
const getTotalVatBase = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.vatbase || 0), 0));
const getTotalVatAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.vatamount || 0), 0));
const getTotalAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.total || 0), 0));

// ตั้งค่าเริ่มต้น
onMounted(async () => {
    const now = new Date();
    selectedYear.value = now.getFullYear() + 543;
    selectedMonth.value = now.getMonth() + 1;

    await fetchShopData();
    // ไม่เปิด popover อัตโนมัติ ให้ผู้ใช้คลิกปุ่มเอง
});
</script>

<template>
    <div class="card">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานภาษี / ภาษีซื้อ</span>
                <div v-if="selectedYear && selectedMonth" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    {{ getPeriodName(selectedMonth) }} {{ selectedYear }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" severity="secondary" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4">
                <!-- ส่วนหัวตรงกลาง -->
                <div class="flex justify-center items-center flex-col">
                    <h2 class="font-bold text-xl mb-0">รายงานภาษีซื้อ</h2>
                    <p class="mb-3">เดือนภาษี{{ getPeriodName(selectedMonth) }} ปีภาษี {{ selectedYear }}</p>
                </div>

                <!-- ส่วนข้อมูลบรรทัดที่ 1 -->
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <span class="font-bold">ชื่อสถานประกอบการ:</span>
                        {{ shopName }}
                    </div>
                    <div>
                        <span class="font-bold">เลขประจำตัวผู้เสียภาษี:</span>
                        {{ shopTaxId }}
                    </div>
                </div>

                <!-- ส่วนข้อมูลบรรทัดที่ 2 -->
                <div class="flex justify-between items-center">
                    <div><span class="font-bold">ที่อยู่:</span> {{ shopAddress }}</div>
                    <div><span class="font-bold">สาขา:</span> (สำนักงานใหญ่)</div>
                </div>
            </div>

            <!-- Report Table with Expand -->
            <DataTable v-model:expandedRows="expandedRows" :value="paginatedData" dataKey="docno" showGridlines size="small" class="report-datatable" @row-click="onRowClick">
                <Column expander style="width: 3rem" />
                <Column header="ลำดับ" style="width: 60px" headerClass="text-center" bodyClass="text-center">
                    <template #body="{ index }">
                        {{ (currentPage - 1) * itemsPerPage + index + 1 }}
                    </template>
                </Column>
                <Column field="vatdate" header="วันที่" style="width: 100px" headerClass="text-center" bodyClass="text-center">
                    <template #body="{ data }">
                        {{ formatDateThai(data.vatdate) }}
                    </template>
                </Column>
                <Column field="vatdocno" header="เลขที่ใบกำกับ" style="min-width: 120px">
                    <template #body="{ data }">
                        {{ data.vatdocno || '-' }}
                    </template>
                </Column>
                <Column field="custname" header="ชื่อผู้ขายสินค้า/ผู้ให้บริการ" style="min-width: 200px">
                    <template #body="{ data }">
                        {{ data.custname || '-' }}
                    </template>
                </Column>
                <Column field="custtaxid" header="เลขประจำตัวผู้เสียภาษี" style="width: 150px">
                    <template #body="{ data }">
                        {{ data.custtaxid || '-' }}
                    </template>
                </Column>
                <Column header="สำนักงานใหญ่" style="width: 120px" headerClass="text-center" bodyClass="text-center">
                    <template #body="{ data }">
                        {{ data.organization === 0 ? 'สำนักงานใหญ่' : data.branchcode }}
                    </template>
                </Column>
                <Column header="ยอดยกเว้นภาษี" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.exceptvat || 0) }}
                    </template>
                </Column>
                <Column header="มูลค่าสินค้า/บริการ" style="width: 130px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.vatbase) }}
                    </template>
                </Column>
                <Column header="จำนวนเงินภาษี" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.vatamount) }}
                    </template>
                </Column>
                <Column header="รวมทั้งสิ้น" style="width: 120px" headerClass="text-center" bodyClass="text-right">
                    <template #body="{ data }">
                        {{ formatCurrency(data.total) }}
                    </template>
                </Column>
                <Column header="ยื่นเพิ่มเติม" style="width: 100px" headerClass="text-center" bodyClass="text-center">
                    <template #body="{ data }">
                        {{ data.vatsubmit ? 'ยื่นเพิ่มเติม' : '' }}
                    </template>
                </Column>

                <!-- Expand Row Template -->
                <template #expansion="{ data }">
                    <div class="p-3 bg-surface-50 dark:bg-surface-900">
                        <JournalDetailPanel :docno="data.docno" />
                    </div>
                </template>

                <!-- Empty State -->
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
                    </div>
                </template>

                <!-- Footer -->
                <template #footer>
                    <div v-if="reportData.length > 0" class="flex items-center font-bold text-sm">
                        <div class="flex-1 text-center" style="margin-left: 3rem">รวม</div>
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalExceptVat) }}</div>
                        <div class="text-right" style="width: 130px">{{ formatCurrency(getTotalVatBase) }}</div>
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalVatAmount) }}</div>
                        <div class="text-right" style="width: 120px">{{ formatCurrency(getTotalAmount) }}</div>
                        <div style="width: 100px"></div>
                    </div>
                </template>
            </DataTable>

            <!-- Pagination Controls -->
            <div v-if="reportData.length > 0" class="flex justify-between items-center mt-3">
                <div class="items-per-page">
                    <span class="mr-2">รายการต่อหน้า:</span>
                    <Select v-model="itemsPerPage" :options="itemsPerPageOptions" optionLabel="label" optionValue="value" class="w-auto" />
                </div>
                <div class="pagination-controls">
                    <Button icon="pi pi-angle-double-left" text @click="goToPage(1)" :disabled="currentPage === 1" class="mr-1" />
                    <Button icon="pi pi-angle-left" text @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="mr-1" />
                    <span class="mx-2">หน้า {{ currentPage }} จาก {{ totalPages }}</span>
                    <Button icon="pi pi-angle-right" text @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="ml-1" />
                    <Button icon="pi pi-angle-double-right" text @click="goToPage(totalPages)" :disabled="currentPage === totalPages" class="ml-1" />
                </div>
            </div>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-3">
            <div class="flex items-center gap-2">
                <Select v-model="selectedMonth" :options="monthOptions" optionLabel="label" optionValue="value" placeholder="เดือน" class="w-34" />
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="ปี" class="w-28" />
                <Button icon="pi pi-search" @click="searchAndClosePopover" size="small" />
            </div>
        </div>
    </Popover>

    <!-- Loading Dialog -->
    <LoadingDialog />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.report-datatable :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
    transition:
        background-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
}

.report-datatable :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--primary-50) !important;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
    transform: translateY(-1px);
}

.report-datatable :deep(.p-datatable-row-expansion > td) {
    padding: 0 !important;
}

.text-center {
    text-align: center;
}

.text-right {
    text-align: right;
}

.pagination-controls {
    display: flex;
    align-items: center;
}

.items-per-page {
    display: flex;
    align-items: center;
}
</style>
