<script setup>
import AlertDialog from '@/components/AlertDialog.vue';
import DialogApprove from '@/components/DialogApprove.vue';
import JournalDailyInfoTab from '@/components/accounting/JournalDailyInfoTab.vue';
import JournalTaxInfoTab from '@/components/accounting/JournalTaxInfoTab.vue';
import JournalWithholdingTaxTab from '@/components/accounting/JournalWithholdingTaxTab.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageUploadPreviewDialog from '@/components/image/ImageUploadPreviewDialog.vue';
import { createDocumentImage, getDocumentImageGroup, updateDocumentImageGroupImages, uploadImage } from '@/services/api/image';
import { createJournal, getCreditors, getDebtors, getDocumentFormats, getJournalBooks, getJournalById, updateJournal } from '@/services/api/journal';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const toast = useToast();

const journalId = ref(route.params.id || null);
const isEditMode = ref(!!journalId.value);
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

// Cancel image confirm dialog
const showCancelImageDialog = ref(false);
const cancelImageRandomNumber = ref(0);

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
const showImagePanel = ref(false);
const loadingImages = ref(false);
const documentImageGroup = ref(null);
const selectedImageDetail = ref(null);

// Responsive: ตรวจสอบว่าหน้าจอเล็กกว่า lg (1024px) หรือไม่
const isSmallScreen = ref(window.innerWidth < 1024);
const handleResize = () => {
    isSmallScreen.value = window.innerWidth < 1024;
};

// Image upload state
const fileInputRef = ref(null);
const showUploadPreview = ref(false);
const selectedFile = ref(null);
const uploadedImageUri = ref('');
const uploadingImage = ref(false);

// Get current user email (from localStorage or auth store)
const getCurrentUserEmail = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.email || 'unknown@user.com';
};

