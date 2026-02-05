<script setup>
import AlertDialog from '@/components/AlertDialog.vue';
import JournalDailyInfoTab from '@/components/accounting/JournalDailyInfoTab.vue';
import JournalTaxInfoTab from '@/components/accounting/JournalTaxInfoTab.vue';
import JournalWithholdingTaxTab from '@/components/accounting/JournalWithholdingTaxTab.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageThumbnailStrip from '@/components/image/ImageThumbnailStrip.vue';
import { getDocumentImageGroup, recountTaskDocuments } from '@/services/api/image';
import { createJournal, deselectDocref, updateJournal } from '@/services/api/journal';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();

// Helper function to convert date to local ISO string (without UTC conversion)
const toLocalISOString = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    // คำนวณ timezone offset (เช่น +07:00 สำหรับประเทศไทย)
    const timezoneOffset = -d.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
};

// Route params
const taskId = ref(route.params.taskId || '');
const documentRef = ref(route.query.documentref || '');

const isEditMode = ref(false);
const activeTab = ref('0');
const loading = ref(false);

// Validation alert state
const showValidationAlert = ref(false);
const validationMessage = ref('');
const isDocDateInvalid = ref(false);
const isDocNoInvalid = ref(false);
const isBookCodeInvalid = ref(false);
const isJournalDetailInvalid = ref(false);
const isBalanceInvalid = ref(false);

// Confirm dialog state
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const isSaving = ref(false); // ป้องกันการ save ซ้ำ

// Flag to prevent duplicate deselect
const hasDeselected = ref(false);
const isDeselecting = ref(false); // Prevent race condition

// Track form changes for unsaved warning
const hasUnsavedChanges = ref(false);
const initialFormData = ref(null);

