import apiClient from './client';

/**
 * Get journal entries with pagination, sorting, and filtering
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.sort - Sort field and direction (e.g., 'docdate:-1')
 * @param {string} params.docno - Filter by document number
 * @param {string} params.docdate - Filter by document date
 * @param {string} params.debtorname - Filter by debtor name
 * @param {number} params.accountperiod - Filter by account period
 * @param {string} params.accountdescription - Filter by account description
 * @param {string} params.docformat - Filter by document format
 * @param {string} params.appname - Filter by application name
 * @param {number} params.amount - Filter by amount
 * @param {string} params.createdat - Filter by created date
 * @param {string} params.createdby - Filter by creator
 */
export const getJournalEntries = (params) => {
    return apiClient.get('/gl/journal', { params });
};

/**
 * Get journal entry by ID
 * @param {string} guidfixed - Journal GUID
 */
export const getJournalById = (guidfixed) => {
    return apiClient.get(`/gl/journal/${guidfixed}`);
};

/**
 * Get journal entry by document number
 * @param {string} docno - Document number
 */
export const getJournalByDocno = (docno) => {
    return apiClient.get(`/gl/journal/docno/${docno}`);
};

/**
 * Delete a journal entry
 * @param {string} guidfixed - Journal GUID
 */
export const deleteJournalEntry = (guidfixed) => {
    return apiClient.delete(`/gl/journal/${guidfixed}`);
};

/**
 * Delete journal entries by batch ID (ลบทั้ง batch จาก Statement)
 * @param {string} batchid - Batch ID
 * @returns {Promise} Delete result
 */
export const deleteJournalByBatchId = (batchid) => {
    return apiClient.delete(`/gl/journal/batchid/${batchid}`);
};

/**
 * Get journal books (สมุดรายวัน) with pagination and search
 * @param {Object} params - Query parameters
 * @param {string} params.q - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 */
export const getJournalBooks = (params = {}) => {
    return apiClient.get('/gl/journalbook', { params: { limit: 20, ...params } });
};

/**
 * Get debtors (ลูกหนี้) with pagination and search
 * @param {Object} params - Query parameters
 * @param {string} params.q - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 */
export const getDebtors = (params = {}) => {
    return apiClient.get('/debtaccount/debtor', { params: { limit: 20, ...params } });
};

/**
 * Get creditors (เจ้าหนี้) with pagination and search
 * @param {Object} params - Query parameters
 * @param {string} params.q - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 */
export const getCreditors = (params = {}) => {
    return apiClient.get('/debtaccount/creditor', { params: { limit: 20, ...params } });
};

/**
 * Get chart of accounts with pagination and search
 * @param {Object} params - Query parameters
 * @param {string} params.q - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 */
export const getChartOfAccounts = (params = {}) => {
    return apiClient.get('/gl/chartofaccount', { params: { limit: 20, ...params } });
};

/**
 * Check account period by date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise} - Account period data
 */
export const getAccountPeriodByDate = (date) => {
    return apiClient.get('/gl/accountperiodmaster/by-date', { params: { 'date-list': date } });
};

/**
 * Get document formats (รูปแบบการบันทึกบัญชี) with pagination and search
 * @param {Object} params - Query parameters
 * @param {string} params.q - Search query
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 */
export const getDocumentFormats = (params = {}) => {
    return apiClient.get('/transaction/document-formate', { params: { limit: 20, ...params } });
};

/**
 * Create a new journal entry
 * @param {Object} data - Journal entry data
 */
export const createJournal = (data) => {
    return apiClient.post('/gl/journal', data);
};

/**
 * Update an existing journal entry
 * @param {string} guidfixed - Journal GUID
 * @param {Object} data - Journal entry data
 */
export const updateJournal = (guidfixed, data) => {
    return apiClient.put(`/gl/journal/${guidfixed}`, data);
};

/**
 * Get list of users who are selecting documents
 * @returns {Promise} - List of { docref, username }
 */
export const getDocrefSelected = () => {
    return apiClient.get('/gl/journal/docref/selected');
};

/**
 * Mark a document as selected by current user
 * @param {string} docref - Document reference GUID
 * @returns {Promise}
 */
export const selectDocref = (docref) => {
    return apiClient.post('/gl/journal/docref/select', { docref });
};

/**
 * Deselect a document by current user
 * @param {string} docref - Document reference GUID
 * @returns {Promise}
 */
export const deselectDocref = (docref) => {
    return apiClient.post('/gl/journal/docref/deselect', { docref });
};

/**
 * Bulk import journal entries
 * @param {Array} data - Array of journal entries
 * @returns {Promise} Import result
 */
export const importJournals = (data) => {
    return apiClient.post('/gl/journal/bulk', data);
};
