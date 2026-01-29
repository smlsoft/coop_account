<script setup>
import { getAccountPeriodByDate, getChartOfAccounts, getCreditors, getDebtors, getDocumentFormats, getJournalBooks } from '@/services/api/journal';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: Object,
        default: () => ({})
    },
    isDocNoInvalid: {
        type: Boolean,
        default: false
    },
    isBookCodeInvalid: {
        type: Boolean,
        default: false
    },
    isJournalDetailInvalid: {
        type: Boolean,
        default: false
    },
    isBalanceInvalid: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'validation-change', 'save', 'add-row', 'generate-docno']);

// Refs for focus management
const journalTableRef = ref(null);
const currentRowIndex = ref(0);

// Form data with two-way binding
const formData = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

// Local state for dropdowns
const journalBooks = ref([]);
const journalBooksLoading = ref(false);
const debtAccounts = ref([]);
const debtAccountsLoading = ref(false);
const chartOfAccounts = ref([]);
const documentFormats = ref([]);
const documentFormatsLoading = ref(false);

// Alert dialog state
const showPeriodAlert = ref(false);
const periodAlertMessage = ref('');
const isDocDateInvalid = ref(false);

// Debt account type options
const debtAccountTypes = ref([
    { label: 'ลูกหนี้', value: 0 },
    { label: 'เจ้าหนี้', value: 1 }
]);

// Journal type options
const journalTypes = ref([
    { label: 'ทั่วไป', value: 0 },
    { label: 'ปิดบัญชี', value: 1 }
]);

// Generate document number
const generateDocNo = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');

    updateField('docno', `JO-${yy}${mm}${dd}${hh}${min}-${seq}`);
};

// Update single field
const updateField = (field, value) => {
    const newValue = { ...props.modelValue, [field]: value };
    emit('update:modelValue', newValue);
};

// Format date to YYYY-MM-DD
const formatDateForApi = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Check account period when document date changes
const handleDocDateChange = async (newDate) => {
    if (!newDate) {
        updateField('docdate', null);
        isDocDateInvalid.value = false;
        return;
    }

    // บันทึกค่าวันที่ก่อนเสมอ
    updateField('docdate', newDate);

    const dateStr = formatDateForApi(newDate);

    try {
        const response = await getAccountPeriodByDate(dateStr);
        if (response.data.success && response.data.data.length > 0) {
            const periodData = response.data.data[0].perioddata;

            // Check if period is valid (has guidfixed)
            if (!periodData.guidfixed || periodData.guidfixed === '') {
                periodAlertMessage.value = 'วันที่เอกสารนี้ยังไม่ได้กำหนดงวดบัญชี ระบบจะบันทึกวันที่นี้ได้ แต่อาจมีปัญหาในการประมวลผล';
                showPeriodAlert.value = true;
                isDocDateInvalid.value = true;
                emit('validation-change', { isDocDateInvalid: true });
                return;
            }

            // Check if period is disabled
            if (periodData.isdisabled) {
                periodAlertMessage.value = 'วันที่เอกสารนี้ได้ถูกปิดงวดไปแล้ว ระบบจะบันทึกวันที่นี้ได้ แต่อาจไม่สามารถแก้ไขได้ในภายหลัง';
                showPeriodAlert.value = true;
                isDocDateInvalid.value = true;
                emit('validation-change', { isDocDateInvalid: true });
                return;
            }

            // Valid period
            isDocDateInvalid.value = false;
            emit('validation-change', { isDocDateInvalid: false });
        }
    } catch (error) {
        console.error('Error checking account period:', error);
        periodAlertMessage.value = 'ไม่สามารถตรวจสอบงวดบัญชีได้ วันที่จะถูกบันทึก แต่กรุณาตรวจสอบความถูกต้อง';
        showPeriodAlert.value = true;
        isDocDateInvalid.value = true;
        emit('validation-change', { isDocDateInvalid: true });
    }
};