// Detect OS for keyboard shortcuts
const isMac = ref(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
const ctrlKey = computed(() => (isMac.value ? '⌘' : 'Ctrl'));
const altKey = computed(() => (isMac.value ? '⌥' : 'Alt'));

// Keyboard shortcuts info popover
const shortcutInfoRef = ref(null);
const toggleShortcutInfo = (event) => {
    shortcutInfoRef.value.toggle(event);
};

// Image panel state
const loadingImages = ref(false);
const documentImageGroup = ref(null);
const selectedImageDetail = ref(null);

// Thumbnail strip ref
const thumbnailStripRef = ref(null);

// Responsive: ตรวจสอบว่าหน้าจอเล็กกว่า lg (1024px) หรือไม่
const isSmallScreen = ref(window.innerWidth < 1024);
const handleResize = () => {
    isSmallScreen.value = window.innerWidth < 1024;
};

// Handle validation change from child component
const handleValidationChange = (validation) => {
    if (validation.isDocDateInvalid !== undefined) {
        isDocDateInvalid.value = validation.isDocDateInvalid;
    }
};

// Form data
const formData = ref({
    docdate: null,
    docno: '',
    bookcode: null,
    debtaccounttype: 0,
    debtaccountcode: null,
    exdocrefdate: null,
    exdocrefno: '',
    journaltype: 0,
    accountdescription: '',
    docformat: '',
    documentref: '',
    journaldetail: [],
    vats: [],
    taxes: []
});

// Deselect docref and go back
const deselectAndGoBack = async () => {
    // Prevent duplicate calls
    if (isDeselecting.value || hasDeselected.value) {
        router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
        return;
    }

    if (documentRef.value) {
        isDeselecting.value = true;
        hasDeselected.value = true;
        try {
            await deselectDocref(documentRef.value);
        } catch (error) {
            console.error('Error deselecting docref:', error);
        } finally {
            isDeselecting.value = false;
        }
    }
    router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
};

const goBack = () => {
    deselectAndGoBack();
};

// Helper function to deselect current document
const deselectCurrentDocument = async () => {
    if (documentRef.value && !hasDeselected.value && !isDeselecting.value) {
        isDeselecting.value = true;
        hasDeselected.value = true;
        try {
            await deselectDocref(documentRef.value);
            console.log('✅ Document deselected');
        } catch (error) {
            console.error('❌ Error deselecting:', error);
        } finally {
            isDeselecting.value = false;
        }
    }
};

// ลบแถวว่างใน journaldetail (แถวที่ไม่มีข้อมูลเลย)
const removeEmptyJournalDetails = () => {
    if (!formData.value.journaldetail) return;

    const filteredDetails = formData.value.journaldetail.filter((detail) => {
        const hasAccountCode = detail.accountcode && detail.accountcode.trim() !== '';
        const hasAccountName = detail.accountname && detail.accountname.trim() !== '';
        const hasDebit = parseFloat(detail.debitamount) !== 0;
        const hasCredit = parseFloat(detail.creditamount) !== 0;
        return hasAccountCode || hasAccountName || hasDebit || hasCredit;
    });

    formData.value.journaldetail = filteredDetails;
};

// Validate form before saving
const validateForm = () => {
    const errors = [];
    removeEmptyJournalDetails();

    isDocDateInvalid.value = false;
    isDocNoInvalid.value = false;
    isBookCodeInvalid.value = false;
    isJournalDetailInvalid.value = false;
    isBalanceInvalid.value = false;

    if (!formData.value.docdate) {
        errors.push('- วันที่เอกสาร (กรุณาเลือกวันที่)');
        isDocDateInvalid.value = true;
    } else if (isDocDateInvalid.value) {
        errors.push('- วันที่เอกสารไม่อยู่ในงวดบัญชีที่เปิดใช้งาน');
    }

    if (!formData.value.docno || formData.value.docno.trim() === '') {
        errors.push('- เลขที่เอกสาร (กรุณากรอกเลขที่เอกสาร)');
        isDocNoInvalid.value = true;
    }

    if (!formData.value.bookcode) {
        errors.push('- สมุดรายวัน (กรุณาเลือกสมุดรายวัน)');
        isBookCodeInvalid.value = true;
    }

    if (!formData.value.journaldetail || formData.value.journaldetail.length === 0) {
        errors.push('- รายละเอียดรายการ (ต้องมีอย่างน้อย 1 รายการ)');
        isJournalDetailInvalid.value = true;
    } else {
        const invalidRows = [];
        formData.value.journaldetail.forEach((detail, index) => {
            if (!detail.accountcode || (!detail.debitamount && !detail.creditamount)) {
                invalidRows.push(index + 1);
            }
        });

        if (invalidRows.length > 0) {
            errors.push(`- รายการบัญชีแถวที่ ${invalidRows.join(', ')} (ข้อมูลไม่ครบถ้วน)`);
            isJournalDetailInvalid.value = true;
        }

        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.debitamount) || 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.creditamount) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            errors.push('- ยอดเดบิตและเครดิตไม่สมดุล');
            isJournalDetailInvalid.value = true;
            isBalanceInvalid.value = true;
        }
    }

    // Validate vats
    if (formData.value.vats && formData.value.vats.length > 0) {
        const vatErrors = [];
        formData.value.vats.forEach((vat, index) => {
            const rowErrors = [];
            if (!vat.vatdocno || vat.vatdocno.trim() === '') rowErrors.push('เลขที่ใบกำกับ');
            if (!vat.custtaxid || vat.custtaxid.trim() === '') rowErrors.push('เลขประจำตัวผู้เสียภาษี');
            if (!vat.custname || vat.custname.trim() === '') rowErrors.push('ชื่อ');
            if (!vat.vatbase || parseFloat(vat.vatbase) === 0) rowErrors.push('ฐานภาษี');
            if (rowErrors.length > 0) vatErrors.push(`รายการที่ ${index + 1}: ${rowErrors.join(', ')}`);
        });
        if (vatErrors.length > 0) {
            errors.push(`- ข้อมูลภาษี (VAT) ไม่ครบถ้วน:<br/>&nbsp;&nbsp;${vatErrors.join('<br/>&nbsp;&nbsp;')}`);
        }
    }

    // Validate taxes
    if (formData.value.taxes && formData.value.taxes.length > 0) {
        const taxErrors = [];
        formData.value.taxes.forEach((tax, taxIndex) => {
            const rowErrors = [];
            if (!tax.taxdocno || tax.taxdocno.trim() === '') rowErrors.push('เลขที่เอกสาร');
            if (!tax.custname || tax.custname.trim() === '') rowErrors.push('ชื่อ');
            if (!tax.custtaxid || tax.custtaxid.trim() === '') rowErrors.push('เลขประจำตัวผู้เสียภาษี');
            if (!tax.details || tax.details.length === 0) {
                rowErrors.push('รายละเอียด (ต้องมีอย่างน้อย 1 รายการ)');
            } else {
                const invalidDetails = [];
                tax.details.forEach((detail, detailIndex) => {
                    if (!detail.description || detail.description.trim() === '' || !detail.taxbase || parseFloat(detail.taxbase) === 0) {
                        invalidDetails.push(detailIndex + 1);
                    }
                });
                if (invalidDetails.length > 0) rowErrors.push(`รายละเอียดแถวที่ ${invalidDetails.join(', ')} ไม่ครบถ้วน`);
            }
            if (rowErrors.length > 0) taxErrors.push(`รายการที่ ${taxIndex + 1}: ${rowErrors.join(', ')}`);
        });
        if (taxErrors.length > 0) {
            errors.push(`- ข้อมูลภาษีหัก ณ ที่จ่าย ไม่ครบถ้วน:<br/>&nbsp;&nbsp;${taxErrors.join('<br/>&nbsp;&nbsp;')}`);
        }
    }

    return errors;
};

