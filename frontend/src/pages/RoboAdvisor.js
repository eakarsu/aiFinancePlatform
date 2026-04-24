import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Briefcase, TrendingUp, DollarSign, Bot, RefreshCw, ChevronRight, Star } from 'lucide-react';
import * as api from '../services/api';
import { bulkDeletePortfolios, exportPortfolios, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A', '#FF5722'];

const PORTFOLIO_SORT_COLUMNS = [
  { field: 'createdAt', label: 'Date' },
  { field: 'name', label: 'Name' },
  { field: 'totalValue', label: 'Value' },
  { field: 'type', label: 'Type' }
];

function RoboAdvisor() {
  const navigate = useNavigate();
  const [riskProfile, setRiskProfile] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('portfolios');
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  // Search, sort, pagination state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Bulk selection & confirm dialog
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    riskTolerance: 'MODERATE',
    investmentGoal: 'growth',
    timeHorizon: 10,
    monthlyIncome: '',
    monthlyExpenses: '',
    emergencyFund: ''
  });
  const [investmentAmount, setInvestmentAmount] = useState(10000);

  useEffect(() => {
    loadRiskProfile();
  }, []);

  useEffect(() => {
    loadPortfolios();
  }, [search, sortBy, sortOrder, offset, limit]);

  const loadRiskProfile = async () => {
    try {
      const profileRes = await api.getRiskProfile();
      if (profileRes.data) {
        setRiskProfile(profileRes.data);
        setFormData({
          riskTolerance: profileRes.data.riskTolerance || 'MODERATE',
          investmentGoal: profileRes.data.investmentGoal || 'growth',
          timeHorizon: profileRes.data.timeHorizon || 10,
          monthlyIncome: profileRes.data.monthlyIncome || '',
          monthlyExpenses: profileRes.data.monthlyExpenses || '',
          emergencyFund: profileRes.data.emergencyFund || ''
        });
      }
    } catch (error) {
      console.error('Failed to load risk profile:', error);
    }
  };

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      const response = await api.getPortfolios({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setPortfolios(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setRecLoading(true);
    try {
      const response = await api.saveRiskProfile(formData);
      setRiskProfile(response.data);
      alert('Risk profile saved!');
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setRecLoading(false);
    }
  };

  const getRecommendation = async () => {
    if (!riskProfile) {
      alert('Please save your risk profile first');
      return;
    }
    setRecLoading(true);
    try {
      const response = await api.getPortfolioRecommendation(investmentAmount);
      setRecommendation(response.data);
      setActiveTab('recommendation');
    } catch (error) {
      alert('Failed to get recommendation');
    } finally {
      setRecLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === portfolios.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(portfolios.map(p => p.id));
    }
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected Portfolios',
      message: `Are you sure you want to delete ${selectedIds.length} portfolios? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await bulkDeletePortfolios(selectedIds);
          setSelectedIds([]);
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
          loadPortfolios();
        } catch (error) {
          console.error('Bulk delete failed:', error);
        }
      }
    });
  };

  const handleExport = (format) => {
    downloadExport(exportPortfolios, format, 'portfolios');
  };

  const chartData = recommendation?.recommendation?.allocation?.map((item) => ({
    name: item.asset,
    value: item.percentage
  })) || [];

  const totalValue = portfolios.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const totalCash = portfolios.reduce((sum, p) => sum + (p.cashBalance || 0), 0);
  const avgAiScore = portfolios.length > 0
    ? (portfolios.reduce((sum, p) => sum + (p.aiScore || 0), 0) / portfolios.length).toFixed(1)
    : 0;

  const getTypeColor = (type) => {
    const colors = {
      CONSERVATIVE: '#2196F3',
      BALANCED: '#4CAF50',
      GROWTH: '#FF9800',
      AGGRESSIVE: '#F44336',
      INCOME: '#9C27B0'
    };
    return colors[type] || '#607D8B';
  };

  if (loading && portfolios.length === 0 && !riskProfile) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>AI Advisor</h1>
          <p>AI-powered investment recommendations and portfolio management</p>
        </div>
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Advisor</h1>
        <p>AI-powered investment recommendations and portfolio management</p>
      </div>

      <div className="tabs">
        <button className={activeTab === 'portfolios' ? 'active' : ''} onClick={() => setActiveTab('portfolios')}>
          My Portfolios ({total || portfolios.length})
        </button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
          Risk Profile
        </button>
        <button className={activeTab === 'recommendation' ? 'active' : ''} onClick={() => setActiveTab('recommendation')}>
          AI Recommendation
        </button>
      </div>

      {/* ===== PORTFOLIOS TAB ===== */}
      {activeTab === 'portfolios' && (
        <>
          {/* Summary Stats */}
          <div className="stats-row">
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <span className="stat-label">Total Value</span>
                <span className="stat-value">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(33,150,243,0.1)', color: '#2196F3' }}>
                <Briefcase size={22} />
              </div>
              <div>
                <span className="stat-label">Portfolios</span>
                <span className="stat-value">{total || portfolios.length}</span>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(255,152,0,0.1)', color: '#FF9800' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="stat-label">Cash Balance</span>
                <span className="stat-value">${totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(156,39,176,0.1)', color: '#9C27B0' }}>
                <Star size={22} />
              </div>
              <div>
                <span className="stat-label">Avg AI Score</span>
                <span className="stat-value">{avgAiScore}/100</span>
              </div>
            </div>
          </div>

          {/* Toolbar: Search, Sort, Export */}
          <div className="toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <SearchBar
              value={search}
              onChange={(val) => { setSearch(val); setOffset(0); }}
              placeholder="Search portfolios..."
            />
            <SortControls
              columns={PORTFOLIO_SORT_COLUMNS}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }}
            />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedIds([])}
          />

          {/* Portfolios Grid */}
          {loading ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : portfolios.length === 0 ? (
            <EmptyState
              icon={<Bot size={48} />}
              title="No portfolios yet"
              description="Create your first AI-managed portfolio."
              actionLabel="Set Up Profile"
              onAction={() => setActiveTab('profile')}
            />
          ) : (
            <>
              <div className="recommendation-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio.id}
                    className="card clickable"
                    onClick={() => setSelectedPortfolio(portfolio)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(portfolio.id)}
                        onChange={() => toggleSelect(portfolio.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{portfolio.name}</h3>
                        <span
                          className="risk-badge"
                          style={{
                            background: getTypeColor(portfolio.type) + '18',
                            color: getTypeColor(portfolio.type),
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            display: 'inline-block',
                            marginTop: '0.3rem'
                          }}
                        >
                          {portfolio.type}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                          ${portfolio.totalValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Cash: ${portfolio.cashBalance?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Holdings count */}
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {portfolio.holdings?.length || 0} holdings
                    </div>

                    {/* AI Score bar */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>AI Score</span>
                        <span style={{ fontWeight: 600 }}>{portfolio.aiScore?.toFixed(0)}/100</span>
                      </div>
                      <div style={{ background: 'var(--border-light)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${portfolio.aiScore || 0}%`,
                          height: '100%',
                          borderRadius: '4px',
                          background: (portfolio.aiScore || 0) >= 85 ? '#4CAF50' : (portfolio.aiScore || 0) >= 70 ? '#FF9800' : '#F44336'
                        }} />
                      </div>
                    </div>

                    {/* AI Recommendation snippet */}
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {portfolio.aiRecommendation?.slice(0, 80)}{portfolio.aiRecommendation?.length > 80 ? '...' : ''}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                      View Details <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                total={total}
                offset={offset}
                limit={limit}
                onPageChange={setOffset}
                onLimitChange={(val) => { setLimit(val); setOffset(0); }}
              />
            </>
          )}
        </>
      )}

      {/* ===== PROFILE TAB ===== */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2>Your Risk Profile</h2>
          <form onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="form-group">
                <label>Risk Tolerance</label>
                <select value={formData.riskTolerance} onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value })}>
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                </select>
              </div>
              <div className="form-group">
                <label>Investment Goal</label>
                <select value={formData.investmentGoal} onChange={(e) => setFormData({ ...formData, investmentGoal: e.target.value })}>
                  <option value="retirement">Retirement</option>
                  <option value="growth">Wealth Growth</option>
                  <option value="income">Passive Income</option>
                  <option value="preservation">Capital Preservation</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time Horizon (years)</label>
                <input type="number" value={formData.timeHorizon} onChange={(e) => setFormData({ ...formData, timeHorizon: parseInt(e.target.value) })} min={1} max={50} />
              </div>
              <div className="form-group">
                <label>Monthly Income ($)</label>
                <input type="number" value={formData.monthlyIncome} onChange={(e) => setFormData({ ...formData, monthlyIncome: parseFloat(e.target.value) })} placeholder="5000" />
              </div>
              <div className="form-group">
                <label>Monthly Expenses ($)</label>
                <input type="number" value={formData.monthlyExpenses} onChange={(e) => setFormData({ ...formData, monthlyExpenses: parseFloat(e.target.value) })} placeholder="3000" />
              </div>
              <div className="form-group">
                <label>Emergency Fund ($)</label>
                <input type="number" value={formData.emergencyFund} onChange={(e) => setFormData({ ...formData, emergencyFund: parseFloat(e.target.value) })} placeholder="10000" />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={recLoading}>
              {recLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <div className="recommendation-section">
            <h3>Get AI Recommendation</h3>
            <div className="form-group">
              <label>Investment Amount ($)</label>
              <input type="number" value={investmentAmount} onChange={(e) => setInvestmentAmount(parseFloat(e.target.value))} placeholder="10000" />
            </div>
            <button onClick={getRecommendation} className="btn-secondary" disabled={recLoading}>
              {recLoading ? 'Analyzing...' : 'Get AI Portfolio Recommendation'}
            </button>
          </div>
        </div>
      )}

      {/* ===== RECOMMENDATION TAB ===== */}
      {activeTab === 'recommendation' && recommendation && (
        <div className="recommendation-results">
          <div className="card clickable" onClick={() => navigate('/portfolio-dashboard')} title="View portfolio dashboard">
            <h2>{recommendation.recommendation?.portfolioType} Portfolio</h2>
            <div className="recommendation-grid" onClick={(e) => e.stopPropagation()}>
              <div className="chart-section">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="allocation-details">
                <h3>Allocation Details</h3>
                {recommendation.recommendation?.allocation?.map((item, index) => (
                  <div key={index} className="allocation-item clickable-row" onClick={() => setSelectedAllocation({ ...item, color: COLORS[index % COLORS.length] })}>
                    <div className="allocation-header">
                      <span className="allocation-asset">{item.asset}</span>
                      <span className="allocation-percentage">{item.percentage}%</span>
                    </div>
                    {item.etf && <div className="allocation-etf"><strong>{item.etf}</strong> - {item.etfName}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Investment Summary</h3>
            <div className="summary-grid">
              <div className="summary-item"><label>Investment Amount</label><span>${recommendation.investmentAmount?.toLocaleString()}</span></div>
              <div className="summary-item"><label>Expected Return</label><span>{recommendation.recommendation?.expectedReturn?.low}% - {recommendation.recommendation?.expectedReturn?.high}% annually</span></div>
              <div className="summary-item"><label>Risk Level</label><span className={`risk-badge ${recommendation.recommendation?.riskLevel?.toLowerCase()}`}>{recommendation.recommendation?.riskLevel}</span></div>
              <div className="summary-item"><label>Rebalance Frequency</label><span>{recommendation.recommendation?.rebalanceFrequency}</span></div>
            </div>
          </div>

          <div className="card">
            <h3>AI Analysis</h3>
            <p className="reasoning">{recommendation.recommendation?.reasoning}</p>
          </div>

          {/* Market Outlook */}
          {recommendation.recommendation?.marketOutlook && (
            <div className="card" style={{borderLeft:'4px solid #1976d2'}}>
              <h3 style={{color:'#1976d2'}}>Market Outlook</h3>
              <p>{recommendation.recommendation.marketOutlook}</p>
            </div>
          )}

          {/* Risk Analysis */}
          {recommendation.recommendation?.riskAnalysis && (
            <div className="card" style={{borderLeft:'4px solid #f57c00'}}>
              <h3 style={{color:'#f57c00'}}>Risk Analysis</h3>
              <p><strong>Max Drawdown:</strong> {recommendation.recommendation.riskAnalysis.maxDrawdown}</p>
              {recommendation.recommendation.riskAnalysis.riskFactors?.length > 0 && (
                <>
                  <p style={{fontWeight:600, marginBottom:'4px'}}>Risk Factors:</p>
                  <ul style={{paddingLeft:'20px', margin:'0 0 12px'}}>
                    {recommendation.recommendation.riskAnalysis.riskFactors.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </>
              )}
              {recommendation.recommendation.riskAnalysis.mitigations?.length > 0 && (
                <>
                  <p style={{fontWeight:600, marginBottom:'4px'}}>How We Mitigate:</p>
                  <ul style={{paddingLeft:'20px', margin:0}}>
                    {recommendation.recommendation.riskAnalysis.mitigations.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Growth Projections */}
          {recommendation.recommendation?.growthProjections && (
            <div className="card" style={{borderLeft:'4px solid #388e3c'}}>
              <h3 style={{color:'#388e3c'}}>Growth Projections</h3>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px'}}>
                {Object.entries(recommendation.recommendation.growthProjections).map(([period, vals]) => (
                  <div key={period} style={{background:'var(--bg-secondary, #f5f5f5)', padding:'14px', borderRadius:'8px', textAlign:'center'}}>
                    <div style={{fontWeight:700, color:'#388e3c', marginBottom:'8px', fontSize:'15px'}}>{period.replace('year', 'Year ')}</div>
                    <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>Conservative: <strong>${vals.conservative?.toLocaleString()}</strong></div>
                    <div style={{fontSize:'17px', color:'#2e7d32', fontWeight:700, margin:'4px 0'}}>Expected: ${vals.expected?.toLocaleString()}</div>
                    <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>Optimistic: <strong>${vals.optimistic?.toLocaleString()}</strong></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Contribution */}
          {recommendation.recommendation?.monthlyContribution && (
            <div className="card" style={{borderLeft:'4px solid #7b1fa2'}}>
              <h3 style={{color:'#7b1fa2'}}>Recommended Monthly Contribution</h3>
              <p style={{fontSize:'22px', fontWeight:700, margin:'0 0 8px'}}>${recommendation.recommendation.monthlyContribution.recommended?.toLocaleString()}/month</p>
              <p style={{color:'var(--text-secondary)', margin:0}}>{recommendation.recommendation.monthlyContribution.impact}</p>
            </div>
          )}

          {/* Tax Strategy */}
          {recommendation.recommendation?.taxStrategy && (
            <div className="card" style={{borderLeft:'4px solid #0288d1'}}>
              <h3 style={{color:'#0288d1'}}>Tax Strategy</h3>
              <p>{recommendation.recommendation.taxStrategy}</p>
            </div>
          )}

          {/* Next Steps */}
          {recommendation.recommendation?.nextSteps?.length > 0 && (
            <div className="card" style={{borderLeft:'4px solid #c62828'}}>
              <h3 style={{color:'#c62828'}}>Next Steps</h3>
              <ol style={{paddingLeft:'20px', margin:0}}>
                {recommendation.recommendation.nextSteps.map((step, i) => (
                  <li key={i} style={{marginBottom:'8px'}}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recommendation' && !recommendation && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Bot size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>No Recommendation Yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Go to the Risk Profile tab and click "Get AI Portfolio Recommendation".</p>
          <button className="btn-primary" style={{ marginTop: '1rem', width: 'auto' }} onClick={() => setActiveTab('profile')}>
            Go to Risk Profile
          </button>
        </div>
      )}

      {/* Portfolio Detail Modal */}
      {selectedPortfolio && (
        <div className="modal-overlay" onClick={() => setSelectedPortfolio(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPortfolio.name}</h2>
              <button className="close-btn" onClick={() => setSelectedPortfolio(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-item">
                  <span className="stat-label">Total Value</span>
                  <span className="stat-value">${selectedPortfolio.totalValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Cash Balance</span>
                  <span className="stat-value">${selectedPortfolio.cashBalance?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">AI Score</span>
                  <span className="stat-value">{selectedPortfolio.aiScore?.toFixed(1)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Type</span>
                  <span className="stat-value">{selectedPortfolio.type}</span>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                {selectedPortfolio.aiRecommendation}
              </p>

              {selectedPortfolio.holdings?.length > 0 && (
                <>
                  <h4 style={{ marginBottom: '0.75rem' }}>Holdings ({selectedPortfolio.holdings.length})</h4>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Shares</th>
                        <th>Avg Cost</th>
                        <th>Current</th>
                        <th>P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPortfolio.holdings.map((h) => {
                        const pl = h.currentPrice && h.avgCost ? ((h.currentPrice - h.avgCost) / h.avgCost * 100).toFixed(1) : null;
                        return (
                          <tr key={h.id}>
                            <td><strong>{h.symbol}</strong></td>
                            <td>{h.name}</td>
                            <td>{h.shares?.toFixed(2)}</td>
                            <td>${h.avgCost?.toFixed(2)}</td>
                            <td>${h.currentPrice?.toFixed(2)}</td>
                            <td style={{ color: pl >= 0 ? '#4CAF50' : '#F44336', fontWeight: 600 }}>
                              {pl !== null ? `${pl >= 0 ? '+' : ''}${pl}%` : '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {selectedPortfolio.lastRebalanced && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                  Last rebalanced: {new Date(selectedPortfolio.lastRebalanced).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedPortfolio(null)}>Close</button>
              <button className="btn-primary" onClick={() => { setSelectedPortfolio(null); navigate('/portfolio-dashboard'); }}>
                Portfolio Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Detail Modal */}
      {selectedAllocation && (
        <div className="modal-overlay" onClick={() => setSelectedAllocation(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderLeftColor: selectedAllocation.color }}>
              <h2>{selectedAllocation.asset}</h2>
              <button className="close-btn" onClick={() => setSelectedAllocation(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="allocation-highlight" style={{ backgroundColor: selectedAllocation.color }}>
                <span className="percentage">{selectedAllocation.percentage}%</span>
                <span className="amount">${((recommendation?.investmentAmount || 10000) * selectedAllocation.percentage / 100).toLocaleString()}</span>
              </div>
              {selectedAllocation.etf && (
                <div className="etf-details">
                  <h4>Recommended ETF</h4>
                  <div className="etf-card">
                    <span className="etf-symbol">{selectedAllocation.etf}</span>
                    <span className="etf-name">{selectedAllocation.etfName}</span>
                    {selectedAllocation.expenseRatio && <span className="expense-ratio">Expense Ratio: {selectedAllocation.expenseRatio}%</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedAllocation(null)}>Close</button>
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

export default RoboAdvisor;
