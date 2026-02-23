<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import ThaiDatePicker from '@/components/common/ThaiDatePicker.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useReportExport } from '@/composables/useReportExport';
import { getJournalByDocNo, getTrialBalanceSheet } from '@/services/api/report';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

// State
const loading = ref(false);
const reportData = ref(null);
const searchPopover = ref(null);
const expandedRows = ref({});
const ledgerDataCache = ref({});
const loadingLedger = ref({});

// Journal Detail Dialog
const journalDialogVisible = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);

// Search filters
const endDate = ref(null);
const includeClosingEntry = ref(0); // 0 = ไม่รวม, 1 = รวม

// Options for include closing entry
const icaOptions = [
    { label: 'ไม่รวม', value: 0 },
    { label: 'รวม', value: 1 }
];

// Initialize default dates (last day of current month)
const initDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    endDate.value = new Date(year, month + 1, 0);
};

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

// Computed - filter account details (only level 3-5)
const filteredAccountDetails = computed(() => {
    if (!reportData.value?.accountdetails) return [];
    return reportData.value.accountdetails.filter((item) => item.accountlevel >= 3);
});

// Computed - calculate Profit/Loss section totals
const profitLossTotals = computed(() => {
    if (!filteredAccountDetails.value.length) return { debit: 0, credit: 0 };

    // Category 4 = รายได้, Category 5 = ค่าใช้จ่าย
    const profitLossAccounts = filteredAccountDetails.value.filter((item) => item.accountcategory === 4 || item.accountcategory === 5);

    return {
        debit: profitLossAccounts.reduce((sum, item) => sum + (parseFloat(item.nextbalancedebitamount) || 0), 0),
        credit: profitLossAccounts.reduce((sum, item) => sum + (parseFloat(item.nextbalancecreditamount) || 0), 0)
    };
});

// Computed - calculate Balance Sheet section totals
const balanceSheetTotals = computed(() => {
    if (!filteredAccountDetails.value.length) return { debit: 0, credit: 0 };

    // Category 1 = สินทรัพย์, Category 2 = หนี้สิน, Category 3 = ส่วนของเจ้าของ
    const balanceSheetAccounts = filteredAccountDetails.value.filter((item) => item.accountcategory === 1 || item.accountcategory === 2 || item.accountcategory === 3);

    return {
        debit: balanceSheetAccounts.reduce((sum, item) => sum + (parseFloat(item.nextbalancedebitamount) || 0), 0),
        credit: balanceSheetAccounts.reduce((sum, item) => sum + (parseFloat(item.nextbalancecreditamount) || 0), 0)
    };
});

// Computed - Net profit/loss
const netProfitLoss = computed(() => {
    return profitLossTotals.value.credit - profitLossTotals.value.debit;
});

// Computed - Profit/Loss row for adjusting
const profitLossAdjustment = computed(() => {
    const netPL = netProfitLoss.value;
    return {
        profitLossDebit: netPL > 0 ? netPL : 0,
        profitLossCredit: netPL < 0 ? Math.abs(netPL) : 0,
        balanceSheetDebit: netPL < 0 ? Math.abs(netPL) : 0,
        balanceSheetCredit: netPL > 0 ? netPL : 0
    };
});

// Computed - Final totals
const finalTotals = computed(() => {
    const adj = profitLossAdjustment.value;
    return {
        profitLossDebit: profitLossTotals.value.debit + adj.profitLossDebit,
        profitLossCredit: profitLossTotals.value.credit + adj.profitLossCredit,
        balanceSheetDebit: balanceSheetTotals.value.debit + adj.balanceSheetDebit,
        balanceSheetCredit: balanceSheetTotals.value.credit + adj.balanceSheetCredit
    };
});

// Computed - Get profit/loss debit for a row
const getProfitLossDebit = (item) => {
    if (item.accountcategory === 4 || item.accountcategory === 5) {
        return item.nextbalancedebitamount || 0;
    }
    return 0;
};

