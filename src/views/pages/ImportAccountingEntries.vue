<script setup>
import DialogForm from '@/components/DialogForm.vue';
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import * as XLSX from 'xlsx';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const fileInput = ref(null);
const importData = ref([]);
const errorMessages = ref([]);
const showConfirmDialog = ref(false);
const isSaving = ref(false);
const isDragging = ref(false);

// Detail dialog
const detailDialogVisible = ref(false);
const selectedJournal = ref(null);

// Masterdata
const chartOfAccounts = ref([]);
const journalBooks = ref([]);

// Constants
const TEMPLATE_URL = '/demo/file/template_journal.xlsx';

// Load masterdata
onMounted(async () => {
    await Promise.all([fetchChartOfAccounts(), fetchJournalBooks()]);
});

const fetchChartOfAccounts = async () => {
    try {
        const response = await api.getChartOfAccounts({ limit: 9999 });
        if (response.success) {
            chartOfAccounts.value = response.data || [];
        }
    } catch (error) {
        console.error('Failed to fetch chart of accounts:', error);
    }
};

const fetchJournalBooks = async () => {
    try {
        const response = await api.getJournalBooks({ limit: 9999 });
        if (response.success) {
            journalBooks.value = response.data || [];
        }
    } catch (error) {
        console.error('Failed to fetch journal books:', error);
    }
};

// Helper functions
const selectAccount = (code) => {
    return chartOfAccounts.value.find((acc) => acc.accountcode === code);
};

const selectBookDetail = (code) => {
    return journalBooks.value.find((book) => book.code === code);
};

const getDateTimeFromDate = (value) => {
    if (!value) return '';
    // Handle Excel date serial number
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString();
    }
    // Handle string date
    if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
    }
    return '';
};

const formatDate = (dateString) => {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const removeDuplicates = (arr) => {
    const obj = {};
    arr.forEach((item) => {
        obj[item] = true;
    });
    return Object.keys(obj);
};

const groupByKey = (array, key) => {
    return array.reduce((hash, obj) => {
        if (obj[key] === undefined) return hash;
        return Object.assign(hash, {
            [obj[key]]: (hash[obj[key]] || []).concat(obj)
        });
    }, {});
};

// Download template
const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'template_journal.xlsx';
    link.click();
};

