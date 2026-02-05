import { useLoading } from '@/composables/useLoading';
import { ITEMS_PER_PAGE_OPTIONS } from '@/constants/taxReport';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

/**
 * Shared composable for withholding tax report functionality
 * @param {number} taxtype - Tax type (1 = Withholding Tax)
 * @param {number} custtype - Customer type (0 = Individual ภ.ง.ด.3, 1 = Juristic ภ.ง.ด.53)
 * @returns {Object} - All necessary reactive state and methods for withholding tax reports
 */
export function useWithholdingTaxReport(taxtype, custtype) {
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
            return sum + parseFloat(firstDetail?.taxbase || 0);
        }, 0)
    );

    const getTotalTaxAmount = computed(() =>
        reportData.value.reduce((sum, item) => {
            const firstDetail = item.details?.[0];
            return sum + parseFloat(firstDetail?.taxamount || 0);
        }, 0)
    );

    // Disable download button when date range not selected or no data
    const isDownloadDisabled = computed(() => {
        return !fromDate.value || !toDate.value || reportData.value.length === 0;
    });

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
     * แปลงวันที่เป็น string format สำหรับ API
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
     * ดึงข้อมูลรายงานภาษีหัก ณ ที่จ่าย
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

            const limit = itemsPerPage.value === 9999 ? 9999 : itemsPerPage.value;
            const offset = itemsPerPage.value === 9999 ? 0 : (currentPage.value - 1) * itemsPerPage.value;

            const params = {
                limit,
                offset,
                taxtype,
                custtype,
                fromdate: formatDateForAPI(fromDate.value),
                todate: formatDateForAPI(toDate.value),
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const response = await api.getJournalTax(params);

            if (response.success) {
                reportData.value = response.data || [];
                totalRecords.value = response.pagination?.total || response.data?.length || 0;

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
                summary: 'กรุณาเลือกข้อมูล',
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
     * ดาวน์โหลด PDF รายงานภาษีหัก ณ ที่จ่าย
     */
    const downloadPDF = async () => {
        if (!fromDate.value || !toDate.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกช่วงวันที่ก่อนดาวน์โหลด PDF',
                life: 3000
            });
            return;
        }

        if (!shopData.value) {
            const success = await fetchShopData();
            if (!success) return;
        }

        try {
            showLoading('กำลังสร้างไฟล์ PDF...');

            const params = {
                taxtype,
                custtype,
                fromdate: formatDateForAPI(fromDate.value),
                todate: formatDateForAPI(toDate.value),
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const result = await api.generateAndOpenJournalTaxPDF(params);

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

        await fetchShopData();
        // ดึงข้อมูลรายงานทันทีที่โหลดหน้า
        await fetchReport(true);
    };

    // Watch itemsPerPage changes - รีเซ็ตหน้าและดึงข้อมูลใหม่
    watch(itemsPerPage, () => {
        if (fromDate.value && toDate.value && !isUpdatingFromWatch.value) {
            isUpdatingFromWatch.value = true;
            fetchReport(true).finally(() => {
                isUpdatingFromWatch.value = false;
            });
        }
    });

    // Watch currentPage changes - ดึงข้อมูลหน้าใหม่
    watch(currentPage, (newPage, oldPage) => {
        if (newPage !== oldPage && fromDate.value && toDate.value && !isUpdatingFromWatch.value) {
            fetchReport(false);
        }
    });

    return {
        // State
        shopData,
        reportData,
        totalRecords,
        currentPage,
        itemsPerPage,
        fromDate,
        toDate,
        expandedRows,
        searchPopover,

        // Constants
        itemsPerPageOptions: ITEMS_PER_PAGE_OPTIONS,

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
        fetchShopData,
        fetchReport,
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