// Computed - Get profit/loss credit for a row
const getProfitLossCredit = (item) => {
    if (item.accountcategory === 4 || item.accountcategory === 5) {
        return item.nextbalancecreditamount || 0;
    }
    return 0;
};

// Computed - Get balance sheet debit for a row
const getBalanceSheetDebit = (item) => {
    if (item.accountcategory === 1 || item.accountcategory === 2 || item.accountcategory === 3) {
        return item.nextbalancedebitamount || 0;
    }
    return 0;
};

// Computed - Get balance sheet credit for a row
const getBalanceSheetCredit = (item) => {
    if (item.accountcategory === 1 || item.accountcategory === 2 || item.accountcategory === 3) {
        return item.nextbalancecreditamount || 0;
    }
    return 0;
};

// Fetch report data
const fetchReport = async () => {
    if (!endDate.value) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกวันที่',
            life: 3000
        });
        return;
    }

    loading.value = true;
    expandedRows.value = {};
    ledgerDataCache.value = {};

    try {
        const params = {
            startdate: '2000-01-01',
            enddate: formatDateForApi(endDate.value),
            ica: includeClosingEntry.value
        };

        const response = await getTrialBalanceSheet(params);

        if (response.success) {
            reportData.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: response.message || 'ไม่สามารถดึงข้อมูลรายงานได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching work sheet report:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// // Fetch ledger account data when row expands
// const fetchLedgerAccount = async (accountCode) => {
//     if (ledgerDataCache.value[accountCode]) {
//         return;
//     }

//     loadingLedger.value[accountCode] = true;

//     try {
//         const params = {
//             startdate: '2000-01-01',
//             enddate: formatDateForApi(endDate.value),
//             accountcode: `${accountCode}:${accountCode}`
//         };

//         const response = await getLedgerAccount(params);

//         if (response.success && response.data?.length > 0) {
//             ledgerDataCache.value[accountCode] = response.data[0];
//         }
//     } catch (error) {
//         console.error('Error fetching ledger account:', error);
//         toast.add({
//             severity: 'error',
//             summary: 'ข้อผิดพลาด',
//             detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีแยกประเภท',
//             life: 3000
//         });
//     } finally {
//         loadingLedger.value[accountCode] = false;
//     }
// };

// // Handle row expand
// const onRowExpand = (event) => {
//     const accountCode = event.data.accountcode;
//     fetchLedgerAccount(accountCode);
// };

// // Handle row click to toggle expand
// const onWorkSheetRowClick = (event) => {
//     const accountCode = event.data.accountcode;
//     if (expandedRows.value[accountCode]) {
//         delete expandedRows.value[accountCode];
//     } else {
//         expandedRows.value[accountCode] = true;
//         fetchLedgerAccount(accountCode);
//     }
// };

// Handle ledger row click to show journal detail
const onLedgerRowClick = async (docno) => {
    loadingJournal.value = true;
    journalDialogVisible.value = true;

    try {
        const response = await getJournalByDocNo(docno);

        if (response.success && response.data) {
            selectedJournal.value = response.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่พบข้อมูลเอกสาร',
                life: 3000
            });
            journalDialogVisible.value = false;
        }
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร',
            life: 3000
        });
        journalDialogVisible.value = false;
    } finally {
        loadingJournal.value = false;
    }
};

// Get ledger data for account
const getLedgerData = (accountCode) => {
    return ledgerDataCache.value[accountCode];
};

// Check if ledger is loading
const isLedgerLoading = (accountCode) => {
    return loadingLedger.value[accountCode] || false;
};

// Get row class based on account level for indentation
const getRowClass = (data) => {
    const level = data.accountlevel || 1;
    return {
        'font-bold': level <= 2,
        'text-surface-600 dark:text-surface-400': level > 3
    };
};

// Get account name with indentation based on level
const getIndentedName = (data) => {
    const level = data.accountlevel || 1;
    const indent = '  '.repeat(Math.max(0, level - 1));
    return indent + data.accountname;
};

