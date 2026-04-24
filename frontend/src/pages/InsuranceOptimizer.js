import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2 } from 'lucide-react';
import { getInsurancePolicies, addInsurancePolicy, deleteInsurancePolicy, analyzeInsurancePolicy, updateInsurancePolicy, optimizeInsurancePortfolio, bulkDeleteInsurance, exportInsurance, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

function InsuranceOptimizer() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [formData, setFormData] = useState({
    insuranceType: 'health', provider: '', policyNumber: '', coverageAmount: '',
    premium: '', deductible: '', startDate: '', endDate: ''
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

  useEffect(() => { loadPolicies(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const response = await getInsurancePolicies({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setPolicies(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      ['coverageAmount', 'premium', 'deductible'].forEach(key => {
        data[key] = data[key] ? parseFloat(data[key]) : null;
      });

      if (editingPolicy) {
        await updateInsurancePolicy(editingPolicy.id, data);
      } else {
        await addInsurancePolicy(data);
      }
      setShowForm(false);
      setEditingPolicy(null);
      setFormData({ insuranceType: 'health', provider: '', policyNumber: '', coverageAmount: '', premium: '', deductible: '', startDate: '', endDate: '' });
      loadPolicies();
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const handleAnalyze = async (policy) => {
    setAnalyzing(policy.id);
    try {
      const response = await analyzeInsurancePolicy(policy.id);
      const ai = response.data.analysis || {};
      setSelectedPolicy({
        ...policy,
        analysis: ai.analysis || ai,
        aiCoverageScore: ai.aiCoverageScore,
        aiPremiumRating: ai.aiPremiumRating,
        aiSavingsPotential: ai.aiSavingsPotential,
        aiGaps: ai.gaps,
        aiRecommendations: ai.recommendations,
        aiAlternatives: ai.alternatives,
      });
      loadPolicies();
    } catch (error) {
      console.error('Failed to analyze policy:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleOptimizePortfolio = async () => {
    setOptimizing(true);
    try {
      const response = await optimizeInsurancePortfolio();
      setPortfolioAnalysis(response.data);
    } catch (error) {
      console.error('Failed to optimize portfolio:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Policy',
      message: 'Delete this policy?',
      onConfirm: async () => {
        await deleteInsurancePolicy(id);
        loadPolicies();
        if (selectedPolicy?.id === id) setSelectedPolicy(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      insuranceType: policy.insuranceType || 'health', provider: policy.provider || '',
      policyNumber: policy.policyNumber || '', coverageAmount: policy.coverageAmount || '',
      premium: policy.premium || '', deductible: policy.deductible || '',
      startDate: policy.startDate?.split('T')[0] || '', endDate: policy.endDate?.split('T')[0] || ''
    });
    setShowForm(true);
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected policy(ies)?`,
      onConfirm: async () => {
        await bulkDeleteInsurance(selectedIds);
        setSelectedIds([]);
        loadPolicies();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleExport = async (format) => {
    await downloadExport(exportInsurance, format, 'insurance');
  };

  const handleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === policies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(policies.map(p => p.id));
    }
  };

  const getCoverageColor = (score) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#f44336';
  };

  const getPremiumRatingColor = (rating) => {
    if (rating === 'excellent') return '#4CAF50';
    if (rating === 'good') return '#8BC34A';
    if (rating === 'fair') return '#FF9800';
    return '#f44336';
  };

  const insuranceTypes = ['health', 'life', 'auto', 'home', 'disability', 'umbrella'];
  const totalPremium = policies.reduce((sum, p) => sum + (p.premium || 0), 0);

  const sortColumns = [
    { field: 'createdAt', label: 'Date' },
    { field: 'insuranceType', label: 'Type' },
    { field: 'premium', label: 'Premium' },
    { field: 'provider', label: 'Provider' }
  ];

  if (loading && policies.length === 0) return <LoadingSkeleton type="cards" count={6} />;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Insurance Optimizer</h1>
        <p>Optimize your insurance coverage with AI-powered analysis</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingPolicy(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Add Policy</button>
          {policies.length > 0 && (
            <button className="btn-secondary" onClick={handleOptimizePortfolio} disabled={optimizing}>
              {optimizing ? 'Optimizing...' : 'Optimize Portfolio'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingPolicy ? 'Edit' : 'Add'} Insurance Policy</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Insurance Type *</label>
                  <select value={formData.insuranceType} onChange={e => setFormData({...formData, insuranceType: e.target.value})}>
                    {insuranceTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Provider</label><input value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Coverage Amount ($)</label><input type="number" value={formData.coverageAmount} onChange={e => setFormData({...formData, coverageAmount: e.target.value})} /></div>
                <div className="form-group"><label>Monthly Premium ($)</label><input type="number" step="0.01" value={formData.premium} onChange={e => setFormData({...formData, premium: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Deductible ($)</label><input type="number" value={formData.deductible} onChange={e => setFormData({...formData, deductible: e.target.value})} /></div>
                <div className="form-group"><label>Policy Number</label><input value={formData.policyNumber} onChange={e => setFormData({...formData, policyNumber: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingPolicy ? 'Update' : 'Add'} Policy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {portfolioAnalysis && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>Portfolio Optimization Results</h3>
            <button className="btn-close" onClick={() => setPortfolioAnalysis(null)}>×</button>
          </div>
          <div className="portfolio-score">
            <div className="score-circle" style={{ backgroundColor: getCoverageColor(portfolioAnalysis.analysis?.portfolioScore || 0) }}>
              <span className="score">{portfolioAnalysis.analysis?.portfolioScore || 0}</span>
              <span className="label">Score</span>
            </div>
            <div className="portfolio-stats">
              <div><label>Current Premium</label><span>${totalPremium}/mo</span></div>
              <div><label>Optimized Premium</label><span>${portfolioAnalysis.analysis?.optimizedPremium?.toFixed(0)}/mo</span></div>
              <div className="savings"><label>Potential Savings</label><span className="highlight">${portfolioAnalysis.analysis?.potentialSavings?.toFixed(0)}/year</span></div>
            </div>
          </div>
          {portfolioAnalysis.analysis?.analysis && (
            <div className="portfolio-insights">
              <p>{portfolioAnalysis.analysis.analysis.summary}</p>
              {portfolioAnalysis.analysis.analysis.gaps?.length > 0 && (
                <div className="gaps"><h4>Coverage Gaps</h4><ul>{portfolioAnalysis.analysis.analysis.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
              )}
            </div>
          )}
          <p className="powered-by">Powered by OpenRouter AI</p>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Policies ({total})</h3>
          <div className="total-premium">Total Monthly Premium: ${totalPremium.toFixed(2)}</div>

          <div className="list-toolbar">
            <SearchBar value={search} onChange={(val) => { setSearch(val); setOffset(0); }} placeholder="Search policies..." />
            <SortControls columns={sortColumns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }} />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            totalCount={policies.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
          />

          {policies.length === 0 ? (
            <EmptyState title="No insurance policies yet" message="Add your first policy to optimize coverage." />
          ) : (
            policies.map(policy => (
              <div key={policy.id} className={`data-card clickable has-checkbox ${selectedPolicy?.id === policy.id ? 'selected' : ''}`} onClick={() => setSelectedPolicy(policy)}>
                <input
                  type="checkbox"
                  className="card-checkbox"
                  checked={selectedIds.includes(policy.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectItem(policy.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span className="type-badge">{policy.insuranceType.toUpperCase()}</span>
                    {policy.isActive && <span className="badge active">Active</span>}
                  </div>
                  {policy.aiCoverageScore && (
                    <div className="ai-score" style={{ backgroundColor: getCoverageColor(policy.aiCoverageScore) }}>{policy.aiCoverageScore}</div>
                  )}
                </div>
                <p className="card-subtitle">{policy.provider || 'No provider specified'}</p>
                <div className="card-details">
                  <span>Coverage: ${policy.coverageAmount?.toLocaleString() || 'N/A'}</span>
                  <span>Premium: ${policy.premium}/mo</span>
                </div>
                {policy.aiPremiumRating && (
                  <div className="premium-rating" style={{ color: getPremiumRatingColor(policy.aiPremiumRating) }}>
                    Premium: {policy.aiPremiumRating.toUpperCase()}
                  </div>
                )}
                {policy.aiSavingsPotential > 0 && (
                  <div className="savings-badge">Potential Savings: ${policy.aiSavingsPotential}/mo</div>
                )}
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleAnalyze(policy); }} disabled={analyzing === policy.id} className="btn-small">{analyzing === policy.id ? 'Analyzing...' : 'AI Analyze'}</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(policy); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(policy.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}

          <Pagination offset={offset} limit={limit} total={total} onPageChange={setOffset} />
        </div>

        <div className="detail-panel">
          {selectedPolicy ? (
            <div className="detail-content">
              <h2>{selectedPolicy.insuranceType.charAt(0).toUpperCase() + selectedPolicy.insuranceType.slice(1)} Insurance</h2>

              <div className="detail-section">
                <h3>Policy Details</h3>
                <div className="info-grid">
                  <div className="info-item"><label>Provider</label><span>{selectedPolicy.provider || 'N/A'}</span></div>
                  <div className="info-item"><label>Policy Number</label><span>{selectedPolicy.policyNumber || 'N/A'}</span></div>
                  <div className="info-item"><label>Coverage</label><span>${selectedPolicy.coverageAmount?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>Premium</label><span>${selectedPolicy.premium}/month</span></div>
                  <div className="info-item"><label>Deductible</label><span>${selectedPolicy.deductible?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>Status</label><span>{selectedPolicy.isActive ? 'Active' : 'Inactive'}</span></div>
                </div>
              </div>

              {selectedPolicy.analysis && (
                <div className="ai-analysis-section">
                  <h3>AI Analysis</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getCoverageColor(selectedPolicy.aiCoverageScore) }}>
                      <span className="score-value">{selectedPolicy.aiCoverageScore}</span>
                      <span className="score-label">Coverage Score</span>
                    </div>
                    <div className="ai-meta">
                      <div><span className="label">Premium Rating:</span><span className="value" style={{ color: getPremiumRatingColor(selectedPolicy.aiPremiumRating) }}>{selectedPolicy.aiPremiumRating?.toUpperCase()}</span></div>
                      {selectedPolicy.aiSavingsPotential > 0 && <div><span className="label">Potential Savings:</span><span className="value highlight">${selectedPolicy.aiSavingsPotential}/mo</span></div>}
                    </div>
                  </div>

                  <div className="analysis-content">
                    {selectedPolicy.analysis.summary && (
                      <div className="analysis-summary"><h4>Summary</h4><p>{selectedPolicy.analysis.summary}</p></div>
                    )}

                    {selectedPolicy.aiGaps?.length > 0 && (
                      <div className="gaps-section">
                        <h4>Coverage Gaps</h4>
                        {selectedPolicy.aiGaps.map((gap, i) => (
                          <div key={i} className={`gap-item ${gap.risk}`}>
                            <span className="gap-name">{gap.gap}</span>
                            <span className="gap-risk">{gap.risk} risk</span>
                            <p className="gap-recommendation">{gap.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPolicy.aiRecommendations?.length > 0 && (
                      <div className="recommendations">
                        <h4>Recommendations</h4>
                        {selectedPolicy.aiRecommendations.map((rec, i) => (
                          <div key={i} className={`recommendation-item ${rec.priority}`}>
                            <h5>{rec.title}</h5>
                            <p>{rec.description}</p>
                            {rec.potentialSavings && <span className="savings">Save ${rec.potentialSavings}/mo</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPolicy.aiAlternatives?.length > 0 && (
                      <div className="alternatives-section">
                        <h4>Alternative Policies</h4>
                        <div className="alternatives-grid">
                          {selectedPolicy.aiAlternatives.map((alt, i) => (
                            <div key={i} className="alternative-card">
                              <h5>{alt.provider}</h5>
                              <p className="premium">Est. Premium: ${alt.estimatedPremium}/mo</p>
                              <p className="coverage">{alt.coverage}</p>
                              <div className="pros-cons">
                                {alt.pros && <span className="pros">+ {alt.pros.join(', ')}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedPolicy.analysis && (
                <div className="no-analysis">
                  <p>No AI analysis yet. Click "AI Analyze" to get optimization suggestions.</p>
                  <button onClick={() => handleAnalyze(selectedPolicy)} disabled={analyzing === selectedPolicy.id} className="btn-primary">{analyzing === selectedPolicy.id ? 'Analyzing...' : 'Generate AI Analysis'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a policy to view details</p></div>
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

export default InsuranceOptimizer;
