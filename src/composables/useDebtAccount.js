import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
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

    // State
    const accounts = ref([]);
    const totalRecords = ref(0);
    const currentPage = ref(1);
    const rowsPerPage = ref(10);
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
        fetchAccounts(page);
    };

    /**
     * ค้นหา
     */
    const handleSearch = () => {
        currentPage.value = 1;
        fetchAccounts(1);
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

    return {
        // Config
        config,

        // State
        accounts,
        totalRecords,
        currentPage,
        rowsPerPage,
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
        getAccountName
    };
}