const { exportToExcel, exportToPdf } = useReportExport();

// Export Excel
const exportExcel = () => {
    const headerRows = [['รหัสบัญชี', 'ชื่อบัญชี', 'ยอดสะสม เดบิต', 'ยอดสะสม เครดิต', 'งบกำไรขาดทุน เดบิต', 'งบกำไรขาดทุน เครดิต', 'งบดุล เดบิต', 'งบดุล เครดิต']];

    const dataRows = filteredAccountDetails.value.map((item) => [
        item.accountcode,
        getIndentedName(item),
        formatCurrency(item.nextbalancedebitamount),
        formatCurrency(item.nextbalancecreditamount),
        formatCurrency(getProfitLossDebit(item)),
        formatCurrency(getProfitLossCredit(item)),
        formatCurrency(getBalanceSheetDebit(item)),
        formatCurrency(getBalanceSheetCredit(item))
    ]);

    // Footer rows
    if (reportData.value) {
        const adj = profitLossAdjustment.value;
        dataRows.push([
            'รวม',
            '',
            formatCurrency(reportData.value.totalnextbalancedebit),
            formatCurrency(reportData.value.totalnextbalancecredit),
            formatCurrency(profitLossTotals.value.debit),
            formatCurrency(profitLossTotals.value.credit),
            formatCurrency(balanceSheetTotals.value.debit),
            formatCurrency(balanceSheetTotals.value.credit)
        ]);
        dataRows.push([
            'กำไร (ขาดทุน) สุทธิ',
            '',
            '-',
            '-',
            adj.profitLossDebit > 0 ? formatCurrency(adj.profitLossDebit) : '-',
            adj.profitLossCredit > 0 ? formatCurrency(adj.profitLossCredit) : '-',
            adj.balanceSheetDebit > 0 ? formatCurrency(adj.balanceSheetDebit) : '-',
            adj.balanceSheetCredit > 0 ? formatCurrency(adj.balanceSheetCredit) : '-'
        ]);
        dataRows.push([
            'ผลรวมสุทธิ',
            '',
            '-',
            '-',
            formatCurrency(finalTotals.value.profitLossDebit),
            formatCurrency(finalTotals.value.profitLossCredit),
            formatCurrency(finalTotals.value.balanceSheetDebit),
            formatCurrency(finalTotals.value.balanceSheetCredit)
        ]);
    }

    exportToExcel({
        headerRows,
        dataRows,
        colWidths: [{ wch: 14 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }],
        sheetName: 'กระดาษทำการ',
        filename: `กระดาษทำการ_${formatDateForApi(endDate.value)}.xlsx`
    });
};

