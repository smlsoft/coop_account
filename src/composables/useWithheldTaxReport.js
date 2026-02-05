import { useLoading } from '@/composables/useLoading';
import { ITEMS_PER_PAGE_OPTIONS } from '@/constants/taxReport';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

/**
 * Composable for withheld tax report functionality (ภาษีถูกหัก ณ ที่จ่าย)
 * @returns {Object} - All necessary reactive state and methods for withheld tax reports
 */
export function useWithheldTaxReport() {
    const toast = useToast();
    const { showLoading, hideLoading } = useLoading();

    // State
    const shopData = ref(null);
    const shopId = ref(localStorage.getItem('shopid') || '');
    const reportData = ref([]);
    const totalRecords = ref(0);
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const fromDate = ref(null);
    const toDate = ref(null);
    const expandedRows = ref({});
    const searchPopover = ref(null);

    // Prevent race conditions between watchers
    const isUpdatingFromWatch = ref(false);

    // Computed properties สำหรับข้อมูลกิจการ
    const shopName = computed(() => shopData.value?.names?.find((n) => n.code === 'th')?.name || '');
    const shopAddress = computed(() => shopData.value?.address?.find((a) => a.code === 'th')?.name || '');
    const shopTaxId = computed(() => shopData.value?.settings?.taxid || '');

    // Pagination
    const totalPages = computed(() => {
        if (itemsPerPage.value === 9999) return 1;
        return Math.ceil(totalRecords.value / itemsPerPage.value);
    });

    const paginatedData = computed(() => {
        return reportData.value;
    });

    // Calculate totals
    const getTotalTaxBase = computed(() =>
        reportData.value.reduce((sum, item) => {
            const firstDetail = item.details?.[0];
            return sum + (firstDetail?.taxbase || 0);
        }, 0)
    );

    const getTotalTaxAmount = computed(() =>
        reportData.value.reduce((sum, item) => {
            const firstDetail = item.details?.[0];
            return sum + (firstDetail?.taxamount || 0);
        }, 0)
    );

    // Constants
    const itemsPerPageOptions = ITEMS_PER_PAGE_OPTIONS;

    // Download disabled state
    const isDownloadDisabled = computed(() => {
        return !fromDate.value || !toDate.value || reportData.value.length === 0;
    });

    /**
     * ดึงข้อมูลกิจการ
     */
    const fetchShopData = async () => {
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
     * จัดรูปแบบวันที่สำหรับ API (YYYY-MM-DD HH:mm:ss)
     */
    const formatDateForAPI = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    /**
     * ดึงข้อมูลรายงานภาษีถูกหัก ณ ที่จ่าย
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

            const limit = itemsPerPage.value === 9999 ? 9999 : itemsPerPage.value;
            const offset = itemsPerPage.value === 9999 ? 0 : (currentPage.value - 1) * itemsPerPage.value;

            const params = {
                limit,
                offset,
                taxtype: 0, // ภาษีถูกหัก ณ ที่จ่าย
                fromdate: formatDateForAPI(fromDate.value),
                todate: formatDateForAPI(toDate.value),
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const response = await api.getJournalTaxDeduct(params);

            if (response.success) {
                reportData.value = response.data || [];
                totalRecords.value = response.pagination?.total || 0;
            } else {
                reportData.value = [];
                totalRecords.value = 0;
                toast.add({
                    severity: 'warn',
                    summary: 'แจ้งเตือน',
                    detail: response.msg || 'ไม่พบข้อมูลรายงาน',
                    life: 3000
                });
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            reportData.value = [];
            totalRecords.value = 0;
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
     * Watch for pagination changes
     */
    watch([currentPage, itemsPerPage], ([newPage, newItemsPerPage], [oldPage, oldItemsPerPage]) => {
        if (isUpdatingFromWatch.value) return;

        if (newPage !== oldPage || newItemsPerPage !== oldItemsPerPage) {
            if (fromDate.value && toDate.value) {
                fetchReport(false);
            }
        }
    });

    /**
     * Navigate to specific page
     */
    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages.value) {
            currentPage.value = page;
        }
    };

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
        if (!fromDate.value || !toDate.value) {
            toast.add({
                severity: 'warn',
                summary: 'แจ้งเตือน',
                detail: 'กรุณาเลือกช่วงวันที่ที่ต้องการค้นหา',
                life: 3000
            });
            return;
        }

        searchPopover.value.hide();
        fetchReport(true);
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
     * ดาวน์โหลด PDF รายงานภาษีถูกหัก ณ ที่จ่าย
     */
    const downloadPDF = async () => {
        if (!fromDate.value || !toDate.value) {
            toast.add({
                severity: 'warn',
                summary: 'แจ้งเตือน',
                detail: 'กรุณาเลือกช่วงวันที่ที่ต้องการดาวน์โหลด',
                life: 3000
            });
            return;
        }

        try {
            showLoading('กำลังสร้างไฟล์ PDF...');

            const params = {
                taxtype: 0,
                fromdate: formatDateForAPI(fromDate.value),
                todate: formatDateForAPI(toDate.value),
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const result = await api.generateAndOpenJournalTaxDeductPDF(params);

            if (result.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: 'เปิดไฟล์ PDF สำเร็จ',
                    life: 3000
                });
            } else {
                toast.add({
                    severity: 'error',
                    summary: 'เกิดข้อผิดพลาด',
                    detail: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้',
                    life: 3000
                });
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถสร้างไฟล์ PDF ได้',
                life: 3000
            });
        } finally {
            hideLoading();
        }
    };

    /**
     * Initialize report with current month date range
     */
    const initReport = async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Set to first day of current month at 00:00:00
        const firstDay = new Date(year, month, 1, 0, 0, 0);
        fromDate.value = firstDay;

        // Set to last day of current month at 23:59:59
        const lastDay = new Date(year, month + 1, 0, 23, 59, 59);
        toDate.value = lastDay;

        // Fetch shop data and report
        await fetchShopData();
        await fetchReport(true);
    };

    return {
        // State
        reportData,
        currentPage,
        itemsPerPage,
        fromDate,
        toDate,
        expandedRows,
        searchPopover,

        // Constants
        itemsPerPageOptions,

        // Computed
        shopName,
        shopAddress,
        shopTaxId,
        totalPages,
        paginatedData,
        getTotalTaxBase,
        getTotalTaxAmount,
        isDownloadDisabled,

        // Methods
        goToPage,
        toggleSearchPopover,
        searchAndClosePopover,
        formatDateThai,
        formatCurrency,
        onRowClick,
        downloadPDF,
        initReport
    };
}