// Load document images from API
const loadDocumentImages = async (docRef) => {
    if (!docRef) return;

    loadingImages.value = true;
    try {
        const response = await getDocumentImageGroup(docRef);
        if (response.data.success) {
            documentImageGroup.value = response.data.data;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดรูปภาพเอกสารได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error loading document images:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถโหลดรูปภาพเอกสารได้',
            life: 3000
        });
    } finally {
        loadingImages.value = false;
    }
};

// Handle document change from thumbnail strip
const handleDocumentChange = async (newDocumentRef) => {
    console.log('🟡 handleDocumentChange called with:', newDocumentRef);

    // Reset form and load new document
    documentRef.value = newDocumentRef;
    formData.value.documentref = newDocumentRef;

    // Reset form data
    formData.value.docdate = new Date();
    formData.value.docno = '';
    formData.value.bookcode = null;
    formData.value.debtaccounttype = 0;
    formData.value.debtaccountcode = null;
    formData.value.exdocrefdate = null;
    formData.value.exdocrefno = '';
    formData.value.journaltype = 0;
    formData.value.accountdescription = '';
    formData.value.docformat = '';
    formData.value.journaldetail = [{ accountcode: '', accountname: '', debitamount: 0, creditamount: 0 }];
    formData.value.vats = [];
    formData.value.taxes = [];

    // Reset validation states
    isDocDateInvalid.value = false;
    isDocNoInvalid.value = false;
    isBookCodeInvalid.value = false;
    isJournalDetailInvalid.value = false;
    isBalanceInvalid.value = false;

    // Load new images
    await loadDocumentImages(newDocumentRef);

    // Reset unsaved changes flag
    hasUnsavedChanges.value = false;
    initialFormData.value = JSON.stringify(formData.value);

    // Reset tab to first tab
    activeTab.value = '0';
};

const handleSave = () => {
    // ป้องกันการกด save ซ้ำ
    if (isSaving.value || showConfirmDialog.value) {
        console.log('⚠️ Save already in progress, ignoring...');
        return;
    }

    const validationErrors = validateForm();

    if (validationErrors.length > 0) {
        const errorItems = validationErrors
            .map(
                (err) => `
                <div class="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 mb-2">
                    <i class="pi pi-exclamation-circle text-red-500 mt-0.5 flex-shrink-0"></i>
                    <span class="text-sm">${err}</span>
                </div>`
            )
            .join('');
        validationMessage.value = `
            <div class="text-left">
                <p class="mb-4 text-surface-600 dark:text-surface-400">พบข้อผิดพลาด ${validationErrors.length} รายการ กรุณาตรวจสอบและแก้ไขข้อมูลก่อนบันทึก</p>
                ${errorItems}
            </div>`;
        showValidationAlert.value = true;
        return;
    }

    confirmMessage.value = 'คุณต้องการบันทึกเอกสารรายวัน ใช่หรือไม่ ?';
    showConfirmDialog.value = true;
};