// Trigger file input
const triggerFileUpload = () => {
    fileInputRef.value?.click();
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
    uploadingImage.value = true;

    try {
        // Upload file
        const response = await uploadImage(file);
        if (response.data.success) {
            uploadedImageUri.value = response.data.data.uri;
            showUploadPreview.value = true;
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        toast.add({
            severity: 'error',
            summary: 'อัพโหลดไม่สำเร็จ',
            detail: error.response?.data?.message || 'ไม่สามารถอัพโหลดไฟล์ได้',
            life: 3000
        });
        selectedFile.value = null;
        uploadedImageUri.value = '';
    } finally {
        uploadingImage.value = false;
        // Reset file input
        if (fileInputRef.value) {
            fileInputRef.value.value = '';
        }
    }
};

// Confirm upload - create document image
const handleConfirmUpload = async () => {
    if (!selectedFile.value || !uploadedImageUri.value) return;

    uploadingImage.value = true;

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
        const createResponse = await createDocumentImage(payload);
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
            await updateDocumentImageGroupImages(formData.value.documentref, updatedImages);

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'เพิ่มรูปภาพในชุดเอกสารเรียบร้อยแล้ว',
                life: 3000
            });
        } else {
            // New document - set documentref to new group
            formData.value.documentref = groupid;

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
        console.error('Error confirming upload:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถบันทึกเอกสารได้',
            life: 3000
        });
    } finally {
        uploadingImage.value = false;
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

// ลบแถวว่างใน journaldetail (แถวที่ไม่มีข้อมูลเลย)
const removeEmptyJournalDetails = () => {
    if (!formData.value.journaldetail) return;

    const filteredDetails = formData.value.journaldetail.filter((detail) => {
        // ถ้า accountcode ว่าง, accountname ว่าง, debitamount = 0, creditamount = 0 ให้ลบออก
        const hasAccountCode = detail.accountcode && detail.accountcode.trim() !== '';
        const hasAccountName = detail.accountname && detail.accountname.trim() !== '';
        const hasDebit = parseFloat(detail.debitamount) !== 0;
        const hasCredit = parseFloat(detail.creditamount) !== 0;

        // เก็บแถวไว้ถ้ามีข้อมูลอย่างน้อย 1 อย่าง
        return hasAccountCode || hasAccountName || hasDebit || hasCredit;
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
        // ตรวจสอบว่าแต่ละรายการมีข้อมูลครบถ้วน
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

        // ตรวจสอบความสมดุลของรายการ
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.debitamount) || 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.creditamount) || 0), 0);

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
            if (!vat.vatbase || parseFloat(vat.vatbase) === 0) {
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
                    if (!detail.description || detail.description.trim() === '' || !detail.taxbase || parseFloat(detail.taxbase) === 0) {
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

// Handle cancel image - show confirmation if documentref exists
const handleCancelImage = () => {
    if (formData.value.documentref) {
        // Has document, show confirm dialog
        cancelImageRandomNumber.value = Math.floor(Math.random() * 9000) + 1000;
        showCancelImageDialog.value = true;
    } else {
        // No document, just close panel
        showImagePanel.value = false;
    }
};

// Confirm cancel image - clear documentref
const confirmCancelImage = () => {
    formData.value.documentref = '';
    documentImageGroup.value = null;
    showImagePanel.value = false;
    showCancelImageDialog.value = false;

    toast.add({
        severity: 'success',
        summary: 'สำเร็จ',
        detail: 'ยกเลิกการใช้รูปภาพเอกสารเรียบร้อยแล้ว',
        life: 3000
    });
};

// Cancel image confirmation failed
const cancelImageFailed = () => {
    toast.add({
        severity: 'error',
        summary: 'ตัวเลขไม่ถูกต้อง',
        detail: 'กรุณากรอกตัวเลขให้ตรงกับที่แสดง',
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
    try {
        const response = await getDocumentImageGroup(documentRef);
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

const handleSave = () => {
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
    confirmMessage.value = 'คุณต้องการบันทึกเอกสารรายวัน ใช่หรือไม่ ?';
    showConfirmDialog.value = true;
};

const submitForm = async () => {
    loading.value = true;
    try {
        // คำนวณ amount จาก journaldetail
        const totalDebit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.debitamount) || 0), 0);
        const totalCredit = formData.value.journaldetail.reduce((sum, d) => sum + (parseFloat(d.creditamount) || 0), 0);
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
            docdate: formData.value.docdate ? new Date(formData.value.docdate).toISOString() : new Date().toISOString(),
            docno: formData.value.docno,
            bookcode: formData.value.bookcode?.code || '',
            appname: '',
            jobguidfixed: '',
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
                vatdate: vat.vatdate ? new Date(vat.vatdate).toISOString() : new Date().toISOString(),
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
                taxdate: tax.taxdate ? new Date(tax.taxdate).toISOString() : new Date().toISOString(),
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
            exdocrefdate: formData.value.exdocrefdate ? new Date(formData.value.exdocrefdate).toISOString() : null,
            exdocrefno: formData.value.exdocrefno || ''
        };

        // เรียก API (POST หรือ PUT)
        let response;
        if (isEditMode.value) {
            response = await updateJournal(journalId.value, payload);
        } else {
            response = await createJournal(payload);
        }

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: isEditMode.value ? 'บันทึกการแก้ไขรายการบัญชีเรียบร้อยแล้ว' : 'บันทึกรายการบัญชีใหม่เรียบร้อยแล้ว',
                life: 3000
            });

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
        console.error('Error submitting journal:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
            life: 5000
        });
    } finally {
        loading.value = false;
    }
};

