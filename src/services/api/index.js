// Export all API modules
import * as accountperiodAPI from './accountperiod';
import * as authAPI from './auth';
import * as chartofaccountAPI from './chartofaccount';
import * as creditorAPI from './creditor';
import * as dashboardAPI from './dashboard';
import * as debtorAPI from './debtor';
import * as journalbookAPI from './journalbook';
import * as masterexpenseAPI from './masterexpense';
import * as masterincomeAPI from './masterincome';
import * as reportAPI from './report';
import * as shopAPI from './shop';
import * as shopuserAPI from './shopuser';
import * as taskAPI from './task';

// Re-export as default object for backward compatibility
export default {
    // Auth APIs
    login: authAPI.login,
    logout: authAPI.logout,
    loginWithGoogle: authAPI.loginWithGoogle,
    listShop: authAPI.listShop,
    selectShop: authAPI.selectShop,
    favoriteShop: authAPI.favoriteShop,
    createShop: authAPI.createShop,

    // Dashboard APIs
    getChartOfAccount: dashboardAPI.getChartOfAccount,
    getJournals: dashboardAPI.getJournals,
    getDocumentImages: dashboardAPI.getDocumentImages,
    getDuplicateDocNos: dashboardAPI.getDuplicateDocNos,

    // Task APIs
    getTasks: taskAPI.getTasks,
    createTask: taskAPI.createTask,
    updateTask: taskAPI.updateTask,
    updateTaskStatus: taskAPI.updateTaskStatus,
    deleteTask: taskAPI.deleteTask,
    generateTaskId: taskAPI.generateTaskId,

    // Shop APIs
    getShop: shopAPI.getShop,
    updateShop: shopAPI.updateShop,

    // Chart of Account APIs
    getChartOfAccounts: chartofaccountAPI.getChartOfAccounts,
    getChartOfAccountById: chartofaccountAPI.getChartOfAccount,
    createChartOfAccount: chartofaccountAPI.createChartOfAccount,
    updateChartOfAccount: chartofaccountAPI.updateChartOfAccount,
    deleteChartOfAccount: chartofaccountAPI.deleteChartOfAccount,

    // Journal Book APIs
    getJournalBooks: journalbookAPI.getJournalBooks,
    getJournalBookById: journalbookAPI.getJournalBook,
    createJournalBook: journalbookAPI.createJournalBook,
    updateJournalBook: journalbookAPI.updateJournalBook,
    deleteJournalBook: journalbookAPI.deleteJournalBook,

    // Debtor APIs
    getDebtors: debtorAPI.getDebtors,
    getDebtorById: debtorAPI.getDebtor,
    createDebtor: debtorAPI.createDebtor,
    updateDebtor: debtorAPI.updateDebtor,
    deleteDebtor: debtorAPI.deleteDebtor,

    // Creditor APIs
    getCreditors: creditorAPI.getCreditors,
    getCreditorById: creditorAPI.getCreditor,
    createCreditor: creditorAPI.createCreditor,
    updateCreditor: creditorAPI.updateCreditor,
    deleteCreditor: creditorAPI.deleteCreditor,

    // Account Period APIs
    getAccountPeriods: accountperiodAPI.getAccountPeriods,
    getAccountPeriodById: accountperiodAPI.getAccountPeriod,
    getAccountPeriodByDate: accountperiodAPI.getAccountPeriodByDate,
    createAccountPeriod: accountperiodAPI.createAccountPeriod,
    createAccountPeriodBulk: accountperiodAPI.createAccountPeriodBulk,
    updateAccountPeriod: accountperiodAPI.updateAccountPeriod,
    deleteAccountPeriod: accountperiodAPI.deleteAccountPeriod,
    deleteAccountPeriodBulk: accountperiodAPI.deleteAccountPeriodBulk,

    // Master Income APIs (รายได้อื่น ๆ)
    getMasterIncomes: masterincomeAPI.getMasterIncomes,
    getMasterIncomeById: masterincomeAPI.getMasterIncome,
    createMasterIncome: masterincomeAPI.createMasterIncome,
    updateMasterIncome: masterincomeAPI.updateMasterIncome,
    deleteMasterIncome: masterincomeAPI.deleteMasterIncome,

    // Master Expense APIs (ค่าใช้จ่ายอื่น ๆ)
    getMasterExpenses: masterexpenseAPI.getMasterExpenses,
    getMasterExpenseById: masterexpenseAPI.getMasterExpense,
    createMasterExpense: masterexpenseAPI.createMasterExpense,
    updateMasterExpense: masterexpenseAPI.updateMasterExpense,
    deleteMasterExpense: masterexpenseAPI.deleteMasterExpense,

    // Shop User APIs (ผู้ใช้งานในระบบ)
    getShopUsers: shopuserAPI.getShopUsers,
    saveShopUserPermission: shopuserAPI.saveShopUserPermission,
    deleteShopUser: shopuserAPI.deleteShopUser,

    // Report APIs (รายงาน)
    getJournalVat: reportAPI.getJournalVat,
    getJournalDetail: reportAPI.getJournalDetail
};

// Also export modules separately for selective imports
export { accountperiodAPI, authAPI, chartofaccountAPI, creditorAPI, dashboardAPI, debtorAPI, journalbookAPI, masterexpenseAPI, masterincomeAPI, shopAPI, shopuserAPI, taskAPI };
