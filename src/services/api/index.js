// Export all API modules
import * as authAPI from './auth';
import * as dashboardAPI from './dashboard';
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
    generateTaskId: taskAPI.generateTaskId
};

// Also export modules separately for selective imports
export { authAPI, dashboardAPI, taskAPI };