// Export PDF
const exportPdf = () => {
    // landscape A4 usable = 281mm, 2-level header
    const head = [
        [
            { content: 'รหัสบัญชี', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'ชื่อบัญชี', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'ยอดสะสม', colSpan: 2, styles: { halign: 'center' } },
            { content: 'งบกำไรขาดทุน', colSpan: 2, styles: { halign: 'center' } },
            { content: 'งบดุล', colSpan: 2, styles: { halign: 'center' } }
        ],
        [
            { content: 'เดบิต', styles: { halign: 'center' } },
            { content: 'เครดิต', styles: { halign: 'center' } },
            { content: 'เดบิต', styles: { halign: 'center' } },
            { content: 'เครดิต', styles: { halign: 'center' } },
            { content: 'เดบิต', styles: { halign: 'center' } },
            { content: 'เครดิต', styles: { halign: 'center' } }
        ]
    ];

    const body = filteredAccountDetails.value.map((item) => {
        const isBold = (item.accountlevel || 1) <= 2;
        const style = { fontStyle: isBold ? 'bold' : 'normal' };
        const rightStyle = { ...style, halign: 'right' };
        return [
            { content: item.accountcode, styles: { ...style, halign: 'center' } },
            { content: getIndentedName(item), styles: style },
            { content: formatCurrency(item.nextbalancedebitamount), styles: rightStyle },
            { content: formatCurrency(item.nextbalancecreditamount), styles: rightStyle },
            { content: formatCurrency(getProfitLossDebit(item)), styles: rightStyle },
            { content: formatCurrency(getProfitLossCredit(item)), styles: rightStyle },
            { content: formatCurrency(getBalanceSheetDebit(item)), styles: rightStyle },
            { content: formatCurrency(getBalanceSheetCredit(item)), styles: rightStyle }
        ];
    });

    // Footer rows
    if (reportData.value) {
        const adj = profitLossAdjustment.value;
        const footerStyle = { fontStyle: 'bold' };
        const footerRight = { fontStyle: 'bold', halign: 'right' };
        body.push([
            { content: 'รวม', styles: { ...footerStyle, halign: 'center' } },
            { content: '', styles: footerStyle },
            { content: formatCurrency(reportData.value.totalnextbalancedebit), styles: footerRight },
            { content: formatCurrency(reportData.value.totalnextbalancecredit), styles: footerRight },
            { content: formatCurrency(profitLossTotals.value.debit), styles: footerRight },
            { content: formatCurrency(profitLossTotals.value.credit), styles: footerRight },
            { content: formatCurrency(balanceSheetTotals.value.debit), styles: footerRight },
            { content: formatCurrency(balanceSheetTotals.value.credit), styles: footerRight }
        ]);
        body.push([
            { content: 'กำไร (ขาดทุน) สุทธิ', colSpan: 2, styles: { fontStyle: 'normal', halign: 'center' } },
            { content: '-', styles: { fontStyle: 'normal', halign: 'right' } },
            { content: '-', styles: { fontStyle: 'normal', halign: 'right' } },
            { content: adj.profitLossDebit > 0 ? formatCurrency(adj.profitLossDebit) : '-', styles: { fontStyle: 'normal', halign: 'right' } },
            { content: adj.profitLossCredit > 0 ? formatCurrency(adj.profitLossCredit) : '-', styles: { fontStyle: 'normal', halign: 'right' } },
            { content: adj.balanceSheetDebit > 0 ? formatCurrency(adj.balanceSheetDebit) : '-', styles: { fontStyle: 'normal', halign: 'right' } },
            { content: adj.balanceSheetCredit > 0 ? formatCurrency(adj.balanceSheetCredit) : '-', styles: { fontStyle: 'normal', halign: 'right' } }
        ]);
        body.push([
            { content: 'ผลรวมสุทธิ', colSpan: 2, styles: { ...footerStyle, halign: 'center' } },
            { content: '-', styles: { ...footerStyle, halign: 'right' } },
            { content: '-', styles: { ...footerStyle, halign: 'right' } },
            { content: formatCurrency(finalTotals.value.profitLossDebit), styles: footerRight },
            { content: formatCurrency(finalTotals.value.profitLossCredit), styles: footerRight },
            { content: formatCurrency(finalTotals.value.balanceSheetDebit), styles: footerRight },
            { content: formatCurrency(finalTotals.value.balanceSheetCredit), styles: footerRight }
        ]);
    }

    // landscape 281mm: code=18, name=fill, 6 numeric cols=22 each
    const numW = 22;
    const codeW = 18;
    const nameW = 281 - codeW - numW * 6;

    exportToPdf({
        orientation: 'landscape',
        title: 'กระดาษทำการ',
        subtitle: `ณ วันที่ ${formatDateThai(endDate.value)}${includeClosingEntry.value === 1 ? ' (รวมรายการปิดบัญชี)' : ''}`,
        head,
        body,
        columnStyles: {
            0: { cellWidth: codeW, halign: 'center' },
            1: { cellWidth: nameW },
            2: { cellWidth: numW, halign: 'right' },
            3: { cellWidth: numW, halign: 'right' },
            4: { cellWidth: numW, halign: 'right' },
            5: { cellWidth: numW, halign: 'right' },
            6: { cellWidth: numW, halign: 'right' },
            7: { cellWidth: numW, halign: 'right' }
        },
        filename: `กระดาษทำการ_${formatDateForApi(endDate.value)}.pdf`
    });
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

// Initialize on mount
onMounted(() => {
    initDefaultDates();
    fetchReport();
});
</script>

<template>
    <div class="card bg-surface-card p-6 rounded-xl shadow-sm">
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between">
            <div>
                <span class="text-xl font-medium text-surface-900 dark:text-surface-0">รายงานทางการเงิน / กระดาษทำการ</span>
                <div v-if="endDate" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    <i class="pi pi-calendar mr-1"></i>
                    ณ วันที่ {{ formatDateThai(endDate) }}
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="Excel" icon="pi pi-file-excel" @click="exportExcel" severity="secondary" :disabled="!filteredAccountDetails.length" />
                <Button label="PDF" icon="pi pi-file-pdf" @click="exportPdf" severity="secondary" :disabled="!filteredAccountDetails.length" />
                <Button label="เลือกเงื่อนไข" icon="pi pi-filter" @click="toggleSearchPopover" />
            </div>
        </div>

        <!-- Report Container -->
        <div class="report-container">
            <!-- Report Header -->
            <div class="mb-4 text-center">
                <div class="font-bold text-xl mb-0">กระดาษทำการ</div>
                <p class="text-sm text-surface-600 dark:text-surface-400">ณ วันที่ {{ formatDateThai(endDate) }}</p>
                <p v-if="includeClosingEntry === 1" class="text-sm text-surface-600 dark:text-surface-400">(รวมรายการปิดบัญชี)</p>
            </div>

            <!-- Report Table -->
            <DataTable :value="filteredAccountDetails" :loading="loading" dataKey="accountcode" showGridlines size="small" :rowHover="true" scrollable scrollHeight="calc(100vh - 380px)" class="worksheet-table">
                <!-- <Column expander style="width: 3rem" /> -->
                <Column field="accountcode" header="รหัสบัญชี" style="width: 120px">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ data.accountcode }}</span>
                    </template>
                </Column>
                <Column field="accountname" header="ชื่อบัญชี" style="min-width: 250px">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)" style="white-space: pre">{{ getIndentedName(data) }}</span>
                    </template>
                </Column>
                <ColumnGroup type="header">
                    <Row>
                        <Column header="รหัสบัญชี" :rowspan="2" :pt="{ headerCell: { style: 'width: 120px; text-align: center' } }" />
                        <Column header="ชื่อบัญชี" :rowspan="2" :pt="{ headerCell: { style: 'min-width: 250px; text-align: center' } }" />
                        <Column header="ยอดสะสม" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                        <Column header="งบกำไรขาดทุน" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                        <Column header="งบดุล" :colspan="2" :pt="{ headerCell: { style: 'text-align: center' } }" />
                    </Row>
                    <Row>
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เดบิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                        <Column header="เครดิต" :pt="{ headerCell: { style: 'width: 130px; text-align: center' } }" />
                    </Row>
                </ColumnGroup>

                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.nextbalancedebitamount) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(data.nextbalancecreditamount) }}</span>
                    </template>
                </Column>
                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(getProfitLossDebit(data)) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(getProfitLossCredit(data)) }}</span>
                    </template>
                </Column>
                <Column header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(getBalanceSheetDebit(data)) }}</span>
                    </template>
                </Column>
                <Column header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                    <template #body="{ data }">
                        <span :class="getRowClass(data)">{{ formatCurrency(getBalanceSheetCredit(data)) }}</span>
                    </template>
                </Column>

                <!-- Expansion Template -->
                <!-- <template #expansion="{ data }">
                    <div class="p-4 bg-surface-50 dark:bg-surface-900">
                        <!\-\- Loading State -\->
                        <div v-if="isLedgerLoading(data.accountcode)" class="flex justify-center py-4">
                            <ProgressSpinner style="width: 40px; height: 40px" />
                        </div>

                        <!\-\- Ledger Data -\->
                        <div v-else-if="getLedgerData(data.accountcode)">
                            <div class="mb-3 font-semibold text-surface-900 dark:text-surface-0">
                                <i class="pi pi-list mr-2"></i>
                                บัญชีแยกประเภท: {{ getLedgerData(data.accountcode).accountcode }} - {{ getLedgerData(data.accountcode).accountname }}
                            </div>

                            <DataTable :value="getLedgerData(data.accountcode).details || []" size="small" showGridlines :rowHover="true" class="ledger-table" @row-click="(e) => onLedgerRowClick(e.data.docno)">
                                <Column field="docdate" header="วันที่" style="width: 120px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ formatDateThai(detail.docdate) }}
                                    </template>
                                </Column>
                                <Column field="docno" header="เลขที่เอกสาร" style="width: 180px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        <span class="text-sm">{{ detail.docno }}</span>
                                    </template>
                                </Column>
                                <Column field="accountdescription" header="รายละเอียด" style="min-width: 250px" :pt="{ headerCell: { style: 'text-align: center' } }">
                                    <template #body="{ data: detail }">
                                        {{ detail.accountdescription || '-' }}
                                    </template>
                                </Column>
                                <Column field="debit" header="เดบิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.debit > 0" class="text-blue-600 dark:text-blue-400">
                                            {{ formatCurrency(detail.debit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="credit" header="เครดิต" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span v-if="detail.credit > 0" class="text-orange-600 dark:text-orange-400">
                                            {{ formatCurrency(detail.credit) }}
                                        </span>
                                        <span v-else class="text-surface-400">-</span>
                                    </template>
                                </Column>
                                <Column field="amount" header="ยอดรวม" style="width: 130px" :pt="{ headerCell: { style: 'text-align: center' }, bodyCell: { style: 'text-align: right' } }">
                                    <template #body="{ data: detail }">
                                        <span :class="detail.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                                            {{ formatCurrency(detail.amount) }}
                                        </span>
                                    </template>
                                </Column>

                                <template #empty>
                                    <div class="text-center py-4 text-surface-500">ไม่พบรายการเคลื่อนไหว</div>
                                </template>
                            </DataTable>
                        </div>

                        <!\-\- No Data -\->
                        <div v-else class="text-center py-4 text-surface-500">ไม่พบข้อมูลบัญชีแยกประเภท</div>
                    </div>
                </template> -->

                <!-- Empty State -->
                <template #empty>
                    <div class="text-center py-8">
                        <i class="pi pi-file text-4xl text-surface-400 mb-3 block"></i>
                        <p class="text-surface-600 dark:text-surface-400">ไม่พบข้อมูลรายงาน</p>
                    </div>
                </template>

                <!-- Footer -->
                <ColumnGroup v-if="reportData" type="footer">
                    <!-- รวม -->
                    <Row>
                        <Column footer="รวม" :colspan="2" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'text-align: center; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(reportData.totalnextbalancedebit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(reportData.totalnextbalancecredit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(profitLossTotals.debit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(profitLossTotals.credit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(balanceSheetTotals.debit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(balanceSheetTotals.credit)" :pt="{ footerCell: { class: 'bg-surface-100 dark:bg-surface-800', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                    </Row>
                    <!-- กำไรขาดทุน -->
                    <Row>
                        <Column footer="กำไร (ขาดทุน) สุทธิ" :colspan="2" :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900', style: 'text-align: center; font-weight: 500' } }" />
                        <Column footer="-" :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900 text-surface-400', style: 'width: 130px; text-align: right' } }" />
                        <Column footer="-" :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900 text-surface-400', style: 'width: 130px; text-align: right' } }" />
                        <Column
                            :footer="profitLossAdjustment.profitLossDebit > 0 ? formatCurrency(profitLossAdjustment.profitLossDebit) : '-'"
                            :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900', style: 'width: 130px; text-align: right' } }"
                        />
                        <Column
                            :footer="profitLossAdjustment.profitLossCredit > 0 ? formatCurrency(profitLossAdjustment.profitLossCredit) : '-'"
                            :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900', style: 'width: 130px; text-align: right' } }"
                        />
                        <Column
                            :footer="profitLossAdjustment.balanceSheetDebit > 0 ? formatCurrency(profitLossAdjustment.balanceSheetDebit) : '-'"
                            :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900', style: 'width: 130px; text-align: right' } }"
                        />
                        <Column
                            :footer="profitLossAdjustment.balanceSheetCredit > 0 ? formatCurrency(profitLossAdjustment.balanceSheetCredit) : '-'"
                            :pt="{ footerCell: { class: 'bg-surface-50 dark:bg-surface-900', style: 'width: 130px; text-align: right' } }"
                        />
                    </Row>
                    <!-- ผลรวม -->
                    <Row>
                        <Column footer="ผลรวมสุทธิ" :colspan="2" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-t-2', style: 'text-align: center; font-weight: bold' } }" />
                        <Column footer="-" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 text-surface-400 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column footer="-" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 text-surface-400 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(finalTotals.profitLossDebit)" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(finalTotals.profitLossCredit)" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(finalTotals.balanceSheetDebit)" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                        <Column :footer="formatCurrency(finalTotals.balanceSheetCredit)" :pt="{ footerCell: { class: 'bg-primary-50 dark:bg-primary-900/20 border-t-2', style: 'width: 130px; text-align: right; font-weight: bold' } }" />
                    </Row>
                </ColumnGroup>
            </DataTable>
        </div>
    </div>

    <!-- Search Popover -->
    <Popover ref="searchPopover">
        <div class="p-4 w-80">
            <div class="font-semibold mb-3">เงื่อนไขการค้นหา</div>

            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1">ณ วันที่</label>
                    <ThaiDatePicker v-model="endDate" class="w-full" showIcon />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">รวมรายการปิดบัญชี</label>
                    <Select v-model="includeClosingEntry" :options="icaOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <div class="flex justify-end mt-2">
                    <Button label="ค้นหา" icon="pi pi-search" @click="searchAndClosePopover" />
                </div>
            </div>
        </div>
    </Popover>

    <!-- Journal Detail Dialog -->
    <JournalDetailDialog v-model:visible="journalDialogVisible" :journal="selectedJournal" />

    <!-- Loading Dialog -->
    <LoadingDialog :visible="loading" message="กำลังโหลดข้อมูล..." />
</template>

<style scoped>
/* Style for indentation */
:deep(.p-datatable-tbody > tr > td) {
    vertical-align: middle;
}

/* Footer styling */
:deep(.p-datatable-tfoot > tr) {
    background: var(--p-surface-100);
}

:deep(.dark .p-datatable-tfoot > tr) {
    background: var(--p-surface-800);
}

:deep(.p-datatable-tfoot) {
    border-top: 2px solid var(--p-surface-300);
}

:deep(.dark .p-datatable-tfoot) {
    border-top-color: var(--p-surface-600);
}

/* Expansion row styling */
:deep(.p-datatable-row-expansion > td) {
    padding: 0 !important;
}

/* Worksheet table styling - clickable rows */
.worksheet-table :deep(.p-datatable-tbody > tr:not(.p-datatable-row-expansion)) {
    cursor: pointer;
}

/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}

/* Ledger table styling */
.ledger-table :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
}

.ledger-table :deep(.p-datatable-tbody > tr:hover) {
    background: var(--p-surface-100);
}

:deep(.dark) .ledger-table :deep(.p-datatable-tbody > tr:hover) {
    background: var(--p-surface-800);
}
</style>
