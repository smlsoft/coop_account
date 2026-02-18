<script setup>
import AiModelSelectionDialog from '@/components/accounting/AiModelSelectionDialog.vue';
import JournalDailyInfoTab from '@/components/accounting/JournalDailyInfoTab.vue';
import OcrResultDialog from '@/components/accounting/OcrResultDialog.vue';
import TaskImageSelectionDialog from '@/components/accounting/TaskImageSelectionDialog.vue';
import TaskSelectionDialog from '@/components/accounting/TaskSelectionDialog.vue';
import AlertDialog from '@/components/AlertDialog.vue';
import DialogForm from '@/components/DialogForm.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageUploadPreviewDialog from '@/components/image/ImageUploadPreviewDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useLoading } from '@/composables/useLoading';
import { createDocumentImage, getDocumentImageGroup, updateDocumentImageGroupImages, uploadImage } from '@/services/api/image';
import { createJournal, getCreditors, getDebtors, getDocumentFormats, getJournalBooks, getJournalById, updateJournal } from '@/services/api/journal';
import { analyzeReceipt, updateDocumentImageGroup } from '@/services/api/ocr';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

const journalId = ref(route.params.id || null);
const isEditMode = ref(!!journalId.value);
const activeTab = ref('0');
const loading = ref(false);

// AbortController สำหรับยกเลิก API calls
const abortControllers = ref({
    upload: null,
    loadImages: null,
    loadJournal: null,
    submit: null
});

// Helper function: สร้าง AbortController พร้อม timeout
const createAbortController = (timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId));
    return controller;
};

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
const isSaving = ref(false); // ป้องกันการ save ซ้ำ
const justSaved = ref(false); // flag เพื่อบอกว่าเพิ่ง save เสร็จ

// Navigation confirmation dialog state
const showNavigationConfirm = ref(false);
const pendingNavigation = ref(null);

// Original form data snapshot (for detecting changes in edit mode)
const originalFormData = ref(null);

// Cancel image confirm dialog

// Detect OS for keyboard shortcuts
const isMac = ref(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
const ctrlKey = computed(() => (isMac.value ? '⌘' : 'Ctrl'));
const altKey = computed(() => (isMac.value ? '⌥' : 'Alt'));

// ========== Computed Properties: Form Validation ==========
// คำนวณยอดรวม Debit และ Credit
const totalDebit = computed(() => {
    return formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.debitamount, 0), 0);
});

const totalCredit = computed(() => {
    return formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.creditamount, 0), 0);
});

// ตรวจสอบความสมดุล
const isBalanced = computed(() => {
    return Math.abs(totalDebit.value - totalCredit.value) <= 0.01;
});

// ตรวจสอบว่าฟอร์มถูกต้องหรือไม่ (สำหรับ validation พื้นฐาน)
const isFormValid = computed(() => {
    // ต้องมี docdate, docno, bookcode
    if (!formData.value.docdate || !formData.value.docno || !formData.value.bookcode) {
        return false;
    }

    // ต้องมี journaldetail อย่างน้อย 1 รายการ
    if (!formData.value.journaldetail || formData.value.journaldetail.length === 0) {
        return false;
    }

    // ทุกรายการต้องมี accountcode และมี debit หรือ credit
    const hasInvalidRows = formData.value.journaldetail.some((detail) => {
        return !detail.accountcode || (!detail.debitamount && !detail.creditamount);
    });

    if (hasInvalidRows) {
        return false;
    }

    // ต้องสมดุล
    if (!isBalanced.value) {
        return false;
    }

    return true;
});

// Keyboard shortcuts info popover
const shortcutInfoRef = ref(null);
const toggleShortcutInfo = (event) => {
    shortcutInfoRef.value.toggle(event);
};

// ========== AI OCR Functions ==========
const handleAiAnalyze = () => {
    if (!hasImages.value) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่มีรูปภาพ',
            detail: 'กรุณาเพิ่มรูปภาพเอกสารก่อนใช้ AI วิเคราะห์',
            life: 3000
        });
        return;
    }
    showAiModelDialog.value = true;
};

const handleAiModelSelected = async (selectedModel) => {
    showAiModelDialog.value = false;

    if (!formData.value.documentref) {
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่พบข้อมูลเอกสาร',
            life: 3000
        });
        return;
    }

    // ตรวจสอบว่ามีข้อมูล OCR อยู่แล้วหรือไม่
    if (documentImageGroup.value?.ocranalyzeai) {
        try {
            const existingOcrData = JSON.parse(documentImageGroup.value.ocranalyzeai);
            ocrResultData.value = existingOcrData;
            showOcrResultDialog.value = true;
            return;
        } catch (error) {
            console.warn('Failed to parse existing OCR data:', error);
        }
    }

    // เรียก API วิเคราะห์เอกสาร
    try {
        showLoading('กำลังวิเคราะห์เอกสารด้วย AI...');
        const response = await analyzeReceipt({
            guidfixed: formData.value.documentref,
            model: selectedModel
        });

        if (response.data.success) {
            ocrResultData.value = response.data.data;

            // บันทึกผลลัพธ์ลงฐานข้อมูล
            await saveOcrResult(response.data.data);

            hideLoading();
            showOcrResultDialog.value = true;
        } else {
            throw new Error('OCR analysis failed');
        }
    } catch (error) {
        hideLoading();
        console.error('OCR analysis error:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถวิเคราะห์เอกสารได้',
            life: 3000
        });
    }
};

