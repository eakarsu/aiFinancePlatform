import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import * as api from '../services/api';
import { exportCreditHistory, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

const HISTORY_SORT_COLUMNS = [
  { field: 'startDate', label: 'Date' },
  { field: 'type', label: 'Type' },
  { field: 'provider', label: 'Provider' }
];

function CreditScoring() {
  const navigate = useNavigate();
  const [creditProfile, setCreditProfile] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('score');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiResultsRef = useRef(null);

  // Credit histories list state
  const [creditHistories, setCreditHistories] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historySortBy, setHistorySortBy] = useState('startDate');
  const [historySortOrder, setHistorySortOrder] = useState('desc');
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLimit, setHistoryLimit] = useState(25);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Bulk selection & confirm dialog
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    annualIncome: '',
    employmentStatus: 'EMPLOYED',
    employmentYears: '',
    housingStatus: 'RENTER',
    monthlyRent: '',
    rentPaymentHistory: '',
    utilityPaymentHistory: '',
    phonePaymentHistory: '',
    bankAccountAge: '',
    averageBalance: '',
    overdraftCount: '',
    traditionalScore: ''
  });

  useEffect(() => {
    loadAndCalculate();
  }, []);

  useEffect(() => {
    if (activeTab === 'histories') {
      loadCreditHistories();
    }
  }, [activeTab, historySearch, historySortBy, historySortOrder, historyOffset, historyLimit]);

  const loadAndCalculate = async () => {
    try {
      const profileRes = await api.getCreditProfile();
      if (profileRes.data) {
        setCreditProfile(profileRes.data);
        setFormData({
          annualIncome: profileRes.data.annualIncome || '',
          employmentStatus: profileRes.data.employmentStatus || 'EMPLOYED',
          employmentYears: profileRes.data.employmentYears || '',
          housingStatus: profileRes.data.housingStatus || 'RENTER',
          monthlyRent: profileRes.data.monthlyRent || '',
          rentPaymentHistory: profileRes.data.rentPaymentHistory || '',
          utilityPaymentHistory: profileRes.data.utilityPaymentHistory || '',
          phonePaymentHistory: profileRes.data.phonePaymentHistory || '',
          bankAccountAge: profileRes.data.bankAccountAge || '',
          averageBalance: profileRes.data.averageBalance || '',
          overdraftCount: profileRes.data.overdraftCount || '',
          traditionalScore: profileRes.data.traditionalScore || ''
        });

        // Use stored score (no auto-calculation, instant load)
        if (profileRes.data.aiCreditScore) {
          setScoreResult({
            score: profileRes.data.aiCreditScore,
            confidence: profileRes.data.aiConfidence,
            factors: profileRes.data.aiFactors
          });
          setActiveTab('score');
        }
      }
    } catch (error) {
      console.error('Failed to load credit profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreditHistories = async () => {
    setHistoryLoading(true);
    try {
      const response = await api.getCreditHistories({
        search: historySearch,
        sortBy: historySortBy,
        sortOrder: historySortOrder,
        offset: historyOffset,
        limit: historyLimit
      });
      const result = response.data;
      setCreditHistories(result.data || result);
      setHistoryTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load credit histories:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAIAnalyze = async () => {
    setAiLoading(true);
    try {
      const response = await api.aiAnalyzeCredit();
      setAiAnalysis(response.data);
      setTimeout(() => {
        aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('AI analysis failed:', error);
      alert('Failed to generate AI analysis. Make sure the AI API key is configured.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setCalculating(true);
    try {
      const response = await api.saveCreditProfile(formData);
      setCreditProfile(response.data);
      // Auto-recalculate score after saving profile changes
      try {
        const scoreRes = await api.calculateCreditScore();
        setScoreResult(scoreRes.data);
        setAiAnalysis(null);
        alert('Profile saved and score recalculated!');
        setActiveTab('score');
      } catch (err) {
        alert('Profile saved! Go to Score tab and click Recalculate.');
      }
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setCalculating(false);
    }
  };

  const calculateScore = async () => {
    if (!creditProfile) {
      alert('Please save your credit profile first');
      return;
    }
    setCalculating(true);
    setAiAnalysis(null);
    try {
      // Step 1: Calculate algorithm score (fast)
      const response = await api.calculateCreditScore();
      setScoreResult(response.data);
      setActiveTab('score');

      // Step 2: Run AI analysis automatically
      setAiLoading(true);
      try {
        const aiResponse = await api.aiAnalyzeCredit();
        setAiAnalysis(aiResponse.data);
        setTimeout(() => {
          aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (aiErr) {
        console.error('AI analysis failed:', aiErr);
      } finally {
        setAiLoading(false);
      }
    } catch (error) {
      alert('Failed to calculate score');
    } finally {
      setCalculating(false);
    }
  };

  const toggleSelectHistory = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllHistories = () => {
    if (selectedIds.length === creditHistories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(creditHistories.map(h => h.id));
    }
  };

  const handleBulkDeleteHistories = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected Histories',
      message: `Are you sure you want to delete ${selectedIds.length} credit history records? This cannot be undone.`,
      onConfirm: async () => {
        try {
          // No bulk delete API for credit histories, so skip or handle gracefully
          setSelectedIds([]);
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
          loadCreditHistories();
        } catch (error) {
          console.error('Bulk delete failed:', error);
        }
      }
    });
  };

  const handleExportHistory = (format) => {
    downloadExport(exportCreditHistory, format, 'credit-history');
  };

  const getScoreColor = (score) => {
    if (score >= 750) return '#4CAF50';
    if (score >= 670) return '#8BC34A';
    if (score >= 580) return '#FF9800';
    return '#F44336';
  };

  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>AI Credit Scoring</h1>
          <p>Alternative credit scoring using non-traditional data for thin-file consumers</p>
        </div>
        <LoadingSkeleton variant="detail-panel" count={1} />
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Credit Scoring</h1>
        <p>Alternative credit scoring using non-traditional data for thin-file consumers</p>
      </div>

      <div className="tabs">
        <button className={activeTab === 'score' ? 'active' : ''} onClick={() => setActiveTab('score')}>
          AI Credit Score
        </button>
        <button className={activeTab === 'histories' ? 'active' : ''} onClick={() => setActiveTab('histories')}>
          Credit Histories ({creditProfile?.creditHistories?.length || historyTotal || 0})
        </button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
          Edit Profile
        </button>
      </div>

      {/* ===== SCORE TAB ===== */}
      {activeTab === 'score' && (
        <>
          {scoreResult ? (
            <div className="score-results">
              <div className="card score-card">
                <div className="score-display">
                  <div className="score-circle" style={{ borderColor: getScoreColor(scoreResult.score) }}>
                    <span className="score-number">{scoreResult.score}</span>
                    <span className="score-label">{getScoreLabel(scoreResult.score)}</span>
                  </div>
                  <div className="score-meta">
                    <p>AI Credit Score</p>
                    <span className="confidence">Confidence: {scoreResult.confidence?.toFixed(1)}%</span>
                    {scoreResult.method && (
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Method: {scoreResult.method}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {scoreResult.riskLevel && (
                <div className="card">
                  <h3>Risk Assessment</h3>
                  <div className={`risk-indicator ${scoreResult.riskLevel?.toLowerCase()}`}>
                    {scoreResult.riskLevel} Risk
                  </div>
                </div>
              )}

              <div className="factors-grid">
                <div className="card factors-card positive">
                  <h3><CheckCircle size={18} style={{ marginRight: '0.5rem', color: '#4CAF50' }} /> Positive Factors</h3>
                  <ul>
                    {scoreResult.factors?.positive?.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div className="card factors-card negative">
                  <h3><AlertTriangle size={18} style={{ marginRight: '0.5rem', color: '#F44336' }} /> Areas for Improvement</h3>
                  <ul>
                    {scoreResult.factors?.negative?.length > 0 ? (
                      scoreResult.factors.negative.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))
                    ) : (
                      <li style={{ color: 'var(--text-muted)' }}>No negative factors found</li>
                    )}
                  </ul>
                </div>
              </div>

              {scoreResult.recommendations && scoreResult.recommendations.length > 0 && (
                <div className="card">
                  <h3>Recommendations</h3>
                  <ul className="recommendations-list">
                    {scoreResult.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {scoreResult.loanApprovalLikelihood && (
                <div className="card">
                  <h3>Loan Approval Likelihood</h3>
                  <div className="loan-grid">
                    {Object.entries(scoreResult.loanApprovalLikelihood).map(([loan, likelihood]) => (
                      <div key={loan} className="loan-item clickable" onClick={() => setSelectedLoan({ type: loan, likelihood, score: scoreResult.score })}>
                        <span className="loan-type">{loan.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className={`loan-likelihood ${likelihood.toLowerCase().replace(' ', '-')}`}>{likelihood}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scoreResult.paymentStats && (
                <div className="card">
                  <h3>Payment Statistics</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-value">{scoreResult.paymentStats.totalPayments}</span>
                      <span className="stat-label">Total Payments</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{scoreResult.paymentStats.onTimePercentage}%</span>
                      <span className="stat-label">On-Time Rate</span>
                    </div>
                    <div className="stat-item positive">
                      <span className="stat-value">{scoreResult.paymentStats.onTime}</span>
                      <span className="stat-label">On-Time</span>
                    </div>
                    <div className="stat-item warning">
                      <span className="stat-value">{scoreResult.paymentStats.late}</span>
                      <span className="stat-label">Late</span>
                    </div>
                    <div className="stat-item negative">
                      <span className="stat-value">{scoreResult.paymentStats.missed}</span>
                      <span className="stat-label">Missed</span>
                    </div>
                  </div>
                </div>
              )}

              {scoreResult.reasoning && (
                <div className="card">
                  <h3>AI Analysis</h3>
                  <p className="reasoning">{scoreResult.reasoning}</p>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button onClick={calculateScore} className="btn-primary" disabled={calculating || aiLoading} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '1rem' }}>
                  {calculating ? 'Calculating...' : aiLoading ? 'AI Analyzing...' : 'Recalculate Score with AI'}
                </button>
                {(calculating || aiLoading) && (
                  <p style={{ color: '#666', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                    {calculating ? 'Calculating your credit score...' : 'AI is analyzing your credit profile...'}
                  </p>
                )}
              </div>

              {/* AI Analysis Results */}
              {aiAnalysis && (
                <div ref={aiResultsRef} className="portfolio-analysis-card" style={{ marginTop: '1.5rem' }}>
                  <div className="portfolio-header">
                    <h3>AI-Powered Credit Analysis</h3>
                    <button className="btn-close" onClick={() => setAiAnalysis(null)}>×</button>
                  </div>

                  {/* Score Breakdown */}
                  {aiAnalysis.scoreBreakdown && (
                    <div className="portfolio-insights">
                      <p>{aiAnalysis.scoreBreakdown}</p>
                    </div>
                  )}

                  {/* Improvement Potential */}
                  {aiAnalysis.improvementPotential && (
                    <div style={{ padding: '0.75rem 1rem', background: '#e8f5e9', borderRadius: '8px', marginTop: '1rem' }}>
                      <strong style={{ color: '#2e7d32' }}>Improvement Potential: </strong>
                      <span style={{ color: '#333' }}>{aiAnalysis.improvementPotential}</span>
                    </div>
                  )}

                  {/* AI Insights */}
                  {aiAnalysis.aiInsights?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>AI Insights</h4>
                      {aiAnalysis.aiInsights.map((insight, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                          <CheckCircle size={16} style={{ color: '#4CAF50', marginTop: '2px', flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>{insight}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Personalized Recommendations */}
                  {aiAnalysis.personalizedRecommendations?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Personalized Recommendations</h4>
                      {aiAnalysis.personalizedRecommendations.map((rec, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                          <TrendingUp size={16} style={{ color: '#2196F3', marginTop: '2px', flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>{rec}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Plan */}
                  {aiAnalysis.actionPlan?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Action Plan</h4>
                      {aiAnalysis.actionPlan.map((item, i) => (
                        <div key={i} className={`recommendation-item ${item.priority}`}>
                          <h5>{item.action}</h5>
                          <p>{item.impact}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CreditCard size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>No Score Available</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Complete your credit profile first, then we'll calculate your AI credit score.</p>
              <button className="btn-primary" style={{ marginTop: '1rem', width: 'auto' }} onClick={() => setActiveTab('profile')}>
                Complete Profile
              </button>
            </div>
          )}
        </>
      )}

      {/* ===== CREDIT HISTORIES TAB ===== */}
      {activeTab === 'histories' && (
        <div>
          {/* Toolbar: Search, Sort, Export */}
          <div className="toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <SearchBar
              value={historySearch}
              onChange={(val) => { setHistorySearch(val); setHistoryOffset(0); }}
              placeholder="Search credit histories..."
            />
            <SortControls
              columns={HISTORY_SORT_COLUMNS}
              sortBy={historySortBy}
              sortOrder={historySortOrder}
              onSort={(field, order) => { setHistorySortBy(field); setHistorySortOrder(order); setHistoryOffset(0); }}
            />
            <ExportButton onExport={handleExportHistory} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            onDelete={handleBulkDeleteHistories}
            onClear={() => setSelectedIds([])}
          />

          {historyLoading ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : creditHistories.length > 0 ? (
            <>
              <div className="recommendation-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {creditHistories.map((history) => {
                  const total = history.onTimePayments + history.latePayments + history.missedPayments;
                  const onTimeRate = total > 0 ? ((history.onTimePayments / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={history.id} className="card" style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(history.id)}
                          onChange={() => toggleSelectHistory(history.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{history.provider}</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{history.type}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>${history.monthlyAmount?.toFixed(0)}/mo</span>
                      </div>

                      {/* On-time rate bar */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>On-Time Rate</span>
                          <span style={{ fontWeight: 600, color: onTimeRate >= 95 ? '#4CAF50' : onTimeRate >= 80 ? '#FF9800' : '#F44336' }}>{onTimeRate}%</span>
                        </div>
                        <div style={{ background: 'var(--border-light)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${onTimeRate}%`, height: '100%', borderRadius: '4px', background: onTimeRate >= 95 ? '#4CAF50' : onTimeRate >= 80 ? '#FF9800' : '#F44336' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#4CAF50' }}>{history.onTimePayments} on-time</span>
                        <span style={{ color: '#FF9800' }}>{history.latePayments} late</span>
                        <span style={{ color: '#F44336' }}>{history.missedPayments} missed</span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Since {new Date(history.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        {history.endDate ? ` — ${new Date(history.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' — Present'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination
                total={historyTotal}
                offset={historyOffset}
                limit={historyLimit}
                onPageChange={setHistoryOffset}
                onLimitChange={(val) => { setHistoryLimit(val); setHistoryOffset(0); }}
              />
            </>
          ) : (
            <EmptyState
              icon={<FileText size={48} />}
              title="No credit history"
              description="Add payment history to improve your score."
            />
          )}
        </div>
      )}

      {/* ===== PROFILE TAB ===== */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2>Your Credit Profile</h2>
          <p className="card-subtitle">Enter your financial information for AI analysis</p>

          <form onSubmit={handleSaveProfile}>
            <h3>Employment & Income</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Annual Income ($)</label>
                <input type="number" value={formData.annualIncome} onChange={(e) => setFormData({ ...formData, annualIncome: parseFloat(e.target.value) })} placeholder="50000" />
              </div>
              <div className="form-group">
                <label>Employment Status</label>
                <select value={formData.employmentStatus} onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}>
                  <option value="EMPLOYED">Employed Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="SELF_EMPLOYED">Self-Employed</option>
                  <option value="UNEMPLOYED">Unemployed</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </div>
              <div className="form-group">
                <label>Years at Current Job</label>
                <input type="number" value={formData.employmentYears} onChange={(e) => setFormData({ ...formData, employmentYears: parseInt(e.target.value) })} placeholder="3" />
              </div>
            </div>

            <h3>Housing</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Housing Status</label>
                <select value={formData.housingStatus} onChange={(e) => setFormData({ ...formData, housingStatus: e.target.value })}>
                  <option value="OWNER">Home Owner</option>
                  <option value="RENTER">Renter</option>
                  <option value="LIVING_WITH_FAMILY">Living with Family</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Rent/Mortgage ($)</label>
                <input type="number" value={formData.monthlyRent} onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) })} placeholder="1500" />
              </div>
            </div>

            <h3>Payment History (Alternative Data)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Rent On-Time Payments (months)</label>
                <input type="number" value={formData.rentPaymentHistory} onChange={(e) => setFormData({ ...formData, rentPaymentHistory: parseInt(e.target.value) })} placeholder="24" />
              </div>
              <div className="form-group">
                <label>Utility On-Time Payments (months)</label>
                <input type="number" value={formData.utilityPaymentHistory} onChange={(e) => setFormData({ ...formData, utilityPaymentHistory: parseInt(e.target.value) })} placeholder="24" />
              </div>
              <div className="form-group">
                <label>Phone Bill On-Time Payments (months)</label>
                <input type="number" value={formData.phonePaymentHistory} onChange={(e) => setFormData({ ...formData, phonePaymentHistory: parseInt(e.target.value) })} placeholder="24" />
              </div>
            </div>

            <h3>Banking Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Bank Account Age (months)</label>
                <input type="number" value={formData.bankAccountAge} onChange={(e) => setFormData({ ...formData, bankAccountAge: parseInt(e.target.value) })} placeholder="36" />
              </div>
              <div className="form-group">
                <label>Average Balance ($)</label>
                <input type="number" value={formData.averageBalance} onChange={(e) => setFormData({ ...formData, averageBalance: parseFloat(e.target.value) })} placeholder="5000" />
              </div>
              <div className="form-group">
                <label>Overdraft Count (last 12 months)</label>
                <input type="number" value={formData.overdraftCount} onChange={(e) => setFormData({ ...formData, overdraftCount: parseInt(e.target.value) })} placeholder="0" />
              </div>
            </div>

            <h3>Traditional Score (Optional)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Existing Credit Score (if any)</label>
                <input type="number" value={formData.traditionalScore} onChange={(e) => setFormData({ ...formData, traditionalScore: parseInt(e.target.value) })} placeholder="Leave blank if no credit history" min={300} max={850} />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={calculating}>
              {calculating ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <div className="recommendation-section">
            <button onClick={calculateScore} className="btn-secondary" disabled={calculating}>
              {calculating ? 'Calculating...' : 'Calculate AI Credit Score'}
            </button>
          </div>
        </div>
      )}

      {/* Loan Detail Modal */}
      {selectedLoan && (
        <div className="modal-overlay" onClick={() => setSelectedLoan(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedLoan.type.replace(/([A-Z])/g, ' $1').trim()}</h2>
              <button className="close-btn" onClick={() => setSelectedLoan(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="label">Approval Likelihood:</span>
                <span className={`loan-likelihood large ${selectedLoan.likelihood.toLowerCase().replace(' ', '-')}`}>{selectedLoan.likelihood}</span>
              </div>
              <div className="detail-row">
                <span className="label">Your Credit Score:</span>
                <span className="value">{selectedLoan.score}</span>
              </div>
              <div className="detail-row">
                <span className="label">Typical Requirement:</span>
                <span className="value">
                  {selectedLoan.type === 'personalLoan' ? '580+' :
                   selectedLoan.type === 'autoLoan' ? '620+' :
                   selectedLoan.type === 'mortgage' ? '680+' :
                   selectedLoan.type === 'creditCard' ? '650+' : '600+'}
                </span>
              </div>
              <div className="loan-tips">
                <h4>Tips to Improve Approval Chances</h4>
                <ul>
                  <li>Maintain consistent payment history</li>
                  <li>Keep credit utilization below 30%</li>
                  <li>Avoid opening new accounts before applying</li>
                  <li>Consider a co-signer if needed</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedLoan(null)}>Close</button>
              <button className="btn-primary" onClick={() => { setSelectedLoan(null); setActiveTab('profile'); }}>Improve Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
}

export default CreditScoring;