const submitForm = async () => {
    // ป้องกันการ save ซ้ำ
    if (isSaving.value) {
        console.log('⚠️ Submit already in progress, ignoring...');
        return;
    }

    showConfirmDialog.value = false; // ปิด dialog ทันทีเมื่อเริ่มบันทึก
    isSaving.value = true;
    loading.value = true;

    try {
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.debitamount) || 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.creditamount) || 0), 0);
        const amount = Math.max(totalDebit, totalCredit);

        const payload = {
            debtor: formData.value.debtaccounttype === 0 ? formData.value.debtaccountcode || {} : {},
            creditor: formData.value.debtaccounttype === 1 ? formData.value.debtaccountcode || {} : {},
            debtaccounttype: formData.value.debtaccounttype,
            accountdescription: formData.value.accountdescription || '',
            accountgroup: '',
            accountperiod: new Date(formData.value.docdate).getMonth() + 1,
            accountyear: new Date(formData.value.docdate).getFullYear() + 543,
            documentref: formData.value.documentref || '',
            amount: amount,
            batchId: '',
            docdate: toLocalISOString(formData.value.docdate) || toLocalISOString(new Date()),
            docno: formData.value.docno,
            bookcode: formData.value.bookcode?.code || '',
            appname: '',
            jobguidfixed: taskId.value,
            docformat: formData.value.docformat || '',
            journaldetail: formData.value.journaldetail.map((detail) => ({
                accountcode: detail.accountcode,
                accountname: detail.accountname || '',
                debitamount: parseFloat(detail.debitamount) || 0,
                creditamount: parseFloat(detail.creditamount) || 0
            })),
            journaltype: formData.value.journaltype || 0,
            parid: '0000000',
            vats: (formData.value.vats || []).map((vat) => ({
                vatdocno: vat.vatdocno || '',
                vatdate: toLocalISOString(vat.vatdate) || toLocalISOString(new Date()),
                vattype: vat.vattype || 0,
                vatmode: vat.vatmode || 0,
                vatperiod: vat.vatperiod || new Date().getMonth() + 1,
                vatyear: vat.vatyear || new Date().getFullYear() + 543,
                vatbase: parseFloat(vat.vatbase) || 0,
                vatrate: parseFloat(vat.vatrate) || 7,
                vatamount: parseFloat(vat.vatamount) || 0,
                exceptvat: parseFloat(vat.exceptvat) || 0,
                vatsubmit: vat.vatsubmit || false,
                remark: vat.remark || '',
                custtaxid: vat.custtaxid || '',
                custname: vat.custname || '',
                custtype: vat.custtype || 0,
                organization: vat.organization || 0,
                branchcode: vat.branchcode || '00000',
                address: vat.address || ''
            })),
            taxes: (formData.value.taxes || []).map((tax) => ({
                taxtype: tax.taxtype || 0,
                custtype: tax.custtype || 0,
                taxdate: toLocalISOString(tax.taxdate) || toLocalISOString(new Date()),
                taxdocno: tax.taxdocno || '',
                custname: tax.custname || '',
                custtaxid: tax.custtaxid || '',
                address: tax.address || '',
                details: (tax.details || []).map((detail) => ({
                    description: detail.description || '',
                    taxbase: parseFloat(detail.taxbase) || 0,
                    taxrate: parseFloat(detail.taxrate) || 0,
                    taxamount: parseFloat(detail.taxamount) || 0
                }))
            })),
            exdocrefdate: toLocalISOString(formData.value.exdocrefdate),
            exdocrefno: formData.value.exdocrefno || ''
        };

        let response;
        if (isEditMode.value) {
            response = await updateJournal(route.params.id, payload);
        } else {
            response = await createJournal(payload);
        }

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'บันทึกรายการบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            try {
                // Step 1: Recount task documents
                console.log('📊 Recounting task documents...');
                await recountTaskDocuments(taskId.value);
                console.log('✅ Recount completed');
            } catch (error) {
                console.error('❌ Error recounting task:', error);
                // Continue even if recount fails
            }

            // Step 2: Refresh thumbnail strip to update status
            if (thumbnailStripRef.value) {
                await thumbnailStripRef.value.refresh();
            }

            // Step 3: Auto navigate to next document or deselect and go back
            setTimeout(async () => {
                if (thumbnailStripRef.value && thumbnailStripRef.value.hasNextDocument()) {
                    // มีรูปถัดไป → ให้ goToNextDocument จัดการ deselect + select
                    console.log('⏭️ Auto moving to next document...');
                    const moved = await thumbnailStripRef.value.goToNextDocument();

                    if (!moved) {
                        // If failed to move, deselect and go back to detail page
                        await deselectCurrentDocument();
                        router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
                    }
                    // If moved successfully, stay on current page with new document
                } else {
                    // No next document - deselect and go back to detail page
                    console.log('✅ No more documents, deselecting and returning to detail page');
                    await deselectCurrentDocument();
                    router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
                }
            }, 500);
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: response.data.message || 'ไม่สามารถบันทึกข้อมูลได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error submitting journal:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
            life: 5000
        });
    } finally {
        loading.value = false;
        isSaving.value = false;
    }
};

