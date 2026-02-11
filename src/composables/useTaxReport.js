import { useLoading } from '@/composables/useLoading';
import { ITEMS_PER_PAGE_OPTIONS, MONTH_OPTIONS } from '@/constants/taxReport';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

/**
 * Shared composable for tax report functionality
 * @param {number} mode - Tax mode (0 = Purchase Tax, 1 = Sale Tax)
 * @returns {Object} - All necessary reactive state and methods for tax reports
 */
export function useTaxReport(mode) {
    const toast = useToast();
    const { showLoading, hideLoading } = useLoading();

    // State
    const shopData = ref(null);
    const shopId = ref(localStorage.getItem('shopid') || '');
    const reportData = ref([]);
    const totalRecords = ref(0);
    const currentPage = ref(1);
    const itemsPerPage = ref(10);
    const selectedYear = ref(null);
    const selectedMonth = ref(null);
    const expandedRows = ref({});
    const searchPopover = ref(null);

    // Prevent race conditions between watchers
    const isUpdatingFromWatch = ref(false);

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
    const getTotalExceptVat = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.exceptvat || 0), 0));
    const getTotalVatBase = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.vatbase || 0), 0));
    const getTotalVatAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.vatamount || 0), 0));
    const getTotalAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.total || 0), 0));

    // Disable download button when year or month not selected or no data
    const isDownloadDisabled = computed(() => {
        return !selectedYear.value || !selectedMonth.value || reportData.value.length === 0;
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
     * ดึงข้อมูลรายงานภาษี
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
                mode,
                year: selectedYear.value,
                period: selectedMonth.value,
                fromdate,
                todate,
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const response = await api.getJournalVat(params);

            if (response.success) {
                // เพิ่ม unique ID ให้แต่ละแถวเพื่อป้องกันปัญหา docno ซ้ำ
                reportData.value = (response.data || []).map((item, index) => ({
                    ...item,
                    _uniqueId: `${mode}-${item.docno}-${index}`
                }));
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
        if (!selectedYear.value || !selectedMonth.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกปีและเดือนที่ต้องการค้นหา',
                life: 3000
            });
            return;
        }

        // Clear expanded rows เมื่อค้นหาข้อมูลใหม่
        expandedRows.value = {};

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
     * แปลง period เป็นชื่อเดือน
     */
    const getPeriodName = (period) => {
        const month = MONTH_OPTIONS.find((m) => m.value === period);
        return month ? month.label : '';
    };

    /**
     * จัดการการคลิกแถวเพื่อขยาย/หดข้อมูล
     */
    const onRowClick = (event) => {
        const uniqueId = event.data._uniqueId;
        if (expandedRows.value[uniqueId]) {
            delete expandedRows.value[uniqueId];
        } else {
            expandedRows.value[uniqueId] = true;
        }
    };

    /**
     * ดาวน์โหลด PDF รายงานภาษี
     */
    const downloadPDF = async () => {
        if (!selectedYear.value || !selectedMonth.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกปีและเดือนก่อนดาวน์โหลด PDF',
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

            const { fromdate, todate } = getDateRange(selectedYear.value, selectedMonth.value);

            const params = {
                mode,
                year: selectedYear.value,
                period: selectedMonth.value,
                fromdate,
                todate,
                shopid: shopId.value,
                shopname: shopName.value,
                taxid: shopTaxId.value,
                address: shopAddress.value
            };

            const result = await api.generateAndOpenJournalVatPDF(params);

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
     * Initialize report with current month/year
     */
    const initReport = async () => {
        const now = new Date();
        selectedYear.value = now.getFullYear() + 543;
        selectedMonth.value = now.getMonth() + 1;
        await fetchShopData();
        // ดึงข้อมูลรายงานทันทีที่โหลดหน้า
        await fetchReport(true);
    };

    // Watch itemsPerPage changes - รีเซ็ตหน้าและดึงข้อมูลใหม่
    watch(itemsPerPage, () => {
        if (selectedYear.value && selectedMonth.value && !isUpdatingFromWatch.value) {
            isUpdatingFromWatch.value = true;
            // Clear expanded rows เมื่อเปลี่ยนจำนวนรายการต่อหน้า
            expandedRows.value = {};
            fetchReport(true).finally(() => {
                isUpdatingFromWatch.value = false;
            });
        }
    });

    // Watch currentPage changes - ดึงข้อมูลหน้าใหม่
    watch(currentPage, (newPage, oldPage) => {
        if (newPage !== oldPage && selectedYear.value && selectedMonth.value && !isUpdatingFromWatch.value) {
            // Clear expanded rows เมื่อเปลี่ยนหน้า
            expandedRows.value = {};
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
        selectedYear,
        selectedMonth,
        expandedRows,
        searchPopover,

        // Constants
        monthOptions: MONTH_OPTIONS,
        itemsPerPageOptions: ITEMS_PER_PAGE_OPTIONS,

        // Computed
        shopName,
        shopAddress,
        shopTaxId,
        yearOptions,
        totalPages,
        paginatedData,
        getTotalExceptVat,
        getTotalVatBase,
        getTotalVatAmount,
        getTotalAmount,
        isDownloadDisabled,

        // Methods
        fetchShopData,
        fetchReport,
        goToPage,
        toggleSearchPopover,
        searchAndClosePopover,
        formatDateThai,
        formatCurrency,
        getPeriodName,
        onRowClick,
        downloadPDF,
        initReport
    };
}