// Search journal books
const searchJournalBooks = async (event) => {
    journalBooksLoading.value = true;
    try {
        const response = await getJournalBooks({ q: event.query, page: 1, limit: 20 });
        if (response.data.success) {
            journalBooks.value = response.data.data.map((item) => ({
                ...item,
                displayLabel: `${item.code} ~ ${item.name1}`
            }));
        }
    } catch (error) {
        console.error('Error fetching journal books:', error);
    } finally {
        journalBooksLoading.value = false;
    }
};

// Search debt accounts based on type
const searchDebtAccounts = async (event) => {
    debtAccountsLoading.value = true;
    try {
        const debtType = props.modelValue.debtaccounttype;
        const apiCall = debtType === 1 ? getCreditors : getDebtors;
        const response = await apiCall({ q: event.query, page: 1, limit: 20 });

        if (response.data.success) {
            debtAccounts.value = response.data.data.map((item) => {
                const thName = item.names?.find((n) => n.code === 'th')?.name || '';
                return {
                    ...item,
                    displayLabel: `${item.code} ~ ${thName}`
                };
            });
        }
    } catch (error) {
        console.error('Error fetching debt accounts:', error);
    } finally {
        debtAccountsLoading.value = false;
    }
};

// Watch debt account type change to reset debt account selection
let isResettingDebtAccount = false;
watch(
    () => props.modelValue.debtaccounttype,
    (newVal, oldVal) => {
        // ป้องกัน infinite loop โดยตรวจสอบว่าค่าเปลี่ยนจริงๆ และไม่ได้อยู่ระหว่าง reset
        if (newVal !== oldVal && !isResettingDebtAccount && props.modelValue.debtaccountcode !== null) {
            isResettingDebtAccount = true;
            updateField('debtaccountcode', null);
            debtAccounts.value = [];
            // Reset flag หลังจาก Vue อัปเดตเสร็จ
            nextTick(() => {
                isResettingDebtAccount = false;
            });
        }
    }
);

// Watch วันที่เอกสาร เพื่ออัปเดตวันที่ใบกำกับและวันที่หัก ณ ที่จ่าย
let isUpdatingDates = false;
let lastDocDate = null;
watch(
    () => props.modelValue.docdate,
    (newDate, oldDate) => {
        // ป้องกัน infinite loop
        if (isUpdatingDates) return;

        // ตรวจสอบว่าวันที่เปลี่ยนจริงๆ
        const newDateStr = newDate ? new Date(newDate).toISOString() : null;
        const oldDateStr = oldDate ? new Date(oldDate).toISOString() : null;
        if (newDateStr === oldDateStr || newDateStr === lastDocDate) return;

        if (newDate) {
            isUpdatingDates = true;
            lastDocDate = newDateStr;

            let needsUpdate = false;
            let updatedValue = { ...props.modelValue };

            // อัปเดตวันที่ใบกำกับทุกรายการใน vats (เฉพาะที่แตกต่าง)
            if (props.modelValue.vats && props.modelValue.vats.length > 0) {
                const updatedVats = props.modelValue.vats.map((vat) => {
                    const currentVatDate = vat.vatdate ? new Date(vat.vatdate).toISOString() : null;
                    if (currentVatDate !== newDateStr) {
                        needsUpdate = true;
                        const date = new Date(newDate);
                        return {
                            ...vat,
                            vatdate: date,
                            vatyear: date.getFullYear() + 543,
                            vatperiod: date.getMonth() + 1
                        };
                    }
                    return vat;
                });
                updatedValue.vats = updatedVats;
            }

            // อัปเดตวันที่หัก ณ ที่จ่ายทุกรายการใน taxes (เฉพาะที่แตกต่าง)
            if (props.modelValue.taxes && props.modelValue.taxes.length > 0) {
                const updatedTaxes = props.modelValue.taxes.map((tax) => {
                    const currentTaxDate = tax.taxdate ? new Date(tax.taxdate).toISOString() : null;
                    if (currentTaxDate !== newDateStr) {
                        needsUpdate = true;
                        return {
                            ...tax,
                            taxdate: new Date(newDate)
                        };
                    }
                    return tax;
                });
                updatedValue.taxes = updatedTaxes;
            }

            // Emit เฉพาะเมื่อมีการเปลี่ยนแปลงจริงๆ
            if (needsUpdate) {
                emit('update:modelValue', updatedValue);
            }

            nextTick(() => {
                isUpdatingDates = false;
            });
        }
    }
);