const saveOcrResult = async (ocrData) => {
    try {
        await updateDocumentImageGroup(formData.value.documentref, {
            ocranalyzeai: JSON.stringify(ocrData),
            updatedby: 'system'
        });
    } catch (error) {
        console.error('Error saving OCR result:', error);
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
    formData.value.docdate = entry.document_date || new Date().toISOString().split('T')[0];
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
};

const handleReanalyze = () => {
    showOcrResultDialog.value = false;
    ocrResultData.value = null;
    showAiModelDialog.value = true;
};

// Image panel state
const showImagePanel = ref(false);
const loadingImages = ref(false);
const documentImageGroup = ref(null);
const selectedImageDetail = ref(null);

// AI OCR Dialog state
const showAiModelDialog = ref(false);
const showOcrResultDialog = ref(false);
const ocrResultData = ref(null);
const isDataFromAI = ref(false);

// Journal books for OCR mapping
const journalBooks = ref([]);

// Responsive: ตรวจสอบว่าหน้าจอเล็กกว่า lg (1024px) หรือไม่
const isSmallScreen = ref(window.innerWidth < 1024);

// ตรวจสอบว่ามีรูปภาพหรือไม่
const hasImages = computed(() => {
    return documentImageGroup.value?.imagereferences && documentImageGroup.value.imagereferences.length > 0;
});
const handleResize = () => {
    isSmallScreen.value = window.innerWidth < 1024;
};

// Image upload state
const fileInputRef = ref(null);
const showUploadPreview = ref(false);
const selectedFile = ref(null);
const uploadedImageUri = ref('');
const uploadingImage = ref(false);

// Task selection state
const showTaskSelectionDialog = ref(false);
const showTaskImageSelectionDialog = ref(false);
const selectedTask = ref(null);
const imageSourceType = ref(null); // 'upload' or 'task'

// Get current user email (from localStorage or auth store)
const getCurrentUserEmail = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.email || 'unknown@user.com';
};

// ========== Helper Functions: Safe Data Parsing ==========
const safeParseDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue === '0001-01-01T00:00:00Z') return null;
    try {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
};

const safeParseNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseInt = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

// แปลงวันที่เป็น ISO string โดยใช้ local timezone (ไม่ใช่ UTC)
// เพื่อป้องกันปัญหาวันที่เลื่อนไป 1 วัน เมื่อแปลงจาก local time เป็น UTC
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

// Trigger file input
const triggerFileUpload = () => {
    fileInputRef.value?.click();
};

// Open task selection dialog
const openTaskSelection = () => {
    // ถ้ามีรูปอยู่แล้วและเป็นรูปจาก task ต้องลบก่อน
    if (formData.value.documentref && imageSourceType.value === 'task') {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาลบรูปภาพที่มีอยู่ก่อน จึงจะสามารถเลือกรูปภาพจาก Task ใหม่ได้',
            life: 5000
        });
        return;
    }
    showTaskSelectionDialog.value = true;
};

// Handle task selected
const handleTaskSelected = (task) => {
    selectedTask.value = task;
    showTaskImageSelectionDialog.value = true;
};

// Handle back to task selection
const handleBackToTaskSelection = () => {
    showTaskImageSelectionDialog.value = false;
    showTaskSelectionDialog.value = true;
};

// Handle images selected from task (ใช้ชุดเอกสารที่มีอยู่แล้วจาก Task)
const handleImagesSelectedFromTask = async (result) => {
    if (!result || !result.groupGuidfixed) return;

    showLoading('กำลังโหลดชุดเอกสารจาก Task...');

    try {
        // ใช้ guidfixed ของชุดเอกสารที่เลือกจาก Task โดยตรง (ไม่สร้างใหม่)
        formData.value.documentref = result.groupGuidfixed;

        // Set image source type
        imageSourceType.value = 'task';

        // Reload document images
        await loadDocumentImages(formData.value.documentref);

        // Show image panel
        showImagePanel.value = true;

        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'เลือกชุดเอกสารจาก Task เรียบร้อยแล้ว',
            life: 3000
        });
    } catch (error) {
        console.error('Error loading images from task:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถโหลดชุดเอกสารจาก Task ได้',
            life: 3000
        });
    } finally {
        hideLoading();
        selectedTask.value = null;
    }
};

// Handle file selection
const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        toast.add({
            severity: 'error',
            summary: 'ไฟล์ไม่ถูกต้อง',
            detail: 'รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, GIF, WebP) และ PDF',
            life: 3000
        });
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        toast.add({
            severity: 'error',
            summary: 'ไฟล์ใหญ่เกินไป',
            detail: 'ขนาดไฟล์ต้องไม่เกิน 10MB',
            life: 3000
        });
        return;
    }

    selectedFile.value = file;
    showLoading('กำลังอัพโหลดไฟล์...');

    // ยกเลิก upload ก่อนหน้าถ้ามี
    if (abortControllers.value.upload) {
        abortControllers.value.upload.abort();
    }

    // สร้าง AbortController ใหม่พร้อม timeout 30 วินาที
    abortControllers.value.upload = createAbortController(30000);

    try {
        // Upload file with abort signal
        const response = await uploadImage(file, { signal: abortControllers.value.upload.signal });
        if (response.data.success) {
            uploadedImageUri.value = response.data.data.uri;
            showUploadPreview.value = true;
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            toast.add({
                severity: 'warn',
                summary: 'ยกเลิกการอัพโหลด',
                detail: 'การอัพโหลดถูกยกเลิกหรือใช้เวลานานเกินไป',
                life: 3000
            });
        } else {
            console.error('Error uploading image:', error);
            toast.add({
                severity: 'error',
                summary: 'อัพโหลดไม่สำเร็จ',
                detail: error.response?.data?.message || 'ไม่สามารถอัพโหลดไฟล์ได้',
                life: 3000
            });
        }
        selectedFile.value = null;
        uploadedImageUri.value = '';
    } finally {
        hideLoading();
        abortControllers.value.upload = null;
        // Reset file input
        if (fileInputRef.value) {
            fileInputRef.value.value = '';
        }
    }
};

