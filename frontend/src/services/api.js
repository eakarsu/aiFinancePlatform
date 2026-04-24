import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (email, password, totpCode) => api.post('/auth/login', { email, password, totpCode });
export const demoLogin = () => api.post('/auth/demo-login');
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, newPassword) => api.post('/auth/reset-password', { token, newPassword });

// 2FA
export const setup2FA = () => api.post('/auth/2fa/setup');
export const verify2FA = (code) => api.post('/auth/2fa/verify', { code });
export const disable2FA = (password) => api.post('/auth/2fa/disable', { password });

// Robo-Advisor
export const getRiskProfile = () => api.get('/robo-advisor/risk-profile');
export const saveRiskProfile = (data) => api.post('/robo-advisor/risk-profile', data);
export const getPortfolioRecommendation = (investmentAmount) =>
  api.post('/robo-advisor/recommend-portfolio', { investmentAmount });
export const getPortfolios = (params) => api.get('/robo-advisor/portfolios', { params });
export const createPortfolio = (data) => api.post('/robo-advisor/portfolios', data);
export const rebalancePortfolio = (id) => api.post(`/robo-advisor/portfolios/${id}/rebalance`);
export const bulkDeletePortfolios = (ids) => api.post('/robo-advisor/portfolios/bulk-delete', { ids });
export const exportPortfolios = (format) => api.get('/robo-advisor/portfolios/export', { params: { format } });

// Credit Scoring
export const getCreditProfile = () => api.get('/credit-scoring/profile');
export const saveCreditProfile = (data) => api.post('/credit-scoring/profile', data);
export const addCreditHistory = (data) => api.post('/credit-scoring/history', data);
export const calculateCreditScore = () => api.post('/credit-scoring/calculate-score');
export const getCreditScoreHistory = () => api.get('/credit-scoring/score-history');
export const aiAnalyzeCredit = () => api.post('/credit-scoring/ai-analyze');
export const getCreditHistories = (params) => api.get('/credit-scoring/history', { params });
export const exportCreditHistory = (format) => api.get('/credit-scoring/history/export', { params: { format } });

// Fraud Detection
export const getTransactions = (params) => api.get('/fraud-detection/transactions', { params });
export const addTransaction = (data) => api.post('/fraud-detection/transactions', data);
export const updateTransaction = (id, data) => api.patch(`/fraud-detection/transactions/${id}`, data);
export const deleteTransaction = (id) => api.delete(`/fraud-detection/transactions/${id}`);
export const analyzeTransaction = (transactionId) => api.post('/fraud-detection/analyze', { transactionId });
export const analyzeBatch = () => api.post('/fraud-detection/analyze-batch');
export const analyzeRules = () => api.post('/fraud-detection/analyze-rules');
export const getFraudAlerts = (status) => api.get('/fraud-detection/alerts', { params: { status } });
export const updateAlert = (id, data) => api.patch(`/fraud-detection/alerts/${id}`, data);
export const getFraudStats = () => api.get('/fraud-detection/stats');
export const monitorTransaction = (data) => api.post('/fraud-detection/monitor', data);
export const bulkDeleteTransactions = (ids) => api.post('/fraud-detection/transactions/bulk-delete', { ids });
export const exportTransactions = (format) => api.get('/fraud-detection/transactions/export', { params: { format } });

// Alerts/Notifications (AI-enhanced)
export const getNotifications = (params) => api.get('/alerts', { params });
export const getNotificationCount = () => api.get('/alerts/count');
export const getGroupedNotifications = () => api.get('/alerts/grouped');
export const markNotificationRead = (id) => api.patch(`/alerts/${id}/read`);
export const markAllNotificationsRead = (category) => api.patch('/alerts/read-all', { category });
export const dismissNotification = (id) => api.patch(`/alerts/${id}/dismiss`);
export const dismissAllNotifications = (params) => api.patch('/alerts/dismiss-all', params);
export const getNotificationStats = (days) => api.get('/alerts/stats', { params: { days } });
export const getNotificationPreferences = () => api.get('/alerts/preferences');
export const updateNotificationPreferences = (preferences) => api.put('/alerts/preferences', preferences);
export const getAIAlertSummary = () => api.post('/alerts/ai-summary');
export const exportNotifications = (format) => api.get('/alerts/export', { params: { format } });

// User Profile & Settings
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword });
export const deleteAccount = () => api.delete('/auth/account');
export const exportUserData = () => api.get('/auth/export-data');

// Transaction Import (AI-enhanced)
export const importCSV = (csvContent, mapping, skipDuplicates) =>
  api.post('/transaction-import/csv', { csvContent, mapping, skipDuplicates });