// Search document formats
const searchDocumentFormats = async (event) => {
    documentFormatsLoading.value = true;
    try {
        const response = await getDocumentFormats({ q: event.query, page: 1, limit: 20 });
        if (response.data.success) {
            documentFormats.value = response.data.data.map((item) => ({
                ...item,
                displayLabel: `${item.doccode} ~ ${item.description}`
            }));
        }
    } catch (error) {
        console.error('Error fetching document formats:', error);
    } finally {
        documentFormatsLoading.value = false;
    }
};

// Apply document format to journal details
const applyDocumentFormat = (selectedFormat) => {
    // ถ้ากด clear (selectedFormat = null) ให้เคลียร์ข้อมูล
    if (!selectedFormat) {
        clearDocumentFormat();
        return;
    }

    // ถ้าไม่มี details ให้ return
    if (!selectedFormat.details) return;

    // แปลง details จาก format เป็น journal detail format
    const newDetails = selectedFormat.details.map((detail) => ({
        accountcode: detail.accountcode || '',
        accountname: detail.detail || '',
        debitamount: parseFloat(detail.debit) || 0,
        creditamount: parseFloat(detail.credit) || 0
    }));

    // อัปเดต journaldetail และ docformat (ใช้ description แทน doccode)
    const newValue = {
        ...props.modelValue,
        journaldetail: newDetails,
        docformat: selectedFormat.description || ''
    };

    emit('update:modelValue', newValue);
};

// Clear document format and journal details
const clearDocumentFormat = () => {
    // ลบรายละเอียดบัญชีทั้งหมดและ reset docformat
    const newValue = {
        ...props.modelValue,
        journaldetail: [{ accountcode: '', accountname: '', debitamount: 0, creditamount: 0 }],
        docformat: ''
    };

    emit('update:modelValue', newValue);
};

// Load all chart of accounts at once
const loadAllChartOfAccounts = async () => {
    try {
        const response = await getChartOfAccounts({
            q: '',
            page: 1,
            limit: 1000,
            sort: 'accountcode:1'
        });

        if (response.data.success) {
            const accounts = response.data.data;

            // Debug: ดูข้อมูลที่ได้จาก API
            console.log('📊 Total accounts from API:', accounts.length);
            console.log('📊 Account levels distribution:', accounts.reduce((acc, item) => {
                acc[item.accountlevel] = (acc[item.accountlevel] || 0) + 1;
                return acc;
            }, {}));

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

            // Debug: ดูผลลัพธ์
            console.log('📊 Total items:', flatList.length);
            console.log('📊 Selectable items:', flatList.filter((i) => !i.disabled).length);
            console.log('📊 Header items:', flatList.filter((i) => i.disabled).length);

            chartOfAccounts.value = flatList;
        }
    } catch (error) {
        console.error('Error loading chart of accounts:', error);
        chartOfAccounts.value = [];
    }
};

// Check if specific row is loading
// const isRowLoading = (index) => activeSearchRowIndex.value === index;

// Journal detail management
const journalDetails = computed({
    get: () => props.modelValue.journaldetail || [],
    set: (value) => updateField('journaldetail', value)
});

const addRow = () => {
    const newDetails = [...journalDetails.value, { accountcode: '', accountname: '', debitamount: 0, creditamount: 0 }];
    updateField('journaldetail', newDetails);
};

const removeRow = (index) => {
    const newDetails = journalDetails.value.filter((_, i) => i !== index);
    updateField('journaldetail', newDetails);
};

const moveRowUp = (index) => {
    if (index <= 0) return;
    const newDetails = [...journalDetails.value];
    [newDetails[index - 1], newDetails[index]] = [newDetails[index], newDetails[index - 1]];
    updateField('journaldetail', newDetails);
};

const moveRowDown = (index) => {
    if (index >= journalDetails.value.length - 1) return;
    const newDetails = [...journalDetails.value];
    [newDetails[index], newDetails[index + 1]] = [newDetails[index + 1], newDetails[index]];
    updateField('journaldetail', newDetails);
};

