import React, { useState, useEffect } from 'react';
import { Phone, TrendingDown, Plus, Edit2, Trash2 } from 'lucide-react';
import { getBills, addBill, deleteBill, updateBill, getNegotiationStrategy, recordNegotiation, analyzeAllBills, bulkDeleteBills, exportBills, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

function BillNegotiator() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showNegotiate, setShowNegotiate] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [negotiateForm, setNegotiateForm] = useState({ newAmount: '', notes: '', success: true });
  const [formData, setFormData] = useState({
    billType: 'internet', provider: '', currentAmount: '', originalAmount: '',
    frequency: 'monthly', dueDate: '', accountNumber: '', isUnderContract: false,
    contractStart: '', contractEnd: ''
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

  useEffect(() => { loadBills(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const response = await getBills({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setBills(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        currentAmount: parseFloat(formData.currentAmount) || 0,
        originalAmount: parseFloat(formData.originalAmount) || parseFloat(formData.currentAmount) || 0,
        dueDate: formData.dueDate ? parseInt(formData.dueDate) : null
      };

      if (editingBill) {
        await updateBill(editingBill.id, data);
      } else {
        await addBill(data);
      }
      setShowForm(false);
      setEditingBill(null);
      setFormData({ billType: 'internet', provider: '', currentAmount: '', originalAmount: '', frequency: 'monthly', dueDate: '', accountNumber: '', isUnderContract: false, contractStart: '', contractEnd: '' });
      loadBills();
    } catch (error) {
      console.error('Failed to save bill:', error);
    }
  };

  const handleGetStrategy = async (bill) => {
    setAnalyzing(bill.id);
    try {
      const response = await getNegotiationStrategy(bill.id);
      const s = response.data.strategy || {};
      setSelectedBill({
        ...bill,
        strategy: s,
        aiSuccessLikelihood: s.aiSuccessLikelihood,
        aiSavingsEstimate: s.aiSavingsEstimate,
        aiAlternatives: s.alternatives,
        aiTips: s.tips,
      });
      loadBills();
    } catch (error) {
      console.error('Failed to get strategy:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleRecordNegotiation = async (billId) => {
    try {
      await recordNegotiation(billId, {
        newAmount: parseFloat(negotiateForm.newAmount),
        notes: negotiateForm.notes,
        success: negotiateForm.success
      });
      setShowNegotiate(null);
      setNegotiateForm({ newAmount: '', notes: '', success: true });
      loadBills();
    } catch (error) {
      console.error('Failed to record negotiation:', error);
    }
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const response = await analyzeAllBills();
      setPortfolioAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze all bills:', error);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Bill',
      message: 'Delete this bill?',
      onConfirm: async () => {
        await deleteBill(id);
        loadBills();
        if (selectedBill?.id === id) setSelectedBill(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      billType: bill.billType || 'internet', provider: bill.provider || '',
      currentAmount: bill.currentAmount || '', originalAmount: bill.originalAmount || '',
      frequency: bill.frequency || 'monthly', dueDate: bill.dueDate || '',
      accountNumber: bill.accountNumber || '', isUnderContract: bill.isUnderContract || false,
      contractStart: bill.contractStart?.split('T')[0] || '', contractEnd: bill.contractEnd?.split('T')[0] || ''
    });
    setShowForm(true);
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected bill(s)?`,
      onConfirm: async () => {
        await bulkDeleteBills(selectedIds);
        setSelectedIds([]);
        loadBills();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleExport = async (format) => {
    await downloadExport(exportBills, format, 'bills');
  };

  const handleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === bills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(bills.map(b => b.id));
    }
  };

  const getSavingsColor = (savings) => {
    if (savings >= 30) return '#4CAF50';
    if (savings >= 15) return '#8BC34A';
    if (savings >= 5) return '#FF9800';
    return '#607D8B';
  };

  const getSuccessColor = (likelihood) => {
    if (likelihood >= 70) return '#4CAF50';
    if (likelihood >= 50) return '#FF9800';
    return '#f44336';
  };

  const billTypes = ['cable', 'internet', 'phone', 'insurance', 'subscription', 'utility', 'gym', 'streaming'];
  const totalMonthly = bills.reduce((sum, b) => {
    const monthly = b.frequency === 'yearly' ? b.currentAmount / 12 : b.currentAmount;
    return sum + (monthly || 0);
  }, 0);
  const totalSavingsPotential = bills.reduce((sum, b) => sum + (b.aiSavingsEstimate || 0), 0);

  const sortColumns = [
    { field: 'createdAt', label: 'Date' },
    { field: 'provider', label: 'Provider' },
    { field: 'currentAmount', label: 'Amount' },
    { field: 'billType', label: 'Type' }
  ];

  if (loading && bills.length === 0) return <LoadingSkeleton type="cards" count={6} />;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Bill Negotiator</h1>
        <p>Get AI-powered negotiation strategies to lower your bills</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingBill(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Add Bill</button>
          {bills.length > 0 && (
            <button className="btn-secondary" onClick={handleAnalyzeAll} disabled={analyzingAll}>
              {analyzingAll ? 'Analyzing...' : 'Analyze All Bills'}
            </button>
          )}
        </div>
      </div>

      {bills.length > 0 && (
        <div className="bills-summary">
          <div className="summary-item"><label>Total Monthly Bills</label><span>${totalMonthly.toFixed(2)}</span></div>
          <div className="summary-item"><label>Annual Spending</label><span>${(totalMonthly * 12).toFixed(2)}</span></div>
          <div className="summary-item highlight"><label>Est. Savings Potential</label><span>${totalSavingsPotential}/mo</span></div>
        </div>
      )}

      {portfolioAnalysis && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>Bills Portfolio Analysis</h3>
            <button className="btn-close" onClick={() => setPortfolioAnalysis(null)}>×</button>
          </div>
          <div className="portfolio-savings">
            <div className="savings-highlight">
              <span className="label">Potential Annual Savings</span>
              <span className="amount">${portfolioAnalysis.analysis?.potentialAnnualSavings?.toFixed(0)}</span>
            </div>
            <div className="current-vs-optimized">
              <div><label>Current Monthly</label><span>${portfolioAnalysis.analysis?.totalMonthly?.toFixed(2)}</span></div>
              <div><label>Optimized Monthly</label><span>${(portfolioAnalysis.analysis?.totalMonthly - portfolioAnalysis.analysis?.potentialMonthlySavings)?.toFixed(2)}</span></div>
            </div>
          </div>
          {portfolioAnalysis.analysis?.analysis && (
            <div className="portfolio-insights">
              <p>{portfolioAnalysis.analysis.analysis.summary}</p>
              {portfolioAnalysis.analysis.analysis.marketComparison && (
                <p><strong>Market Comparison:</strong> {portfolioAnalysis.analysis.analysis.marketComparison}</p>
              )}
              {portfolioAnalysis.analysis.analysis.quickWins?.length > 0 && (
                <div className="quick-wins"><h4>Quick Wins</h4><ul>{portfolioAnalysis.analysis.analysis.quickWins.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
              )}
              {portfolioAnalysis.analysis.analysis.overPayingBills?.length > 0 && (
                <div className="quick-wins"><h4>Where You're Overpaying</h4><ul>{portfolioAnalysis.analysis.analysis.overPayingBills.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
              )}
            </div>
          )}
          {portfolioAnalysis.analysis?.billAnalysis?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Bill-by-Bill Breakdown</h4>
              {portfolioAnalysis.analysis.billAnalysis.map((b, i) => (
                <div key={i} className="action-item" style={{flexDirection:'column',alignItems:'flex-start',gap:'4px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                    <strong>{b.bill}</strong>
                    <span style={{color:'#4CAF50',fontWeight:'bold'}}>Save ${b.savingsPotential}/mo</span>
                  </div>
                  <div style={{fontSize:'0.85rem',color:'#666'}}>Current: ${b.currentAmount}/mo | Market avg: ${b.marketAverage}/mo</div>
                  <div style={{fontSize:'0.9rem'}}>{b.recommendation}</div>
                </div>
              ))}
            </div>
          )}
          {portfolioAnalysis.analysis?.recommendations?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Recommendations</h4>
              {portfolioAnalysis.analysis.recommendations.map((r, i) => (
                <div key={i} className="action-item" style={{flexDirection:'column',alignItems:'flex-start',gap:'4px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                    <strong>{r.title}</strong>
                    {r.potentialSavings > 0 && <span style={{color:'#4CAF50',fontWeight:'bold'}}>Save ${r.potentialSavings}/mo</span>}
                  </div>
                  <p style={{margin:'2px 0',fontSize:'0.9rem'}}>{r.description}</p>
                  {r.effort && <span className={`badge ${r.effort}`} style={{fontSize:'0.75rem'}}>{r.effort} effort</span>}
                </div>
              ))}
            </div>
          )}
          {portfolioAnalysis.analysis?.actionPlan?.length > 0 && (
            <div className="action-plan">
              <h4>Action Plan</h4>
              {portfolioAnalysis.analysis.actionPlan.map((item, i) => (
                <div key={i} className="action-item">
                  <span className="priority">#{item.priority}</span>
                  <span className="bill">{item.bill}</span>
                  <span className="action">{item.action}</span>
                  <span className="savings">Save ${item.expectedSavings}/mo</span>
                  {item.timeframe && <span className="timeframe" style={{fontSize:'0.8rem',color:'#888'}}>{item.timeframe}</span>}
                </div>
              ))}
            </div>
          )}
          {portfolioAnalysis.analysis?.negotiationCalendar?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Negotiation Calendar</h4>
              {portfolioAnalysis.analysis.negotiationCalendar.map((n, i) => (
                <div key={i} style={{marginBottom:'8px'}}>
                  <strong>{n.bill}</strong> - {n.bestTime}
                  {n.reason && <span style={{fontSize:'0.85rem',color:'#666'}}> ({n.reason})</span>}
                </div>
              ))}
            </div>
          )}
          <p className="powered-by">Powered by OpenRouter AI</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingBill ? 'Edit' : 'Add'} Bill</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Bill Type *</label>
                  <select value={formData.billType} onChange={e => setFormData({...formData, billType: e.target.value})}>
                    {billTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Provider *</label><input value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} required placeholder="e.g., Comcast, Verizon" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Current Amount ($) *</label><input type="number" step="0.01" value={formData.currentAmount} onChange={e => setFormData({...formData, currentAmount: e.target.value})} required /></div>
                <div className="form-group"><label>Original Amount ($)</label><input type="number" step="0.01" value={formData.originalAmount} onChange={e => setFormData({...formData, originalAmount: e.target.value})} placeholder="Before any discounts" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div className="form-group"><label>Due Date (day of month)</label><input type="number" min="1" max="31" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Account Number</label><input value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} /></div>
              <div className="form-group checkbox">
                <label><input type="checkbox" checked={formData.isUnderContract} onChange={e => setFormData({...formData, isUnderContract: e.target.checked})} /> Under Contract</label>
              </div>
              {formData.isUnderContract && (
                <div className="form-row">
                  <div className="form-group"><label>Contract Start</label><input type="date" value={formData.contractStart} onChange={e => setFormData({...formData, contractStart: e.target.value})} /></div>
                  <div className="form-group"><label>Contract End</label><input type="date" value={formData.contractEnd} onChange={e => setFormData({...formData, contractEnd: e.target.value})} /></div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingBill ? 'Update' : 'Add'} Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNegotiate && (
        <div className="modal-overlay" onClick={() => setShowNegotiate(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Record Negotiation Result</h2>
            <p>Bill: {bills.find(b => b.id === showNegotiate)?.provider} - {bills.find(b => b.id === showNegotiate)?.billType}</p>
            <div className="form-group checkbox">
              <label><input type="checkbox" checked={negotiateForm.success} onChange={e => setNegotiateForm({...negotiateForm, success: e.target.checked})} /> Negotiation Successful</label>
            </div>
            {negotiateForm.success && (
              <div className="form-group"><label>New Amount ($)</label><input type="number" step="0.01" value={negotiateForm.newAmount} onChange={e => setNegotiateForm({...negotiateForm, newAmount: e.target.value})} /></div>
            )}
            <div className="form-group"><label>Notes</label><textarea value={negotiateForm.notes} onChange={e => setNegotiateForm({...negotiateForm, notes: e.target.value})} placeholder="What happened during the call?" /></div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowNegotiate(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => handleRecordNegotiation(showNegotiate)}>Record Result</button>
            </div>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Bills ({total})</h3>

          <div className="list-toolbar">
            <SearchBar value={search} onChange={(val) => { setSearch(val); setOffset(0); }} placeholder="Search bills..." />
            <SortControls columns={sortColumns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }} />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            totalCount={bills.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
          />

          {bills.length === 0 ? (
            <EmptyState title="No bills yet" message="Add your first bill to find savings." />
          ) : (
            bills.map(bill => (
              <div key={bill.id} className={`data-card clickable has-checkbox ${selectedBill?.id === bill.id ? 'selected' : ''}`} onClick={() => setSelectedBill(bill)}>
                <input
                  type="checkbox"
                  className="card-checkbox"
                  checked={selectedIds.includes(bill.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectItem(bill.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span className="bill-type">{bill.billType.toUpperCase()}</span>
                    {bill.isUnderContract && <span className="badge contract">Contract</span>}
                  </div>
                  {bill.aiSavingsEstimate > 0 && (
                    <div className="savings-badge" style={{ backgroundColor: getSavingsColor(bill.aiSavingsEstimate) }}>
                      Save ${bill.aiSavingsEstimate}/mo
                    </div>
                  )}
                </div>
                <p className="card-provider">{bill.provider}</p>
                <div className="card-amount">${bill.currentAmount}/{bill.frequency === 'yearly' ? 'yr' : 'mo'}</div>
                <div className="card-details">
                  {bill.lastNegotiated && <span>Last negotiated: {new Date(bill.lastNegotiated).toLocaleDateString()}</span>}
                  {bill.aiSuccessLikelihood && <span style={{ color: getSuccessColor(bill.aiSuccessLikelihood) }}>{bill.aiSuccessLikelihood}% success chance</span>}
                </div>
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleGetStrategy(bill); }} disabled={analyzing === bill.id} className="btn-small">{analyzing === bill.id ? 'Loading...' : 'Get Strategy'}</button>
                  <button onClick={(e) => { e.stopPropagation(); setShowNegotiate(bill.id); }} className="btn-small">Record Result</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(bill); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(bill.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}

          <Pagination offset={offset} limit={limit} total={total} onPageChange={setOffset} />
        </div>

        <div className="detail-panel">
          {selectedBill ? (
            <div className="detail-content">
              <h2>{selectedBill.provider}</h2>
              <p className="bill-type-label">{selectedBill.billType}</p>

              <div className="bill-overview">
                <div className="current-amount">
                  <span className="label">Current Amount</span>
                  <span className="amount">${selectedBill.currentAmount}/{selectedBill.frequency === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                {selectedBill.originalAmount && selectedBill.originalAmount !== selectedBill.currentAmount && (
                  <div className="original-amount">
                    <span className="label">Original</span>
                    <span className="amount strikethrough">${selectedBill.originalAmount}</span>
                    <span className="saved">You've saved ${(selectedBill.originalAmount - selectedBill.currentAmount).toFixed(2)}/mo</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Bill Details</h3>
                <div className="info-grid">
                  <div className="info-item"><label>Provider</label><span>{selectedBill.provider}</span></div>
                  <div className="info-item"><label>Type</label><span>{selectedBill.billType}</span></div>
                  <div className="info-item"><label>Frequency</label><span>{selectedBill.frequency}</span></div>
                  {selectedBill.dueDate && <div className="info-item"><label>Due Date</label><span>{selectedBill.dueDate}th of month</span></div>}
                  <div className="info-item"><label>Under Contract</label><span>{selectedBill.isUnderContract ? 'Yes' : 'No'}</span></div>
                  {selectedBill.contractEnd && <div className="info-item"><label>Contract Ends</label><span>{new Date(selectedBill.contractEnd).toLocaleDateString()}</span></div>}
                </div>
              </div>

              {selectedBill.negotiationHistory?.length > 0 && (
                <div className="detail-section">
                  <h3>Negotiation History</h3>
                  <div className="history-list">
                    {selectedBill.negotiationHistory.map((h, i) => (
                      <div key={i} className={`history-item ${h.success ? 'success' : 'failed'}`}>
                        <span className="date">{new Date(h.date).toLocaleDateString()}</span>
                        <span className="result">{h.success ? `Reduced to $${h.newAmount}` : 'No reduction'}</span>
                        {h.savings > 0 && <span className="savings">Saved ${h.savings}/mo</span>}
                        {h.notes && <p className="notes">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBill.strategy && (
                <div className="ai-analysis-section">
                  <h3>AI Negotiation Strategy</h3>
                  <div className="strategy-header">
                    <div className="success-likelihood" style={{ backgroundColor: getSuccessColor(selectedBill.aiSuccessLikelihood) }}>
                      <span className="value">{selectedBill.aiSuccessLikelihood}%</span>
                      <span className="label">Success Likelihood</span>
                    </div>
                    <div className="savings-estimate">
                      <span className="label">Estimated Savings</span>
                      <span className="value">${selectedBill.aiSavingsEstimate}/mo</span>
                    </div>
                  </div>

                  <div className="strategy-content">
                    {selectedBill.strategy.analysis && (
                      <div className="analysis-summary">
                        <h4>Analysis</h4>
                        <p>{selectedBill.strategy.analysis.summary}</p>
                        {selectedBill.strategy.analysis.marketRate && <p><strong>Market Rate:</strong> {selectedBill.strategy.analysis.marketRate}</p>}
                      </div>
                    )}

                    {selectedBill.strategy.negotiationScript && (
                      <div className="negotiation-script">
                        <h4>Negotiation Script</h4>
                        <div className="script-section">
                          <h5>Opening</h5>
                          <p className="script-text">{selectedBill.strategy.negotiationScript.opening}</p>
                        </div>
                        {selectedBill.strategy.negotiationScript.keyPoints && (
                          <div className="script-section">
                            <h5>Key Points to Mention</h5>
                            <ul>{selectedBill.strategy.negotiationScript.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                          </div>
                        )}
                        {selectedBill.strategy.negotiationScript.objectionHandling && (
                          <div className="script-section">
                            <h5>Handling Objections</h5>
                            {selectedBill.strategy.negotiationScript.objectionHandling.map((oh, i) => (
                              <div key={i} className="objection">
                                <p className="objection-text"><strong>If they say:</strong> "{oh.objection}"</p>
                                <p className="response-text"><strong>You say:</strong> "{oh.response}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="script-section">
                          <h5>Closing</h5>
                          <p className="script-text">{selectedBill.strategy.negotiationScript.closing}</p>
                        </div>
                      </div>
                    )}

                    {selectedBill.aiAlternatives && (
                      <div className="alternatives-section">
                        <h4>Alternative Providers</h4>
                        <div className="alternatives-grid">
                          {selectedBill.aiAlternatives.map((alt, i) => (
                            <div key={i} className="alternative-card">
                              <h5>{alt.provider}</h5>
                              <p className="cost">Est. Cost: ${alt.estimatedCost}/mo</p>
                              <p className="features">{alt.features}</p>
                              {alt.switchingCost && <p className="switching">Switching cost: {alt.switchingCost}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedBill.aiTips && (
                      <div className="tips-section">
                        <h4>Pro Tips</h4>
                        <ul className="tips-list">{selectedBill.aiTips.map((tip, i) => <li key={i} className={tip.importance}>{tip.tip}</li>)}</ul>
                      </div>
                    )}

                    {selectedBill.strategy.timeline && (
                      <div className="timeline-section">
                        <h4>When to Call</h4>
                        <p><strong>Best Days:</strong> {selectedBill.strategy.timeline.bestDays}</p>
                        <p><strong>Before You Call:</strong> {selectedBill.strategy.timeline.preparation}</p>
                        <p><strong>Estimated Call Time:</strong> {selectedBill.strategy.timeline.estimatedCallTime}</p>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedBill.strategy && (
                <div className="no-analysis">
                  <p>Get an AI-powered negotiation strategy to lower this bill.</p>
                  <button onClick={() => handleGetStrategy(selectedBill)} disabled={analyzing === selectedBill.id} className="btn-primary">{analyzing === selectedBill.id ? 'Loading...' : 'Get Negotiation Strategy'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a bill to view details and negotiation strategies</p></div>
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

export default BillNegotiator;
