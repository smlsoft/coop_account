<script setup>
import StatementConfigDialog from '@/components/accounting/StatementConfigDialog.vue';
import StatementJournalTable from '@/components/accounting/StatementJournalTable.vue';
import StatementTransactionTable from '@/components/accounting/StatementTransactionTable.vue';
import DialogApprove from '@/components/DialogApprove.vue';
import PdfViewer from '@/components/image/PdfViewer.vue';
import { useLoading } from '@/composables/useLoading';
import { getAccountPeriodByDate } from '@/services/api/accountperiod';
import { readBankStatement } from '@/services/api/bankstatement';
import { importJournals } from '@/services/api/journal';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// State
const currentStep = ref(1); // 1: Upload, 2: Review Transactions, 3: Review Journals
const selectedFile = ref(null);
const pdfPassword = ref('');
const showPasswordInput = ref(false);
const pdfSource = ref(null);
const transactions = ref([]);
const journals = ref([]);
const statementConfig = ref(null);

// Dialogs
const showConfigDialog = ref(false);
const showSaveConfirmDialog = ref(false);
const randomNumber = ref(0);

// Loading states
const isUploading = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);

// Computed
const hasTransactions = computed(() => transactions.value.length > 0);
const hasJournals = computed(() => journals.value.length > 0);
const hasInvalidPeriod = computed(() => journals.value.some((j) => j.periodValidation?.isValid === false));
const validEntriesCount = computed(() => journals.value.filter((j) => j.periodValidation?.isValid === true).length);
const invalidEntriesCount = computed(() => journals.value.filter((j) => j.periodValidation?.isValid === false).length);

// Transaction summary (Step 2 header)
const transactionSummary = computed(() => {
    let totalDeposit = 0;
    let totalWithdraw = 0;
    let lastBalance = null;

    transactions.value.forEach((tx) => {
        if (tx.deposit) {
            const val = parseFloat(String(tx.deposit).replace(/,/g, ''));
            if (!isNaN(val) && val > 0) totalDeposit += val;
        }
        if (tx.withdraw) {
            const val = parseFloat(String(tx.withdraw).replace(/,/g, ''));
            if (!isNaN(val) && val > 0) totalWithdraw += val;
        }
        if (tx.balance) {
            const val = parseFloat(String(tx.balance).replace(/,/g, ''));
            if (!isNaN(val)) lastBalance = val;
        }
    });

    return { totalDeposit, totalWithdraw, lastBalance };
});

// Journal summary (Step 3)
const journalTotalAmount = computed(() => {
    return journals.value.reduce((sum, j) => sum + (j.amount || 0), 0);
});

// File input
const fileInputRef = ref(null);

// Format currency
const formatCurrency = (value) => {
    if (!value) return '0.00';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

// ===============================
// STEP 1: อัพโหลด PDF
// ===============================

const triggerFileUpload = () => {
    fileInputRef.value?.click();
};

const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        toast.add({
            severity: 'error',
            summary: 'ผิดพลาด',
            detail: 'กรุณาเลือกไฟล์ PDF เท่านั้น',
            life: 3000
        });
        return;
    }

    selectedFile.value = file;

    // โหลด PDF เพื่อแสดงใน Step 2 และ 3
    const fileReader = new FileReader();
    fileReader.onload = () => {
        pdfSource.value = fileReader.result;
    };
    fileReader.readAsDataURL(file);

    // อัพโหลดทันทีเมื่อเลือกไฟล์ (ถ้ายังไม่ต้องการ password)
    if (!showPasswordInput.value) {
        await handleUpload();
    }
};