// Process file
const processFile = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['.xls', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const isValidType = validTypes.some((type) => file.name.endsWith(type) || file.type === type);

    if (!isValidType) {
        toast.add({
            severity: 'warn',
            summary: 'รูปแบบไฟล์ไม่ถูกต้อง',
            detail: 'กรุณาเลือกไฟล์ Excel (.xls หรือ .xlsx)',
            life: 3000
        });
        return;
    }

    showLoading('กำลังอ่านไฟล์...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const results = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 1 });

            const errorMsgs = [];
            const details = [];

            results.forEach((row) => {
                // Initialize journal structure
                const importDaily = {
                    accountdescription: '',
                    accountgroup: '',
                    accountperiod: '',
                    accountyear: '',
                    journaltype: 0,
                    amount: 0,
                    batchId: '',
                    docdate: '',
                    docno: '',
                    exdocrefdate: '',
                    exdocrefno: '',
                    bookcode: '',
                    journaldetail: [],
                    parid: '0000000'
                };

                const importVat = {
                    vatdocno: '',
                    vattype: 0,
                    vatdate: '',
                    vatperiod: '',
                    vatyear: '',
                    vatbase: 0,
                    vatrate: 0,
                    vatamount: 0,
                    exceptvat: 0,
                    vatmode: 0,
                    vatsubmit: false,
                    custcode: '',
                    custname: '',
                    custtaxid: '',
                    organization: 0,
                    branchcode: '00000',
                    remark: ''
                };

                const importTax = {
                    taxdocno: '',
                    taxdate: '',
                    custname: '',
                    custtype: 0,
                    custtaxid: '',
                    taxtype: 0,
                    address: '',
                    taxamount: 0,
                    details: [
                        { description: '', taxbase: 0, taxrate: 0, taxamount: 0 },
                        { description: '', taxbase: 0, taxrate: 0, taxamount: 0 }
                    ]
                };

                const journal = [];
                const journalHead = [];

                // Parse each field
                Object.entries(row).forEach(([key, value]) => {
                    // Journal fields
                    if (key === 'ACCGROUP') importDaily.accountgroup = value ? String(value).trim() : '';
                    if (key === 'PERIOD') importDaily.accountperiod = value;
                    if (key === 'YEAR') importDaily.accountyear = parseInt(value);
                    if (key === 'DESC') importDaily.accountdescription = value ? String(value).trim() : '';
                    if (key === 'NO') importDaily.docno = value ? String(value).trim() : '';
                    if (key === 'DATE') importDaily.docdate = getDateTimeFromDate(value);
                    if (key === 'NOREF') importDaily.exdocrefno = value ? String(value).trim() : '';
                    if (key === 'DATEREF') importDaily.exdocrefdate = getDateTimeFromDate(value);
                    if (key === 'BOOK') {
                        const bookCodeFromExcel = value ? String(value).trim() : '';
                        const book = selectBookDetail(bookCodeFromExcel);
                        importDaily.bookcode = book ? book.code : '';
                        importDaily._bookcodeFromExcel = bookCodeFromExcel; // เก็บไว้สำหรับแสดง error
                    }
                    if (key === 'TYPE') importDaily.journaltype = parseInt(value) || 0;
                    if (key === 'Reference doc') importDaily.batchId = value ? String(value).trim() : '';

                    // VAT fields
                    if (key === 'VATISADD') importVat.vatsubmit = value === '1' || value === 1;
                    if (key === 'BRANCHNO') importVat.branchcode = value ? String(value).trim() : '00000';
                    if (key === 'ORGTYPE') importVat.organization = parseInt(value) || 0;
                    if (key === 'CUSTNAME') {
                        importVat.custname = value ? String(value).trim() : '';
                        importTax.custname = value ? String(value).trim() : '';
                    }
                    if (key === 'EXCEPTVAT') importVat.exceptvat = parseFloat(value) || 0;
                    if (key === 'VATMONTH') importVat.vatperiod = value;
                    if (key === 'VATYEAR') importVat.vatyear = parseInt(value);
                    if (key === 'CUSTTAXID') {
                        importVat.custtaxid = value ? String(value).trim() : '';
                        importTax.custtaxid = value ? String(value).trim() : '';
                    }
                    if (key === 'VATDATE') importVat.vatdate = getDateTimeFromDate(value);
                    if (key === 'VATNO') importVat.vatdocno = value ? String(value).trim() : '';
                    if (key === 'VATTYPE') importVat.vattype = parseInt(value) || 0;
                    if (key === 'VATBASE') importVat.vatbase = parseFloat(value) || 0;
                    if (key === 'VATRATE') importVat.vatrate = parseFloat(value) || 0;
                    if (key === 'VATMODE') importVat.vatmode = parseInt(value) || 0;
                    if (key === 'VATVALUE') importVat.vatamount = parseFloat(value) || 0;

                    // Tax (WHT) fields
                    if (key === 'WHTTOTAL') importTax.taxamount = parseFloat(value) || 0;
                    if (key === 'CUSTTYPE') importTax.custtype = parseInt(value) || 0;
                    if (key === 'CUSTADDR') importTax.address = value ? String(value).trim() : '';
                    if (key === 'WHTDATE') importTax.taxdate = getDateTimeFromDate(value);
                    if (key === 'WHTNO') importTax.taxdocno = value ? String(value).trim() : '';
                    if (key === 'WHTRATE') importTax.details[0].taxrate = parseFloat(value) || 0;
                    if (key === 'WHTRATE2') importTax.details[1].taxrate = parseFloat(value) || 0;
                    if (key === 'WHTBASE') importTax.details[0].taxbase = parseFloat(value) || 0;
                    if (key === 'WHTBASE2') importTax.details[1].taxbase = parseFloat(value) || 0;
                    if (key === 'WHTDESC') importTax.details[0].description = value ? String(value).trim() : '';
                    if (key === 'WHTDESC2') importTax.details[1].description = value ? String(value).trim() : '';
                    if (key === 'WHTVALUE') importTax.details[0].taxamount = parseFloat(value) || 0;
                    if (key === 'WHTVALUE2') importTax.details[1].taxamount = parseFloat(value) || 0;
                    if (key === 'WHTMODE') importTax.taxtype = parseInt(value) || 0;

                    // Journal detail (D_ for debit, C_ for credit)
                    if (key.startsWith('D_')) {
                        const accountCode = key.split('D_')[1];
                        const account = selectAccount(accountCode);
                        journalHead.push(account ? account.accountcode : key);
                        journal.push({
                            accountcode: account ? account.accountcode : key,
                            accountname: account ? account.accountname : accountCode,
                            debitamount: parseFloat(value) || 0,
                            creditamount: 0
                        });
                    }

                    if (key.startsWith('C_')) {
                        const accountCode = key.split('C_')[1];
                        const account = selectAccount(accountCode);
                        journalHead.push(account ? account.accountcode : key);
                        journal.push({
                            accountcode: account ? account.accountcode : key,
                            accountname: account ? account.accountname : accountCode,
                            debitamount: 0,
                            creditamount: parseFloat(value) || 0
                        });
                    }
                });

                // Group journal details by account code
                const uniqueHead = removeDuplicates(journalHead);
                const groupedJournal = groupByKey(journal, 'accountcode');

                uniqueHead.forEach((accountCode) => {
                    const items = groupedJournal[accountCode];
                    if (items && items.length > 0) {
                        if (items.length === 1) {
                            importDaily.journaldetail.push({
                                accountcode: items[0].accountcode,
                                accountname: items[0].accountname,
                                debitamount: parseFloat(items[0].debitamount) || 0,
                                creditamount: parseFloat(items[0].creditamount) || 0
                            });
                        } else {
                            let sumDebit = 0;
                            let sumCredit = 0;
                            items.forEach((item) => {
                                sumDebit += parseFloat(item.debitamount) || 0;
                                sumCredit += parseFloat(item.creditamount) || 0;
                            });
                            importDaily.journaldetail.push({
                                accountcode: items[0].accountcode,
                                accountname: items[0].accountname,
                                debitamount: sumDebit,
                                creditamount: sumCredit
                            });
                        }
                    }
                });

                // Calculate totals
                let sumCredit = 0;
                let sumDebit = 0;
                importDaily.journaldetail.forEach((jr) => {
                    sumCredit += parseFloat(jr.creditamount) || 0;
                    sumDebit += parseFloat(jr.debitamount) || 0;
                });
                importDaily.amount = sumDebit;

                // Validation
                if (sumCredit.toFixed(2) !== sumDebit.toFixed(2)) {
                    errorMsgs.push({
                        name: 'ยอดเดบิต และ เครดิต ไม่เท่ากัน',
                        docno: importDaily.docno,
                        tab: 1
                    });
                }

                if (!importDaily.docdate) {
                    errorMsgs.push({ name: 'วันที่เอกสาร', docno: importDaily.docno, tab: 1 });
                }

                if (!importDaily.accountperiod) {
                    errorMsgs.push({ name: 'งวดบัญชี', docno: importDaily.docno, tab: 1 });
                }

                if (!importDaily.accountyear) {
                    errorMsgs.push({ name: 'ปีบัญชี', docno: importDaily.docno, tab: 1 });
                }

                if (!importDaily.bookcode) {
                    const bookcodeFromExcel = importDaily._bookcodeFromExcel || '';
                    if (bookcodeFromExcel) {
                        errorMsgs.push({
                            name: `ไม่พบรหัสสมุดรายวัน "${bookcodeFromExcel}" ในระบบ กรุณาตรวจสอบข้อมูล สมุดรายวัน`,
                            docno: importDaily.docno,
                            tab: 1
                        });
                    } else {
                        errorMsgs.push({
                            name: 'ไม่ได้ระบุสมุดรายวัน กรุณากรอกรหัสสมุดรายวันในไฟล์ Excel',
                            docno: importDaily.docno,
                            tab: 1
                        });
                    }
                }

                importDaily.journaldetail.forEach((ele) => {
                    if (ele.accountcode.startsWith('D_') || ele.accountcode.startsWith('C_') || !ele.accountcode) {
                        errorMsgs.push({
                            name: 'ไม่พบรายละเอียดรายการบัญชีหรือรายการซ้ำ ' + ele.accountname,
                            docno: importDaily.docno,
                            tab: 1
                        });
                    }
                });

                // VAT validation
                if (importVat.vatdocno) {
                    if (!importVat.vatdate) errorMsgs.push({ name: 'วันที่ใบกำกับ', docno: importDaily.docno, tab: 2 });
                    if (!importVat.vatperiod) errorMsgs.push({ name: 'เดือนภาษี', docno: importDaily.docno, tab: 2 });
                    if (!importVat.vatyear) errorMsgs.push({ name: 'ปีภาษี', docno: importDaily.docno, tab: 2 });
                    if (!importVat.vatbase) errorMsgs.push({ name: 'ฐานภาษี', docno: importDaily.docno, tab: 2 });
                    if (!importVat.vatrate && importVat.vatrate !== 0) errorMsgs.push({ name: 'อัตรา', docno: importDaily.docno, tab: 2 });
                    if (!importVat.vatamount && importVat.vatamount !== 0) errorMsgs.push({ name: 'ยอดภาษี', docno: importDaily.docno, tab: 2 });
                }

                // Tax validation
                if (importTax.taxdocno) {
                    if (!importTax.taxdate) errorMsgs.push({ name: 'วันที่หัก ณ ที่จ่าย', docno: importTax.taxdocno, tab: 3 });
                    if (!importTax.details[0].description) errorMsgs.push({ name: 'รายละเอียด 1', docno: importTax.taxdocno, tab: 3 });

                    // Auto-fill taxamount if description exists
                    if (importTax.details[0].description && !importTax.details[0].taxamount) {
                        importTax.details[0].taxamount = 0;
                    }
                    if (importTax.details[1].description && !importTax.details[1].taxamount) {
                        importTax.details[1].taxamount = 0;
                    }

                    const totalTaxAmount = parseFloat(importTax.details[0].taxamount) + parseFloat(importTax.details[1].taxamount);
                    if (Math.abs(totalTaxAmount - parseFloat(importTax.taxamount)) > 0.01) {
                        errorMsgs.push({ name: 'ยอดรวมภาษีหัก ณ ที่จ่าย ไม่สัมพันธ์กัน', docno: importTax.taxdocno, tab: 3 });
                    }
                }

                // Add to details
                details.push({
                    import_daily: importDaily,
                    import_vats: importVat.vatdocno ? [importVat] : [],
                    import_taxs: importTax.taxdocno ? [importTax] : []
                });
            });

            errorMessages.value = errorMsgs;

            if (errorMsgs.length === 0) {
                importData.value = details;
                toast.add({
                    severity: 'success',
                    summary: 'อ่านไฟล์สำเร็จ',
                    detail: `พบข้อมูล ${details.length} รายการ`,
                    life: 3000
                });
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์',
                life: 5000
            });
        } finally {
            hideLoading();
        }
    };

    reader.onerror = () => {
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอ่านไฟล์ได้',
            life: 3000
        });
    };

    reader.readAsArrayBuffer(file);
};

