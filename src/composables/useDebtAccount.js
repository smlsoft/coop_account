import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { useLoading } from './useLoading';

/**
 * Composable for managing Debt Accounts (Debtors/Creditors)
 * @param {string} type - 'debtor' or 'creditor'
 * @returns {object} Methods and states for debt account management
 */
export function useDebtAccount(type = 'debtor') {
    const router = useRouter();
    const toast = useToast();
    const { showLoading, hideLoading } = useLoading();

    // Configuration based on type
    const config = {
        debtor: {
            title: 'ลูกหนี้',
            titleSingle: 'ลูกหนี้',
            apiPrefix: 'debtor',
            route: '/masterdata/debtors',
            api: {
                getAll: api.getDebtors,
                getById: api.getDebtorById,
                create: api.createDebtor,
                update: api.updateDebtor,
                delete: api.deleteDebtor
            }
        },
        creditor: {
            title: 'เจ้าหนี้',
            titleSingle: 'เจ้าหนี้',
            apiPrefix: 'creditor',
            route: '/masterdata/creditors',
            api: {
                getAll: api.getCreditors,
                getById: api.getCreditorById,
                create: api.createCreditor,
                update: api.updateCreditor,
                delete: api.deleteCreditor
            }
        }
    }[type];

    // LocalStorage key for filter persistence
    const FILTER_STORAGE_KEY = `${type}_filters`;

    // State
    const accounts = ref([]);
    const totalRecords = ref(0);
    const currentPage = ref(1);
    const rowsPerPage = ref(10);
    const first = ref(0); // Index ของ row แรกที่แสดงใน DataTable (สำหรับ paginator)
    const searchQuery = ref('');
    const isLoading = ref(false);

    // Options สำหรับ dropdown
    const personalTypeOptions = [
        { label: 'บุคคลธรรมดา', value: 1 },
        { label: 'นิติบุคคล', value: 2 }
    ];

    const customerTypeOptions = [
        { label: 'สำนักงานใหญ่', value: 1 },
        { label: 'สาขา', value: 2 }
    ];

    // Label mappings
    const personalTypes = {
        1: 'บุคคลธรรมดา',
        2: 'นิติบุคคล'
    };

    const customerTypes = {
        1: 'สำนักงานใหญ่',
        2: 'สาขา'
    };

    /**
     * บันทึก filter state ลง localStorage
     */
    const saveFilterState = () => {
        const filterState = {
            page: currentPage.value,
            limit: rowsPerPage.value,
            search: searchQuery.value
        };
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
    };

    /**
     * โหลด filter state จาก localStorage
     */
    const loadFilterState = () => {
        try {
            const savedState = localStorage.getItem(FILTER_STORAGE_KEY);
            if (savedState) {
                const filterState = JSON.parse(savedState);
                currentPage.value = filterState.page || 1;
                rowsPerPage.value = filterState.limit || 10;
                searchQuery.value = filterState.search || '';
                // คำนวณ first index สำหรับ paginator (page - 1) * limit
                first.value = (currentPage.value - 1) * rowsPerPage.value;
                return true;
            }
        } catch (error) {
            console.error('Error loading filter state:', error);
        }
        return false;
    };

    /**
     * ล้าง filter state จาก localStorage
     */
    const clearFilterState = () => {
        localStorage.removeItem(FILTER_STORAGE_KEY);
    };

    /**
     * ดึงข้อมูลบัญชีลูกหนี้/เจ้าหนี้
     */
    const fetchAccounts = async (page = 1) => {
        try {
            isLoading.value = true;
            showLoading('กำลังโหลดข้อมูล...');

            const params = {
                page: page,
                limit: rowsPerPage.value,
                q: searchQuery.value,
                sort: 'code:1'
            };

            const response = await config.api.getAll(params);

            if (response.success) {
                accounts.value = response.data;
                totalRecords.value = response.pagination.total;
                currentPage.value = response.pagination.page;
            }
        } catch (error) {
            console.error(`Error fetching ${type}s:`, error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลได้',
                life: 3000
            });
        } finally {
            isLoading.value = false;
            hideLoading();
        }
    };

    /**
     * จัดการเมื่อเปลี่ยนหน้า
     */
    const onPageChange = (event) => {
        const page = event.page + 1;
        rowsPerPage.value = event.rows;
        first.value = event.first;
        fetchAccounts(page);
        saveFilterState();
    };

    /**
     * ค้นหา
     */
    const handleSearch = () => {
        currentPage.value = 1;
        fetchAccounts(1);
        saveFilterState();
    };

    /**
     * ล้างการค้นหา
     */
    const clearSearch = () => {
        searchQuery.value = '';
        currentPage.value = 1;
        fetchAccounts(1);
    };

    /**
     * ไปหน้าสร้างใหม่
     */
    const navigateToCreate = () => {
        router.push(`${config.route}/create`);
    };

    /**
     * ไปหน้าแก้ไข
     */
    const navigateToEdit = (id) => {
        router.push(`${config.route}/edit/${id}`);
    };

    /**
     * ลบบัญชี
     */
    const deleteAccount = async (id) => {
        try {
            showLoading('กำลังลบข้อมูล...');

            const response = await config.api.delete(id);

            if (response.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: `ลบ${config.titleSingle}เรียบร้อยแล้ว`,
                    life: 3000
                });

                // Reload current page
                await fetchAccounts(currentPage.value);
            }
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: `ไม่สามารถลบ${config.titleSingle}ได้`,
                life: 3000
            });
        } finally {
            hideLoading();
        }
    };

    /**
     * ดึงข้อมูลบัญชีตาม ID (สำหรับ Form)
     */
    const fetchAccountById = async (id) => {
        try {
            showLoading('กำลังโหลดข้อมูล...');

            const response = await config.api.getById(id);

            if (response.success) {
                return response.data;
            }
        } catch (error) {
            console.error(`Error fetching ${type} by ID:`, error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลได้',
                life: 3000
            });
            throw error;
        } finally {
            hideLoading();
        }
    };

    /**
     * สร้างบัญชีใหม่
     */
    const createAccount = async (data) => {
        try {
            showLoading('กำลังบันทึกข้อมูล...');

            const response = await config.api.create(data);

            if (response.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: `เพิ่ม${config.titleSingle}เรียบร้อยแล้ว`,
                    life: 3000
                });

                router.push(config.route);
                return true;
            }
        } catch (error) {
            console.error(`Error creating ${type}:`, error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.response?.data?.message || `ไม่สามารถเพิ่ม${config.titleSingle}ได้`,
                life: 3000
            });
            return false;
        } finally {
            hideLoading();
        }
    };

    /**
     * อัพเดทบัญชี
     */
    const updateAccount = async (id, data) => {
        try {
            showLoading('กำลังบันทึกข้อมูล...');

            const response = await config.api.update(id, data);

            if (response.success) {
                toast.add({
                    severity: 'success',
                    summary: 'สำเร็จ',
                    detail: `แก้ไข${config.titleSingle}เรียบร้อยแล้ว`,
                    life: 3000
                });

                router.push(config.route);
                return true;
            }
        } catch (error) {
            console.error(`Error updating ${type}:`, error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.response?.data?.message || `ไม่สามารถแก้ไข${config.titleSingle}ได้`,
                life: 3000
            });
            return false;
        } finally {
            hideLoading();
        }
    };

    /**
     * Get account name helper
     */
    const getAccountName = (account) => {
        if (!account) return '-';
        const thName = account.names?.find((n) => n.code === 'th');
        const name = thName?.name || account.name || '-';
        return `${account.code} - ${name}`;
    };

    /**
     * Setup filter persistence
     */
    const setupFilterPersistence = () => {
        // Watch สำหรับบันทึก filter state เมื่อมีการเปลี่ยนแปลง
        watch([currentPage, rowsPerPage, searchQuery], () => {
            saveFilterState();
        });

        // ตรวจสอบก่อนออกจากหน้า - ถ้าไปหน้า Form ให้เก็บ filter ไว้ ถ้าไปหน้าอื่นให้ลบ
        onBeforeRouteLeave((to) => {
            // ตรวจสอบว่ากำลังจะไปหน้า Form หรือไม่
            const isGoingToFormPage = to.path?.startsWith(`${config.route}/create`) || to.path?.startsWith(`${config.route}/edit`);

            // ถ้าไม่ได้ไปหน้า form ให้ลบ filter state (เช่น เปลี่ยน menu)
            if (!isGoingToFormPage) {
                clearFilterState();
            }
        });
    };

    return {
        // Config
        config,

        // State
        accounts,
        totalRecords,
        currentPage,
        rowsPerPage,
        first,
        searchQuery,
        isLoading,

        // Options
        personalTypeOptions,
        customerTypeOptions,
        personalTypes,
        customerTypes,

        // Methods
        fetchAccounts,
        onPageChange,
        handleSearch,
        clearSearch,
        navigateToCreate,
        navigateToEdit,
        deleteAccount,
        fetchAccountById,
        createAccount,
        updateAccount,
        getAccountName,
        loadFilterState,
        setupFilterPersistence
    };
}