const handleUpload = async () => {
    if (!selectedFile.value) {
        toast.add({
            severity: 'warn',
            summary: 'แจ้งเตือน',
            detail: 'กรุณาเลือกไฟล์ Statement',
            life: 3000
        });
        return;
    }

    isUploading.value = true;
    showLoading('กำลังอ่าน Statement... (อาจใช้เวลา 30-60 วินาที)');

    try {
        const response = await readBankStatement(selectedFile.value, pdfPassword.value || null);

        if (response.status === 'success') {
            // Validate transactions
            const validTransactions = validateTransactions(response.result || []);

            if (validTransactions.length === 0) {
                toast.add({
                    severity: 'error',
                    summary: 'ไม่พบข้อมูล',
                    detail: 'ไม่พบรายการธุรกรรมที่ถูกต้องใน Statement',
                    life: 5000
                });
                return;
            }

            transactions.value = validTransactions;

            // แสดง warning ถ้ามีรายการที่ถูกกรอง
            if (validTransactions.length < response.result.length) {
                toast.add({
                    severity: 'warn',
                    summary: 'คำเตือน',
                    detail: `พบรายการที่ไม่สมบูรณ์ ${response.result.length - validTransactions.length} รายการ (ถูกกรองออก)`,
                    life: 5000
                });
            }

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `อ่าน Statement สำเร็จ ${validTransactions.length} รายการ`,
                life: 3000
            });

            currentStep.value = 2;
        } else if (response.status === 'password_required') {
            showPasswordInput.value = true;
            toast.add({
                severity: 'info',
                summary: 'ต้องการรหัสผ่าน',
                detail: 'กรุณากรอกรหัสผ่าน PDF',
                life: 3000
            });
        } else if (response.status === 'password_incorrect') {
            toast.add({
                severity: 'error',
                summary: 'รหัสผ่านไม่ถูกต้อง',
                detail: 'กรุณาลองใหม่อีกครั้ง',
                life: 3000
            });
            showPasswordInput.value = true;
        } else {
            throw new Error(response.message || 'ไม่สามารถอ่าน Statement ได้');
        }
    } catch (error) {
        console.error('Upload error:', error);

        // Handle password_required / password_incorrect จาก API (HTTP 400)
        if (error.status === 'password_required') {
            showPasswordInput.value = true;
            toast.add({
                severity: 'info',
                summary: 'ต้องการรหัสผ่าน',
                detail: 'กรุณากรอกรหัสผ่าน PDF',
                life: 3000
            });
        } else if (error.status === 'password_incorrect') {
            showPasswordInput.value = true;
            toast.add({
                severity: 'error',
                summary: 'รหัสผ่านไม่ถูกต้อง',
                detail: 'กรุณาลองใหม่อีกครั้ง',
                life: 3000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.message || 'ไม่สามารถอ่าน Statement ได้',
                life: 5000
            });
        }
    } finally {
        isUploading.value = false;
        hideLoading();
    }
};

// Validate transactions
const validateTransactions = (txs) => {
    return txs.filter((tx) => {
        // ต้องมีวันที่
        if (!tx.date) return false;

        // ต้องมี deposit หรือ withdraw
        const hasAmount = (tx.deposit && parseFloat(String(tx.deposit).replace(/,/g, '')) > 0) || (tx.withdraw && parseFloat(String(tx.withdraw).replace(/,/g, '')) > 0);
        if (!hasAmount) return false;

        // ต้องมี description
        if (!tx.description || tx.description.trim() === '') return false;

        return true;
    });
};

// ===============================
// STEP 2: กรอกข้อมูลและสร้าง GL
// ===============================

const openConfigDialog = () => {
    showConfigDialog.value = true;
};

const handleConfigSave = async (config) => {
    statementConfig.value = config;
    showConfigDialog.value = false;

    await generateJournals();
};