// Handle file upload
const handleFileUpload = (event) => {
    const file = event.files?.[0];
    processFile(file);
};

// Drag & Drop handlers
const onDragOver = (event) => {
    event.preventDefault();
    isDragging.value = true;
};

const onDragLeave = () => {
    isDragging.value = false;
};

const onDrop = (event) => {
    event.preventDefault();
    isDragging.value = false;
    const file = event.dataTransfer?.files?.[0];
    processFile(file);
};

// Clear data
const clearData = () => {
    importData.value = [];
    errorMessages.value = [];
    if (fileInput.value) {
        fileInput.value.clear();
    }
};

// View detail
const viewDetail = (data) => {
    // Convert import format to JournalDetailDialog format
    selectedJournal.value = {
        docno: data.import_daily.docno,
        docdate: data.import_daily.docdate,
        bookcode: data.import_daily.bookcode,
        accountdescription: data.import_daily.accountdescription,
        accountperiod: data.import_daily.accountperiod,
        accountyear: data.import_daily.accountyear,
        journaltype: data.import_daily.journaltype,
        amount: data.import_daily.amount,
        exdocrefno: data.import_daily.exdocrefno,
        exdocrefdate: data.import_daily.exdocrefdate,
        journaldetail: data.import_daily.journaldetail,
        vats: data.import_vats,
        taxes: data.import_taxs,
        debtaccounttype: 0,
        docformat: '-'
    };
    detailDialogVisible.value = true;
};