// Confirm upload - create document image
const handleConfirmUpload = async () => {
    if (!selectedFile.value || !uploadedImageUri.value) return;

    showLoading('กำลังบันทึกเอกสาร...');

    // ยกเลิก request ก่อนหน้าถ้ามี
    if (abortControllers.value.upload) {
        abortControllers.value.upload.abort();
    }

    abortControllers.value.upload = createAbortController(30000);

    try {
        const now = new Date();
        const userEmail = getCurrentUserEmail();

        // Create document image payload
        const payload = {
            name: selectedFile.value.name,
            metafileat: new Date(selectedFile.value.lastModified).toISOString(),
            imageuri: uploadedImageUri.value,
            uploadedby: userEmail,
            uploadedat: now.toISOString()
        };

        // Create document image
        const createResponse = await createDocumentImage(payload, { signal: abortControllers.value.upload.signal });
        if (!createResponse.data.success) {
            throw new Error('Failed to create document image');
        }

        const { groupid, id: documentImageId } = createResponse.data;

        // Check if we have existing documentref (adding to existing group)
        if (formData.value.documentref && documentImageGroup.value) {
            // Add new image to existing group
            const existingImages = documentImageGroup.value.imagereferences || [];
            const newImageOrder = existingImages.length + 1;

            const updatedImages = [
                ...existingImages,
                {
                    xorder: newImageOrder,
                    documentimageguid: documentImageId,
                    imageuri: uploadedImageUri.value,
                    billcount: 0,
                    cloneimagefrom: '',
                    name: selectedFile.value.name,
                    uploadedby: userEmail,
                    uploadedat: now.toISOString(),
                    metafileat: new Date(selectedFile.value.lastModified).toISOString()
                }
            ];

            // Update document image group
            await updateDocumentImageGroupImages(formData.value.documentref, updatedImages, { signal: abortControllers.value.upload.signal });

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'เพิ่มรูปภาพในชุดเอกสารเรียบร้อยแล้ว',
                life: 3000
            });
        } else {
            // New document - set documentref to new group
            formData.value.documentref = groupid;

            // Set image source type
            imageSourceType.value = 'upload';

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'อัพโหลดเอกสารเรียบร้อยแล้ว',
                life: 3000
            });
        }

        // Reload document images
        await loadDocumentImages(formData.value.documentref);

        // Show image panel
        showImagePanel.value = true;

        // Close preview dialog
        showUploadPreview.value = false;
        selectedFile.value = null;
        uploadedImageUri.value = '';
    } catch (error) {
        if (error.name === 'AbortError') {
            toast.add({
                severity: 'warn',
                summary: 'ยกเลิกการบันทึก',
                detail: 'การบันทึกเอกสารถูกยกเลิกหรือใช้เวลานานเกินไป',
                life: 3000
            });
        } else {
            console.error('Error confirming upload:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.response?.data?.message || 'ไม่สามารถบันทึกเอกสารได้',
                life: 3000
            });
        }
    } finally {
        hideLoading();
        abortControllers.value.upload = null;
    }
};

// Cancel upload
const handleCancelUpload = () => {
    showUploadPreview.value = false;
    selectedFile.value = null;
    uploadedImageUri.value = '';
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

const goBack = () => {
    router.push({ name: 'journal-entry' });
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

    // ลบแถวว่างก่อน validate
    removeEmptyJournalDetails();

    // รีเซ็ต validation state ทั้งหมดก่อน
    isDocDateInvalid.value = false;
    isDocNoInvalid.value = false;
    isBookCodeInvalid.value = false;
    isJournalDetailInvalid.value = false;
    isBalanceInvalid.value = false;

    // ตรวจสอบวันที่เอกสาร (required)
    if (!formData.value.docdate) {
        errors.push('- วันที่เอกสาร (กรุณาเลือกวันที่)');
        isDocDateInvalid.value = true;
    } else if (isDocDateInvalid.value) {
        errors.push('- วันที่เอกสารไม่อยู่ในงวดบัญชีที่เปิดใช้งาน');
    }

    // ตรวจสอบเลขที่เอกสาร (required)
    if (!formData.value.docno || formData.value.docno.trim() === '') {
        errors.push('- เลขที่เอกสาร (กรุณากรอกเลขที่เอกสาร)');
        isDocNoInvalid.value = true;
    }

    // ตรวจสอบสมุดรายวัน (required)
    if (!formData.value.bookcode) {
        errors.push('- สมุดรายวัน (กรุณาเลือกสมุดรายวัน)');
        isBookCodeInvalid.value = true;
    }

    // ตรวจสอบรายละเอียดรายการ (ต้องมีอย่างน้อย 1 รายการ)
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

        // ตรวจสอบความสมดุลของรายการ (ใช้ safeParseNumber)
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.debitamount, 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.creditamount, 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            errors.push('- ยอดเดบิตและเครดิตไม่สมดุล');
            isJournalDetailInvalid.value = true;
            isBalanceInvalid.value = true;
        }
    }

    // ตรวจสอบข้อมูลภาษี (vats) - ถ้ามีรายการต้องกรอกข้อมูลครบ
    if (formData.value.vats && formData.value.vats.length > 0) {
        const vatErrors = [];
        formData.value.vats.forEach((vat, index) => {
            const rowErrors = [];
            if (!vat.vatdocno || vat.vatdocno.trim() === '') {
                rowErrors.push('เลขที่ใบกำกับ');
            }
            if (!vat.custtaxid || vat.custtaxid.trim() === '') {
                rowErrors.push('เลขประจำตัวผู้เสียภาษี');
            }
            if (!vat.custname || vat.custname.trim() === '') {
                rowErrors.push('ชื่อ');
            }
            if (!vat.vatbase || safeParseNumber(vat.vatbase, 0) === 0) {
                rowErrors.push('ฐานภาษี');
            }
            if (rowErrors.length > 0) {
                vatErrors.push(`รายการที่ ${index + 1}: ${rowErrors.join(', ')}`);
            }
        });
        if (vatErrors.length > 0) {
            errors.push(`- ข้อมูลภาษี (VAT) ไม่ครบถ้วน:<br/>&nbsp;&nbsp;${vatErrors.join('<br/>&nbsp;&nbsp;')}`);
        }
    }

    // ตรวจสอบข้อมูลภาษีหัก ณ ที่จ่าย (taxes) - ถ้ามีรายการต้องกรอกข้อมูลครบ
    if (formData.value.taxes && formData.value.taxes.length > 0) {
        const taxErrors = [];
        formData.value.taxes.forEach((tax, taxIndex) => {
            const rowErrors = [];
            if (!tax.taxdocno || tax.taxdocno.trim() === '') {
                rowErrors.push('เลขที่เอกสาร');
            }
            if (!tax.custname || tax.custname.trim() === '') {
                rowErrors.push('ชื่อ');
            }
            if (!tax.custtaxid || tax.custtaxid.trim() === '') {
                rowErrors.push('เลขประจำตัวผู้เสียภาษี');
            }
            // ตรวจสอบ details
            if (!tax.details || tax.details.length === 0) {
                rowErrors.push('รายละเอียด (ต้องมีอย่างน้อย 1 รายการ)');
            } else {
                const invalidDetails = [];
                tax.details.forEach((detail, detailIndex) => {
                    if (!detail.description || detail.description.trim() === '' || !detail.taxbase || safeParseNumber(detail.taxbase, 0) === 0) {
                        invalidDetails.push(detailIndex + 1);
                    }
                });
                if (invalidDetails.length > 0) {
                    rowErrors.push(`รายละเอียดแถวที่ ${invalidDetails.join(', ')} ไม่ครบถ้วน`);
                }
            }
            if (rowErrors.length > 0) {
                taxErrors.push(`รายการที่ ${taxIndex + 1}: ${rowErrors.join(', ')}`);
            }
        });
        if (taxErrors.length > 0) {
            errors.push(`- ข้อมูลภาษีหัก ณ ที่จ่าย ไม่ครบถ้วน:<br/>&nbsp;&nbsp;${taxErrors.join('<br/>&nbsp;&nbsp;')}`);
        }
    }

    return errors;
};

