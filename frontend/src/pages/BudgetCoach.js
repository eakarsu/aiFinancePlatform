import React, { useState, useEffect } from 'react';
import { Wallet, PieChart, Lightbulb, Plus, Edit2, Trash2 } from 'lucide-react';
import { getBudgetPlans, addBudgetPlan, deleteBudgetPlan, analyzeBudgetPlan, updateBudgetPlan, getExpenses, addExpense, deleteExpense, getExpenseSummary, bulkDeleteBudgetPlans, exportBudgetPlans, bulkDeleteExpenses, exportExpenses, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

const defaultCategories = [
  { name: 'Housing', budgeted: 0, spent: 0, color: '#4CAF50' },
  { name: 'Food', budgeted: 0, spent: 0, color: '#2196F3' },
  { name: 'Transportation', budgeted: 0, spent: 0, color: '#FF9800' },
  { name: 'Utilities', budgeted: 0, spent: 0, color: '#9C27B0' },
  { name: 'Entertainment', budgeted: 0, spent: 0, color: '#E91E63' },
  { name: 'Healthcare', budgeted: 0, spent: 0, color: '#00BCD4' },
  { name: 'Shopping', budgeted: 0, spent: 0, color: '#FF5722' },
  { name: 'Savings', budgeted: 0, spent: 0, color: '#8BC34A' },
  { name: 'Other', budgeted: 0, spent: 0, color: '#607D8B' }
];

const PLAN_SORT_COLUMNS = [
  { field: 'createdAt', label: 'Date' },
  { field: 'name', label: 'Name' },
  { field: 'totalBudget', label: 'Budget' }
];

function BudgetCoach() {
  const [plans, setPlans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [planForm, setPlanForm] = useState({ name: 'My Budget', period: 'monthly', totalIncome: '', categories: defaultCategories });
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'Food', description: '', merchant: '', date: new Date().toISOString().split('T')[0] });

  // Search, sort, pagination state for plans
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Bulk selection & confirm dialog
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => { loadData(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, expensesRes, summaryRes] = await Promise.all([
        getBudgetPlans({ search, sortBy, sortOrder, offset, limit }),
        getExpenses({ limit: 50 }),
        getExpenseSummary('month')
      ]);
      const plansResult = plansRes.data;
      setPlans(plansResult.data || plansResult);
      setTotal(plansResult.total || (plansResult.data || plansResult).length);
      setExpenses(expensesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      const totalBudget = planForm.categories.reduce((sum, c) => sum + (parseFloat(c.budgeted) || 0), 0);
      const data = { ...planForm, totalIncome: parseFloat(planForm.totalIncome) || 0, totalBudget };

      if (editingPlan) {
        await updateBudgetPlan(editingPlan.id, data);
      } else {
        await addBudgetPlan(data);
      }
      setShowPlanForm(false);
      setEditingPlan(null);
      setPlanForm({ name: 'My Budget', period: 'monthly', totalIncome: '', categories: defaultCategories });
      loadData();
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await addExpense({ ...expenseForm, amount: parseFloat(expenseForm.amount) });
      setShowExpenseForm(false);
      setExpenseForm({ amount: '', category: 'Food', description: '', merchant: '', date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (error) {
      console.error('Failed to add expense:', error);
    }
  };

  const handleAnalyze = async (plan) => {
    setAnalyzing(plan.id);
    try {
      const response = await analyzeBudgetPlan(plan.id);
      const ai = response.data.analysis || {};
      setSelectedPlan({
        ...plan,
        analysis: ai.analysis || ai,
        aiHealthScore: ai.aiHealthScore,
        aiSavingsGoal: ai.aiSavingsGoal,
        aiInsights: ai.insights,
        aiRecommendations: ai.recommendations,
        aiOptimizations: ai.optimizations
      });
      loadData();
    } catch (error) {
      console.error('Failed to analyze:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDeletePlan = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Budget Plan',
      message: 'Are you sure you want to delete this budget plan? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        await deleteBudgetPlan(id);
        loadData();
        if (selectedPlan?.id === id) setSelectedPlan(null);
      }
    });
  };

  const handleDeleteExpense = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense?',
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        await deleteExpense(id);
        loadData();
      }
    });
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected Plans',
      message: `Are you sure you want to delete ${selectedIds.length} budget plan(s)? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        try {
          await bulkDeleteBudgetPlans(selectedIds);
          setSelectedIds([]);
          loadData();
        } catch (error) {
          console.error('Bulk delete failed:', error);
        }
      }
    });
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || 'My Budget',
      period: plan.period || 'monthly',
      totalIncome: plan.totalIncome || '',
      categories: plan.categories || defaultCategories
    });
    setShowPlanForm(true);
  };

  const updateCategory = (index, field, value) => {
    const newCategories = [...planForm.categories];
    newCategories[index] = { ...newCategories[index], [field]: field === 'budgeted' ? parseFloat(value) || 0 : value };
    setPlanForm({ ...planForm, categories: newCategories });
  };

  const getHealthColor = (score) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#f44336';
  };

  const getCategorySpentPercentage = (cat) => {
    if (!cat.budgeted) return 0;
    return Math.min((cat.spent / cat.budgeted) * 100, 100);
  };

  const toggleSelectPlan = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === plans.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(plans.map(p => p.id));
    }
  };

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
    setOffset(0);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setOffset(0);
    setSelectedIds([]);
  };

  const handleExport = (format) => {
    downloadExport(exportBudgetPlans, format, 'budget-plans');
  };

  if (loading && plans.length === 0) return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Budget Coach</h1>
        <p>Get personalized budget coaching and spending insights</p>
      </div>
      <LoadingSkeleton variant="card" count={3} />
    </div>
  );

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Budget Coach</h1>
        <p>Get personalized budget coaching and spending insights</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowPlanForm(true); setEditingPlan(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> New Budget</button>
          <button className="btn-secondary" onClick={() => setShowExpenseForm(true)}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Add Expense</button>
        </div>
      </div>

      {summary && (
        <div className="summary-bar">
          <div className="summary-item"><label>This Month's Spending</label><span>${summary.total?.toFixed(2)}</span></div>
          <div className="summary-item"><label>Transactions</label><span>{summary.count}</span></div>
          <div className="summary-item"><label>Average</label><span>${summary.average?.toFixed(2)}</span></div>
          <div className="summary-item"><label>Top Category</label><span>{summary.categoryBreakdown?.[0]?.name || 'N/A'}</span></div>
        </div>
      )}

      <div className="tabs">
        <button className={activeTab === 'plans' ? 'active' : ''} onClick={() => setActiveTab('plans')}>Budget Plans</button>
        <button className={activeTab === 'expenses' ? 'active' : ''} onClick={() => setActiveTab('expenses')}>Expenses</button>
      </div>

      {showPlanForm && (
        <div className="modal-overlay" onClick={() => setShowPlanForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>{editingPlan ? 'Edit' : 'Create'} Budget Plan</h2>
            <form onSubmit={handlePlanSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Budget Name</label><input value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} /></div>
                <div className="form-group">
                  <label>Period</label>
                  <select value={planForm.period} onChange={e => setPlanForm({...planForm, period: e.target.value})}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group"><label>Total Income ($)</label><input type="number" value={planForm.totalIncome} onChange={e => setPlanForm({...planForm, totalIncome: e.target.value})} /></div>
              </div>

              <h3>Budget Categories</h3>
              <div className="categories-form">
                {planForm.categories.map((cat, i) => (
                  <div key={i} className="category-row">
                    <span className="category-name" style={{ borderLeftColor: cat.color }}>{cat.name}</span>
                    <input type="number" placeholder="Budget" value={cat.budgeted || ''} onChange={e => updateCategory(i, 'budgeted', e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="budget-total">
                Total Budget: ${planForm.categories.reduce((sum, c) => sum + (parseFloat(c.budgeted) || 0), 0).toFixed(2)}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPlanForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingPlan ? 'Update' : 'Create'} Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseForm && (
        <div className="modal-overlay" onClick={() => setShowExpenseForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Expense</h2>
            <form onSubmit={handleExpenseSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Amount ($) *</label><input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required /></div>
                <div className="form-group">
                  <label>Category *</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                    {defaultCategories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Description</label><input value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label>Merchant</label><input value={expenseForm.merchant} onChange={e => setExpenseForm({...expenseForm, merchant: e.target.value})} /></div>
                <div className="form-group"><label>Date</label><input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowExpenseForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          {activeTab === 'plans' ? (
            <>
              <div className="list-toolbar">
                <SearchBar value={search} onChange={handleSearch} placeholder="Search budget plans..." />
                <SortControls columns={PLAN_SORT_COLUMNS} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <ExportButton onExport={handleExport} />
              </div>
              <BulkActions selectedCount={selectedIds.length} onDelete={handleBulkDelete} onClear={() => setSelectedIds([])} />
              <h3>Your Budget Plans ({total})</h3>
              {loading ? (
                <LoadingSkeleton variant="card" count={3} />
              ) : plans.length === 0 ? (
                <EmptyState
                  title="No budget plans yet"
                  description="Create your first budget plan."
                  actionLabel="New Budget"
                  onAction={() => { setShowPlanForm(true); setEditingPlan(null); }}
                />
              ) : (
                <>
                  <div className="select-all-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === plans.length && plans.length > 0}
                        onChange={toggleSelectAll}
                      />
                      Select All
                    </label>
                  </div>
                  {plans.map(plan => (
                    <div key={plan.id} className={`data-card clickable ${selectedPlan?.id === plan.id ? 'selected' : ''}`} onClick={() => setSelectedPlan(plan)}>
                      <div className="card-header">
                        <label className="checkbox-label" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(plan.id)}
                            onChange={() => toggleSelectPlan(plan.id)}
                          />
                        </label>
                        <span className="card-title">{plan.name}</span>
                        {plan.aiHealthScore && <div className="ai-score" style={{ backgroundColor: getHealthColor(plan.aiHealthScore) }}>{plan.aiHealthScore}</div>}
                      </div>
                      <div className="card-details">
                        <span>Income: ${plan.totalIncome?.toLocaleString()}</span>
                        <span>Budget: ${plan.totalBudget?.toLocaleString()}</span>
                        <span>{plan.period}</span>
                      </div>
                      {plan.categories && (
                        <div className="mini-categories">
                          {plan.categories.slice(0, 3).map((cat, i) => (
                            <div key={i} className="mini-cat" style={{ backgroundColor: cat.color }}>${cat.budgeted}</div>
                          ))}
                        </div>
                      )}
                      <div className="card-actions">
                        <button onClick={(e) => { e.stopPropagation(); handleAnalyze(plan); }} disabled={analyzing === plan.id} className="btn-small">{analyzing === plan.id ? 'Analyzing...' : 'AI Coach'}</button>
                        <button onClick={(e) => { e.stopPropagation(); handleEditPlan(plan); }} className="btn-icon"><Edit2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <Pagination total={total} offset={offset} limit={limit} onPageChange={setOffset} onLimitChange={(val) => { setLimit(val); setOffset(0); }} />
                </>
              )}
            </>
          ) : (
            <>
              <h3>Recent Expenses ({expenses.length})</h3>
              {expenses.length === 0 ? (
                <EmptyState
                  title="No expenses recorded yet"
                  description="Add your first expense to start tracking."
                  actionLabel="Add Expense"
                  onAction={() => setShowExpenseForm(true)}
                />
              ) : (
                expenses.map(expense => (
                  <div key={expense.id} className="expense-card">
                    <div className="expense-header">
                      <span className="expense-category">{expense.category}</span>
                      <span className="expense-amount">-${expense.amount?.toFixed(2)}</span>
                    </div>
                    <p className="expense-desc">{expense.description || expense.merchant || 'No description'}</p>
                    <div className="expense-footer">
                      <span className="expense-date">{new Date(expense.date).toLocaleDateString()}</span>
                      <button onClick={() => handleDeleteExpense(expense.id)} className="btn-icon delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="detail-panel">
          {selectedPlan ? (
            <div className="detail-content">
              <h2>{selectedPlan.name}</h2>

              <div className="budget-overview">
                <div className="overview-item"><label>Total Income</label><span>${selectedPlan.totalIncome?.toLocaleString()}</span></div>
                <div className="overview-item"><label>Total Budget</label><span>${selectedPlan.totalBudget?.toLocaleString()}</span></div>
                <div className="overview-item savings"><label>Savings</label><span>${(selectedPlan.totalIncome - selectedPlan.totalBudget)?.toLocaleString()}</span></div>
              </div>

              <div className="categories-section">
                <h3>Budget Categories</h3>
                {selectedPlan.categories?.map((cat, i) => (
                  <div key={i} className="category-bar">
                    <div className="category-info">
                      <span className="name" style={{ color: cat.color }}>{cat.name}</span>
                      <span className="amounts">${cat.spent || 0} / ${cat.budgeted}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress" style={{ width: `${getCategorySpentPercentage(cat)}%`, backgroundColor: cat.color }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedPlan.analysis && (
                <div className="ai-analysis-section">
                  <h3>AI Budget Coaching</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getHealthColor(selectedPlan.aiHealthScore) }}>
                      <span className="score-value">{selectedPlan.aiHealthScore}</span>
                      <span className="score-label">Health Score</span>
                    </div>
                    {selectedPlan.aiSavingsGoal && (
                      <div className="savings-goal"><label>Suggested Savings Goal:</label><span>${selectedPlan.aiSavingsGoal}/month</span></div>
                    )}
                  </div>

                  <div className="analysis-content">
                    {selectedPlan.analysis.summary && <div className="analysis-summary"><h4>Summary</h4><p>{selectedPlan.analysis.summary}</p></div>}

                    {selectedPlan.aiInsights && (
                      <div className="insights-section">
                        <h4>Category Insights</h4>
                        {selectedPlan.aiInsights.map((insight, i) => (
                          <div key={i} className={`insight-item ${insight.status}`}>
                            <span className="category">{insight.category}</span>
                            <p>{insight.insight}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPlan.aiRecommendations && (
                      <div className="recommendations">
                        <h4>Recommendations</h4>
                        {selectedPlan.aiRecommendations.map((rec, i) => (
                          <div key={i} className={`recommendation-item ${rec.difficulty}`}>
                            <h5>{rec.title}</h5>
                            <p>{rec.description}</p>
                            {rec.potentialSavings && <span className="savings">Potential Savings: ${rec.potentialSavings}/mo</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPlan.aiOptimizations && (
                      <div className="optimizations">
                        <h4>Spending Optimizations</h4>
                        {selectedPlan.aiOptimizations.map((opt, i) => (
                          <div key={i} className="optimization-item">
                            <span className="category">{opt.category}</span>
                            <span className="current">Current: ${opt.currentSpend}</span>
                            <span className="suggested">Suggested: ${opt.suggestedSpend}</span>
                            <p className="tip">{opt.tip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedPlan.analysis && (
                <div className="no-analysis">
                  <p>Get personalized budget coaching from AI.</p>
                  <button onClick={() => handleAnalyze(selectedPlan)} disabled={analyzing === selectedPlan.id} className="btn-primary">{analyzing === selectedPlan.id ? 'Analyzing...' : 'Get AI Coaching'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a budget plan to view details</p></div>
          )}
        </div>
      </div>

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

export default BudgetCoach;