const updateRow = (index, field, value) => {
    const newDetails = [...journalDetails.value];
    newDetails[index] = { ...newDetails[index], [field]: value };
    updateField('journaldetail', newDetails);
};

const onAccountSelect = (index, selectedAccount) => {
    if (selectedAccount) {
        const newDetails = [...journalDetails.value];
        newDetails[index] = {
            ...newDetails[index],
            accountcode: selectedAccount.accountcode,
            accountname: selectedAccount.accountname
        };
        updateField('journaldetail', newDetails);
    } else {
        // เมื่อ clear ให้ลบข้อมูลบัญชี
        const newDetails = [...journalDetails.value];
        newDetails[index] = {
            ...newDetails[index],
            accountcode: '',
            accountname: ''
        };
        updateField('journaldetail', newDetails);
    }
};

// Summary calculations
const totalDebit = computed(() => {
    return journalDetails.value.reduce((sum, row) => sum + (parseFloat(row.debitamount) || 0), 0);
});

const totalCredit = computed(() => {
    return journalDetails.value.reduce((sum, row) => sum + (parseFloat(row.creditamount) || 0), 0);
});

const difference = computed(() => {
    return totalDebit.value - totalCredit.value;
});

const formatCurrency = (value) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
};

// ตรวจสอบว่าอยู่ในแถวสุดท้ายของตารางหรือไม่
const isInLastRowOfTable = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const row = activeElement.closest('tr[data-pc-section="bodyrow"]');
    if (!row) return false;

    const tbody = row.closest('tbody');
    if (!tbody) return false;

    const rows = Array.from(tbody.querySelectorAll('tr[data-pc-section="bodyrow"]'));
    const currentIndex = rows.indexOf(row);

    return currentIndex === rows.length - 1;
};

// ตรวจสอบว่าอยู่ในช่องสุดท้ายของแถวหรือไม่ (ช่อง creditamount)
const isInLastInputOfRow = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    // ตรวจสอบว่าอยู่ในคอลัมน์เครดิต
    const row = activeElement.closest('tr[data-pc-section="bodyrow"]');
    if (!row) return false;

    // หา input ทั้งหมดในแถว
    const inputs = row.querySelectorAll('input:not([disabled])');
    const inputArray = Array.from(inputs);
    const currentIndex = inputArray.indexOf(activeElement);

    // ถ้าเป็น input สุดท้าย (เครดิต)
    return currentIndex === inputArray.length - 1;
};

