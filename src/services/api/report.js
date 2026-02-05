import axios from 'axios';
import apiClient from './client';

// Report API ใช้ URL แยกต่างหาก
const REPORT_API_URL = import.meta.env.VITE_APP_API_REPORT || import.meta.env.VITE_APP_API || 'https://api.dev.dedepos.com/';

/**
 * ดึงรายงานภาษีมูลค่าเพิ่ม (ภาษีซื้อ/ภาษีขาย)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {number} params.mode - โหมด (0 = ภาษีซื้อ, 1 = ภาษีขาย)
 * @param {number} params.year - ปี พ.ศ.
 * @param {number} params.period - เดือน (1-12)
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.shopname - ชื่อกิจการ
 * @param {string} params.taxid - เลขประจำตัวผู้เสียภาษี
 * @param {string} params.address - ที่อยู่กิจการ
 * @returns {Promise} ข้อมูลรายงานภาษี
 */
export const getJournalVat = async (params) => {
    try {
        const response = await apiClient.get('/apireport/journalvat', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal VAT report:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับ Report API
 * @param {string} path - เส้นทาง API
 * @returns {string} - URL เต็มรูปแบบ
 */
const createReportApiUrl = (path) => {
    let baseUrl = REPORT_API_URL;
    if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
    }
    if (path.startsWith('/')) {
        path = path.substring(1);
    }
    return `${baseUrl}${path}`;
};

/**
 * สร้างไฟล์ PDF รายงานภาษีซื้อ/ขาย
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ข้อมูลการสร้างไฟล์ (jobId, fileName, checkLink, downloadLink)
 */
export const generateJournalVatPDF = async (params) => {
    try {
        const url = createReportApiUrl('apireport/journalvat/genPDF');
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error generating journal VAT PDF:', error);
        throw error;
    }
};

/**
 * ตรวจสอบสถานะการสร้าง PDF
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise} สถานะการสร้าง PDF
 */
export const checkJournalVatPDFStatus = async (jobId, fileName) => {
    try {
        const url = createReportApiUrl(`apireport/journalvat/check/${jobId}/${fileName}`);
        const response = await axios.get(url, { timeout: 10000 });
        return {
            completed: response.data.success,
            ...response.data
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return { completed: false, message: 'PDF generation in progress (timeout)' };
        }
        console.error('Error checking PDF status:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับดาวน์โหลด PDF
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} URL สำหรับดาวน์โหลด
 */
export const getJournalVatPDFDownloadUrl = (jobId, fileName) => {
    return createReportApiUrl(`apireport/journalvat/download/${jobId}/${fileName}`);
};

/**
 * รอให้ PDF สร้างเสร็จแล้วเปิดในหน้าต่างใหม่
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} maxAttempts - จำนวนครั้งสูงสุดที่จะตรวจสอบ
 * @param {number} interval - ช่วงเวลาระหว่างการตรวจสอบ (ms)
 * @returns {Promise} ผลลัพธ์การดาวน์โหลด
 */
export const waitForPDFAndOpen = (jobId, fileName, maxAttempts = 20, interval = 3000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkJob = async () => {
            if (attempts >= maxAttempts) {
                reject(new Error('ไม่สามารถสร้าง PDF ได้ภายในเวลาที่กำหนด'));
                return;
            }

            attempts++;
            console.log(`Checking PDF status: Attempt ${attempts} of ${maxAttempts}`);

            try {
                const status = await checkJournalVatPDFStatus(jobId, fileName);

                if (status.completed) {
                    const downloadUrl = getJournalVatPDFDownloadUrl(jobId, fileName);
                    window.open(downloadUrl, '_blank');
                    resolve({ success: true, message: 'เปิด PDF สำเร็จ' });
                } else {
                    setTimeout(checkJob, interval);
                }
            } catch (error) {
                if (error.response?.status === 500) {
                    setTimeout(checkJob, interval * 2);
                } else {
                    setTimeout(checkJob, interval);
                }
            }
        };

        checkJob();
    });
};

/**
 * สร้างและเปิด PDF รายงานภาษีซื้อ/ขาย (ฟังก์ชันรวมครบขั้นตอน)
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ผลลัพธ์การสร้างและเปิด PDF
 */
export const generateAndOpenJournalVatPDF = async (params) => {
    try {
        const result = await generateJournalVatPDF(params);

        if (result.success) {
            const { jobId, fileName } = result.data;
            return await waitForPDFAndOpen(jobId, fileName);
        } else {
            return {
                success: false,
                message: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้'
            };
        }
    } catch (error) {
        console.error('Error in generate and open PDF:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูลรายละเอียดบันทึกบัญชีจากเลขที่เอกสาร
 * @param {string} docno - เลขที่เอกสาร
 * @returns {Promise} ข้อมูลรายละเอียดบันทึกบัญชี
 */
export const getJournalDetail = async (docno) => {
    try {
        const response = await apiClient.get(`/gl/journal/docno/${docno}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        throw error;
    }
};

/**
 * ดึงรายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / ภ.ง.ด.53)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {number} params.taxtype - ประเภทภาษี (1 = ภาษีหัก ณ ที่จ่าย)
 * @param {number} params.custtype - ประเภทลูกค้า (0 = บุคคลธรรมดา ภ.ง.ด.3, 1 = นิติบุคคล ภ.ง.ด.53)
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.shopname - ชื่อกิจการ
 * @param {string} params.taxid - เลขประจำตัวผู้เสียภาษี
 * @param {string} params.address - ที่อยู่กิจการ
 * @returns {Promise} ข้อมูลรายงานภาษีหัก ณ ที่จ่าย
 */
export const getJournalTax = async (params) => {
    try {
        const response = await apiClient.get('/apireport/journaltax', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal tax report:', error);
        throw error;
    }
};

/**
 * สร้างไฟล์ PDF รายงานภาษีหัก ณ ที่จ่าย
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ข้อมูลการสร้างไฟล์ (jobId, fileName, checkLink, downloadLink)
 */
export const generateJournalTaxPDF = async (params) => {
    try {
        const url = createReportApiUrl('apireport/journaltax/genPDF');
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error generating journal tax PDF:', error);
        throw error;
    }
};

/**
 * ตรวจสอบสถานะการสร้าง PDF ภาษีหัก ณ ที่จ่าย
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise} สถานะการสร้าง PDF
 */
export const checkJournalTaxPDFStatus = async (jobId, fileName) => {
    try {
        const url = createReportApiUrl(`apireport/journaltax/check/${jobId}/${fileName}`);
        const response = await axios.get(url, { timeout: 10000 });
        return {
            completed: response.data.success,
            ...response.data
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return { completed: false, message: 'PDF generation in progress (timeout)' };
        }
        console.error('Error checking PDF status:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับดาวน์โหลด PDF ภาษีหัก ณ ที่จ่าย
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} URL สำหรับดาวน์โหลด
 */
export const getJournalTaxPDFDownloadUrl = (jobId, fileName) => {
    return createReportApiUrl(`apireport/journaltax/download/${jobId}/${fileName}`);
};

/**
 * รอให้ PDF ภาษีหัก ณ ที่จ่าย สร้างเสร็จแล้วเปิดในหน้าต่างใหม่
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} maxAttempts - จำนวนครั้งสูงสุดที่จะตรวจสอบ
 * @param {number} interval - ช่วงเวลาระหว่างการตรวจสอบ (ms)
 * @returns {Promise} ผลลัพธ์การดาวน์โหลด
 */
export const waitForTaxPDFAndOpen = (jobId, fileName, maxAttempts = 20, interval = 3000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkJob = async () => {
            if (attempts >= maxAttempts) {
                reject(new Error('ไม่สามารถสร้าง PDF ได้ภายในเวลาที่กำหนด'));
                return;
            }

            attempts++;
            console.log(`Checking Tax PDF status: Attempt ${attempts} of ${maxAttempts}`);

            try {
                const status = await checkJournalTaxPDFStatus(jobId, fileName);

                if (status.completed) {
                    const downloadUrl = getJournalTaxPDFDownloadUrl(jobId, fileName);
                    window.open(downloadUrl, '_blank');
                    resolve({ success: true, message: 'เปิด PDF สำเร็จ' });
                } else {
                    setTimeout(checkJob, interval);
                }
            } catch (error) {
                if (error.response?.status === 500) {
                    setTimeout(checkJob, interval * 2);
                } else {
                    setTimeout(checkJob, interval);
                }
            }
        };

        checkJob();
    });
};

/**
 * สร้างและเปิด PDF รายงานภาษีหัก ณ ที่จ่าย (ฟังก์ชันรวมครบขั้นตอน)
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ผลลัพธ์การสร้างและเปิด PDF
 */
export const generateAndOpenJournalTaxPDF = async (params) => {
    try {
        const result = await generateJournalTaxPDF(params);

        if (result.success) {
            const { jobId, fileName } = result.data;
            return await waitForTaxPDFAndOpen(jobId, fileName);
        } else {
            return {
                success: false,
                message: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้'
            };
        }
    } catch (error) {
        console.error('Error in generate and open Tax PDF:', error);
        throw error;
    }
};

// ============================================================================
// Withheld Tax Report (ภาษีถูกหัก ณ ที่จ่าย) - journaltaxdeduct
// ============================================================================

/**
 * ดึงรายงานภาษีถูกหัก ณ ที่จ่าย
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {number} params.taxtype - ประเภทภาษี (0 = ภาษีถูกหัก ณ ที่จ่าย)
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.shopname - ชื่อกิจการ
 * @param {string} params.taxid - เลขประจำตัวผู้เสียภาษี
 * @param {string} params.address - ที่อยู่กิจการ
 * @returns {Promise} ข้อมูลรายงานภาษีถูกหัก ณ ที่จ่าย
 */
export const getJournalTaxDeduct = async (params) => {
    try {
        const response = await apiClient.get('/apireport/journaltaxdeduct', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal tax deduct report:', error);
        throw error;
    }
};

/**
 * สร้างไฟล์ PDF รายงานภาษีถูกหัก ณ ที่จ่าย
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ข้อมูลการสร้างไฟล์ (jobId, fileName, checkLink, downloadLink)
 */
export const generateJournalTaxDeductPDF = async (params) => {
    try {
        const url = createReportApiUrl('apireport/journaltaxdeduct/genPDF');
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error generating journal tax deduct PDF:', error);
        throw error;
    }
};

/**
 * ตรวจสอบสถานะการสร้าง PDF ภาษีถูกหัก ณ ที่จ่าย
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise} สถานะการสร้าง PDF
 */
export const checkJournalTaxDeductPDFStatus = async (jobId, fileName) => {
    try {
        const url = createReportApiUrl(`apireport/journaltaxdeduct/check/${jobId}/${fileName}`);
        const response = await axios.get(url, { timeout: 10000 });
        return {
            completed: response.data.success,
            ...response.data
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return { completed: false, message: 'PDF generation in progress (timeout)' };
        }
        console.error('Error checking PDF status:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับดาวน์โหลด PDF ภาษีถูกหัก ณ ที่จ่าย
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} URL สำหรับดาวน์โหลด
 */
export const getJournalTaxDeductPDFDownloadUrl = (jobId, fileName) => {
    return createReportApiUrl(`apireport/journaltaxdeduct/download/${jobId}/${fileName}`);
};

/**
 * รอให้ PDF ภาษีถูกหัก ณ ที่จ่าย สร้างเสร็จแล้วเปิดในหน้าต่างใหม่
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} maxAttempts - จำนวนครั้งสูงสุดที่จะตรวจสอบ
 * @param {number} interval - ช่วงเวลาระหว่างการตรวจสอบ (ms)
 * @returns {Promise} ผลลัพธ์การดาวน์โหลด
 */
export const waitForTaxDeductPDFAndOpen = (jobId, fileName, maxAttempts = 20, interval = 3000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkJob = async () => {
            if (attempts >= maxAttempts) {
                reject(new Error('ไม่สามารถสร้าง PDF ได้ภายในเวลาที่กำหนด'));
                return;
            }

            attempts++;
            console.log(`Checking Tax Deduct PDF status: Attempt ${attempts} of ${maxAttempts}`);

            try {
                const status = await checkJournalTaxDeductPDFStatus(jobId, fileName);

                if (status.completed) {
                    const downloadUrl = getJournalTaxDeductPDFDownloadUrl(jobId, fileName);
                    window.open(downloadUrl, '_blank');
                    resolve({ success: true, message: 'เปิด PDF สำเร็จ' });
                } else {
                    setTimeout(checkJob, interval);
                }
            } catch (error) {
                if (error.response?.status === 500) {
                    setTimeout(checkJob, interval * 2);
                } else {
                    setTimeout(checkJob, interval);
                }
            }
        };

        checkJob();
    });
};

/**
 * สร้างและเปิด PDF รายงานภาษีถูกหัก ณ ที่จ่าย (ฟังก์ชันรวมครบขั้นตอน)
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ผลลัพธ์การสร้างและเปิด PDF
 */
export const generateAndOpenJournalTaxDeductPDF = async (params) => {
    try {
        const result = await generateJournalTaxDeductPDF(params);

        if (result.success) {
            const { jobId, fileName } = result.data;
            return await waitForTaxDeductPDFAndOpen(jobId, fileName);
        } else {
            return {
                success: false,
                message: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้'
            };
        }
    } catch (error) {
        console.error('Error in generate and open Tax Deduct PDF:', error);
        throw error;
    }
};

// ============================================================================
// Trial Balance Sheet Report (งบทดลอง)
// ============================================================================

/**
 * ดึงรายงานงบทดลอง (Trial Balance Sheet)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {string} params.startdate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} params.enddate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {number} params.ica - รวมรายการปิดบัญชีสิ้นปี (0 = ไม่รวม, 1 = รวม)
 * @returns {Promise} ข้อมูลรายงานงบทดลอง
 */
export const getTrialBalanceSheet = async (params) => {
    try {
        const response = await apiClient.get('/gl/report/trialbalancesheet', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching trial balance sheet report:', error);
        throw error;
    }
};

/**
 * ดึงรายงานบัญชีแยกประเภท (Ledger Account)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {string} params.startdate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} params.enddate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} params.accountcode - รหัสบัญชี (format: startcode:endcode)
 * @returns {Promise} ข้อมูลรายงานบัญชีแยกประเภท
 */
export const getLedgerAccount = async (params) => {
    try {
        const response = await apiClient.get('/gl/report/ledgeraccount', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching ledger account report:', error);
        throw error;
    }
};

/**
 * ดึงข้อมูล journal จาก docno (สำหรับแสดงใน dialog)
 * @param {string} docno - เลขที่เอกสาร
 * @returns {Promise} ข้อมูล journal
 */
export const getJournalByDocNo = async (docno) => {
    try {
        const response = await apiClient.get(`/gl/journal/docno/${docno}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching journal by docno:', error);
        throw error;
    }
};

/**
 * ดึงรายงานงบกำไรขาดทุน (Profit and Loss / Income Statement)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {string} params.startdate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} params.enddate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @returns {Promise} ข้อมูลรายงานงบกำไรขาดทุน
 */
export const getProfitAndLoss = async (params) => {
    try {
        const response = await apiClient.get('/gl/report/profitandloss', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching profit and loss report:', error);
        throw error;
    }
};

/**
 * ดึงรายงานงบกำไรขาดทุน 12 เดือน
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {string} params.endDate - วันที่สิ้นสุด (YYYY-MM-DD HH:mm:ss)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.shopname - ชื่อกิจการ
 * @param {string} params.taxid - เลขประจำตัวผู้เสียภาษี
 * @param {string} params.address - ที่อยู่กิจการ
 * @returns {Promise} ข้อมูลรายงานงบกำไรขาดทุน 12 เดือน
 */
export const getJournal12Columns = async (params) => {
    try {
        const response = await apiClient.get('/apireport/journal12columns/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching journal 12 columns report:', error);
        throw error;
    }
};

/**
 * ดึงรายงานงบแสดงฐานะการเงิน (Balance Sheet)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {string} params.enddate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} params.accountgroup - กลุ่มบัญชี (optional)
 * @param {number} params.ica - ICA flag (default: 0)
 * @returns {Promise} ข้อมูลรายงานงบแสดงฐานะการเงิน
 */
export const getBalanceSheet = async (params) => {
    try {
        const response = await apiClient.get('/gl/report/balancesheet', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching balance sheet report:', error);
        throw error;
    }
};

// ============================================================================
// Accounts Payable Report (รายงานสถานะเจ้าหนี้)
// ============================================================================

/**
 * ดึงรายงานสถานะเจ้าหนี้ (Accounts Payable)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.accountcode - รหัสบัญชี
 * @param {string} params.custcode - รหัสเจ้าหนี้ (optional)
 * @returns {Promise} ข้อมูลรายงานสถานะเจ้าหนี้
 */
export const getAccountsPayable = async (params) => {
    try {
        const response = await apiClient.get('/apireport/accounts_payable/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching accounts payable report:', error);
        throw error;
    }
};

/**
 * สร้างไฟล์ PDF รายงานสถานะเจ้าหนี้
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ข้อมูลการสร้างไฟล์ (jobId, fileName, checkLink, downloadLink)
 */
export const generateAccountsPayablePDF = async (params) => {
    try {
        const url = createReportApiUrl('apireport/accounts_payable/genPDF');
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error generating accounts payable PDF:', error);
        throw error;
    }
};

/**
 * ตรวจสอบสถานะการสร้าง PDF สถานะเจ้าหนี้
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise} สถานะการสร้าง PDF
 */
export const checkAccountsPayablePDFStatus = async (jobId, fileName) => {
    try {
        const url = createReportApiUrl(`apireport/accounts_payable/check/${jobId}/${fileName}`);
        const response = await axios.get(url, { timeout: 10000 });
        return {
            completed: response.data.success,
            ...response.data
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return { completed: false, message: 'PDF generation in progress (timeout)' };
        }
        console.error('Error checking PDF status:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับดาวน์โหลด PDF สถานะเจ้าหนี้
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} URL สำหรับดาวน์โหลด
 */
export const getAccountsPayablePDFDownloadUrl = (jobId, fileName) => {
    return createReportApiUrl(`apireport/accounts_payable/download/${jobId}/${fileName}`);
};

/**
 * รอให้ PDF สถานะเจ้าหนี้ สร้างเสร็จแล้วเปิดในหน้าต่างใหม่
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} maxAttempts - จำนวนครั้งสูงสุดที่จะตรวจสอบ
 * @param {number} interval - ช่วงเวลาระหว่างการตรวจสอบ (ms)
 * @returns {Promise} ผลลัพธ์การดาวน์โหลด
 */
export const waitForAccountsPayablePDFAndOpen = (jobId, fileName, maxAttempts = 20, interval = 3000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkJob = async () => {
            if (attempts >= maxAttempts) {
                reject(new Error('ไม่สามารถสร้าง PDF ได้ภายในเวลาที่กำหนด'));
                return;
            }

            attempts++;
            console.log(`Checking Accounts Payable PDF status: Attempt ${attempts} of ${maxAttempts}`);

            try {
                const status = await checkAccountsPayablePDFStatus(jobId, fileName);

                if (status.completed) {
                    const downloadUrl = getAccountsPayablePDFDownloadUrl(jobId, fileName);
                    window.open(downloadUrl, '_blank');
                    resolve({ success: true, message: 'เปิด PDF สำเร็จ' });
                } else {
                    setTimeout(checkJob, interval);
                }
            } catch (error) {
                if (error.response?.status === 500) {
                    setTimeout(checkJob, interval * 2);
                } else {
                    setTimeout(checkJob, interval);
                }
            }
        };

        checkJob();
    });
};

/**
 * สร้างและเปิด PDF รายงานสถานะเจ้าหนี้ (ฟังก์ชันรวมครบขั้นตอน)
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ผลลัพธ์การสร้างและเปิด PDF
 */
export const generateAndOpenAccountsPayablePDF = async (params) => {
    try {
        const result = await generateAccountsPayablePDF(params);

        if (result.success) {
            const { jobId, fileName } = result.data;
            return await waitForAccountsPayablePDFAndOpen(jobId, fileName);
        } else {
            return {
                success: false,
                message: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้'
            };
        }
    } catch (error) {
        console.error('Error in generate and open Accounts Payable PDF:', error);
        throw error;
    }
};

// ============================================================================
// Accounts Receivable Report (รายงานสถานะลูกหนี้)
// ============================================================================

/**
 * ดึงรายงานสถานะลูกหนี้ (Accounts Receivable)
 * @param {object} params - พารามิเตอร์สำหรับรายงาน
 * @param {number} params.limit - จำนวนรายการต่อหน้า
 * @param {number} params.offset - ตำแหน่งเริ่มต้น
 * @param {string} params.fromdate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} params.todate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} params.shopid - รหัสกิจการ
 * @param {string} params.accountcode - รหัสบัญชี
 * @param {string} params.custcode - รหัสลูกหนี้ (optional)
 * @returns {Promise} ข้อมูลรายงานสถานะลูกหนี้
 */
export const getAccountsReceivable = async (params) => {
    try {
        const response = await apiClient.get('/apireport/accounts_receivable/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching accounts receivable report:', error);
        throw error;
    }
};

/**
 * สร้างไฟล์ PDF รายงานสถานะลูกหนี้
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ข้อมูลการสร้างไฟล์ (jobId, fileName, checkLink, downloadLink)
 */
export const generateAccountsReceivablePDF = async (params) => {
    try {
        const url = createReportApiUrl('apireport/accounts_receivable/genPDF');
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error generating accounts receivable PDF:', error);
        throw error;
    }
};

/**
 * ตรวจสอบสถานะการสร้าง PDF สถานะลูกหนี้
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise} สถานะการสร้าง PDF
 */
export const checkAccountsReceivablePDFStatus = async (jobId, fileName) => {
    try {
        const url = createReportApiUrl(`apireport/accounts_receivable/check/${jobId}/${fileName}`);
        const response = await axios.get(url, { timeout: 10000 });
        return {
            completed: response.data.success,
            ...response.data
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return { completed: false, message: 'PDF generation in progress (timeout)' };
        }
        console.error('Error checking PDF status:', error);
        throw error;
    }
};

/**
 * สร้าง URL สำหรับดาวน์โหลด PDF สถานะลูกหนี้
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} URL สำหรับดาวน์โหลด
 */
export const getAccountsReceivablePDFDownloadUrl = (jobId, fileName) => {
    return createReportApiUrl(`apireport/accounts_receivable/download/${jobId}/${fileName}`);
};

/**
 * รอให้ PDF สถานะลูกหนี้ สร้างเสร็จแล้วเปิดในหน้าต่างใหม่
 * @param {string} jobId - รหัสงาน
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} maxAttempts - จำนวนครั้งสูงสุดที่จะตรวจสอบ
 * @param {number} interval - ช่วงเวลาระหว่างการตรวจสอบ (ms)
 * @returns {Promise} ผลลัพธ์การดาวน์โหลด
 */
export const waitForAccountsReceivablePDFAndOpen = (jobId, fileName, maxAttempts = 20, interval = 3000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkJob = async () => {
            if (attempts >= maxAttempts) {
                reject(new Error('ไม่สามารถสร้าง PDF ได้ภายในเวลาที่กำหนด'));
                return;
            }

            attempts++;
            console.log(`Checking Accounts Receivable PDF status: Attempt ${attempts} of ${maxAttempts}`);

            try {
                const status = await checkAccountsReceivablePDFStatus(jobId, fileName);

                if (status.completed) {
                    const downloadUrl = getAccountsReceivablePDFDownloadUrl(jobId, fileName);
                    window.open(downloadUrl, '_blank');
                    resolve({ success: true, message: 'เปิด PDF สำเร็จ' });
                } else {
                    setTimeout(checkJob, interval);
                }
            } catch (error) {
                if (error.response?.status === 500) {
                    setTimeout(checkJob, interval * 2);
                } else {
                    setTimeout(checkJob, interval);
                }
            }
        };

        checkJob();
    });
};

/**
 * สร้างและเปิด PDF รายงานสถานะลูกหนี้ (ฟังก์ชันรวมครบขั้นตอน)
 * @param {object} params - พารามิเตอร์สำหรับสร้าง PDF
 * @returns {Promise} ผลลัพธ์การสร้างและเปิด PDF
 */
export const generateAndOpenAccountsReceivablePDF = async (params) => {
    try {
        const result = await generateAccountsReceivablePDF(params);

        if (result.success) {
            const { jobId, fileName } = result.data;
            return await waitForAccountsReceivablePDFAndOpen(jobId, fileName);
        } else {
            return {
                success: false,
                message: result.message || 'ไม่สามารถสร้างไฟล์ PDF ได้'
            };
        }
    } catch (error) {
        console.error('Error in generate and open Accounts Receivable PDF:', error);
        throw error;
    }
};