// Toggle image panel
const toggleImagePanel = async () => {
    if (!showImagePanel.value && isEditMode.value && formData.value.documentref) {
        // Load document images when opening panel in edit mode
        await loadDocumentImages(formData.value.documentref);
    }
    showImagePanel.value = !showImagePanel.value;
};

// Handle cancel image - ยกเลิกทันทีโดยไม่ต้องยืนยัน
const handleCancelImage = () => {
    if (formData.value.documentref) {
        // Has document, cancel it directly
        cancelImage();
    } else {
        // No document, just close panel
        showImagePanel.value = false;
    }
};

// Cancel image - clear documentref (ไม่ต้องใช้ Dialog ยืนยัน)
const cancelImage = () => {
    formData.value.documentref = '';
    documentImageGroup.value = null;
    imageSourceType.value = null; // Reset image source type

    toast.add({
        severity: 'success',
        summary: 'สำเร็จ',
        detail: 'ยกเลิกการใช้รูปภาพเอกสารเรียบร้อยแล้ว',
        life: 3000
    });
};

// Load document images from API
const loadDocumentImages = async (documentRef) => {
    if (!documentRef) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'ไม่พบข้อมูลรูปภาพเอกสาร',
            life: 3000
        });
        return;
    }

    loadingImages.value = true;
    showLoading('กำลังโหลดรูปภาพเอกสาร...');

    // ยกเลิก request ก่อนหน้าถ้ามี
    if (abortControllers.value.loadImages) {
        abortControllers.value.loadImages.abort();
    }

    abortControllers.value.loadImages = createAbortController(15000);

    try {
        const response = await getDocumentImageGroup(documentRef, { signal: abortControllers.value.loadImages.signal });
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
        if (error.name === 'AbortError') {
            console.log('Load images aborted');
        } else {
            console.error('Error loading document images:', error);
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: error.response?.data?.message || 'ไม่สามารถโหลดรูปภาพเอกสารได้',
                life: 3000
            });
        }
    } finally {
        loadingImages.value = false;
        hideLoading();
        abortControllers.value.loadImages = null;
    }
};