// Keyboard shortcuts handler
const handleKeydown = (event) => {
    const isCtrl = event.ctrlKey || event.metaKey;
    const isAlt = event.altKey;
    const key = event.key?.toLowerCase() || ''; // Normalize key to lowercase for consistency
    const code = event.code; // Physical key position (more reliable for shortcuts)

    // Tab หรือ Enter ที่แถวสุดท้าย ช่องสุดท้าย → เพิ่มแถวใหม่
    if ((key === 'tab' || key === 'enter') && !event.shiftKey && !isCtrl && !isAlt) {
        if (isInLastRowOfTable() && isInLastInputOfRow()) {
            event.preventDefault();
            addRowAndFocus();
            return;
        }
    }

    // Ctrl/Cmd + S - Save
    if (isCtrl && (key === 's' || code === 'KeyS')) {
        console.log('✅ Save shortcut triggered');
        event.preventDefault();
        emit('save');
        return;
    }

    // Alt/Option + N - Add new row
    if (isAlt && (key === 'n' || code === 'KeyN')) {
        console.log('✅ Add new row shortcut triggered');
        event.preventDefault();
        addRowAndFocus();
        return;
    }

    // Alt/Option + G - Generate doc number
    if (isAlt && (key === 'g' || code === 'KeyG')) {
        console.log('✅ Generate doc number shortcut triggered');
        event.preventDefault();
        generateDocNo();
        return;
    }

    // Ctrl/Cmd + Delete - Delete current row (when in table)
    if (isCtrl && (key === 'delete' || code === 'Delete' || code === 'Backspace')) {
        console.log('✅ Delete row shortcut triggered');
        event.preventDefault();
        const activeRow = getCurrentRowFromFocus();
        if (activeRow >= 0) {
            removeRowAndFocus(activeRow);
        }
        return;
    }

    // Alt/Option + ArrowUp - Move row up
    if (isAlt && (key === 'arrowup' || code === 'ArrowUp')) {
        console.log('✅ Move row up shortcut triggered');
        event.preventDefault();
        const activeRow = getCurrentRowFromFocus();
        if (activeRow > 0) {
            moveRowUp(activeRow);
            currentRowIndex.value = activeRow - 1;
            // Focus back to the moved row
            nextTick(() => {
                const table = journalTableRef.value?.$el || document.querySelector('.journal-detail-table');
                if (table) {
                    const rows = table.querySelectorAll('tbody tr[data-pc-section="bodyrow"]');
                    const targetRow = rows[activeRow - 1];
                    if (targetRow) {
                        const input = targetRow.querySelector('input');
                        input?.focus();
                    }
                }
            });
        }
        return;
    }

    // Alt/Option + ArrowDown - Move row down
    if (isAlt && (key === 'arrowdown' || code === 'ArrowDown')) {
        console.log('✅ Move row down shortcut triggered');
        event.preventDefault();
        const activeRow = getCurrentRowFromFocus();
        if (activeRow >= 0 && activeRow < journalDetails.value.length - 1) {
            moveRowDown(activeRow);
            currentRowIndex.value = activeRow + 1;
            // Focus back to the moved row
            nextTick(() => {
                const table = journalTableRef.value?.$el || document.querySelector('.journal-detail-table');
                if (table) {
                    const rows = table.querySelectorAll('tbody tr[data-pc-section="bodyrow"]');
                    const targetRow = rows[activeRow + 1];
                    if (targetRow) {
                        const input = targetRow.querySelector('input');
                        input?.focus();
                    }
                }
            });
        }
        return;
    }

    // Insert key - Add new row (alternative)
    // Note: On Mac keyboards, Insert key might be 'Help'
    if ((key === 'insert' || key === 'help' || code === 'Insert' || code === 'Help') && !isCtrl && !isAlt) {
        event.preventDefault();
        addRowAndFocus();
        return;
    }
};

// Get current row index from focused element
const getCurrentRowFromFocus = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return -1;

    const row = activeElement.closest('tr[data-pc-section="bodyrow"]');
    if (!row) return -1;

    const tbody = row.closest('tbody');
    if (!tbody) return -1;

    const rows = Array.from(tbody.querySelectorAll('tr[data-pc-section="bodyrow"]'));
    return rows.indexOf(row);
};

// Add row and focus on the new row's first input
const addRowAndFocus = () => {
    addRow();
    nextTick(() => {
        const table = journalTableRef.value?.$el || document.querySelector('.journal-detail-table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr[data-pc-section="bodyrow"]');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                const input = lastRow.querySelector('input');
                input?.focus();
            }
        }
    });
};

// Remove row and focus on adjacent row
const removeRowAndFocus = (index) => {
    if (journalDetails.value.length <= 1) return;

    removeRow(index);
    nextTick(() => {
        const table = journalTableRef.value?.$el || document.querySelector('.journal-detail-table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr[data-pc-section="bodyrow"]');
            const focusIndex = Math.min(index, rows.length - 1);
            const targetRow = rows[focusIndex];
            if (targetRow) {
                const input = targetRow.querySelector('input');
                input?.focus();
            }
        }
    });
};