export const analyzeTransactions = () => api.post('/transaction-import/analyze');
export const getImportHistory = (params) => api.get('/transaction-import/history', { params });
export const getImportDetails = (id) => api.get(`/transaction-import/history/${id}`);
export const getCSVTemplate = () => api.get('/transaction-import/csv/template');
export const createPlaidLinkToken = () => api.post('/transaction-import/plaid/link-token');
export const exchangePlaidToken = (data) => api.post('/transaction-import/plaid/exchange-token', data);
export const getPlaidAccounts = () => api.get('/transaction-import/plaid/accounts');
export const syncPlaidTransactions = (connectionId) => api.post('/transaction-import/plaid/sync', { connectionId });
export const disconnectPlaid = (connectionId) => api.delete(`/transaction-import/plaid/${connectionId}`);
export const bulkDeleteImports = (ids) => api.post('/transaction-import/history/bulk-delete', { ids });
export const exportImportHistory = (format) => api.get('/transaction-import/history/export', { params: { format } });

// Risk Assessment (AI-enhanced)
export const getRiskQuestionnaire = () => api.get('/risk-assessment/questionnaire');
export const saveRiskQuestionnaire = (data) => api.post('/risk-assessment/questionnaire', data);
export const calculateRiskFromAnswers = (data) => api.post('/risk-assessment/calculate', data);
export const getFullRiskAssessment = () => api.get('/risk-assessment/assessment');
export const getRiskQuestions = () => api.get('/risk-assessment/questions');
export const aiAnalyzeRisk = () => api.post('/risk-assessment/ai-analyze');
export const exportRiskAssessment = (format) => api.get('/risk-assessment/export', { params: { format } });

// Stock Screener
export const getStocks = (params) => api.get('/stock-screener', { params });
export const getStock = (id) => api.get(`/stock-screener/${id}`);
export const addStock = (data) => api.post('/stock-screener', data);
export const updateStock = (id, data) => api.patch(`/stock-screener/${id}`, data);
export const deleteStock = (id) => api.delete(`/stock-screener/${id}`);
export const analyzeStock = (id) => api.post(`/stock-screener/${id}/analyze`);
export const analyzeAllStocks = () => api.post('/stock-screener/analyze-all');
export const toggleWatchlist = (id) => api.patch(`/stock-screener/${id}/watchlist`);
export const bulkDeleteStocks = (ids) => api.post('/stock-screener/bulk-delete', { ids });
export const exportStocks = (format) => api.get('/stock-screener/export', { params: { format } });

// Crypto Analyzer
export const getCryptos = (params) => api.get('/crypto-analyzer', { params });
export const getCrypto = (id) => api.get(`/crypto-analyzer/${id}`);
export const addCrypto = (data) => api.post('/crypto-analyzer', data);
export const updateCrypto = (id, data) => api.patch(`/crypto-analyzer/${id}`, data);
export const deleteCrypto = (id) => api.delete(`/crypto-analyzer/${id}`);
export const analyzeCrypto = (id) => api.post(`/crypto-analyzer/${id}/analyze`);
export const analyzeAllCryptos = () => api.post('/crypto-analyzer/analyze-all');
export const toggleCryptoTracking = (id) => api.patch(`/crypto-analyzer/${id}/track`);
export const bulkDeleteCryptos = (ids) => api.post('/crypto-analyzer/bulk-delete', { ids });
export const exportCryptos = (format) => api.get('/crypto-analyzer/export', { params: { format } });

// Loan Advisor
export const getLoans = (params) => api.get('/loan-advisor', { params });
export const getLoan = (id) => api.get(`/loan-advisor/${id}`);
export const addLoan = (data) => api.post('/loan-advisor', data);
export const updateLoan = (id, data) => api.patch(`/loan-advisor/${id}`, data);
export const deleteLoan = (id) => api.delete(`/loan-advisor/${id}`);
export const analyzeLoan = (id) => api.post(`/loan-advisor/${id}/analyze`);
export const calculateLoanPayment = (data) => api.post('/loan-advisor/calculate', data);
export const bulkDeleteLoans = (ids) => api.post('/loan-advisor/bulk-delete', { ids });
export const exportLoans = (format) => api.get('/loan-advisor/export', { params: { format } });

// Insurance Optimizer
export const getInsurancePolicies = (params) => api.get('/insurance-optimizer', { params });
export const getInsurancePolicy = (id) => api.get(`/insurance-optimizer/${id}`);
export const addInsurancePolicy = (data) => api.post('/insurance-optimizer', data);
export const updateInsurancePolicy = (id, data) => api.patch(`/insurance-optimizer/${id}`, data);
export const deleteInsurancePolicy = (id) => api.delete(`/insurance-optimizer/${id}`);
export const analyzeInsurancePolicy = (id) => api.post(`/insurance-optimizer/${id}/analyze`);
export const optimizeInsurancePortfolio = () => api.post('/insurance-optimizer/optimize');
export const bulkDeleteInsurance = (ids) => api.post('/insurance-optimizer/bulk-delete', { ids });
export const exportInsurance = (format) => api.get('/insurance-optimizer/export', { params: { format } });

