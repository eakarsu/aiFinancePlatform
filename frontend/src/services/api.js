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
export const login = (email, password) => api.post('/auth/login', { email, password });
export const demoLogin = () => api.post('/auth/demo-login');
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

// Robo-Advisor
export const getRiskProfile = () => api.get('/robo-advisor/risk-profile');
export const saveRiskProfile = (data) => api.post('/robo-advisor/risk-profile', data);
export const getPortfolioRecommendation = (investmentAmount) =>
  api.post('/robo-advisor/recommend-portfolio', { investmentAmount });
export const getPortfolios = () => api.get('/robo-advisor/portfolios');
export const createPortfolio = (data) => api.post('/robo-advisor/portfolios', data);
export const rebalancePortfolio = (id) => api.post(`/robo-advisor/portfolios/${id}/rebalance`);

// Credit Scoring
export const getCreditProfile = () => api.get('/credit-scoring/profile');
export const saveCreditProfile = (data) => api.post('/credit-scoring/profile', data);
export const addCreditHistory = (data) => api.post('/credit-scoring/history', data);
export const calculateCreditScore = () => api.post('/credit-scoring/calculate-score');
export const getCreditScoreHistory = () => api.get('/credit-scoring/score-history');

// Fraud Detection
export const getTransactions = (limit) => api.get('/fraud-detection/transactions', { params: { limit } });
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

// Alerts/Notifications
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

// User Profile & Settings
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword });
export const deleteAccount = () => api.delete('/auth/account');
export const exportUserData = () => api.get('/auth/export-data');

// Transaction Import
export const importCSV = (csvContent, mapping, skipDuplicates) =>
  api.post('/transaction-import/csv', { csvContent, mapping, skipDuplicates });
export const getImportHistory = () => api.get('/transaction-import/history');
export const getImportDetails = (id) => api.get(`/transaction-import/history/${id}`);
export const getCSVTemplate = () => api.get('/transaction-import/csv/template');
export const createPlaidLinkToken = () => api.post('/transaction-import/plaid/link-token');
export const exchangePlaidToken = (data) => api.post('/transaction-import/plaid/exchange-token', data);
export const getPlaidAccounts = () => api.get('/transaction-import/plaid/accounts');
export const syncPlaidTransactions = (connectionId) => api.post('/transaction-import/plaid/sync', { connectionId });
export const disconnectPlaid = (connectionId) => api.delete(`/transaction-import/plaid/${connectionId}`);

// Risk Assessment
export const getRiskQuestionnaire = () => api.get('/risk-assessment/questionnaire');
export const saveRiskQuestionnaire = (data) => api.post('/risk-assessment/questionnaire', data);
export const calculateRiskFromAnswers = (data) => api.post('/risk-assessment/calculate', data);
export const getFullRiskAssessment = () => api.get('/risk-assessment/assessment');
export const getRiskQuestions = () => api.get('/risk-assessment/questions');

export default api;