// Load initial journal books
onMounted(async () => {
    await searchJournalBooks({ query: '' });
    await searchDocumentFormats({ query: '' });
    await loadAllChartOfAccounts(); // โหลดผังบัญชีทั้งหมดครั้งเดียว
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div class="grid grid-cols-12 gap-4">
        <!-- Alert Dialog for Account Period -->
        <AlertDialog v-model:visible="showPeriodAlert" header="แจ้งเตือนงวดบัญชี" :message="periodAlertMessage" icon="pi-calendar-times" iconColor="text-orange-500" />

        <!-- Row 1 -->
        <!-- Document Date -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label for="docdate" class="block font-medium mb-2">วันที่เอกสาร <span class="text-red-500">*</span></label>
            <DatePicker id="docdate" :modelValue="formData.docdate" @update:modelValue="handleDocDateChange" dateFormat="dd/mm/yy" :showIcon="true" :showButtonBar="true" placeholder="เลือกวันที่" :invalid="isDocDateInvalid" fluid />
            <small v-if="isDocDateInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                <i class="pi pi-exclamation-circle"></i>
                วันที่ไม่อยู่ในงวดบัญชีที่เปิดใช้งาน
            </small>
        </div>

        <!-- Document Number -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label for="docno" class="block font-medium mb-2">เลขที่เอกสาร <span class="text-red-500">*</span></label>
            <div class="flex gap-2">
                <InputText id="docno" :modelValue="formData.docno" @update:modelValue="updateField('docno', $event)" placeholder="เลขที่เอกสาร" class="flex-1" :invalid="isDocNoInvalid" />
                <Button icon="pi pi-sync" severity="secondary" @click="generateDocNo" v-tooltip.top="'สร้างเลขที่เอกสารอัตโนมัติ'" />
            </div>
            <small v-if="isDocNoInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                <i class="pi pi-exclamation-circle"></i>
                กรุณากรอกเลขที่เอกสาร
            </small>
        </div>

        <!-- Journal Book -->
        <div class="col-span-12 md:col-span-4">
            <label for="bookcode" class="block font-medium mb-2">สมุดรายวัน <span class="text-red-500">*</span></label>
            <AutoComplete
                id="bookcode"
                :modelValue="formData.bookcode"
                @update:modelValue="updateField('bookcode', $event)"
                :suggestions="journalBooks"
                optionLabel="displayLabel"
                :loading="journalBooksLoading"
                @complete="searchJournalBooks"
                placeholder="ค้นหาสมุดรายวัน..."
                dropdown
                showClear
                forceSelection
                :invalid="isBookCodeInvalid"
                fluid
            />
            <small v-if="isBookCodeInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                <i class="pi pi-exclamation-circle"></i>
                กรุณาเลือกสมุดรายวัน
            </small>
        </div>

        <!-- Row 2 -->
        <!-- Debt Account Type -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label class="block font-medium mb-2">ประเภท</label>
            <div class="select-button-full">
                <SelectButton :modelValue="formData.debtaccounttype" @update:modelValue="updateField('debtaccounttype', $event)" :options="debtAccountTypes" optionLabel="label" optionValue="value" />
            </div>
        </div>

        <!-- Debt Account -->
        <div class="col-span-12 sm:col-span-6 md:col-span-8">
            <label for="debtaccountcode" class="block font-medium mb-2">
                {{ formData.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้' }}
            </label>
            <AutoComplete
                id="debtaccountcode"
                :modelValue="formData.debtaccountcode"
                @update:modelValue="updateField('debtaccountcode', $event)"
                :suggestions="debtAccounts"
                optionLabel="displayLabel"
                :loading="debtAccountsLoading"
                @complete="searchDebtAccounts"
                :placeholder="`ค้นหา${formData.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้'}...`"
                dropdown
                showClear
                forceSelection
                :disabled="formData.debtaccounttype === undefined || formData.debtaccounttype === null"
                fluid
            />
        </div>

        <!-- Row 3 -->
        <!-- Reference Document Date -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label for="exdocrefdate" class="block font-medium mb-2">วันที่เอกสารอ้างอิง</label>
            <DatePicker id="exdocrefdate" :modelValue="formData.exdocrefdate" @update:modelValue="updateField('exdocrefdate', $event)" dateFormat="dd/mm/yy" :showIcon="true" :showButtonBar="true" placeholder="เลือกวันที่" fluid />
        </div>

        <!-- Reference Document Number -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label for="exdocrefno" class="block font-medium mb-2">เลขที่เอกสารอ้างอิง</label>
            <InputText id="exdocrefno" :modelValue="formData.exdocrefno" @update:modelValue="updateField('exdocrefno', $event)" placeholder="เลขที่เอกสารอ้างอิง" fluid />
        </div>

        <!-- Journal Type -->
        <div class="col-span-12 sm:col-span-6 md:col-span-4">
            <label class="block font-medium mb-2">ประเภทรายการ</label>
            <div class="select-button-full">
                <SelectButton :modelValue="formData.journaltype" @update:modelValue="updateField('journaltype', $event)" :options="journalTypes" optionLabel="label" optionValue="value" />
            </div>
        </div>

        <!-- Row 4 -->
        <!-- Account Description -->
        <div class="col-span-12">
            <label for="accountdescription" class="block font-medium mb-2">คำอธิบาย</label>
            <Textarea id="accountdescription" :modelValue="formData.accountdescription" @update:modelValue="updateField('accountdescription', $event)" placeholder="คำอธิบายรายการ" rows="3" autoResize fluid />
        </div>

        <!-- Row 5 -->
        <!-- Journal Detail Table -->
        <div class="col-span-12 mt-4">
            <div class="flex justify-between items-center mb-3 gap-4">
                <label class="font-medium text-lg">รายละเอียดบัญชี <span class="text-red-500">*</span></label>
                <div class="flex items-center gap-2">
                    <AutoComplete
                        id="docformat"
                        :modelValue="documentFormats.find((f) => f.description === formData.docformat)"
                        @update:modelValue="applyDocumentFormat($event)"
                        :suggestions="documentFormats"
                        optionLabel="displayLabel"
                        :loading="documentFormatsLoading"
                        @complete="searchDocumentFormats"
                        placeholder="เลือกรูปแบบการบันทึก..."
                        dropdown
                        showClear
                        style="width: 280px"
                    >
                        <template #option="{ option }">
                            <div class="flex flex-col">
                                <span class="font-semibold text-sm">{{ option.doccode }} ~ {{ option.description }}</span>
                                <span class="text-xs text-surface-500 dark:text-surface-400">{{ option.details?.length || 0 }} รายการ</span>
                            </div>
                        </template>
                    </AutoComplete>
                    <Button icon="pi pi-plus" label="เพิ่มรายการ" size="small" @click="addRow" style="height: 32.8px" />
                </div>
            </div>

            <div :class="{ 'invalid-table-wrapper': isJournalDetailInvalid }">
                <DataTable ref="journalTableRef" :value="journalDetails" showGridlines size="small" class="journal-detail-table">
                    <Column header="#" style="width: 50px" bodyStyle="text-align: center">
                        <template #body="{ index }">
                            {{ index + 1 }}
                        </template>
                    </Column>

                    <Column header="รหัสบัญชี" style="width: 250px">
                        <template #body="{ data, index }">
                            <Select
                                :modelValue="data.accountcode ? chartOfAccounts.find((item) => item.accountcode === data.accountcode) : null"
                                @update:modelValue="onAccountSelect(index, $event)"
                                :options="chartOfAccounts"
                                optionLabel="displayLabel"
                                optionDisabled="disabled"
                                placeholder="เลือกรหัสบัญชี..."
                                filter
                                showClear
                                class="account-select"
                                :inputStyle="{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }"
                                fluid
                            >
                                <template #option="slotProps">
                                    <div
                                        :class="{
                                            'font-semibold text-primary-700 dark:text-primary-300': slotProps.option.accountlevel === 1,
                                            'font-semibold text-primary-600 dark:text-primary-400': slotProps.option.accountlevel === 2,
                                            'text-surface-700 dark:text-surface-300': !slotProps.option.disabled
                                        }"
                                    >
                                        {{ slotProps.option.displayLabel }}
                                    </div>
                                </template>
                            </Select>
                        </template>
                    </Column>

                    <Column field="accountname" header="ชื่อบัญชี" style="min-width: 200px">
                        <template #body="{ data }">
                            <span class="text-surface-600 dark:text-surface-400">{{ data.accountname || '-' }}</span>
                        </template>
                    </Column>

                    <Column header="เดบิต" style="width: 150px; min-width: 150px">
                        <template #body="{ data, index }">
                            <InputNumber :modelValue="data.debitamount" @update:modelValue="updateRow(index, 'debitamount', $event)" mode="decimal" :minFractionDigits="2" :maxFractionDigits="2" fluid />
                        </template>
                    </Column>

                    <Column header="เครดิต" style="width: 150px; min-width: 150px">
                        <template #body="{ data, index }">
                            <InputNumber :modelValue="data.creditamount" @update:modelValue="updateRow(index, 'creditamount', $event)" mode="decimal" :minFractionDigits="2" :maxFractionDigits="2" fluid />
                        </template>
                    </Column>

                    <Column header="จัดการ" style="width: 120px">
                        <template #body="{ index }">
                            <div class="flex gap-1 justify-center">
                                <Button icon="pi pi-arrow-up" severity="secondary" text size="small" @click="moveRowUp(index)" :disabled="index === 0" v-tooltip.top="'ย้ายขึ้น'" />
                                <Button icon="pi pi-arrow-down" severity="secondary" text size="small" @click="moveRowDown(index)" :disabled="index === journalDetails.length - 1" v-tooltip.top="'ย้ายลง'" />
                                <Button icon="pi pi-trash" severity="danger" text size="small" @click="removeRow(index)" v-tooltip.top="'ลบ'" />
                            </div>
                        </template>
                    </Column>

                    <template #empty>
                        <div class="text-center py-6 text-surface-500">
                            <i class="pi pi-inbox text-3xl mb-2 block"></i>
                            <p>ยังไม่มีรายการบัญชี กดปุ่ม "เพิ่มรายการ" เพื่อเริ่มต้น</p>
                        </div>
                    </template>

                    <template #footer>
                        <div class="flex justify-end gap-6 py-2 font-semibold">
                            <div class="flex items-center gap-2">
                                <span class="text-surface-600 dark:text-surface-400">รวมเดบิต:</span>
                                <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(totalDebit) }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-surface-600 dark:text-surface-400">รวมเครดิต:</span>
                                <span class="text-blue-600 dark:text-blue-400">{{ formatCurrency(totalCredit) }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-surface-600 dark:text-surface-400">ผลต่าง:</span>
                                <span :class="difference === 0 ? 'text-green-600 dark:text-green-400' : isBalanceInvalid ? 'text-red-600 dark:text-red-400 font-bold' : 'text-red-600 dark:text-red-400'">
                                    {{ formatCurrency(difference) }}
                                </span>
                                <i v-if="difference === 0" class="pi pi-check-circle text-green-600 dark:text-green-400"></i>
                                <i v-else class="pi pi-exclamation-triangle" :class="isBalanceInvalid ? 'text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'"></i>
                            </div>
                        </div>
                    </template>
                </DataTable>
            </div>
            <small v-if="isJournalDetailInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1 mt-2">
                <i class="pi pi-exclamation-circle"></i>
                กรุณาเพิ่มรายการบัญชีอย่างน้อย 1 รายการและตรวจสอบความครบถ้วนของข้อมูล
            </small>
        </div>
    </div>
</template>

<style scoped>
.select-button-full :deep(.p-selectbutton) {
    display: flex;
    width: 100%;
}

.select-button-full :deep(.p-selectbutton .p-togglebutton) {
    flex: 1;
}

.journal-detail-table :deep(.p-inputnumber-input) {
    text-align: right;
}

/* จำกัดความกว้างของ Select ในคอลัมน์รหัสบัญชี */
.journal-detail-table :deep(td:nth-child(2)) {
    max-width: 250px !important;
    width: 250px !important;
    overflow: hidden;
}

.account-select {
    width: 100% !important;
    max-width: 250px !important;
}

.account-select :deep(.p-select) {
    width: 100% !important;
    max-width: 250px !important;
}

.account-select :deep(.p-select-label) {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    max-width: 200px !important;
}

.account-select :deep(.p-select-dropdown) {
    flex-shrink: 0;
}

.invalid-table-wrapper {
    border: 2px solid rgb(239 68 68);
    border-radius: 6px;
    padding: 2px;
}

.dark .invalid-table-wrapper {
    border-color: rgb(248 113 113);
}
</style>