const handleSave = () => {
    // ป้องกันการกด save ซ้ำ
    if (isSaving.value || showConfirmDialog.value) {
        console.log('⚠️ Save already in progress, ignoring...');
        return;
    }

    // ตรวจสอบข้อมูลก่อนบันทึก
    const validationErrors = validateForm();

    if (validationErrors.length > 0) {
        // แสดง alert dialog พร้อมรายการที่มีปัญหา
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

    // แสดง dialog ยืนยันการบันทึก
    showConfirmDialog.value = true;
};

const submitForm = async () => {
    // ป้องกันการ save ซ้ำ
    if (isSaving.value) {
        console.log('⚠️ Submit already in progress, ignoring...');
        return;
    }

    // ปิด dialog ก่อน
    showConfirmDialog.value = false;
    isSaving.value = true;

    loading.value = true;
    showLoading(isEditMode.value ? 'กำลังบันทึกการแก้ไขรายการบัญชี...' : 'กำลังบันทึกรายการบัญชีใหม่...');

    // ยกเลิก submit ก่อนหน้าถ้ามี
    if (abortControllers.value.submit) {
        abortControllers.value.submit.abort();
    }

    abortControllers.value.submit = createAbortController(60000); // 60 วินาที สำหรับ submit

    try {
        // คำนวณ amount จาก journaldetail (ใช้ safeParseNumber)
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.debitamount, 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + safeParseNumber(d.creditamount, 0), 0);
        const amount = Math.max(totalDebit, totalCredit);

        // สร้าง payload ตาม API format
        const payload = {
            debtor: formData.value.debtaccounttype === 0 ? formData.value.debtaccountcode || {} : {},
            creditor: formData.value.debtaccounttype === 1 ? formData.value.debtaccountcode || {} : {},
            debtaccounttype: formData.value.debtaccounttype,
            accountdescription: formData.value.accountdescription || '',
            accountgroup: '',
            accountperiod: new Date(formData.value.docdate).getMonth() + 1, // 1-12
            accountyear: new Date(formData.value.docdate).getFullYear() + 543, // พ.ศ.
            documentref: formData.value.documentref || '',
            amount: amount,
            batchId: '',
            docdate: formData.value.docdate ? toLocalISOString(formData.value.docdate) : toLocalISOString(new Date()),
            docno: formData.value.docno,
            bookcode: formData.value.bookcode?.code || '',
            appname: isDataFromAI.value ? 'AI' : '',
            jobguidfixed: '',
            docformat: formData.value.docformat || '',
            journaldetail: formData.value.journaldetail.map((detail) => ({
                accountcode: detail.accountcode,
                accountname: detail.accountname || '',
                debitamount: safeParseNumber(detail.debitamount, 0),
                creditamount: safeParseNumber(detail.creditamount, 0)
            })),
            journaltype: formData.value.journaltype || 0,
            parid: '0000000',
            vats: (formData.value.vats || []).map((vat) => ({
                vatdocno: vat.vatdocno || '',
                vatdate: vat.vatdate ? toLocalISOString(vat.vatdate) : toLocalISOString(new Date()),
                vattype: safeParseInt(vat.vattype, 0),
                vatmode: safeParseInt(vat.vatmode, 0),
                vatperiod: safeParseInt(vat.vatperiod, new Date().getMonth() + 1),
                vatyear: safeParseInt(vat.vatyear, new Date().getFullYear() + 543),
                vatbase: safeParseNumber(vat.vatbase, 0),
                vatrate: safeParseNumber(vat.vatrate, 7),
                vatamount: safeParseNumber(vat.vatamount, 0),
                exceptvat: safeParseNumber(vat.exceptvat, 0),
                vatsubmit: vat.vatsubmit || false,
                remark: vat.remark || '',
                custtaxid: vat.custtaxid || '',
                custname: vat.custname || '',
                custtype: safeParseInt(vat.custtype, 0),
                organization: safeParseInt(vat.organization, 0),
                branchcode: vat.branchcode || '00000',
                address: vat.address || ''
            })),
            taxes: (formData.value.taxes || []).map((tax) => ({
                taxtype: safeParseInt(tax.taxtype, 0),
                custtype: safeParseInt(tax.custtype, 0),
                taxdate: tax.taxdate ? toLocalISOString(tax.taxdate) : toLocalISOString(new Date()),
                taxdocno: tax.taxdocno || '',
                custname: tax.custname || '',
                custtaxid: tax.custtaxid || '',
                address: tax.address || '',
                details: (tax.details || []).map((detail) => ({
                    description: detail.description || '',
                    taxbase: safeParseNumber(detail.taxbase, 0),
                    taxrate: safeParseNumber(detail.taxrate, 0),
                    taxamount: safeParseNumber(detail.taxamount, 0)
                }))
            })),
            exdocrefdate: formData.value.exdocrefdate ? toLocalISOString(formData.value.exdocrefdate) : null,
            exdocrefno: formData.value.exdocrefno || ''
        };

        // เรียก API (POST หรือ PUT) พร้อม abort signal
        let response;
        if (isEditMode.value) {
            response = await updateJournal(journalId.value, payload, { signal: abortControllers.value.submit.signal });
        } else {
            response = await createJournal(payload, { signal: abortControllers.value.submit.signal });
        }

        if (response.data.success) {
            // Reset AI flag after successful save
            isDataFromAI.value = false;

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกการแก้ไขรายการบัญชีเรียบร้อยแล้ว' : 'บันทึกรายการบัญชีใหม่เรียบร้อยแล้ว',
                life: 3000
            });

            // Set flag ว่าเพิ่ง save เสร็จ เพื่อไม่ให้แสดง Navigation Confirm Dialog
            justSaved.value = true;

            // กลับไปหน้า list
            setTimeout(() => {
                router.push({ name: 'journal-entry' });
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
        if (error.name === 'AbortError') {
            toast.add({
                severity: 'warn',
                summary: 'ยกเลิกการบันทึก',
                detail: 'การบันทึกถูกยกเลิกหรือใช้เวลานานเกินไป',
                life: 3000
            });
        } else {
            console.error('Error submitting journal:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
                life: 5000
            });
        }
    } finally {
        loading.value = false;
        hideLoading();
        isSaving.value = false;
        abortControllers.value.submit = null;
    }
};

