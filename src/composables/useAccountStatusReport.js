import { useLoading } from '@/composables/useLoading';
import { ITEMS_PER_PAGE_OPTIONS } from '@/constants/taxReport';
import api from '@/services/api';
import { getCreditors } from '@/services/api/creditor';
import { getDebtors } from '@/services/api/debtor';
import { getChartOfAccounts } from '@/services/api/journal';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

// Report types
export const ACCOUNT_STATUS_TYPE = {
    PAYABLE: 'payable', // เจ้าหนี้
    RECEIVABLE: 'receivable' // ลูกหนี้
};

/**
 * Shared composable for account status report functionality
 * @param {string} type - Report type ('payable' for เจ้าหนี้, 'receivable' for ลูกหนี้)
 * @returns {Object} - All necessary reactive state and methods for account status reports
 */
export function useAccountStatusReport(type) {
    const toast = useToast();
    const { showLoading, hideLoading } = useLoading();

    // State
    const shopData = ref(null);
    const shopId = ref(localStorage.getItem('shopid') || '');
    const reportData = ref([]);
    const totalRecords = ref(0);
    const currentPage = ref(1);
    const itemsPerPage = ref(20);
    const searchPopover = ref(null);

    // Filter state
    const fromDate = ref(null);
    const toDate = ref(null);
    const selectedAccount = ref(null);
    const selectedCustomer = ref(null);

    // Dropdown options
    const chartOfAccounts = ref([]);
    const chartOfAccountsLoading = ref(false);
    const customers = ref([]);
    const customersLoading = ref(false);

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

    // Calculate totals
    const getTotalBeginningBalance = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.beginning_balance || 0), 0));
    const getTotalDebitAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.debit_amount || 0), 0));
    const getTotalCreditAmount = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.credit_amount || 0), 0));
    const getTotalEndingBalance = computed(() => reportData.value.reduce((sum, item) => sum + parseFloat(item.ending_balance || 0), 0));

    // Disable download button when required fields not selected or no data
    const isDownloadDisabled = computed(() => {
        return !fromDate.value || !toDate.value || !selectedAccount.value || reportData.value.length === 0;
    });

    // Report title based on type
    const reportTitle = computed(() => {
        return type === ACCOUNT_STATUS_TYPE.PAYABLE ? 'รายงานสถานะเจ้าหนี้' : 'รายงานสถานะลูกหนี้';
    });

    // Customer label based on type
    const customerLabel = computed(() => {
        return type === ACCOUNT_STATUS_TYPE.PAYABLE ? 'เจ้าหนี้' : 'ลูกหนี้';
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
     * โหลดรายการผังบัญชีทั้งหมด (Hierarchical format)
     */
    const loadChartOfAccounts = async () => {
        chartOfAccountsLoading.value = true;
        try {
            const response = await getChartOfAccounts({
                q: '',
                page: 1,
                limit: 1000,
                sort: 'accountcode:1'
            });

            if (response.data.success) {
                const accounts = response.data.data;

                // แปลงเป็น flat list โดย Level 1, 2 เป็น disabled items (headers)
                const flatList = accounts.map((item) => {
                    if (item.accountlevel === 1) {
                        // Level 1 - หัวข้อหลัก (disabled, ไม่เยื้อง)
                        return {
                            ...item,
                            displayLabel: `📁 ${item.accountcode} - ${item.accountname}`,
                            disabled: true,
                            isHeader: true
                        };
                    } else if (item.accountlevel === 2) {
                        // Level 2 - หัวข้อย่อย (disabled, เยื้อง 1 ระดับ)
                        return {
                            ...item,
                            displayLabel: `    📁 ${item.accountcode} - ${item.accountname}`,
                            disabled: true,
                            isHeader: true
                        };
                    } else {
                        // Level 3, 4, 5 - รายการที่เลือกได้
                        const indent = item.accountlevel === 3 ? '        ' : item.accountlevel === 4 ? '            ' : '                ';
                        return {
                            ...item,
                            displayLabel: `${indent}${item.accountcode} ~ ${item.accountname}`,
                            disabled: false,
                            isHeader: false
                        };
                    }
                });

                chartOfAccounts.value = flatList;
            }
        } catch (error) {
            console.error('Error loading chart of accounts:', error);
            chartOfAccounts.value = [];
        } finally {
            chartOfAccountsLoading.value = false;
        }
    };

    /**
     * โหลดรายการลูกค้าทั้งหมด (เจ้าหนี้/ลูกหนี้)
     */
    const loadCustomers = async () => {
        customersLoading.value = true;
        try {
            const apiCall = type === ACCOUNT_STATUS_TYPE.PAYABLE ? getCreditors : getDebtors;
            const response = await apiCall({ q: '', page: 1, limit: 1000 });

            if (response.success) {
                customers.value = response.data.map((item) => {
                    const thName = item.names?.find((n) => n.code === 'th')?.name || '';
                    return {
                        ...item,
                        displayLabel: `${item.code} ~ ${thName}`
                    };
                });
            }
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            customersLoading.value = false;
        }
    };

    /**
     * จัดรูปแบบวันที่สำหรับ API (YYYY-MM-DD)
     */
    const formatDateForApi = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /**
     * ดึงข้อมูลรายงาน
     * @param {boolean} resetPage - รีเซ็ตหน้ากลับไปหน้าที่ 1 หรือไม่
     */
    const fetchReport = async (resetPage = false) => {
        if (!shopData.value) {
            const success = await fetchShopData();
            if (!success) return;
        }

        if (!selectedAccount.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกผังบัญชี',
                life: 3000
            });
            return;
        }

        if (resetPage) {
            currentPage.value = 1;
        }

        try {
            showLoading('กำลังโหลดข้อมูลรายงาน...');

            // คำนวณ offset จาก currentPage และ itemsPerPage
            const limit = itemsPerPage.value === 9999 ? 9999 : itemsPerPage.value;
            const offset = itemsPerPage.value === 9999 ? 0 : (currentPage.value - 1) * itemsPerPage.value;

            const params = {
                limit,
                offset,
                fromdate: formatDateForApi(fromDate.value),
                todate: formatDateForApi(toDate.value),
                shopid: shopId.value,
                accountcode: selectedAccount.value?.accountcode || '',
                custcode: selectedCustomer.value?.code || ''
            };

            const apiCall = type === ACCOUNT_STATUS_TYPE.PAYABLE ? api.getAccountsPayable : api.getAccountsReceivable;
            const response = await apiCall(params);

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
                detail: 'กรุณาเลือกช่วงวันที่',
                life: 3000
            });
            return;
        }

        if (!selectedAccount.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกผังบัญชี',
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
        const year = date.getFullYear() + 543;
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
     * ดาวน์โหลด PDF รายงาน
     */
    const downloadPDF = async () => {
        if (!fromDate.value || !toDate.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกช่วงวันที่',
                life: 3000
            });
            return;
        }

        if (!selectedAccount.value) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเลือกข้อมูล',
                detail: 'กรุณาเลือกผังบัญชี',
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
                fromdate: formatDateForApi(fromDate.value),
                todate: formatDateForApi(toDate.value),
                shopid: shopId.value,
                accountcode: selectedAccount.value?.accountcode || '',
                custcode: selectedCustomer.value?.code || '',
                limit: 9999,
                offset: 0
            };

            const apiCall = type === ACCOUNT_STATUS_TYPE.PAYABLE ? api.generateAndOpenAccountsPayablePDF : api.generateAndOpenAccountsReceivablePDF;
            const result = await apiCall(params);

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
        // วันที่ 1 ของเดือนปัจจุบัน
        fromDate.value = new Date(now.getFullYear(), now.getMonth(), 1);
        // วันสุดท้ายของเดือนปัจจุบัน
        toDate.value = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        await fetchShopData();

        // โหลด master data ล่วงหน้าเพื่อให้พร้อมใช้งาน
        await Promise.all([loadChartOfAccounts(), loadCustomers()]);
    };

    // Watch itemsPerPage changes - รีเซ็ตหน้าและดึงข้อมูลใหม่
    watch(itemsPerPage, () => {
        if (fromDate.value && toDate.value && selectedAccount.value && !isUpdatingFromWatch.value) {
            isUpdatingFromWatch.value = true;
            fetchReport(true).finally(() => {
                isUpdatingFromWatch.value = false;
            });
        }
    });

    // Watch currentPage changes - ดึงข้อมูลหน้าใหม่
    watch(currentPage, (newPage, oldPage) => {
        if (newPage !== oldPage && fromDate.value && toDate.value && selectedAccount.value && !isUpdatingFromWatch.value) {
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
        searchPopover,
        fromDate,
        toDate,
        selectedAccount,
        selectedCustomer,
        chartOfAccounts,
        chartOfAccountsLoading,
        customers,
        customersLoading,

        // Constants
        itemsPerPageOptions: ITEMS_PER_PAGE_OPTIONS,

        // Computed
        shopName,
        shopAddress,
        shopTaxId,
        totalPages,
        getTotalBeginningBalance,
        getTotalDebitAmount,
        getTotalCreditAmount,
        getTotalEndingBalance,
        isDownloadDisabled,
        reportTitle,
        customerLabel,

        // Methods
        fetchShopData,
        fetchReport,
        goToPage,
        toggleSearchPopover,
        searchAndClosePopover,
        formatDateThai,
        formatCurrency,
        downloadPDF,
        initReport,
        loadChartOfAccounts,
        loadCustomers
    };
}