// Retirement Planner
export const getRetirementPlans = (params) => api.get('/retirement-planner', { params });
export const getRetirementPlan = (id) => api.get(`/retirement-planner/${id}`);
export const addRetirementPlan = (data) => api.post('/retirement-planner', data);
export const updateRetirementPlan = (id, data) => api.patch(`/retirement-planner/${id}`, data);
export const deleteRetirementPlan = (id) => api.delete(`/retirement-planner/${id}`);
export const analyzeRetirementPlan = (id) => api.post(`/retirement-planner/${id}/analyze`);
export const calculateRetirementProjection = (data) => api.post('/retirement-planner/calculate', data);
export const bulkDeleteRetirementPlans = (ids) => api.post('/retirement-planner/bulk-delete', { ids });
export const exportRetirementPlans = (format) => api.get('/retirement-planner/export', { params: { format } });

// Budget Coach
export const getBudgetPlans = (params) => api.get('/budget-coach/plans', { params });
export const getBudgetPlan = (id) => api.get(`/budget-coach/plans/${id}`);
export const addBudgetPlan = (data) => api.post('/budget-coach/plans', data);
export const updateBudgetPlan = (id, data) => api.patch(`/budget-coach/plans/${id}`, data);
export const deleteBudgetPlan = (id) => api.delete(`/budget-coach/plans/${id}`);
export const analyzeBudgetPlan = (id) => api.post(`/budget-coach/plans/${id}/analyze`);
export const getExpenses = (params) => api.get('/budget-coach/expenses', { params });
export const getExpense = (id) => api.get(`/budget-coach/expenses/${id}`);
export const addExpense = (data) => api.post('/budget-coach/expenses', data);
export const updateExpense = (id, data) => api.patch(`/budget-coach/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/budget-coach/expenses/${id}`);
export const getExpenseSummary = (period) => api.get('/budget-coach/summary', { params: { period } });
export const bulkDeleteBudgetPlans = (ids) => api.post('/budget-coach/plans/bulk-delete', { ids });
export const exportBudgetPlans = (format) => api.get('/budget-coach/plans/export', { params: { format } });
export const bulkDeleteExpenses = (ids) => api.post('/budget-coach/expenses/bulk-delete', { ids });
export const exportExpenses = (format) => api.get('/budget-coach/expenses/export', { params: { format } });

// Goal Tracker
export const getGoals = (params) => api.get('/goal-tracker', { params });
export const getGoal = (id) => api.get(`/goal-tracker/${id}`);
export const addGoal = (data) => api.post('/goal-tracker', data);
export const updateGoal = (id, data) => api.patch(`/goal-tracker/${id}`, data);
export const deleteGoal = (id) => api.delete(`/goal-tracker/${id}`);
export const contributeToGoal = (id, amount) => api.post(`/goal-tracker/${id}/contribute`, { amount });
export const analyzeGoal = (id) => api.post(`/goal-tracker/${id}/analyze`);
export const analyzeAllGoals = () => api.post('/goal-tracker/analyze-all');
export const bulkDeleteGoals = (ids) => api.post('/goal-tracker/bulk-delete', { ids });
export const exportGoals = (format) => api.get('/goal-tracker/export', { params: { format } });

// Bill Negotiator
export const getBills = (params) => api.get('/bill-negotiator', { params });
export const getBill = (id) => api.get(`/bill-negotiator/${id}`);
export const addBill = (data) => api.post('/bill-negotiator', data);
export const updateBill = (id, data) => api.patch(`/bill-negotiator/${id}`, data);
export const deleteBill = (id) => api.delete(`/bill-negotiator/${id}`);
export const recordNegotiation = (id, data) => api.post(`/bill-negotiator/${id}/negotiate`, data);
export const getNegotiationStrategy = (id) => api.post(`/bill-negotiator/${id}/strategy`);
export const analyzeAllBills = () => api.post('/bill-negotiator/analyze-all');
export const bulkDeleteBills = (ids) => api.post('/bill-negotiator/bulk-delete', { ids });
export const exportBills = (format) => api.get('/bill-negotiator/export', { params: { format } });

// Generic export helper (downloads file)
export const downloadExport = async (exportFn, format, filename) => {
  try {
    if (format === 'json') {
      const response = await exportFn('json');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const response = await exportFn(format);
      const contentType = format === 'csv' ? 'text/csv' : 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Export failed:', error);
  }
};

export default api;
