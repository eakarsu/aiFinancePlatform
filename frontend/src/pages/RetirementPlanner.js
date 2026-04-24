import React, { useState, useEffect } from 'react';
import { Palmtree, Calendar, TrendingUp, Plus, Edit2, Trash2 } from 'lucide-react';
import { getRetirementPlans, addRetirementPlan, deleteRetirementPlan, analyzeRetirementPlan, updateRetirementPlan, calculateRetirementProjection, bulkDeleteRetirementPlans, exportRetirementPlans, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

function RetirementPlanner() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [projection, setProjection] = useState(null);
  const [formData, setFormData] = useState({
    currentAge: '', retirementAge: '65', lifeExpectancy: '90', currentSavings: '', monthlyContribution: '',
    expectedReturn: '7', inflationRate: '3', socialSecurityAge: '67', socialSecurityAmount: '',
    pensionAmount: '', otherIncome: '', currentExpenses: '', retirementExpenses: '',
    healthcareCosts: '', desiredRetirementIncome: '', legacyGoal: ''
  });

  // Shared component state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => { loadPlans(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await getRetirementPlans({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setPlans(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      Object.keys(data).forEach(key => {
        data[key] = data[key] ? parseFloat(data[key]) : null;
      });

      if (editingPlan) {
        await updateRetirementPlan(editingPlan.id, data);
      } else {
        await addRetirementPlan(data);
      }
      setShowForm(false);
      setEditingPlan(null);
      setFormData({ currentAge: '', retirementAge: '65', lifeExpectancy: '90', currentSavings: '', monthlyContribution: '', expectedReturn: '7', inflationRate: '3', socialSecurityAge: '67', socialSecurityAmount: '', pensionAmount: '', otherIncome: '', currentExpenses: '', retirementExpenses: '', healthcareCosts: '', desiredRetirementIncome: '', legacyGoal: '' });
      loadPlans();
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const handleAnalyze = async (plan) => {
    setAnalyzing(plan.id);
    try {
      const response = await analyzeRetirementPlan(plan.id);
      const ai = response.data.analysis || {};
      setSelectedPlan({
        ...plan,
        analysis: ai.analysis || ai,
        aiReadinessScore: ai.aiReadinessScore,
        aiProjectedSavings: ai.aiProjectedSavings,
        aiIncomeGap: ai.aiIncomeGap,
        aiRecommendations: ai.recommendations,
        aiMilestones: ai.milestones,
        aiRiskAssessment: ai.riskAssessment,
        aiActionItems: ai.actionItems,
      });
      loadPlans();
    } catch (error) {
      console.error('Failed to analyze plan:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleCalculate = async () => {
    try {
      const response = await calculateRetirementProjection({
        currentAge: parseFloat(formData.currentAge),
        retirementAge: parseFloat(formData.retirementAge),
        currentSavings: parseFloat(formData.currentSavings) || 0,
        monthlyContribution: parseFloat(formData.monthlyContribution) || 0,
        expectedReturn: parseFloat(formData.expectedReturn) || 7,
        inflationRate: parseFloat(formData.inflationRate) || 3
      });
      setProjection(response.data);
    } catch (error) {
      console.error('Failed to calculate:', error);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Retirement Plan',
      message: 'Delete this retirement plan?',
      onConfirm: async () => {
        await deleteRetirementPlan(id);
        loadPlans();
        if (selectedPlan?.id === id) setSelectedPlan(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      currentAge: plan.currentAge || '', retirementAge: plan.retirementAge || '65',
      lifeExpectancy: plan.lifeExpectancy || '90', currentSavings: plan.currentSavings || '',
      monthlyContribution: plan.monthlyContribution || '', expectedReturn: plan.expectedReturn || '7',
      inflationRate: plan.inflationRate || '3', socialSecurityAge: plan.socialSecurityAge || '67',
      socialSecurityAmount: plan.socialSecurityAmount || '', pensionAmount: plan.pensionAmount || '',
      otherIncome: plan.otherIncome || '', currentExpenses: plan.currentExpenses || '',
      retirementExpenses: plan.retirementExpenses || '', healthcareCosts: plan.healthcareCosts || '',
      desiredRetirementIncome: plan.desiredRetirementIncome || '', legacyGoal: plan.legacyGoal || ''
    });
    setShowForm(true);
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected retirement plan(s)?`,
      onConfirm: async () => {
        await bulkDeleteRetirementPlans(selectedIds);
        setSelectedIds([]);
        loadPlans();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleExport = async (format) => {
    await downloadExport(exportRetirementPlans, format, 'retirement-plans');
  };

  const handleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === plans.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(plans.map(p => p.id));
    }
  };

  const getReadinessColor = (score) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#f44336';
  };

  const sortColumns = [
    { field: 'createdAt', label: 'Date' },
    { field: 'currentAge', label: 'Age' },
    { field: 'retirementAge', label: 'Retire Age' },
    { field: 'currentSavings', label: 'Savings' }
  ];

  if (loading && plans.length === 0) return <LoadingSkeleton type="cards" count={6} />;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Retirement Planner</h1>
        <p>Plan your retirement with AI-powered projections and recommendations</p>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingPlan(null); setProjection(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> New Retirement Plan</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>{editingPlan ? 'Edit' : 'Create'} Retirement Plan</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group"><label>Current Age *</label><input type="number" value={formData.currentAge} onChange={e => setFormData({...formData, currentAge: e.target.value})} required /></div>
                  <div className="form-group"><label>Retirement Age</label><input type="number" value={formData.retirementAge} onChange={e => setFormData({...formData, retirementAge: e.target.value})} /></div>
                  <div className="form-group"><label>Life Expectancy</label><input type="number" value={formData.lifeExpectancy} onChange={e => setFormData({...formData, lifeExpectancy: e.target.value})} /></div>
                </div>
              </div>

              <div className="form-section">
                <h3>Savings & Contributions</h3>
                <div className="form-row">
                  <div className="form-group"><label>Current Savings ($) *</label><input type="number" value={formData.currentSavings} onChange={e => setFormData({...formData, currentSavings: e.target.value})} required /></div>
                  <div className="form-group"><label>Monthly Contribution ($)</label><input type="number" value={formData.monthlyContribution} onChange={e => setFormData({...formData, monthlyContribution: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Expected Return (%)</label><input type="number" step="0.1" value={formData.expectedReturn} onChange={e => setFormData({...formData, expectedReturn: e.target.value})} /></div>
                  <div className="form-group"><label>Inflation Rate (%)</label><input type="number" step="0.1" value={formData.inflationRate} onChange={e => setFormData({...formData, inflationRate: e.target.value})} /></div>
                </div>
              </div>

              <div className="form-section">
                <h3>Income Sources in Retirement</h3>
                <div className="form-row">
                  <div className="form-group"><label>Social Security Start Age</label><input type="number" value={formData.socialSecurityAge} onChange={e => setFormData({...formData, socialSecurityAge: e.target.value})} /></div>
                  <div className="form-group"><label>Est. Social Security ($/mo)</label><input type="number" value={formData.socialSecurityAmount} onChange={e => setFormData({...formData, socialSecurityAmount: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Pension ($/mo)</label><input type="number" value={formData.pensionAmount} onChange={e => setFormData({...formData, pensionAmount: e.target.value})} /></div>
                  <div className="form-group"><label>Other Income ($/mo)</label><input type="number" value={formData.otherIncome} onChange={e => setFormData({...formData, otherIncome: e.target.value})} /></div>
                </div>
              </div>

              <div className="form-section">
                <h3>Expenses & Goals</h3>
                <div className="form-row">
                  <div className="form-group"><label>Current Expenses ($/mo)</label><input type="number" value={formData.currentExpenses} onChange={e => setFormData({...formData, currentExpenses: e.target.value})} /></div>
                  <div className="form-group"><label>Expected Retirement Expenses ($/mo)</label><input type="number" value={formData.retirementExpenses} onChange={e => setFormData({...formData, retirementExpenses: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Healthcare Budget ($/mo)</label><input type="number" value={formData.healthcareCosts} onChange={e => setFormData({...formData, healthcareCosts: e.target.value})} /></div>
                  <div className="form-group"><label>Desired Retirement Income ($/mo)</label><input type="number" value={formData.desiredRetirementIncome} onChange={e => setFormData({...formData, desiredRetirementIncome: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>Legacy Goal ($ to leave heirs)</label><input type="number" value={formData.legacyGoal} onChange={e => setFormData({...formData, legacyGoal: e.target.value})} /></div>
              </div>

              {projection && (
                <div className="quick-projection">
                  <h4>Quick Projection</h4>
                  <div className="projection-stats">
                    <div><label>Years to Retirement</label><span>{projection.yearsToRetirement}</span></div>
                    <div><label>Projected Savings</label><span>${projection.projectedSavings?.toLocaleString()}</span></div>
                    <div><label>Monthly Retirement Income</label><span>${projection.monthlyRetirementIncome?.toLocaleString()}</span></div>
                    <div><label>Inflation Adjusted</label><span>${projection.realMonthlyIncome?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="button" className="btn-outline" onClick={handleCalculate}>Quick Calculate</button>
                <button type="submit" className="btn-primary">{editingPlan ? 'Update' : 'Create'} Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Retirement Plans ({total})</h3>

          <div className="list-toolbar">
            <SearchBar value={search} onChange={(val) => { setSearch(val); setOffset(0); }} placeholder="Search plans..." />
            <SortControls columns={sortColumns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }} />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            totalCount={plans.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
          />

          {plans.length === 0 ? (
            <EmptyState title="No retirement plans yet" message="Create your first plan to start projecting." />
          ) : (
            plans.map(plan => (
              <div key={plan.id} className={`data-card clickable has-checkbox ${selectedPlan?.id === plan.id ? 'selected' : ''}`} onClick={() => setSelectedPlan(plan)}>
                <input
                  type="checkbox"
                  className="card-checkbox"
                  checked={selectedIds.includes(plan.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectItem(plan.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span>Retirement Plan</span>
                    <span className="badge">Age {plan.currentAge} → {plan.retirementAge}</span>
                  </div>
                  {plan.aiReadinessScore && (
                    <div className="ai-score" style={{ backgroundColor: getReadinessColor(plan.aiReadinessScore) }}>{plan.aiReadinessScore}%</div>
                  )}
                </div>
                <p className="card-savings">Current Savings: ${plan.currentSavings?.toLocaleString()}</p>
                <div className="card-details">
                  <span>{plan.retirementAge - plan.currentAge} years to retirement</span>
                  {plan.monthlyContribution && <span>Contributing: ${plan.monthlyContribution}/mo</span>}
                </div>
                {plan.aiProjectedSavings && (
                  <div className="projected">Projected: ${plan.aiProjectedSavings?.toLocaleString()}</div>
                )}
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleAnalyze(plan); }} disabled={analyzing === plan.id} className="btn-small">{analyzing === plan.id ? 'Analyzing...' : 'AI Analyze'}</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(plan); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}

          <Pagination offset={offset} limit={limit} total={total} onPageChange={setOffset} />
        </div>

        <div className="detail-panel">
          {selectedPlan ? (
            <div className="detail-content">
              <h2>Retirement Plan Analysis</h2>

              <div className="retirement-summary">
                <div className="summary-item"><label>Current Age</label><span>{selectedPlan.currentAge}</span></div>
                <div className="summary-item"><label>Retirement Age</label><span>{selectedPlan.retirementAge}</span></div>
                <div className="summary-item"><label>Years to Go</label><span>{selectedPlan.retirementAge - selectedPlan.currentAge}</span></div>
                <div className="summary-item"><label>Current Savings</label><span>${selectedPlan.currentSavings?.toLocaleString()}</span></div>
              </div>

              {selectedPlan.analysis && (
                <div className="ai-analysis-section">
                  <h3>AI Analysis</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getReadinessColor(selectedPlan.aiReadinessScore) }}>
                      <span className="score-value">{selectedPlan.aiReadinessScore}%</span>
                      <span className="score-label">Retirement Readiness</span>
                    </div>
                    <div className="ai-meta">
                      <div><label>Projected Savings:</label><span>${selectedPlan.aiProjectedSavings?.toLocaleString()}</span></div>
                      {selectedPlan.aiIncomeGap !== null && selectedPlan.aiIncomeGap !== undefined && (
                        <div className={selectedPlan.aiIncomeGap > 0 ? 'gap-warning' : 'gap-good'}>
                          <label>Income Gap:</label>
                          <span>{selectedPlan.aiIncomeGap > 0 ? `-$${selectedPlan.aiIncomeGap?.toLocaleString()}/mo` : 'On Track!'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="analysis-content">
                    {selectedPlan.analysis.summary && (
                      <div className="analysis-summary"><h4>Summary</h4><p>{selectedPlan.analysis.summary}</p></div>
                    )}

                    {selectedPlan.analysis.projections && (
                      <div className="projections-section">
                        <h4>Projections</h4>
                        <div className="projections-grid">
                          {Object.entries(selectedPlan.analysis.projections).map(([key, data]) => (
                            <div key={key} className="projection-card">
                              <h5>{key.replace(/([A-Z])/g, ' $1').trim()}</h5>
                              <p className="savings">${data.savings?.toLocaleString()}</p>
                              <p className="income">${data.monthlyIncome?.toLocaleString()}/mo</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPlan.aiMilestones && (
                      <div className="milestones-section">
                        <h4>Milestones</h4>
                        <div className="milestones-timeline">
                          {selectedPlan.aiMilestones.map((m, i) => (
                            <div key={i} className="milestone-item">
                              <span className="age">Age {m.age}</span>
                              <span className="target">${m.target?.toLocaleString()}</span>
                              <span className="desc">{m.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPlan.aiRecommendations && (
                      <div className="recommendations">
                        <h4>Recommendations</h4>
                        {selectedPlan.aiRecommendations.map((rec, i) => (
                          <div key={i} className={`recommendation-item ${rec.impact}`}>
                            <h5>{rec.title}</h5>
                            <p>{rec.description}</p>
                            <span className="timeframe">{rec.timeframe}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPlan.aiRiskAssessment && (
                      <div className="risk-assessment">
                        <h4>Risk Assessment</h4>
                        <div className="risks-grid">
                          {Object.entries(selectedPlan.aiRiskAssessment).map(([risk, assessment]) => (
                            <div key={risk} className="risk-item">
                              <label>{risk.replace(/([A-Z])/g, ' $1').trim()}</label>
                              <p>{assessment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPlan.aiActionItems && (
                      <div className="action-items">
                        <h4>Action Items</h4>
                        <ul>
                          {selectedPlan.aiActionItems.map((item, i) => (
                            <li key={i} className={item.priority}>
                              <strong>{item.action}</strong>
                              {item.deadline && <span className="deadline">By: {item.deadline}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedPlan.analysis && (
                <div className="no-analysis">
                  <p>No AI analysis yet. Click "AI Analyze" to get comprehensive retirement planning advice.</p>
                  <button onClick={() => handleAnalyze(selectedPlan)} disabled={analyzing === selectedPlan.id} className="btn-primary">{analyzing === selectedPlan.id ? 'Analyzing...' : 'Generate AI Analysis'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a retirement plan to view details</p></div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
}

export default RetirementPlanner;
