import React, { useState, useEffect } from 'react';
import { Target, CheckCircle, AlertTriangle, Plus, Edit2, Trash2 } from 'lucide-react';
import { getGoals, addGoal, deleteGoal, analyzeGoal, updateGoal, contributeToGoal, analyzeAllGoals, bulkDeleteGoals, exportGoals, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

const SORT_COLUMNS = [
  { field: 'createdAt', label: 'Date' },
  { field: 'name', label: 'Name' },
  { field: 'targetAmount', label: 'Target' },
  { field: 'priority', label: 'Priority' }
];

function GoalTracker() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showContribute, setShowContribute] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'savings', targetAmount: '', currentAmount: '',
    deadline: '', priority: '1', monthlyContribution: ''
  });

  // Search, sort, pagination state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Bulk selection & confirm dialog
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => { loadGoals(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await getGoals({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setGoals(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        targetAmount: parseFloat(formData.targetAmount) || 0,
        currentAmount: parseFloat(formData.currentAmount) || 0,
        priority: parseInt(formData.priority) || 1,
        monthlyContribution: parseFloat(formData.monthlyContribution) || null
      };

      if (editingGoal) {
        await updateGoal(editingGoal.id, data);
      } else {
        await addGoal(data);
      }
      setShowForm(false);
      setEditingGoal(null);
      setFormData({ name: '', description: '', category: 'savings', targetAmount: '', currentAmount: '', deadline: '', priority: '1', monthlyContribution: '' });
      loadGoals();
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  const handleContribute = async (goalId) => {
    try {
      await contributeToGoal(goalId, parseFloat(contributeAmount));
      setShowContribute(null);
      setContributeAmount('');
      loadGoals();
      if (selectedGoal?.id === goalId) {
        const updated = goals.find(g => g.id === goalId);
        if (updated) setSelectedGoal({ ...updated, currentAmount: updated.currentAmount + parseFloat(contributeAmount) });
      }
    } catch (error) {
      console.error('Failed to contribute:', error);
    }
  };

  const handleAnalyze = async (goal) => {
    setAnalyzing(goal.id);
    try {
      const response = await analyzeGoal(goal.id);
      const ai = response.data.analysis || {};
      setSelectedGoal({
        ...goal,
        analysis: ai.analysis || ai,
        aiOnTrack: ai.aiOnTrack,
        aiProjectedCompletion: ai.aiProjectedCompletion,
        aiRecommendations: ai.recommendations,
        aiMilestones: ai.milestones,
      });
      loadGoals();
    } catch (error) {
      console.error('Failed to analyze:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const response = await analyzeAllGoals();
      setPortfolioAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze all goals:', error);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        await deleteGoal(id);
        loadGoals();
        if (selectedGoal?.id === id) setSelectedGoal(null);
      }
    });
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected Goals',
      message: `Are you sure you want to delete ${selectedIds.length} goal(s)? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        try {
          await bulkDeleteGoals(selectedIds);
          setSelectedIds([]);
          loadGoals();
        } catch (error) {
          console.error('Bulk delete failed:', error);
        }
      }
    });
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name || '', description: goal.description || '', category: goal.category || 'savings',
      targetAmount: goal.targetAmount || '', currentAmount: goal.currentAmount || '',
      deadline: goal.deadline?.split('T')[0] || '', priority: goal.priority?.toString() || '1',
      monthlyContribution: goal.monthlyContribution || ''
    });
    setShowForm(true);
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return '#4CAF50';
    if (progress >= 50) return '#8BC34A';
    if (progress >= 25) return '#FF9800';
    return '#f44336';
  };

  const getProgress = (goal) => {
    if (!goal.targetAmount) return 0;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  const toggleSelectGoal = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === goals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(goals.map(g => g.id));
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
    downloadExport(exportGoals, format, 'goals');
  };

  const categories = ['savings', 'investment', 'debt_payoff', 'purchase', 'emergency_fund', 'retirement', 'education', 'travel'];
  const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const totalCurrent = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);

  if (loading && goals.length === 0) return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Goal Tracker</h1>
        <p>Track and achieve your financial goals with AI guidance</p>
      </div>
      <LoadingSkeleton variant="card" count={3} />
    </div>
  );

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Goal Tracker</h1>
        <p>Track and achieve your financial goals with AI guidance</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingGoal(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> New Goal</button>
          {goals.length > 1 && (
            <button className="btn-secondary" onClick={handleAnalyzeAll} disabled={analyzingAll}>
              {analyzingAll ? 'Analyzing...' : 'Analyze All Goals'}
            </button>
          )}
        </div>
      </div>

      {goals.length > 0 && (
        <div className="goals-summary">
          <div className="summary-item"><label>Total Goals</label><span>{total}</span></div>
          <div className="summary-item"><label>Total Target</label><span>${totalTarget.toLocaleString()}</span></div>
          <div className="summary-item"><label>Total Saved</label><span>${totalCurrent.toLocaleString()}</span></div>
          <div className="summary-item"><label>Overall Progress</label><span>{totalTarget > 0 ? ((totalCurrent / totalTarget) * 100).toFixed(1) : 0}%</span></div>
        </div>
      )}

      {portfolioAnalysis && portfolioAnalysis.analysis && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>Goals Portfolio Analysis</h3>
            <button className="btn-close" onClick={() => setPortfolioAnalysis(null)}>×</button>
          </div>
          <div className="portfolio-score">
            <div className="score-circle" style={{ backgroundColor: getProgressColor(portfolioAnalysis.analysis?.overallScore || 0) }}>
              <span className="score">{portfolioAnalysis.analysis?.overallScore || 0}</span>
            </div>
            <div className="portfolio-stats">
              <div><label>Overall Progress</label><span>{portfolioAnalysis.analysis?.overallProgress?.toFixed(1) || 0}%</span></div>
            </div>
          </div>
          {portfolioAnalysis.analysis?.analysis && (
            <div className="portfolio-insights">
              <p>{portfolioAnalysis.analysis.analysis.summary}</p>
              {portfolioAnalysis.analysis.analysis.prioritization && (
                <p><strong>Prioritization:</strong> {portfolioAnalysis.analysis.analysis.prioritization}</p>
              )}
              {portfolioAnalysis.analysis.analysis.feasibility && (
                <p><strong>Feasibility:</strong> {portfolioAnalysis.analysis.analysis.feasibility}</p>
              )}
            </div>
          )}
          {portfolioAnalysis.analysis?.recommendations?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Recommendations</h4>
              <div className="quick-recs">{portfolioAnalysis.analysis.recommendations.map((r, i) => <p key={i}><strong>{r.title}:</strong> {r.description || r.reasoning}</p>)}</div>
            </div>
          )}
          {portfolioAnalysis.analysis?.optimizations?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Optimizations</h4>
              <div className="quick-recs">{portfolioAnalysis.analysis.optimizations.map((o, i) => <p key={i}><strong>{o.goal}:</strong> {o.suggestion}</p>)}</div>
            </div>
          )}
          {portfolioAnalysis.analysis?.actionPlan?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Action Plan</h4>
              <div className="quick-recs">{portfolioAnalysis.analysis.actionPlan.map((a, i) => <div key={i}><strong>{a.month}:</strong> {a.actions?.join(', ')}</div>)}</div>
            </div>
          )}
          <p className="powered-by">Powered by OpenRouter AI</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingGoal ? 'Edit' : 'Create'} Financial Goal</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Goal Name *</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g., Emergency Fund" /></div>
              <div className="form-group"><label>Description</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Why is this goal important?" /></div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="1">1 - Highest</option>
                    <option value="2">2 - High</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - Low</option>
                    <option value="5">5 - Lowest</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Target Amount ($) *</label><input type="number" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} required /></div>
                <div className="form-group"><label>Current Amount ($)</label><input type="number" value={formData.currentAmount} onChange={e => setFormData({...formData, currentAmount: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Deadline</label><input type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} /></div>
                <div className="form-group"><label>Monthly Contribution ($)</label><input type="number" value={formData.monthlyContribution} onChange={e => setFormData({...formData, monthlyContribution: e.target.value})} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingGoal ? 'Update' : 'Create'} Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContribute && (
        <div className="modal-overlay" onClick={() => setShowContribute(null)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <h2>Add Contribution</h2>
            <p>Contributing to: {goals.find(g => g.id === showContribute)?.name}</p>
            <div className="form-group"><label>Amount ($)</label><input type="number" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} autoFocus /></div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowContribute(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => handleContribute(showContribute)} disabled={!contributeAmount}>Add</button>
            </div>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <div className="list-toolbar">
            <SearchBar value={search} onChange={handleSearch} placeholder="Search goals..." />
            <SortControls columns={SORT_COLUMNS} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <ExportButton onExport={handleExport} />
          </div>
          <BulkActions selectedCount={selectedIds.length} onDelete={handleBulkDelete} onClear={() => setSelectedIds([])} />
          <h3>Your Goals ({total})</h3>
          {loading ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : goals.length === 0 ? (
            <EmptyState
              title="No goals yet"
              description="Set your first financial goal."
              actionLabel="New Goal"
              onAction={() => { setShowForm(true); setEditingGoal(null); }}
            />
          ) : (
            <>
              <div className="select-all-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === goals.length && goals.length > 0}
                    onChange={toggleSelectAll}
                  />
                  Select All
                </label>
              </div>
              {goals.map(goal => (
                <div key={goal.id} className={`data-card clickable ${selectedGoal?.id === goal.id ? 'selected' : ''}`} onClick={() => setSelectedGoal(goal)}>
                  <div className="card-header">
                    <label className="checkbox-label" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(goal.id)}
                        onChange={() => toggleSelectGoal(goal.id)}
                      />
                    </label>
                    <div className="card-title">
                      <span>{goal.name}</span>
                      <span className={`badge priority-${goal.priority}`}>P{goal.priority}</span>
                      {goal.status === 'completed' && <span className="badge completed"><CheckCircle size={14} /></span>}
                    </div>
                    {goal.aiOnTrack !== undefined && (
                      <span className={`track-badge ${goal.aiOnTrack ? 'on-track' : 'off-track'}`}>
                        {goal.aiOnTrack ? <><CheckCircle size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> On Track</> : <><AlertTriangle size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> Off Track</>}
                      </span>
                    )}
                  </div>
                  <div className="goal-progress">
                    <div className="progress-bar">
                      <div className="progress" style={{ width: `${getProgress(goal)}%`, backgroundColor: getProgressColor(getProgress(goal)) }}></div>
                    </div>
                    <div className="progress-text">
                      <span>${goal.currentAmount?.toLocaleString()} / ${goal.targetAmount?.toLocaleString()}</span>
                      <span>{getProgress(goal).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="card-details">
                    <span className="category">{goal.category?.replace('_', ' ')}</span>
                    {goal.deadline && <span>Due: {new Date(goal.deadline).toLocaleDateString()}</span>}
                  </div>
                  <div className="card-actions">
                    <button onClick={(e) => { e.stopPropagation(); setShowContribute(goal.id); }} className="btn-small"><Plus size={14} style={{marginRight:'2px',verticalAlign:'middle'}} /> Contribute</button>
                    <button onClick={(e) => { e.stopPropagation(); handleAnalyze(goal); }} disabled={analyzing === goal.id} className="btn-small">{analyzing === goal.id ? '...' : 'AI Analyze'}</button>
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(goal); }} className="btn-icon"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <Pagination total={total} offset={offset} limit={limit} onPageChange={setOffset} onLimitChange={(val) => { setLimit(val); setOffset(0); }} />
            </>
          )}
        </div>

        <div className="detail-panel">
          {selectedGoal ? (
            <div className="detail-content">
              <h2>{selectedGoal.name}</h2>
              {selectedGoal.description && <p className="goal-description">{selectedGoal.description}</p>}

              <div className="goal-overview">
                <div className="big-progress">
                  <svg viewBox="0 0 100 100" className="progress-ring">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#eee" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={getProgressColor(getProgress(selectedGoal))} strokeWidth="8"
                      strokeDasharray={`${getProgress(selectedGoal) * 2.83} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="progress-center">
                    <span className="percent">{getProgress(selectedGoal).toFixed(0)}%</span>
                    <span className="label">Complete</span>
                  </div>
                </div>
                <div className="goal-stats">
                  <div><label>Target</label><span>${selectedGoal.targetAmount?.toLocaleString()}</span></div>
                  <div><label>Current</label><span>${selectedGoal.currentAmount?.toLocaleString()}</span></div>
                  <div><label>Remaining</label><span>${(selectedGoal.targetAmount - selectedGoal.currentAmount)?.toLocaleString()}</span></div>
                  {selectedGoal.deadline && <div><label>Deadline</label><span>{new Date(selectedGoal.deadline).toLocaleDateString()}</span></div>}
                  {selectedGoal.monthlyContribution && <div><label>Monthly</label><span>${selectedGoal.monthlyContribution}/mo</span></div>}
                </div>
              </div>

              {selectedGoal.analysis && (
                <div className="ai-analysis-section">
                  <h3>AI Analysis</h3>
                  <div className="ai-header">
                    <div className={`track-status ${selectedGoal.aiOnTrack ? 'on-track' : 'off-track'}`}>
                      {selectedGoal.aiOnTrack ? <><CheckCircle size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> On Track to Meet Goal</> : <><AlertTriangle size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> At Risk of Missing Goal</>}
                    </div>
                    {selectedGoal.aiProjectedCompletion && (
                      <div className="projected-completion">
                        <label>Projected Completion:</label>
                        <span>{new Date(selectedGoal.aiProjectedCompletion).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="analysis-content">
                    {selectedGoal.analysis.summary && <div className="analysis-summary"><h4>Assessment</h4><p>{selectedGoal.analysis.summary}</p></div>}

                    {selectedGoal.analysis.requiredMonthlyContribution && (
                      <div className="required-contribution">
                        <h4>Required Monthly Contribution</h4>
                        <span className="amount">${selectedGoal.analysis.requiredMonthlyContribution?.toLocaleString()}</span>
                        <span className="note">to reach goal by deadline</span>
                      </div>
                    )}

                    {selectedGoal.aiMilestones && (
                      <div className="milestones-section">
                        <h4>Milestones</h4>
                        <div className="milestones-list">
                          {selectedGoal.aiMilestones.map((m, i) => (
                            <div key={i} className={`milestone-item ${m.status}`}>
                              <span className="milestone-percent">{m.percentage}%</span>
                              <span className="milestone-amount">${m.amount?.toLocaleString()}</span>
                              <span className="milestone-date">{m.estimatedDate}</span>
                              <span className={`milestone-status ${m.status}`}>{m.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedGoal.aiRecommendations && (
                      <div className="recommendations">
                        <h4>Recommendations</h4>
                        {selectedGoal.aiRecommendations.map((rec, i) => (
                          <div key={i} className={`recommendation-item ${rec.impact}`}>
                            <h5>{rec.title}</h5>
                            <p>{rec.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedGoal.analysis.motivation && (
                      <div className="motivation"><h4>Keep Going!</h4><p>{selectedGoal.analysis.motivation}</p></div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedGoal.analysis && (
                <div className="no-analysis">
                  <p>Get AI-powered insights to help you reach this goal.</p>
                  <button onClick={() => handleAnalyze(selectedGoal)} disabled={analyzing === selectedGoal.id} className="btn-primary">{analyzing === selectedGoal.id ? 'Analyzing...' : 'Get AI Analysis'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a goal to view details</p></div>
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

export default GoalTracker;
