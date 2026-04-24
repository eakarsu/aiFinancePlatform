import React, { useState, useEffect } from 'react';
import { Building2, DollarSign, Calculator, Plus, Edit2, Trash2 } from 'lucide-react';
import { getLoans, addLoan, deleteLoan, analyzeLoan, updateLoan, calculateLoanPayment, bulkDeleteLoans, exportLoans, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

function LoanAdvisor() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);
  const [formData, setFormData] = useState({
    loanType: 'personal', loanAmount: '', loanPurpose: '', loanTerm: '60', desiredRate: '',
    annualIncome: '', employmentStatus: 'employed', employmentYears: '', creditScore: '',
    existingDebts: '', monthlyExpenses: '', collateralValue: '', downPayment: ''
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

  useEffect(() => { loadLoans(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadLoans = async () => {
    try {
      setLoading(true);
      const response = await getLoans({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setLoans(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      ['loanAmount', 'loanTerm', 'desiredRate', 'annualIncome', 'employmentYears', 'creditScore', 'existingDebts', 'monthlyExpenses', 'collateralValue', 'downPayment'].forEach(key => {
        data[key] = data[key] ? parseFloat(data[key]) : null;
      });

      if (editingLoan) {
        await updateLoan(editingLoan.id, data);
      } else {
        await addLoan(data);
      }
      setShowForm(false);
      setEditingLoan(null);
      setFormData({ loanType: 'personal', loanAmount: '', loanPurpose: '', loanTerm: '60', desiredRate: '', annualIncome: '', employmentStatus: 'employed', employmentYears: '', creditScore: '', existingDebts: '', monthlyExpenses: '', collateralValue: '', downPayment: '' });
      loadLoans();
    } catch (error) {
      console.error('Failed to save loan:', error);
    }
  };

  const handleAnalyze = async (loan) => {
    setAnalyzing(loan.id);
    try {
      const response = await analyzeLoan(loan.id);
      const ai = response.data.analysis || {};
      setSelectedLoan({
        ...loan,
        analysis: ai.analysis || ai,
        aiApprovalLikelihood: ai.aiApprovalLikelihood,
        aiRecommendedRate: ai.aiRecommendedRate,
        aiMonthlyPayment: ai.aiMonthlyPayment,
        aiTotalInterest: ai.aiTotalInterest,
        aiBestLenders: ai.bestLenders,
      });
      loadLoans();
    } catch (error) {
      console.error('Failed to analyze loan:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Loan Application',
      message: 'Delete this loan application?',
      onConfirm: async () => {
        await deleteLoan(id);
        loadLoans();
        if (selectedLoan?.id === id) setSelectedLoan(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleEdit = (loan) => {
    setEditingLoan(loan);
    setFormData({
      loanType: loan.loanType || 'personal', loanAmount: loan.loanAmount || '', loanPurpose: loan.loanPurpose || '',
      loanTerm: loan.loanTerm || '60', desiredRate: loan.desiredRate || '', annualIncome: loan.annualIncome || '',
      employmentStatus: loan.employmentStatus || 'employed', employmentYears: loan.employmentYears || '',
      creditScore: loan.creditScore || '', existingDebts: loan.existingDebts || '',
      monthlyExpenses: loan.monthlyExpenses || '', collateralValue: loan.collateralValue || '',
      downPayment: loan.downPayment || ''
    });
    setShowForm(true);
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected loan application(s)?`,
      onConfirm: async () => {
        await bulkDeleteLoans(selectedIds);
        setSelectedIds([]);
        loadLoans();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleExport = async (format) => {
    await downloadExport(exportLoans, format, 'loans');
  };

  const handleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === loans.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(loans.map(l => l.id));
    }
  };

  const getApprovalColor = (likelihood) => {
    if (likelihood >= 70) return '#4CAF50';
    if (likelihood >= 50) return '#FF9800';
    return '#f44336';
  };

  const loanTypes = ['personal', 'mortgage', 'auto', 'student', 'business'];

  const sortColumns = [
    { field: 'createdAt', label: 'Date' },
    { field: 'loanType', label: 'Type' },
    { field: 'loanAmount', label: 'Amount' },
    { field: 'status', label: 'Status' }
  ];

  if (loading && loans.length === 0) return <LoadingSkeleton type="cards" count={6} />;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Loan Advisor</h1>
        <p>Get AI-powered loan advice and approval likelihood assessment</p>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingLoan(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> New Loan Application</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>{editingLoan ? 'Edit' : 'New'} Loan Application</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <h3>Loan Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Loan Type *</label>
                    <select value={formData.loanType} onChange={e => setFormData({...formData, loanType: e.target.value})}>
                      {loanTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Loan Amount ($) *</label><input type="number" value={formData.loanAmount} onChange={e => setFormData({...formData, loanAmount: e.target.value})} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Loan Term (months)</label><input type="number" value={formData.loanTerm} onChange={e => setFormData({...formData, loanTerm: e.target.value})} /></div>
                  <div className="form-group"><label>Desired Interest Rate (%)</label><input type="number" step="0.01" value={formData.desiredRate} onChange={e => setFormData({...formData, desiredRate: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>Loan Purpose</label><input value={formData.loanPurpose} onChange={e => setFormData({...formData, loanPurpose: e.target.value})} placeholder="e.g., Home renovation, debt consolidation" /></div>
              </div>

              <div className="form-section">
                <h3>Financial Profile</h3>
                <div className="form-row">
                  <div className="form-group"><label>Annual Income ($)</label><input type="number" value={formData.annualIncome} onChange={e => setFormData({...formData, annualIncome: e.target.value})} /></div>
                  <div className="form-group"><label>Credit Score</label><input type="number" min="300" max="850" value={formData.creditScore} onChange={e => setFormData({...formData, creditScore: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Employment Status</label>
                    <select value={formData.employmentStatus} onChange={e => setFormData({...formData, employmentStatus: e.target.value})}>
                      <option value="employed">Employed</option>
                      <option value="self-employed">Self-Employed</option>
                      <option value="retired">Retired</option>
                      <option value="unemployed">Unemployed</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Years Employed</label><input type="number" step="0.5" value={formData.employmentYears} onChange={e => setFormData({...formData, employmentYears: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Existing Debts ($)</label><input type="number" value={formData.existingDebts} onChange={e => setFormData({...formData, existingDebts: e.target.value})} /></div>
                  <div className="form-group"><label>Monthly Expenses ($)</label><input type="number" value={formData.monthlyExpenses} onChange={e => setFormData({...formData, monthlyExpenses: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Collateral Value ($)</label><input type="number" value={formData.collateralValue} onChange={e => setFormData({...formData, collateralValue: e.target.value})} /></div>
                  <div className="form-group"><label>Down Payment ($)</label><input type="number" value={formData.downPayment} onChange={e => setFormData({...formData, downPayment: e.target.value})} /></div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingLoan ? 'Update' : 'Create'} Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Loan Applications ({total})</h3>

          <div className="list-toolbar">
            <SearchBar value={search} onChange={(val) => { setSearch(val); setOffset(0); }} placeholder="Search loans..." />
            <SortControls columns={sortColumns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }} />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            totalCount={loans.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
          />

          {loans.length === 0 ? (
            <EmptyState title="No loan applications yet" message="Add your first loan to get AI advice." />
          ) : (
            loans.map(loan => (
              <div key={loan.id} className={`data-card clickable has-checkbox ${selectedLoan?.id === loan.id ? 'selected' : ''}`} onClick={() => setSelectedLoan(loan)}>
                <input
                  type="checkbox"
                  className="card-checkbox"
                  checked={selectedIds.includes(loan.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectItem(loan.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span className="loan-type">{loan.loanType.toUpperCase()}</span>
                    <span className="badge">{loan.status}</span>
                  </div>
                  {loan.aiApprovalLikelihood && (
                    <div className="ai-score" style={{ backgroundColor: getApprovalColor(loan.aiApprovalLikelihood) }}>{loan.aiApprovalLikelihood}%</div>
                  )}
                </div>
                <p className="card-amount">${loan.loanAmount?.toLocaleString()}</p>
                <div className="card-details">
                  <span>{loan.loanTerm} months</span>
                  {loan.aiRecommendedRate && <span>AI Rate: {loan.aiRecommendedRate}%</span>}
                </div>
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleAnalyze(loan); }} disabled={analyzing === loan.id} className="btn-small">{analyzing === loan.id ? 'Analyzing...' : 'AI Analyze'}</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(loan); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(loan.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}

          <Pagination offset={offset} limit={limit} total={total} onPageChange={setOffset} />
        </div>

        <div className="detail-panel">
          {selectedLoan ? (
            <div className="detail-content">
              <h2>{selectedLoan.loanType.charAt(0).toUpperCase() + selectedLoan.loanType.slice(1)} Loan</h2>
              <div className="loan-amount-display">${selectedLoan.loanAmount?.toLocaleString()}</div>

              <div className="detail-section">
                <h3>Loan Details</h3>
                <div className="info-grid">
                  <div className="info-item"><label>Loan Type</label><span>{selectedLoan.loanType}</span></div>
                  <div className="info-item"><label>Amount</label><span>${selectedLoan.loanAmount?.toLocaleString()}</span></div>
                  <div className="info-item"><label>Term</label><span>{selectedLoan.loanTerm} months</span></div>
                  <div className="info-item"><label>Purpose</label><span>{selectedLoan.loanPurpose || 'N/A'}</span></div>
                  <div className="info-item"><label>Credit Score</label><span>{selectedLoan.creditScore || 'N/A'}</span></div>
                  <div className="info-item"><label>Annual Income</label><span>${selectedLoan.annualIncome?.toLocaleString() || 'N/A'}</span></div>
                </div>
              </div>

              {selectedLoan.analysis && (
                <div className="ai-analysis-section">
                  <h3>AI Loan Analysis</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getApprovalColor(selectedLoan.aiApprovalLikelihood) }}>
                      <span className="score-value">{selectedLoan.aiApprovalLikelihood}%</span>
                      <span className="score-label">Approval Likelihood</span>
                    </div>
                    <div className="ai-meta">
                      <div><span className="label">Recommended Rate:</span><span className="value">{selectedLoan.aiRecommendedRate}%</span></div>
                      <div><span className="label">Monthly Payment:</span><span className="value">${selectedLoan.aiMonthlyPayment?.toLocaleString()}</span></div>
                      <div><span className="label">Total Interest:</span><span className="value">${selectedLoan.aiTotalInterest?.toLocaleString()}</span></div>
                    </div>
                  </div>

                  <div className="analysis-content">
                    <div className="analysis-summary"><h4>Summary</h4><p>{selectedLoan.analysis.summary}</p></div>

                    {selectedLoan.analysis.dtiAssessment && (
                      <div className="analysis-item">
                        <h4>Debt-to-Income Assessment</h4>
                        <p>DTI Ratio: {selectedLoan.analysis.dtiRatio}%</p>
                        <p>{selectedLoan.analysis.dtiAssessment}</p>
                      </div>
                    )}

                    {selectedLoan.analysis.strengths && (
                      <div className="analysis-list"><h4>Strengths</h4><ul className="pros-list">{selectedLoan.analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    )}

                    {selectedLoan.analysis.concerns && (
                      <div className="analysis-list"><h4>Concerns</h4><ul className="cons-list">{selectedLoan.analysis.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                    )}

                    {selectedLoan.analysis.recommendations && (
                      <div className="recommendations"><h4>Recommendations</h4><ul>{selectedLoan.analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                    )}

                    {selectedLoan.aiBestLenders && (
                      <div className="lenders-section">
                        <h4>Recommended Lenders</h4>
                        <div className="lenders-grid">
                          {selectedLoan.aiBestLenders.map((lender, i) => (
                            <div key={i} className="lender-card">
                              <h5>{lender.name}</h5>
                              <p className="lender-type">{lender.type}</p>
                              <p className="lender-rate">Est. Rate: {lender.estimatedRate}%</p>
                              {lender.pros && <div className="pros"><strong>Pros:</strong> {lender.pros.join(', ')}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedLoan.analysis && (
                <div className="no-analysis">
                  <p>No AI analysis yet. Click "AI Analyze" to get loan advice.</p>
                  <button onClick={() => handleAnalyze(selectedLoan)} disabled={analyzing === selectedLoan.id} className="btn-primary">{analyzing === selectedLoan.id ? 'Analyzing...' : 'Generate AI Analysis'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a loan application to view details</p></div>
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

export default LoanAdvisor;