// Load journal data for edit mode
const loadJournalData = async () => {
    if (!journalId.value) return;

    loading.value = true;
    showLoading('กำลังโหลดข้อมูลรายการบัญชี...');

    // ยกเลิก request ก่อนหน้าถ้ามี
    if (abortControllers.value.loadJournal) {
        abortControllers.value.loadJournal.abort();
    }

    abortControllers.value.loadJournal = createAbortController(30000);

    try {
        const response = await getJournalById(journalId.value, { signal: abortControllers.value.loadJournal.signal });
        if (response.data.success) {
            const data = response.data.data;

            // โหลด master data แบบ parallel พร้อม abort signal
            const [booksResponse, formatsResponse] = await Promise.all([
                getJournalBooks({ q: data.bookcode || '', page: 1, limit: 20 }, { signal: abortControllers.value.loadJournal.signal }),
                getDocumentFormats({ q: data.docformat || '', page: 1, limit: 20 }, { signal: abortControllers.value.loadJournal.signal })
            ]);

            // Map bookcode
            let mappedBookcode = null;
            if (data.bookcode && booksResponse.data.success) {
                const foundBook = booksResponse.data.data.find((book) => book.code === data.bookcode);
                if (foundBook) {
                    mappedBookcode = {
                        ...foundBook,
                        displayLabel: `${foundBook.code} ~ ${foundBook.name1}`
                    };
                } else {
                    // ถ้าไม่เจอใน master data ให้ใช้ค่าจาก API
                    mappedBookcode = {
                        code: data.bookcode,
                        displayLabel: data.bookcode
                    };
                }
            }

            // Map docformat
            let mappedDocformat = data.docformat || '';
            // Note: docformat เก็บเป็น description ไม่ต้อง map เป็น object

            // Map debt account (ลูกหนี้/เจ้าหนี้)
            let mappedDebtAccount = null;
            const account = data.debtaccounttype === 1 ? data.creditor : data.debtor;
            if (account && account.guidfixed) {
                try {
                    const debtApiCall = data.debtaccounttype === 1 ? getCreditors : getDebtors;
                    const debtResponse = await debtApiCall({ q: account.code || '', page: 1, limit: 20 }, { signal: abortControllers.value.loadJournal.signal });

                    if (debtResponse.data.success) {
                        const foundAccount = debtResponse.data.data.find((acc) => acc.guidfixed === account.guidfixed);
                        if (foundAccount) {
                            const thName = foundAccount.names?.find((n) => n.code === 'th')?.name || '';
                            mappedDebtAccount = {
                                ...foundAccount,
                                displayLabel: `${foundAccount.code} ~ ${thName}`
                            };
                        } else {
                            // ถ้าไม่เจอใน master data ใช้ข้อมูลจาก API
                            const thName = account.names?.find((n) => n.code === 'th')?.name || '';
                            mappedDebtAccount = {
                                ...account,
                                displayLabel: `${account.code} ~ ${thName}`
                            };
                        }
                    }
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('Error loading debt account:', error);
                        // ถ้า error ใช้ข้อมูลจาก API
                        const thName = account.names?.find((n) => n.code === 'th')?.name || '';
                        mappedDebtAccount = {
                            ...account,
                            displayLabel: `${account.code} ~ ${thName}`
                        };
                    }
                }
            }

            // Map API data to form data (ใช้ safe parsing)
            formData.value = {
                docdate: safeParseDate(data.docdate),
                docno: data.docno || '',
                bookcode: mappedBookcode,
                debtaccounttype: safeParseInt(data.debtaccounttype, 0),
                debtaccountcode: mappedDebtAccount,
                exdocrefdate: safeParseDate(data.exdocrefdate),
                exdocrefno: data.exdocrefno || '',
                journaltype: safeParseInt(data.journaltype, 0),
                accountdescription: data.accountdescription || '',
                docformat: mappedDocformat,
                documentref: data.documentref || '',
                journaldetail: data.journaldetail || [],
                vats: (data.vats || []).map((vat) => ({
                    ...vat,
                    vatdate: safeParseDate(vat.vatdate) || new Date()
                })),
                taxes: (data.taxes || []).map((tax) => ({
                    ...tax,
                    taxdate: safeParseDate(tax.taxdate) || new Date()
                }))
            };

            // Auto-open image panel if documentref exists
            if (data.documentref) {
                await loadDocumentImages(data.documentref);
                showImagePanel.value = true;
                // ไม่กำหนด imageSourceType เพื่อให้แสดงทั้งสองปุ่ม (edit mode)
                imageSourceType.value = null;
            }

            // เก็บ snapshot ของข้อมูลเดิมสำหรับเปรียบเทียบการเปลี่ยนแปลง
            originalFormData.value = JSON.parse(JSON.stringify(formData.value));
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Load journal aborted');
        } else {
            console.error('Error loading journal:', error);
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลรายการบัญชีได้',
                life: 3000
            });
        }
    } finally {
        loading.value = false;
        hideLoading();
        abortControllers.value.loadJournal = null;
    }
};

// Handle navigation confirmation
const handleNavigationConfirm = () => {
    showNavigationConfirm.value = false;
    if (pendingNavigation.value) {
        pendingNavigation.value();
        pendingNavigation.value = null;
    }
};

const handleNavigationCancel = () => {
    showNavigationConfirm.value = false;
    pendingNavigation.value = null;
};

// Navigation guard - เตือนเมื่อมีข้อมูลยังไม่ save
onBeforeRouteLeave((_to, _from, next) => {
    // ถ้ากำลัง save อยู่ หรือเพิ่ง save เสร็จ ให้ผ่านได้เลย
    if (isSaving.value || justSaved.value) {
        next();
        return;
    }

    // ตรวจสอบว่ามีการแก้ไขข้อมูลหรือไม่
    let hasUnsavedChanges = false;

    if (isEditMode.value && originalFormData.value) {
        // Edit mode: เปรียบเทียบกับข้อมูลเดิม
        const currentData = JSON.stringify(formData.value);
        const originalData = JSON.stringify(originalFormData.value);
        hasUnsavedChanges = currentData !== originalData;
    } else {
        // Create mode: ตรวจสอบว่ามีการกรอกข้อมูลหรือไม่
        hasUnsavedChanges = formData.value.docno || formData.value.journaldetail.length > 1 || (formData.value.journaldetail.length === 1 && formData.value.journaldetail[0].accountcode);
    }

    if (hasUnsavedChanges) {
        // แสดง dialog แทน confirm
        pendingNavigation.value = next;
        showNavigationConfirm.value = true;
    } else {
        next();
    }
});

// Watcher: Sync taskguid กับ selectedTask
watch(
    () => formData.value.documentref,
    (newDocRef) => {
        // ถ้ามี documentref ให้ตรวจสอบว่ามาจาก task หรือไม่
        if (!newDocRef) {
            imageSourceType.value = null;
        }
    }
);

onMounted(async () => {
    // Listen for window resize
    window.addEventListener('resize', handleResize);

    if (isEditMode.value) {
        await loadJournalData();
    } else {
        // Set default date to today for new entry
        formData.value.docdate = new Date();
        // สร้างแถวเริ่มต้น 1 แถว
        formData.value.journaldetail = [{ accountcode: '', accountname: '', debitamount: 0, creditamount: 0 }];
    }
});

onUnmounted(() => {
    // Cleanup event listeners
    window.removeEventListener('resize', handleResize);

    // Abort ทุก API calls ที่ยังค้างอยู่
    Object.values(abortControllers.value).forEach((controller) => {
        if (controller) {
            controller.abort();
        }
    });
});
</script>