const generateJournals = async () => {
    if (!statementConfig.value) return;

    isGenerating.value = true;
    showLoading('กำลังสร้างรายการบัญชี...');

    try {
        const generatedJournals = [];

        // สร้าง batchid สำหรับรายการทั้งหมด (YYYYMMDD + random hex)
        const now = new Date();
        const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
        const batchid = `${datePrefix}${randomHex}`;

        console.log(`Generated batch ID: ${batchid}`);

        transactions.value.forEach((tx, index) => {
            const isDeposit = parseFloat(String(tx.deposit || 0).replace(/,/g, '')) > 0;
            const amount = isDeposit ? parseFloat(String(tx.deposit).replace(/,/g, '')) : parseFloat(String(tx.withdraw).replace(/,/g, ''));

            // Generate docno
            const date = new Date(tx.date);
            const dateStr = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
            const docno = `${statementConfig.value.bookCode}-${dateStr}-${String(index + 1).padStart(3, '0')}`;

            generatedJournals.push({
                docno,
                docdate: toISOStringWithTimezone(tx.date), // แปลงเป็น ISO string with timezone
                accountperiod: null, // จะ update หลัง check period
                accountdescription: tx.description,
                amount,
                bookcode: statementConfig.value.bookCode,
                batchid: batchid, // เพิ่ม batchid สำหรับลบทั้ง batch
                exdocrefno: statementConfig.value.referenceNo || '',
                exdocrefdate: statementConfig.value.referenceDate ? toISOStringWithTimezone(statementConfig.value.referenceDate) : null,
                journaldetail: [
                    {
                        accountcode: isDeposit ? statementConfig.value.passbookAccount.accountcode : statementConfig.value.reversalAccount.accountcode,
                        accountname: isDeposit ? statementConfig.value.passbookAccount.accountname : statementConfig.value.reversalAccount.accountname,
                        debitamount: amount,
                        creditamount: 0
                    },
                    {
                        accountcode: isDeposit ? statementConfig.value.reversalAccount.accountcode : statementConfig.value.passbookAccount.accountcode,
                        accountname: isDeposit ? statementConfig.value.reversalAccount.accountname : statementConfig.value.passbookAccount.accountname,
                        debitamount: 0,
                        creditamount: amount
                    }
                ]
            });
        });

        journals.value = generatedJournals;

        // Check account periods
        await checkAccountPeriods();

        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: `สร้างรายการบัญชีแล้ว ${journals.value.length} รายการ`,
            life: 3000
        });

        currentStep.value = 3;
    } catch (error) {
        console.error('Generate journals error:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถสร้างรายการบัญชีได้',
            life: 5000
        });
    } finally {
        isGenerating.value = false;
        hideLoading();
    }
};

// Check account periods - ตรวจสอบแบบละเอียดตาม JournalDailyInfoTab.vue pattern
const checkAccountPeriods = async () => {
    try {
        // เรียก API แยกแต่ละวันที่เพื่อได้ข้อมูล perioddata ครบถ้วน
        for (const journal of journals.value) {
            const d = new Date(journal.docdate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            try {
                const response = await getAccountPeriodByDate(dateStr);

                if (response.success && response.data.length > 0) {
                    const periodData = response.data[0].perioddata;

                    // ตรวจสอบตาม pattern ของ JournalDailyInfoTab.vue
                    if (!periodData.guidfixed || periodData.guidfixed === '') {
                        // ไม่ได้กำหนดงวดบัญชี
                        journal.periodValidation = {
                            isValid: false,
                            message: 'วันที่นี้ยังไม่ได้กำหนดงวดบัญชี',
                            periodData: null
                        };
                        journal.accountperiod = 0;
                    } else if (periodData.isdisabled) {
                        // งวดถูกปิดแล้ว
                        journal.periodValidation = {
                            isValid: false,
                            message: 'งวดบัญชีถูกปิดแล้ว',
                            periodData: periodData
                        };
                        journal.accountperiod = periodData.period || 0;
                    } else {
                        // งวดบัญชีถูกต้อง
                        journal.periodValidation = {
                            isValid: true,
                            message: 'งวดบัญชีถูกต้อง',
                            periodData: periodData
                        };
                        journal.accountperiod = periodData.period || 0;
                    }
                } else {
                    // ไม่พบข้อมูลงวดบัญชี
                    journal.periodValidation = {
                        isValid: false,
                        message: 'ไม่พบข้อมูลงวดบัญชี',
                        periodData: null
                    };
                    journal.accountperiod = 0;
                }
            } catch (error) {
                console.error(`Error checking period for date ${dateStr}:`, error);
                journal.periodValidation = {
                    isValid: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบงวดบัญชี',
                    periodData: null
                };
                journal.accountperiod = 0;
            }
        }
    } catch (error) {
        console.error('Check account periods error:', error);
    }
};

// ===============================
// STEP 3: บันทึกรายการบัญชี
// ===============================

const handleSaveClick = () => {
    randomNumber.value = Math.floor(Math.random() * 9000) + 1000;
    showSaveConfirmDialog.value = true;
};

const handleSaveConfirm = async () => {
    showSaveConfirmDialog.value = false;
    isSaving.value = true;
    showLoading('กำลังบันทึกรายการบัญชี...');

    try {
        const response = await importJournals(journals.value);

        if (response.data?.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'บันทึกรายการบัญชีเสร็จสิ้น',
                life: 3000
            });

            // Redirect to journal entry list
            setTimeout(() => {
                router.push('/accounting/entry');
            }, 1000);
        } else {
            throw new Error(response.data?.message || 'ไม่สามารถบันทึกได้');
        }
    } catch (error) {
        console.error('Save journals error:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.message || 'ไม่สามารถบันทึกรายการบัญชีได้',
            life: 5000
        });
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

