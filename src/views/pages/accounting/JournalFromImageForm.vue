<script setup>
import AiModelSelectionDialog from '@/components/accounting/AiModelSelectionDialog.vue';
import JournalDailyInfoTab from '@/components/accounting/JournalDailyInfoTab.vue';
import JournalTaxInfoTab from '@/components/accounting/JournalTaxInfoTab.vue';
import JournalWithholdingTaxTab from '@/components/accounting/JournalWithholdingTaxTab.vue';
import OcrResultDialog from '@/components/accounting/OcrResultDialog.vue';
import AlertDialog from '@/components/AlertDialog.vue';
import DialogForm from '@/components/DialogForm.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageThumbnailStrip from '@/components/image/ImageThumbnailStrip.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useLoading } from '@/composables/useLoading';
import { getDocumentImageGroup, recountTaskDocuments } from '@/services/api/image';
import { createJournal, deselectDocref, getJournalBooks, getJournalByDocno, updateJournal } from '@/services/api/journal';
import { analyzeReceipt, updateDocumentImageGroup } from '@/services/api/ocr';
import { toDecimalNumber } from '@/utils/numberFormat';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// แปลงวันที่เป็น ISO string โดยใช้ UTC 07:00:00Z (= 14:00 เวลาไทย)
// เพื่อให้ server รับวันที่ถูกต้องโดยไม่เลื่อนวัน
const toLocalISOString = (date) => {
    if (!date) return null;
    const d = new Date(date);
    // Guard: ถ้า year < 2000 แสดงว่า date ไม่ valid (เช่น Go zero time 0001-01-01) ใช้วันปัจจุบันแทน
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return toLocalISOString(new Date());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}T07:00:00Z`;
};

// Route params
const taskId = ref(route.params.taskId || '');
const documentRef = ref(route.query.documentref || '');

const isEditMode = ref(false);
const currentJournalId = ref(''); // guidfixed ของ journal ที่บันทึกแล้วสำหรับรูปปัจจุบัน
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

// AI OCR Dialog state
const showAiModelDialog = ref(false);
const showOcrResultDialog = ref(false);
const ocrResultData = ref(null);
const isDataFromAI = ref(false); // Track if data is from AI OCR

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

// Popup window state
const showThumbnailStrip = ref(true);

// Journal books for OCR mapping
const journalBooks = ref([]);

// Thumbnail strip ref
const thumbnailStripRef = ref(null);

// JournalDailyInfoTab refs (2 instances: splitter mode / popup mode)
const dailyInfoTabSplitRef = ref(null);
const dailyInfoTabPopupRef = ref(null);
// Active tab ref — ใช้ instance ที่ mount อยู่ในขณะนั้น
const activeDailyInfoTab = () => dailyInfoTabSplitRef.value || dailyInfoTabPopupRef.value;

// Responsive: ตรวจสอบว่าหน้าจอเล็กกว่า lg (1024px) หรือไม่
const isSmallScreen = ref(window.innerWidth < 1024);
let resizeTimer = null;
const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        isSmallScreen.value = window.innerWidth < 1024;
    }, 150);
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
    accountgroup: null,
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

// ลบแถวว่างใน journaldetail (แถวที่ไม่มียอด debit หรือ credit)
const removeEmptyJournalDetails = () => {
    if (!formData.value.journaldetail) return;

    const filteredDetails = formData.value.journaldetail.filter((detail) => {
        // เก็บเฉพาะแถวที่มียอด debit หรือ credit
        const hasDebit = parseFloat(detail.debitamount) !== 0;
        const hasCredit = parseFloat(detail.creditamount) !== 0;

        return hasDebit || hasCredit;
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
        // ตรวจสอบว่าแต่ละรายการมี accountcode (เพราะแถวที่ไม่มียอดถูกลบไปแล้ว)
        const invalidRows = [];
        formData.value.journaldetail.forEach((detail, index) => {
            if (!detail.accountcode) {
                invalidRows.push(index + 1);
            }
        });

        if (invalidRows.length > 0) {
            errors.push(`- รายการบัญชีแถวที่ ${invalidRows.join(', ')} (ไม่มีรหัสบัญชี)`);
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
// journalData — ส่งมาเมื่อคลิกรูปที่บันทึกแล้ว (populate form จาก journal record)
const handleDocumentChange = async (newDocumentRef, journalData = null) => {
    // Reset form and load new document
    documentRef.value = newDocumentRef;
    formData.value.documentref = newDocumentRef;

    if (journalData) {
        // กรณีรูปที่บันทึกแล้ว — delegate ให้ JournalDailyInfoTab จัดการ map dropdowns เอง
        // (tab มี option lists ครบ: journalBooks, accountGroups, documentFormats)
        currentJournalId.value = journalData.guidfixed || '';
        await activeDailyInfoTab()?.populateFromJournal(journalData);
    } else {
        // กรณีรูปใหม่ที่ยังไม่บันทึก — reset form (คง docdate และ bookcode ไว้)
        currentJournalId.value = '';
        formData.value.docno = '';
        formData.value.accountgroup = null;
        formData.value.debtaccounttype = 0;
        formData.value.debtaccountcode = null;
        formData.value.exdocrefdate = null;
        formData.value.exdocrefno = '';
        formData.value.journaltype = 0;
        formData.value.accountdescription = '';
        // คง journaldetail ไว้จากเอกสารก่อนหน้า แต่ reset จำนวนเงินเป็น 0
        formData.value.journaldetail = formData.value.journaldetail.map((row) => ({
            ...row,
            debitamount: 0,
            creditamount: 0
        }));
        formData.value.vats = [];
        formData.value.taxes = [];
    }

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

    // Focus docno input เพื่อให้ user พิมพ์ได้ทันที
    await nextTick();
    activeDailyInfoTab()?.focusDocNo();
};

// AI Analysis Functions
const handleAiAnalyze = () => {
    // ตรวจสอบว่ามีข้อมูล OCR เดิมหรือไม่
    if (documentImageGroup.value?.ocranalyzeai) {
        try {
            // Parse ข้อมูล OCR ที่เคยบันทึกไว้
            const existingOcrData = JSON.parse(documentImageGroup.value.ocranalyzeai);
            ocrResultData.value = existingOcrData;
            showOcrResultDialog.value = true;
            console.log('📋 Loaded existing OCR data from ocranalyzeai');
            return;
        } catch (error) {
            console.error('❌ Error parsing existing OCR data:', error);
        }
    }

    // ถ้าไม่มีข้อมูลเดิม ให้เลือก AI Model
    showAiModelDialog.value = true;
};

const handleAiModelSelected = async (model) => {
    // แสดง Loading Dialog
    showLoading('กำลังวิเคราะห์เอกสารด้วย AI...');

    try {
        const shopid = localStorage.getItem('shopid');

        // สร้าง payload
        const payload = {
            shopid: shopid,
            model: model,
            imagereferences: documentImageGroup.value.imagereferences.map((img) => ({
                documentimageguid: img.documentimageguid,
                imageuri: img.imageuri
            }))
        };

        console.log('🤖 Analyzing with AI model:', model, payload);

        // เรียก OCR API
        const response = await analyzeReceipt(payload);

        if (response.data) {
            ocrResultData.value = response.data;
            console.log('✅ OCR Analysis successful:', response.data);

            // บันทึกผลลัพธ์ลง documentimagegroup
            await saveOcrResult(response.data);

            // แสดงผลลัพธ์
            showOcrResultDialog.value = true;
        }
    } catch (error) {
        console.error('❌ Error analyzing with AI:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถวิเคราะห์เอกสารด้วย AI ได้',
            life: 5000
        });
    } finally {
        hideLoading();
    }
};

const saveOcrResult = async (ocrData) => {
    try {
        const payload = {
            guidfixed: documentImageGroup.value.guidfixed,
            title: documentImageGroup.value.title,
            ocranalyzeai: JSON.stringify(ocrData),
            billcount: documentImageGroup.value.billcount,
            references: documentImageGroup.value.references || [],
            tags: documentImageGroup.value.tags || [],
            imagereferences: documentImageGroup.value.imagereferences,
            uploadedby: documentImageGroup.value.uploadedby,
            uploadedat: documentImageGroup.value.uploadedat,
            status: documentImageGroup.value.status,
            description: documentImageGroup.value.description || '',
            taskguid: documentImageGroup.value.taskguid,
            pathtask: documentImageGroup.value.pathtask || '',
            iscompleted: documentImageGroup.value.iscompleted,
            rejectfromgroupguid: documentImageGroup.value.rejectfromgroupguid || '',
            xorder: documentImageGroup.value.xorder,
            rejectremark: documentImageGroup.value.rejectremark || '',
            statuschangedby: documentImageGroup.value.statuschangedby || '',
            statuschangedat: documentImageGroup.value.statuschangedat || '0001-01-01T00:00:00Z',
            statushistories: documentImageGroup.value.statushistories || []
        };

        await updateDocumentImageGroup(documentImageGroup.value.guidfixed, payload);
        console.log('✅ OCR result saved to documentimagegroup');
    } catch (error) {
        console.error('❌ Error saving OCR result:', error);
    }
};

const handleApplyOcrData = async () => {
    if (!ocrResultData.value?.accounting_entry) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่พบข้อมูล',
            detail: 'ไม่พบข้อมูลรายการบัญชีจาก OCR',
            life: 3000
        });
        return;
    }

    const entry = ocrResultData.value.accounting_entry;

    // นำข้อมูลมาใส่ใน form
    formData.value.docdate = entry.document_date || new Date();
    formData.value.docno = entry.reference_number || '';

    // ตั้งค่า journal book
    if (entry.journal_book_code) {
        try {
            // โหลด journal books ถ้ายังไม่มี
            if (journalBooks.value.length === 0) {
                const response = await getJournalBooks({ q: entry.journal_book_code, page: 1, limit: 20 });
                if (response.data.success) {
                    journalBooks.value = response.data.data.map((item) => ({
                        ...item,
                        displayLabel: `${item.code} ~ ${item.name1}`
                    }));
                }
            }

            // หา journal book จาก code
            const foundBook = journalBooks.value.find((book) => book.code === entry.journal_book_code);
            if (foundBook) {
                formData.value.bookcode = foundBook;
            } else {
                console.warn(`Journal book with code ${entry.journal_book_code} not found`);
            }
        } catch (error) {
            console.error('Error loading journal books:', error);
        }
    }

    // ตั้งค่า debtor/creditor
    if (entry.creditor_code) {
        formData.value.debtaccounttype = 1; // Creditor
        // TODO: หา creditor จาก code
    } else if (entry.debtor_code) {
        formData.value.debtaccounttype = 0; // Debtor
        // TODO: หา debtor จาก code
    }

    // ใส่รายการบัญชี
    if (entry.entries && entry.entries.length > 0) {
        formData.value.journaldetail = entry.entries.map((item) => ({
            accountcode: item.account_code || '',
            accountname: item.account_name || '',
            debitamount: item.debit || 0,
            creditamount: item.credit || 0
        }));
    }

    // Mark that data is from AI
    isDataFromAI.value = true;

    toast.add({
        severity: 'success',
        summary: 'สำเร็จ',
        detail: 'นำข้อมูลจาก AI มาใช้เรียบร้อยแล้ว',
        life: 3000
    });

    hasUnsavedChanges.value = true;
};

const handleReanalyze = () => {
    showOcrResultDialog.value = false;
    ocrResultData.value = null;
    showAiModelDialog.value = true;
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
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + toDecimalNumber(d.debitamount, 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + toDecimalNumber(d.creditamount, 0), 0);
        const amount = Math.max(totalDebit, totalCredit);

        const payload = {
            debtor: formData.value.debtaccounttype === 0 ? formData.value.debtaccountcode || {} : {},
            creditor: formData.value.debtaccounttype === 1 ? formData.value.debtaccountcode || {} : {},
            debtaccounttype: formData.value.debtaccounttype,
            accountdescription: formData.value.accountdescription || '',
            accountgroup: formData.value.accountgroup?.code || '',
            accountperiod: new Date(formData.value.docdate).getMonth() + 1,
            accountyear: new Date(formData.value.docdate).getFullYear() + 543,
            documentref: formData.value.documentref || '',
            amount: toDecimalNumber(amount, 0), // ใช้ทศนิยม 2 ตำแหน่ง
            batchId: '',
            docdate: toLocalISOString(formData.value.docdate) || toLocalISOString(new Date()),
            docno: formData.value.docno,
            bookcode: formData.value.bookcode?.code || '',
            appname: isDataFromAI.value ? 'AI' : '',
            jobguidfixed: taskId.value,
            docformat: formData.value.docformat || '',
            journaldetail: formData.value.journaldetail.map((detail) => ({
                accountcode: detail.accountcode,
                accountname: detail.accountname || '',
                debitamount: toDecimalNumber(detail.debitamount, 0), // ใช้ทศนิยม 2 ตำแหน่ง
                creditamount: toDecimalNumber(detail.creditamount, 0) // ใช้ทศนิยม 2 ตำแหน่ง
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
                vatbase: toDecimalNumber(vat.vatbase, 0), // ใช้ทศนิยม 2 ตำแหน่ง
                vatrate: toDecimalNumber(vat.vatrate, 7), // ใช้ทศนิยม 2 ตำแหน่ง
                vatamount: toDecimalNumber(vat.vatamount, 0), // ใช้ทศนิยม 2 ตำแหน่ง
                exceptvat: toDecimalNumber(vat.exceptvat, 0), // ใช้ทศนิยม 2 ตำแหน่ง
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
                    taxbase: toDecimalNumber(detail.taxbase, 0), // ใช้ทศนิยม 2 ตำแหน่ง
                    taxrate: toDecimalNumber(detail.taxrate, 0), // ใช้ทศนิยม 2 ตำแหน่ง
                    taxamount: toDecimalNumber(detail.taxamount, 0) // ใช้ทศนิยม 2 ตำแหน่ง
                }))
            })),
            exdocrefdate: toLocalISOString(formData.value.exdocrefdate),
            exdocrefno: formData.value.exdocrefno || ''
        };

        let response;
        const journalIdToUpdate = isEditMode.value ? route.params.id : currentJournalId.value;
        if (journalIdToUpdate) {
            response = await updateJournal(journalIdToUpdate, payload);
        } else {
            response = await createJournal(payload);
        }

        if (response.data.success) {
            // Reset AI flag after successful save
            isDataFromAI.value = false;

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'บันทึกรายการบัญชีเรียบร้อยแล้ว',
                life: 3000
            });

            // Step 1: Recount task documents (fire-and-forget, non-blocking)
            recountTaskDocuments(taskId.value).catch((e) => console.error('❌ Error recounting task:', e));

            // Step 2: Fetch journal guidfixed from docno, then mark as saved
            if (thumbnailStripRef.value) {
                const savedDocno = formData.value.docno || '';
                let journalGuidfixed = journalIdToUpdate || '';
                if (!journalGuidfixed && savedDocno) {
                    try {
                        const res = await getJournalByDocno(savedDocno);
                        if (res.data?.success && res.data?.data?.guidfixed) {
                            journalGuidfixed = res.data.data.guidfixed;
                        }
                    } catch (e) {
                        // non-fatal — getJournalById fallback via docno will still work
                    }
                }
                currentJournalId.value = journalGuidfixed;
                const savedRef = { guidfixed: journalGuidfixed, module: 'GL', docno: savedDocno };
                thumbnailStripRef.value.markCurrentAsSaved(savedRef);
            }

            // Step 3: Navigate to next document or go back
            setTimeout(async () => {
                // Sync initialFormData with current form so the watch() doesn't
                // re-raise hasUnsavedChanges when form resets during navigation
                hasUnsavedChanges.value = false;
                initialFormData.value = JSON.stringify(formData.value);
                // Wait for Vue to propagate the prop change to child component
                await nextTick();

                if (thumbnailStripRef.value && thumbnailStripRef.value.hasNextDocument()) {
                    const moved = await thumbnailStripRef.value.goToNextDocument();

                    if (!moved) {
                        await deselectCurrentDocument();
                        router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
                    }
                } else {
                    await deselectCurrentDocument();
                    router.push({ name: 'journal-from-image-detail', params: { id: taskId.value } });
                }
            }, 300);
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
        <LoadingDialog />
        <AlertDialog v-model:visible="showValidationAlert" header="ข้อมูลไม่ครบถ้วน" :message="validationMessage" severity="warning" icon="pi-exclamation-triangle" />

        <!-- Confirm Dialog -->
        <DialogForm :confirmDialog="showConfirmDialog" :textContent="confirmMessage" confirmLabel="ยืนยัน (Enter)" cancelLabel="ยกเลิก" severity="primary" @close="showConfirmDialog = false" @confirm="submitForm" />

        <!-- AI Model Selection Dialog -->
        <AiModelSelectionDialog v-model:visible="showAiModelDialog" @confirm="handleAiModelSelected" />

        <!-- OCR Result Dialog -->
        <OcrResultDialog v-model:visible="showOcrResultDialog" :ocrData="ocrResultData" @apply-data="handleApplyOcrData" @reanalyze="handleReanalyze" />

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
                        <div class="p-3 w-80">
                            <p class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">คีย์ลัด</p>
                            <div class="space-y-1 text-sm">
                                <!-- Navigation -->
                                <p class="text-xs text-surface-400 dark:text-surface-500 mt-2 mb-1">การนำทาง</p>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>ถัดไป</span>
                                    <div class="flex gap-1 items-center">
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">Enter</kbd>
                                        <span class="text-surface-400 text-xs">/</span>
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">Tab</kbd>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>ย้อนกลับ</span>
                                    <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">Shift + Tab</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>ขึ้น / ลง row</span>
                                    <div class="flex gap-1 items-center">
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">↑</kbd>
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">↓</kbd>
                                    </div>
                                </div>
                                <!-- Row actions -->
                                <p class="text-xs text-surface-400 dark:text-surface-500 mt-2 mb-1">จัดการแถว</p>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>เพิ่มแถวใหม่</span>
                                    <div class="flex gap-1 items-center">
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + N</kbd>
                                        <span class="text-surface-400 text-xs">หรือ</span>
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ isMac ? 'Help' : 'Insert' }}</kbd>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>ย้ายแถวขึ้น / ลง</span>
                                    <div class="flex gap-1 items-center">
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + ↑</kbd>
                                        <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + ↓</kbd>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>ลบแถวปัจจุบัน</span>
                                    <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ ctrlKey }} + Del</kbd>
                                </div>
                                <!-- Document -->
                                <p class="text-xs text-surface-400 dark:text-surface-500 mt-2 mb-1">เอกสาร</p>
                                <div class="flex justify-between items-center py-1 border-b border-surface-100 dark:border-surface-800">
                                    <span>สร้างเลขที่เอกสาร</span>
                                    <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + G</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1">
                                    <span>บันทึก</span>
                                    <kbd class="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ ctrlKey }} + S</kbd>
                                </div>
                            </div>
                        </div>
                    </Popover>
                    <Button label="AI วิเคราะห์" icon="pi pi-sparkles" severity="secondary" @click="handleAiAnalyze" :disabled="loading || !documentImageGroup" v-tooltip.left="'วิเคราะห์เอกสารด้วย AI'" />
                    <Button label="บันทึก" icon="pi pi-save" @click="handleSave" :loading="loading" />
                </div>
            </div>

            <!-- Loading overlay — ใช้ v-show เพื่อไม่ destroy ImageThumbnailStrip ข้างใน -->
            <div v-show="loading" class="flex justify-center items-center py-20">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
            </div>

            <!-- Main Content with Splitter -->
            <div v-show="!loading">
                <!-- Normal mode: Splitter with Image + Form panels -->
                <Splitter
                    :layout="isSmallScreen ? 'vertical' : 'horizontal'"
                    class="rounded-lg border border-surface-200 dark:border-surface-700 mb-0"
                    :style="showThumbnailStrip ? 'height: calc(100vh - 33.5vh); min-height: 400px' : 'height: calc(100vh - 19.4vh); min-height: 400px'"
                >
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
                                                ref="dailyInfoTabSplitRef"
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

                <div>
                    <!-- Toggle button -->
                    <div class="flex items-center justify-end px-1 pt-1">
                        <Button
                            :icon="showThumbnailStrip ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
                            :label="showThumbnailStrip ? 'ซ่อนรูปย่อ' : 'แสดงรูปย่อ'"
                            text
                            size="small"
                            severity="secondary"
                            @click="showThumbnailStrip = !showThumbnailStrip"
                            v-tooltip.top="showThumbnailStrip ? 'ซ่อน thumbnail strip' : 'แสดง thumbnail strip'"
                        />
                    </div>
                    <ImageThumbnailStrip
                        v-show="showThumbnailStrip"
                        ref="thumbnailStripRef"
                        :taskId="taskId"
                        :currentDocumentRef="documentRef"
                        :hasUnsavedChanges="hasUnsavedChanges"
                        @change-document="handleDocumentChange"
                        class="mt-0 rounded-b-lg overflow-hidden"
                    />
                </div>
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