<template>
    <div>
        <Toast />
        <LoadingDialog />
        <AlertDialog v-model:visible="showValidationAlert" header="ข้อมูลไม่ครบถ้วน" :message="validationMessage" severity="warning" icon="pi-exclamation-triangle" />

        <!-- Save Confirm Dialog -->
        <DialogForm :confirmDialog="showConfirmDialog" textContent="คุณต้องการบันทึกเอกสารรายวัน ใช่หรือไม่ ?" @close="showConfirmDialog = false" @confirm="submitForm" />

        <!-- Navigation Confirm Dialog -->
        <DialogForm
            :confirmDialog="showNavigationConfirm"
            textContent="คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?"
            cancelLabel="ออกจากหน้า"
            confirmLabel="อยู่ต่อ (Enter)"
            @close="handleNavigationConfirm"
            @confirm="handleNavigationCancel"
        />

        <!-- Image Upload Preview Dialog -->
        <ImageUploadPreviewDialog v-model:visible="showUploadPreview" :file="selectedFile" :uploadedUri="uploadedImageUri" :loading="uploadingImage" @confirm="handleConfirmUpload" @cancel="handleCancelUpload" />

        <!-- Task Selection Dialog -->
        <TaskSelectionDialog v-model:visible="showTaskSelectionDialog" @taskSelected="handleTaskSelected" />

        <!-- Task Image Selection Dialog -->
        <TaskImageSelectionDialog v-model:visible="showTaskImageSelectionDialog" :task="selectedTask" @imagesSelected="handleImagesSelectedFromTask" @backToTaskSelection="handleBackToTaskSelection" />

        <!-- AI Model Selection Dialog -->
        <AiModelSelectionDialog v-model:visible="showAiModelDialog" @confirm="handleAiModelSelected" />

        <!-- OCR Result Dialog -->
        <OcrResultDialog v-model:visible="showOcrResultDialog" :ocrData="ocrResultData" @apply-data="handleApplyOcrData" @reanalyze="handleReanalyze" />

        <!-- Hidden file input -->
        <input ref="fileInputRef" type="file" accept="image/*,application/pdf" class="hidden" @change="handleFileSelect" />

        <div class="card">
            <!-- Header -->
            <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-3">
                    <Button icon="pi pi-arrow-left" text @click="goBack" />
                    <div class="text-2xl font-bold m-0 text-surface-900 dark:text-surface-0">
                        {{ isEditMode ? 'แก้ไขรายการบัญชี' : 'เพิ่มรายการบัญชี' }}
                    </div>
                </div>
                <div class="flex gap-2 items-center">
                    <!-- AI Analysis Button -->
                    <!-- <Button icon="pi pi-sparkles" label="AI วิเคราะห์" severity="success" outlined @click="handleAiAnalyze" v-tooltip.left="hasImages ? 'วิเคราะห์เอกสารด้วย AI' : 'ต้องมีรูปภาพเอกสารก่อน'" :disabled="!hasImages || loading" /> -->

                    <!-- Image Panel Buttons -->
                    <Button v-if="!showImagePanel" icon="pi pi-image" label="รูปภาพเอกสาร" text @click="toggleImagePanel" v-tooltip.left="'เปิดแผงรูปภาพเอกสาร'" :disabled="loading" />
                    <Button v-else icon="pi pi-times" label="ยกเลิกการใช้รูปภาพ" text severity="danger" @click="handleCancelImage" v-tooltip.left="'ยกเลิกการใช้รูปภาพเอกสาร'" :disabled="loading" />

                    <Button icon="pi pi-key" text @click="toggleShortcutInfo" v-tooltip.left="'คีย์ลัด'" />

                    <Popover ref="shortcutInfoRef">
                        <div class="p-3 w-72">
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>บันทึก</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ ctrlKey }} + S</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>เพิ่มแถวใหม่</span>
                                    <div class="flex gap-1">
                                        <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + N</kbd>
                                        <span class="text-surface-400" v-if="isMac">หรือ</span>
                                        <kbd v-if="isMac" class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">Help (Ins)</kbd>
                                        <span class="text-surface-400" v-if="!isMac">หรือ</span>
                                        <kbd v-if="!isMac" class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">Insert</kbd>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>สร้างเลขที่เอกสาร</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + G</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ย้ายแถวขึ้น</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + ↑</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ย้ายแถวลง</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ altKey }} + ↓</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700">
                                    <span>ลบแถวปัจจุบัน</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">{{ ctrlKey }} + Del</kbd>
                                </div>
                                <div class="flex justify-between items-center py-1">
                                    <span>ไปช่องถัดไป</span>
                                    <kbd class="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs">Tab</kbd>
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
                <!-- Splitter Layout (when image panel is open) -->
                <!-- layout: horizontal (ซ้าย-ขวา) บน desktop, vertical (บน-ล่าง) บนหน้าจอเล็ก -->
                <Splitter v-if="showImagePanel" :layout="isSmallScreen ? 'vertical' : 'horizontal'" class="rounded-lg border border-surface-200 dark:border-surface-700" style="height: calc(100vh - 250px); min-height: 500px">
                    <!-- Top/Left Panel - Image Detail Panel -->
                    <SplitterPanel :size="isSmallScreen ? 50 : 40" :minSize="isSmallScreen ? 30 : 25" class="bg-surface-50 dark:bg-surface-900">
                        <div class="h-full overflow-auto p-2">
                            <div v-if="loadingImages" class="h-full flex justify-center items-center min-h-80">
                                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                            </div>
                            <!-- Empty state with upload button -->
                            <div v-else-if="!documentImageGroup" class="h-full flex flex-col justify-center items-center text-surface-500 min-h-80 px-4">
                                <i class="pi pi-image text-6xl mb-4"></i>
                                <p class="text-lg font-semibold">ไม่พบรูปภาพเอกสาร</p>
                                <p class="text-sm mt-2 text-surface-400 text-center max-w-md">กรุณาเลือกวิธีการเพิ่มรูปภาพเอกสาร</p>

                                <!-- Instructions -->
                                <div class="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 mt-4 mb-4 max-w-lg">
                                    <div class="flex items-start gap-2 mb-3">
                                        <i class="pi pi-info-circle text-primary-600 dark:text-primary-400 mt-0.5"></i>
                                        <div class="text-sm text-primary-900 dark:text-primary-100">
                                            <div class="font-semibold mb-2">วิธีการใช้งาน:</div>
                                            <ul class="space-y-1.5 text-primary-800 dark:text-primary-200">
                                                <li class="flex items-start gap-2">
                                                    <span class="text-primary-600 dark:text-primary-400">•</span>
                                                    <span><strong>อัพโหลดเอกสาร:</strong> เพิ่มรูปภาพจากคอมพิวเตอร์ของคุณ</span>
                                                </li>
                                                <li class="flex items-start gap-2">
                                                    <span class="text-primary-600 dark:text-primary-400">•</span>
                                                    <span><strong>เลือกจาก Task:</strong> เลือกรูปภาพที่มีอยู่แล้วใน Task</span>
                                                </li>
                                                <li class="flex items-start gap-2">
                                                    <span class="text-primary-600 dark:text-primary-400">•</span>
                                                    <span>หากเลือกจาก Task แล้ว สามารถ<strong>เพิ่มรูป</strong>ด้วยการอัพโหลดได้</span>
                                                </li>
                                                <li class="flex items-start gap-2">
                                                    <span class="text-primary-600 dark:text-primary-400">•</span>
                                                    <span>หากต้องการเลือกรูปจาก Task ใหม่ ให้<strong>ลบรูปเดิม</strong>ก่อน</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex gap-2">
                                    <Button label="อัพโหลดเอกสาร" icon="pi pi-upload" @click="triggerFileUpload" :loading="uploadingImage" />
                                    <!-- <Button label="เลือกจาก Task" icon="pi pi-folder-open" severity="secondary" @click="openTaskSelection" :loading="uploadingImage" /> -->
                                </div>
                            </div>
                            <!-- Image panel with add button -->
                            <div v-else class="h-full flex flex-col">
                                <div class="flex justify-end mb-2 gap-2">
                                    <!-- แสดงปุ่ม "เพิ่มรูป" เสมอ (สามารถเพิ่มรูปได้ทุกกรณี) -->
                                    <Button label="เพิ่มรูป" icon="pi pi-plus" size="small" severity="secondary" @click="triggerFileUpload" :loading="uploadingImage" />
                                    <!-- แสดงปุ่ม "ยกเลิกรูปจาก Task" เฉพาะเมื่อเป็นรูปจาก task -->
                                    <Button v-if="imageSourceType === 'task'" label="ยกเลิกรูปจาก Task" icon="pi pi-times" size="small" severity="danger" @click="cancelImage" outlined />
                                    <!-- แสดงปุ่ม "เลือกจาก Task" เฉพาะเมื่อไม่มีรูปหรือเป็นรูปจาก upload เท่านั้น -->
                                    <!-- <Button v-if="!imageSourceType || imageSourceType === 'upload'" label="เลือกจาก Task" icon="pi pi-folder-open" size="small" severity="info" @click="openTaskSelection" :loading="uploadingImage" /> -->
                                </div>
                                <div class="flex-1 overflow-auto">
                                    <ImageDetailPanel
                                        :selectedGroup="documentImageGroup"
                                        :selectedImageDetail="selectedImageDetail"
                                        :loadingDetail="loadingImages"
                                        :isJobClosed="false"
                                        :isReviewMode="false"
                                        :updatingStatus="false"
                                        :isReadOnly="true"
                                    />
                                </div>
                            </div>
                        </div>
                    </SplitterPanel>

                    <!-- Bottom/Right Panel - Form Tabs -->
                    <SplitterPanel :size="isSmallScreen ? 50 : 60" :minSize="isSmallScreen ? 30 : 35">
                        <div class="h-full flex flex-col p-2">
                            <Tabs v-model:value="activeTab" class="h-full flex flex-col">
                                <TabList>
                                    <Tab value="0">
                                        <i class="pi pi-calendar mr-2"></i>
                                        ข้อมูลรายวัน
                                    </Tab>
                                    <!-- <Tab value="1">
                                        <i class="pi pi-file-edit mr-2"></i>
                                        ข้อมูลภาษี
                                    </Tab>
                                    <Tab value="2">
                                        <i class="pi pi-percentage mr-2"></i>
                                        ภาษีถูกหัก ณ ที่จ่าย
                                    </Tab> -->
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
                                    <!-- <TabPanel value="1">
                                        <div class="pt-4 pb-2">
                                            <JournalTaxInfoTab :modelValue="formData" @update:modelValue="formData = $event" />
                                        </div>
                                    </TabPanel> -->
                                    <!-- <TabPanel value="2">
                                        <div class="pt-4 pb-2">
                                            <JournalWithholdingTaxTab :modelValue="formData" @update:modelValue="formData = $event" />
                                        </div>
                                    </TabPanel> -->
                                </TabPanels>
                            </Tabs>
                        </div>
                    </SplitterPanel>
                </Splitter>

                <!-- Full Width Tabs (when image panel is closed) -->
                <Tabs v-else v-model:value="activeTab" class="flex flex-col" style="height: calc(100vh - 250px); min-height: 500px">
                    <TabList>
                        <Tab value="0">
                            <i class="pi pi-calendar mr-2"></i>
                            ข้อมูลรายวัน
                        </Tab>
                        <!-- <Tab value="1">
                            <i class="pi pi-file-edit mr-2"></i>
                            ข้อมูลภาษี
                        </Tab>
                        <Tab value="2">
                            <i class="pi pi-percentage mr-2"></i>
                            ภาษีถูกหัก ณ ที่จ่าย
                        </Tab> -->
                    </TabList>
                    <TabPanels class="flex-1 overflow-auto">
                        <TabPanel value="0">
                            <div class="pt-4">
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
                        <!-- <TabPanel value="1">
                            <div class="pt-4">
                                <JournalTaxInfoTab :modelValue="formData" @update:modelValue="formData = $event" />
                            </div>
                        </TabPanel>
                        <TabPanel value="2">
                            <div class="pt-4">
                                <JournalWithholdingTaxTab :modelValue="formData" @update:modelValue="formData = $event" />
                            </div>
                        </TabPanel> -->
                    </TabPanels>
                </Tabs>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Splitter Gutter Styling - ใช้ :deep เฉพาะส่วนที่ต้อง override PrimeVue */
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