const handleSaveCancel = () => {
    showSaveConfirmDialog.value = false;
};

// ===============================
// Reset & Navigation
// ===============================

const handleReset = () => {
    currentStep.value = 1;
    selectedFile.value = null;
    pdfPassword.value = '';
    showPasswordInput.value = false;
    pdfSource.value = null;
    transactions.value = [];
    journals.value = [];
    statementConfig.value = null;

    // Reset file input
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
};

const handleBack = () => {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
};

// ฟังก์ชันแปลงวันที่เป็น ISO string with timezone +07:00 (ประเทศไทย)
const toISOStringWithTimezone = (date) => {
    if (!date) return null;

    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    // แปลงเป็นเวลาประเทศไทย (UTC+7)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    // Format: YYYY-MM-DDTHH:mm:ss+07:00
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
};
</script>

<template>
    <div class="card">
        <div class="flex items-center justify-between mb-5">
            <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">บันทึกรายการบัญชีจาก Statement</div>
            <div class="flex gap-2">
                <Button v-if="currentStep === 2" label="กำหนดค่าและสร้างรายการบัญชี" icon="pi pi-cog" :disabled="!hasTransactions" @click="openConfigDialog" />
                <Button
                    v-if="currentStep === 3"
                    label="บันทึกรายการบัญชี"
                    icon="pi pi-save"
                    severity="success"
                    :disabled="!hasJournals || isSaving || hasInvalidPeriod"
                    @click="handleSaveClick"
                    v-tooltip.left="hasInvalidPeriod ? 'ต้องแก้ไขรายการที่ไม่ผ่านการตรวจสอบงวดบัญชีก่อน' : ''"
                />
                <Button v-if="currentStep > 1" icon="pi pi-arrow-left" text severity="secondary" @click="handleBack" />
                <Button v-if="currentStep > 1" label="เริ่มใหม่" icon="pi pi-refresh" severity="secondary" @click="handleReset" />
            </div>
        </div>

        <!-- Steps Indicator -->
        <div class="mb-6">
            <Steps :model="[{ label: 'อัพโหลด Statement' }, { label: 'ตรวจสอบรายการ' }, { label: 'บันทึกบัญชี' }]" :activeStep="currentStep - 1" :readonly="true" />
        </div>

        <!-- STEP 1: Upload Statement -->
        <div v-if="currentStep === 1" class="max-w-2xl mx-auto">
            <div class="flex flex-col gap-4">
                <div class="p-8 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg hover:border-primary-500 transition-colors cursor-pointer" @click="triggerFileUpload">
                    <input ref="fileInputRef" type="file" accept="application/pdf" class="hidden" @change="handleFileSelect" />

                    <div class="text-center">
                        <i class="pi pi-cloud-upload text-6xl text-surface-400 mb-4"></i>
                        <p class="text-lg font-medium mb-2">คลิกเพื่อเลือกไฟล์ Statement (PDF)</p>
                        <p class="text-sm text-surface-500">ระบบจะอัพโหลดและอ่านอัตโนมัติทันที</p>
                    </div>
                </div>

                <div v-if="selectedFile" class="flex items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                    <i class="pi pi-file-pdf text-3xl text-red-500"></i>
                    <div class="flex-1">
                        <p class="font-medium">{{ selectedFile.name }}</p>
                        <p class="text-sm text-surface-500">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
                    </div>
                    <Button icon="pi pi-times" severity="danger" text rounded @click="handleReset" />
                </div>

                <div v-if="showPasswordInput" class="flex flex-col gap-3">
                    <Message severity="info">ไฟล์ PDF มีการป้องกันด้วยรหัสผ่าน กรุณากรอกรหัสผ่านแล้วกดอัพโหลดอีกครั้ง</Message>
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">รหัสผ่าน PDF</label>
                        <Password v-model="pdfPassword" placeholder="กรอกรหัสผ่าน" toggleMask :feedback="false" fluid />
                    </div>
                    <Button label="อัพโหลดด้วยรหัสผ่าน" icon="pi pi-upload" :loading="isUploading" :disabled="!pdfPassword || isUploading" @click="handleUpload" />
                </div>
            </div>
        </div>

        <!-- STEP 2: Review Transactions with PDF -->
        <div v-if="currentStep === 2" class="flex flex-col gap-2">
            <Splitter style="height: calc(90vh - 14.8vh)" class="border border-surface-200 dark:border-surface-700 rounded-lg">
                <SplitterPanel :size="50" :minSize="30">
                    <div class="flex flex-col h-full">
                        <div class="px-2 py-1 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                            <span class="text-sm font-semibold">PDF Statement</span>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <PdfViewer v-if="pdfSource" :src="pdfSource" :password="pdfPassword" />
                        </div>
                    </div>
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="30">
                    <div class="flex flex-col h-full">
                        <div class="px-2 py-1 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 flex items-center justify-between">
                            <div class="flex items-center gap-3 text-sm">
                                <span class="font-semibold">{{ transactions.length }} รายการ</span>
                                <span class="text-surface-400">|</span>
                                <span class="text-green-600 font-medium">เข้า {{ formatCurrency(transactionSummary.totalDeposit) }}</span>
                                <span class="text-surface-400">|</span>
                                <span class="text-red-600 font-medium">ออก {{ formatCurrency(transactionSummary.totalWithdraw) }}</span>
                                <span class="text-surface-400">|</span>
                                <span class="font-semibold">คงเหลือ {{ formatCurrency(transactionSummary.lastBalance) }}</span>
                            </div>
                        </div>
                        <div class="flex-1 overflow-auto">
                            <StatementTransactionTable :transactions="transactions" :loading="isUploading" />
                        </div>
                    </div>
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- STEP 3: Review Journals with PDF -->
        <div v-if="currentStep === 3" class="flex flex-col gap-2">
            <Splitter style="height: calc(90vh - 14.8vh)" class="border border-surface-200 dark:border-surface-700 rounded-lg">
                <SplitterPanel :size="50" :minSize="30">
                    <div class="flex flex-col h-full">
                        <div class="px-2 py-1 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                            <span class="text-sm font-semibold">PDF Statement</span>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <PdfViewer v-if="pdfSource" :src="pdfSource" :password="pdfPassword" />
                        </div>
                    </div>
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="30">
                    <div class="flex flex-col h-full">
                        <div class="px-2 py-1 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 flex items-center justify-between">
                            <div class="flex items-center gap-3 text-sm">
                                <span class="font-semibold">{{ journals.length }} รายการ</span>
                                <span class="text-surface-400">|</span>
                                <span class="font-semibold">ยอดรวม {{ formatCurrency(journalTotalAmount) }}</span>
                                <span class="text-surface-400">|</span>
                                <span class="text-surface-500 text-xs">{{ statementConfig?.bookCode }} / {{ statementConfig?.passbookAccount?.accountcode }} / {{ statementConfig?.reversalAccount?.accountcode }}</span>
                            </div>
                        </div>
                        <div class="flex-1 overflow-auto">
                            <StatementJournalTable :journals="journals" :loading="isGenerating" />
                        </div>
                    </div>
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Config Dialog -->
        <StatementConfigDialog :visible="showConfigDialog" :loading="isGenerating" @update:visible="showConfigDialog = $event" @save="handleConfigSave" />

        <!-- Save Confirm Dialog -->
        <DialogApprove
            :confirmDialog="showSaveConfirmDialog"
            :randomNumber="randomNumber"
            :loading="isSaving"
            mode="save"
            title="ยืนยันการบันทึกรายการบัญชี"
            @close="handleSaveCancel"
            @confirmJob="handleSaveConfirm"
            @confirmJobFalse="handleSaveCancel"
        />
    </div>
</template>

<style scoped>
:deep(.p-steps) {
    padding: 1rem 0;
}
</style>