// Handle browser back/refresh - deselect docref
onBeforeRouteLeave(async (to, from, next) => {
    // Only deselect if not already deselected and not currently deselecting
    if (to.name !== 'journal-from-image-form' && documentRef.value && !hasDeselected.value && !isDeselecting.value) {
        isDeselecting.value = true;
        hasDeselected.value = true;
        try {
            await deselectDocref(documentRef.value);
        } catch (error) {
            console.error('Error deselecting on route leave:', error);
        } finally {
            isDeselecting.value = false;
        }
    }
    next();
});

onMounted(async () => {
    window.addEventListener('resize', handleResize);

    // Set documentref from query
    if (documentRef.value) {
        formData.value.documentref = documentRef.value;
        await loadDocumentImages(documentRef.value);

        // Note: selectDocref is already called by JournalFromImageDetail.vue before navigation
        // No need to call it again here
    }

    // Set default date to today for new entry
    formData.value.docdate = new Date();
    formData.value.journaldetail = [{ accountcode: '', accountname: '', debitamount: 0, creditamount: 0 }];

    // Store initial form data
    initialFormData.value = JSON.stringify(formData.value);

    // Watch for form changes
    watch(
        formData,
        () => {
            const currentData = JSON.stringify(formData.value);
            hasUnsavedChanges.value = currentData !== initialFormData.value;
        },
        { deep: true }
    );
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
});
</script>