// Get total debit
const getTotalDebit = (journal) => {
    return journal.journaldetail?.reduce((sum, item) => sum + (item.debitamount || 0), 0) || 0;
};

// Get total credit
const getTotalCredit = (journal) => {
    return journal.journaldetail?.reduce((sum, item) => sum + (item.creditamount || 0), 0) || 0;
};

// Get book name
const getBookName = (bookcode) => {
    if (!bookcode) return '-';
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book?.name1 || bookcode;
};

// Get error tab name
const getTabName = (tab) => {
    if (tab === 1) return 'ข้อมูลรายวัน';
    if (tab === 2) return 'ข้อมูลภาษี';
    return 'ข้อมูลภาษีหัก ณ ที่จ่าย';
};

// Confirm save
const openConfirmDialog = () => {
    showConfirmDialog.value = true;
};

const closeConfirmDialog = () => {
    showConfirmDialog.value = false;
};

const confirmSave = async () => {
    showConfirmDialog.value = false;

    try {
        isSaving.value = true;
        showLoading('กำลังนำเข้าข้อมูล...');

        // Transform data for API
        const postData = importData.value.map((item) => {
            const sumDebit = item.import_daily.journaldetail.reduce((sum, detail) => sum + (parseFloat(detail.debitamount) || 0), 0);

            return {
                accountdescription: item.import_daily.accountdescription,
                accountgroup: item.import_daily.accountgroup,
                accountperiod: item.import_daily.accountperiod,
                accountyear: item.import_daily.accountyear,
                journaltype: parseInt(item.import_daily.journaltype),
                amount: sumDebit,
                batchId: item.import_daily.batchId,
                docdate: item.import_daily.docdate,
                docno: item.import_daily.docno,
                bookcode: item.import_daily.bookcode,
                journaldetail: item.import_daily.journaldetail,
                parid: item.import_daily.parid,
                vats: item.import_vats,
                taxes: item.import_taxs
            };
        });

        const response = await api.importJournals(postData);

        if (response.data?.success) {
            const createdCount = response.data.created?.length || response.data.data?.length || postData.length;

            toast.add({
                severity: 'success',
                summary: 'นำเข้าข้อมูลสำเร็จ',
                detail: `นำเข้ารายการบัญชี ${createdCount} รายการ`,
                life: 5000
            });

            clearData();
        }
    } catch (error) {
        console.error('Error importing:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถนำเข้าข้อมูลได้',
            life: 5000
        });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

// Computed
const hasData = computed(() => importData.value.length > 0);
const hasErrors = computed(() => errorMessages.value.length > 0);
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">นำเข้าข้อมูลการบันทึกบัญชี</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">นำเข้าข้อมูลรายวันจากไฟล์ Excel</p>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-3">
                <Button label="ดาวน์โหลด Template" icon="pi pi-download" severity="secondary" @click="downloadTemplate" />

                <Button v-if="hasData && !hasErrors" label="บันทึกนำเข้า" icon="pi pi-save" severity="success" :loading="isSaving" @click="openConfirmDialog" />

                <Button v-if="hasData || hasErrors" label="ยกเลิก" icon="pi pi-times" severity="danger" outlined @click="clearData" />
            </div>

            <!-- Error Messages -->
            <div v-if="hasErrors" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="pi pi-exclamation-triangle text-red-500 text-xl"></i>
                    <span class="font-semibold text-red-700 dark:text-red-400">ไม่สามารถทำรายการได้ กรุณาตรวจสอบข้อมูล</span>
                </div>
                <ul class="list-disc list-inside space-y-1">
                    <li v-for="(error, index) in errorMessages" :key="index" class="text-red-600 dark:text-red-400">{{ getTabName(error.tab) }}: {{ error.name }} - เลขที่เอกสาร: {{ error.docno }}</li>
                </ul>
            </div>

            <!-- Data Table -->
            <DataTable
                v-if="hasData && !hasErrors"
                :value="importData"
                :paginator="true"
                :rows="10"
                :rowsPerPageOptions="[10, 25, 50]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="แสดง {first} ถึง {last} จากทั้งหมด {totalRecords} รายการ"
                responsiveLayout="scroll"
                stripedRows
                :rowHover="true"
                class="w-full"
            >
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-3"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูล</p>
                    </div>
                </template>

                <Column field="import_daily.docdate" header="วันที่" style="width: 120px">
                    <template #body="{ data }">
                        {{ formatDate(data.import_daily.docdate) }}
                    </template>
                </Column>

                <Column field="import_daily.docno" header="เลขที่เอกสาร" style="width: 150px">
                    <template #body="{ data }">
                        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ data.import_daily.docno }}</span>
                    </template>
                </Column>

                <Column field="import_daily.bookcode" header="สมุดรายวัน" style="width: 180px">
                    <template #body="{ data }">
                        <span class="text-sm text-primary-600 dark:text-primary-400">{{ data.import_daily.bookcode }}</span>
                        <span class="text-surface-500 dark:text-surface-400 mx-1">~</span>
                        <span>{{ getBookName(data.import_daily.bookcode) }}</span>
                    </template>
                </Column>

                <Column header="งวด/ปี" style="width: 100px">
                    <template #body="{ data }">
                        <Tag :value="`${data.import_daily.accountperiod}/${data.import_daily.accountyear}`" severity="secondary" />
                    </template>
                </Column>

                <Column field="import_daily.amount" header="จำนวนเงิน" style="width: 130px">
                    <template #body="{ data }">
                        <div class="text-right font-semibold text-green-600 dark:text-green-400">
                            {{ formatCurrency(data.import_daily.amount) }}
                        </div>
                    </template>
                </Column>

                <Column field="import_daily.accountdescription" header="คำอธิบาย" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="truncate" v-tooltip.top="data.import_daily.accountdescription">
                            {{ data.import_daily.accountdescription || '-' }}
                        </div>
                    </template>
                </Column>

                <Column header="ภาษี" style="width: 80px">
                    <template #body="{ data }">
                        <Badge v-if="data.import_vats.length > 0" :value="data.import_vats.length" severity="success" />
                        <span v-else class="text-surface-400">-</span>
                    </template>
                </Column>

                <Column header="หัก ณ ที่จ่าย" style="width: 100px">
                    <template #body="{ data }">
                        <Badge v-if="data.import_taxs.length > 0" :value="data.import_taxs.length" severity="warn" />
                        <span v-else class="text-surface-400">-</span>
                    </template>
                </Column>

                <Column header="จัดการ" style="width: 80px" frozen alignFrozen="right">
                    <template #body="{ data }">
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewDetail(data)" v-tooltip.top="'ดูรายละเอียด'" />
                    </template>
                </Column>
            </DataTable>

            <!-- Drop Zone / Empty State -->
            <div
                v-if="!hasData && !hasErrors"
                class="rounded-border border-2 border-dashed border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 transition-all duration-300 cursor-pointer"
                :class="isDragging ? 'border-primary bg-primary-50 dark:bg-primary-900/20 scale-[1.01]' : 'hover:border-primary hover:bg-surface-100 dark:hover:bg-surface-700'"
                @dragover="onDragOver"
                @dragleave="onDragLeave"
                @drop="onDrop"
            >
                <div class="flex flex-col items-center justify-center py-12 px-8">
                    <!-- Icon -->
                    <div class="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300" :class="isDragging ? 'bg-primary-100 dark:bg-primary-900/30 scale-110' : 'bg-surface-100 dark:bg-surface-700'">
                        <i class="pi pi-file-excel text-4xl transition-all duration-300" :class="isDragging ? 'text-primary' : 'text-surface-400'"></i>
                    </div>

                    <!-- Text -->
                    <div class="text-center">
                        <p class="text-xl font-semibold mb-2" :class="isDragging ? 'text-primary' : 'text-surface-700 dark:text-surface-200'">
                            {{ isDragging ? 'ปล่อยไฟล์เพื่อนำเข้า' : 'ลากไฟล์ Excel มาวางที่นี่' }}
                        </p>
                        <p class="text-surface-500 dark:text-surface-400 text-sm">หรือคลิกปุ่มด้านล่างเพื่อเลือกไฟล์</p>
                    </div>

                    <!-- Upload Button -->
                    <FileUpload ref="fileInput" mode="basic" accept=".xls,.xlsx" :auto="true" :customUpload="true" @uploader="handleFileUpload" chooseLabel="เลือกไฟล์" chooseIcon="pi pi-upload" class="mt-4" />

                    <!-- File info -->
                    <div class="flex items-center gap-4 mt-6 text-surface-400 text-xs">
                        <Chip class="bg-surface-100 dark:bg-surface-700">
                            <i class="pi pi-file mr-1"></i>
                            .xls, .xlsx
                        </Chip>
                        <Button label="ดาวน์โหลด Template" icon="pi pi-download" text size="small" @click="downloadTemplate" />
                    </div>

                    <!-- Note -->
                    <p class="text-surface-400 text-xs mt-4 flex items-center gap-1">
                        <i class="pi pi-info-circle"></i>
                        รองรับการนำเข้าข้อมูลรายวัน พร้อมข้อมูลภาษีและภาษีหัก ณ ที่จ่าย
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Detail Dialog -->
    <JournalDetailDialog v-model:visible="detailDialogVisible" :journal="selectedJournal" :journalBooksData="journalBooks" />

    <!-- Confirm Dialog -->
    <DialogForm :confirmDialog="showConfirmDialog" :textContent="`ต้องการบันทึกนำเข้ารายการบัญชี ${importData.length} รายการ?`" confirmLabel="บันทึก (Enter)" @close="closeConfirmDialog" @confirm="confirmSave" />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