// Load journal data for edit mode
const loadJournalData = async () => {
    if (!journalId.value) return;

    loading.value = true;
    try {
        const response = await getJournalById(journalId.value);
        if (response.data.success) {
            const data = response.data.data;

            // โหลด master data แบบ parallel
            const [booksResponse, formatsResponse] = await Promise.all([getJournalBooks({ q: data.bookcode || '', page: 1, limit: 20 }), getDocumentFormats({ q: data.docformat || '', page: 1, limit: 20 })]);

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
                    const debtResponse = await debtApiCall({ q: account.code || '', page: 1, limit: 20 });

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
                    console.error('Error loading debt account:', error);
                    // ถ้า error ใช้ข้อมูลจาก API
                    const thName = account.names?.find((n) => n.code === 'th')?.name || '';
                    mappedDebtAccount = {
                        ...account,
                        displayLabel: `${account.code} ~ ${thName}`
                    };
                }
            }

            // Map API data to form data
            formData.value = {
                docdate: data.docdate ? new Date(data.docdate) : null,
                docno: data.docno || '',
                bookcode: mappedBookcode,
                debtaccounttype: data.debtaccounttype || 0,
                debtaccountcode: mappedDebtAccount,
                exdocrefdate: data.exdocrefdate && data.exdocrefdate !== '0001-01-01T00:00:00Z' ? new Date(data.exdocrefdate) : null,
                exdocrefno: data.exdocrefno || '',
                journaltype: data.journaltype || 0,
                accountdescription: data.accountdescription || '',
                docformat: mappedDocformat,
                documentref: data.documentref || '',
                journaldetail: data.journaldetail || [],
                vats: (data.vats || []).map((vat) => ({
                    ...vat,
                    vatdate: vat.vatdate ? new Date(vat.vatdate) : new Date()
                })),
                taxes: (data.taxes || []).map((tax) => ({
                    ...tax,
                    taxdate: tax.taxdate ? new Date(tax.taxdate) : new Date()
                }))
            };

            // Auto-open image panel if documentref exists
            if (data.documentref) {
                await loadDocumentImages(data.documentref);
                showImagePanel.value = true;
            }
        }
    } catch (error) {
        console.error('Error loading journal:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลรายการบัญชีได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

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
                <Button label="ยืนยัน" icon="pi pi-check" @click="submitForm" :loading="loading" autofocus />
            </template>
        </Dialog>

        <!-- Cancel Image Confirm Dialog -->
        <DialogApprove
            :confirmDialog="showCancelImageDialog"
            :randomNumber="cancelImageRandomNumber"
            mode="cancel"
            title="ยืนยันการยกเลิกรูปภาพ"
            @close="showCancelImageDialog = false"
            @confirmJob="confirmCancelImage"
            @confirmJobFalse="cancelImageFailed"
        />

        <!-- Image Upload Preview Dialog -->
        <ImageUploadPreviewDialog v-model:visible="showUploadPreview" :file="selectedFile" :uploadedUri="uploadedImageUri" :loading="uploadingImage" @confirm="handleConfirmUpload" @cancel="handleCancelUpload" />

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
                    <!-- Image Panel Buttons -->
                    <Button v-if="!showImagePanel" icon="pi pi-image" label="รูปภาพเอกสาร" text @click="toggleImagePanel" v-tooltip.left="'เปิดแผงรูปภาพเอกสาร'" :disabled="loading" />
                    <Button v-else icon="pi pi-times" label="ยกเลิกการใช้รูปภาพ" text severity="danger" @click="handleCancelImage" v-tooltip.left="'ยกเลิกการใช้รูปภาพเอกสาร'" :disabled="loading" />

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
                            <div v-else-if="!documentImageGroup" class="h-full flex flex-col justify-center items-center text-surface-500 min-h-80">
                                <i class="pi pi-image text-6xl mb-4"></i>
                                <p class="text-lg">ไม่พบรูปภาพเอกสาร</p>
                                <p class="text-sm mt-2 text-surface-400 mb-4">กรุณาอัพโหลดรูปภาพหรือ PDF เพื่อแนบเอกสาร</p>
                                <Button label="อัพโหลดเอกสาร" icon="pi pi-upload" @click="triggerFileUpload" :loading="uploadingImage" />
                            </div>
                            <!-- Image panel with add button -->
                            <div v-else class="h-full flex flex-col">
                                <div class="flex justify-end mb-2">
                                    <Button label="เพิ่มรูป" icon="pi pi-plus" size="small" severity="secondary" @click="triggerFileUpload" :loading="uploadingImage" />
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

                <!-- Full Width Tabs (when image panel is closed) -->
                <Tabs v-else v-model:value="activeTab" class="flex flex-col" style="height: calc(100vh - 250px); min-height: 500px">
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
                        <TabPanel value="1">
                            <div class="pt-4">
                                <JournalTaxInfoTab :modelValue="formData" @update:modelValue="formData = $event" />
                            </div>
                        </TabPanel>
                        <TabPanel value="2">
                            <div class="pt-4">
                                <JournalWithholdingTaxTab :modelValue="formData" @update:modelValue="formData = $event" />
                            </div>
                        </TabPanel>
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