<template>
    <div>
        <Toast />
        <AlertDialog v-model:visible="showValidationAlert" header="ข้อมูลไม่ครบถ้วน" :message="validationMessage" severity="warning" icon="pi-exclamation-triangle" />

        <!-- Confirm Dialog -->
        <Dialog v-model:visible="showConfirmDialog" :style="{ width: '450px' }" header="ยืนยันการบันทึก" :modal="true">
            <div class="flex items-start gap-3">
                <i class="pi pi-question-circle text-4xl text-primary-500"></i>
                <p class="text-lg">{{ confirmMessage }}</p>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" class="p-button-text" @click="showConfirmDialog = false" :disabled="loading" />
                <Button label="ยืนยัน" icon="pi pi-save" @click="submitForm" :loading="loading" autofocus />
            </template>
        </Dialog>

        <div class="card">
            <!-- Header -->
            <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-3">
                    <Button icon="pi pi-arrow-left" text @click="goBack" />
                    <div class="text-2xl font-bold m-0 text-surface-900 dark:text-surface-0">บันทึกรายการบัญชีจากรูปภาพ</div>
                </div>
                <div class="flex gap-2 items-center">
                    <Button icon="pi pi-key" text @click="toggleShortcutInfo" v-tooltip.left="'คีย์ลัด'" />

                    <Popover ref="shortcutInfoRef">
                        <div class="p-3 w-72">
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>บันทึก</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ ctrlKey }} + S</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>เพิ่มแถวใหม่</span>
                                    <div class="flex gap-1">
                                        <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ altKey }} + N</kbd>
                                        <span class="text-surface-400" v-if="isMac">หรือ</span>
                                        <kbd v-if="isMac" class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">Help (Ins)</kbd>
                                        <span class="text-surface-400" v-if="!isMac">หรือ</span>
                                        <kbd v-if="!isMac" class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">Insert</kbd>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>สร้างเลขที่เอกสาร</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ altKey }} + G</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ย้ายแถวขึ้น</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ altKey }} + ↑</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ย้ายแถวลง</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ altKey }} + ↓</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ลบแถวปัจจุบัน</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">{{ ctrlKey }} + Del</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1">
                                    <span>ไปช่องถัดไป</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">Tab</kbd>
                                </div>
                            </div>
                        </div>
                    </Popover>
                    <Button label="บันทึก" icon="pi pi-save" @click="handleSave" :loading="loading" />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center items-center py-20">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
            </div>

            <!-- Main Content with Splitter -->
            <div v-else>
                <Splitter :layout="isSmallScreen ? 'vertical' : 'horizontal'" class="rounded-lg border border-surface-200 dark:border-surface-700 mb-0" style="height: calc(100vh - 400px); min-height: 400px">
                    <!-- Left Panel - Image Detail Panel -->
                    <SplitterPanel :size="isSmallScreen ? 50 : 40" :minSize="isSmallScreen ? 30 : 25" class="bg-surface-50 dark:bg-surface-900">
                        <div class="h-full overflow-auto p-2">
                            <div v-if="loadingImages" class="h-full flex justify-center items-center min-h-80">
                                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                            </div>
                            <div v-else-if="!documentImageGroup" class="h-full flex flex-col justify-center items-center text-surface-500 min-h-80">
                                <i class="pi pi-image text-6xl mb-4"></i>
                                <p class="text-lg">ไม่พบรูปภาพเอกสาร</p>
                            </div>
                            <div v-else class="h-full flex flex-col">
                                <div class="flex-1 overflow-auto">
                                    <ImageDetailPanel
                                        :selectedGroup="documentImageGroup"
                                        :selectedImageDetail="selectedImageDetail"
                                        :loadingDetail="loadingImages"
                                        :isJobClosed="false"
                                        :isReviewMode="false"
                                        :updatingStatus="false"
                                        :isReadOnly="true"
                                        :hideDetails="true"
                                    />
                                </div>
                            </div>
                        </div>
                    </SplitterPanel>

                    <!-- Right Panel - Form Tabs -->
                    <SplitterPanel :size="isSmallScreen ? 50 : 60" :minSize="isSmallScreen ? 30 : 35">
                        <div class="h-full flex flex-col p-2">
                            <Tabs v-model:value="activeTab" class="h-full flex flex-col">
                                <TabList>
                                    <Tab value="0">
                                        <i class="pi pi-calendar mr-2"></i>
                                        ข้อมูลรายวัน
                                    </Tab>
                                    <Tab value="1">
                                        <i class="pi pi-file-edit mr-2"></i>
                                        ข้อมูลภาษี
                                    </Tab>
                                    <Tab value="2">
                                        <i class="pi pi-percentage mr-2"></i>
                                        ภาษีถูกหัก ณ ที่จ่าย
                                    </Tab>
                                </TabList>
                                <TabPanels class="flex-1 overflow-auto">
                                    <TabPanel value="0">
                                        <div class="pt-4 pb-2">
                                            <JournalDailyInfoTab
                                                :modelValue="formData"
                                                @update:modelValue="formData = $event"
                                                @validation-change="handleValidationChange"
                                                @save="handleSave"
                                                :isDocNoInvalid="isDocNoInvalid"
                                                :isBookCodeInvalid="isBookCodeInvalid"
                                                :isJournalDetailInvalid="isJournalDetailInvalid"
                                                :isBalanceInvalid="isBalanceInvalid"
                                            />
                                        </div>
                                    </TabPanel>
                                    <TabPanel value="1">
                                        <div class="pt-4 pb-2">
                                            <JournalTaxInfoTab :modelValue="formData" @update:modelValue="formData = $event" />
                                        </div>
                                    </TabPanel>
                                    <TabPanel value="2">
                                        <div class="pt-4 pb-2">
                                            <JournalWithholdingTaxTab :modelValue="formData" @update:modelValue="formData = $event" />
                                        </div>
                                    </TabPanel>
                                </TabPanels>
                            </Tabs>
                        </div>
                    </SplitterPanel>
                </Splitter>

                <!-- Thumbnail Strip -->
                <ImageThumbnailStrip ref="thumbnailStripRef" :taskId="taskId" :currentDocumentRef="documentRef" :hasUnsavedChanges="hasUnsavedChanges" @change-document="handleDocumentChange" class="mt-0 rounded-b-lg overflow-hidden" />
            </div>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-splitter-gutter) {
    background: var(--p-surface-100);
    transition: background 0.2s ease;
}

:deep(.p-splitter-gutter:hover) {
    background: var(--p-primary-100);
}

.dark :deep(.p-splitter-gutter) {
    background: var(--p-surface-800);
}

.dark :deep(.p-splitter-gutter:hover) {
    background: var(--p-primary-900);
}

:deep(.p-splitter-gutter-handle) {
    background: var(--p-surface-400);
    border-radius: 4px;
    transition: all 0.2s ease;
}

:deep(.p-splitter-gutter:hover .p-splitter-gutter-handle) {
    background: var(--p-primary-500);
}
</style>
