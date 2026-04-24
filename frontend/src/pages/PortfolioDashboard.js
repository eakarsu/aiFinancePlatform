import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Plus, AlertTriangle, XCircle, Edit2, Trash2, Wallet } from 'lucide-react';
import { getPortfolios, getPortfolioRecommendation, rebalancePortfolio, createPortfolio, getRiskProfile, saveRiskProfile, exportPortfolios, downloadExport } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ExportButton from '../components/ExportButton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function PortfolioDashboard() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [rebalanceAdvice, setRebalanceAdvice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ name: '', type: 'BALANCED', initialDeposit: 10000 });
  const [error, setError] = useState(null);
  const [hasRiskProfile, setHasRiskProfile] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

  useEffect(() => {
    loadPortfolios();
    checkRiskProfile();
  }, []);

  const checkRiskProfile = async () => {
    try {
      const response = await getRiskProfile();
      setHasRiskProfile(!!response.data);
    } catch (error) {
      setHasRiskProfile(false);
    }
  };

  const createQuickRiskProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      await saveRiskProfile({
        riskTolerance: 'MODERATE',
        investmentGoal: 'growth',
        timeHorizon: 10,
        monthlyIncome: 5000,
        monthlyExpenses: 3000,
        emergencyFund: 10000
      });
      setHasRiskProfile(true);
      // Now try to get recommendation
      const response = await getPortfolioRecommendation(10000);
      setRecommendation(response.data.recommendation);
    } catch (error) {
      console.error('Quick setup failed:', error);
      setError(error.response?.data?.error || 'Quick setup failed');
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolios = async () => {
    try {
      const response = await getPortfolios();
      const result = response.data;
      const items = result.data || result;
      setPortfolios(items);
      if (items.length > 0) {
        setSelectedPortfolio(items[0]);
      }
    } catch (error) {
      console.error('Failed to load portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetRecommendation = async () => {
    setError(null);
    try {
      setLoading(true);
      const response = await getPortfolioRecommendation(selectedPortfolio?.totalValue || 10000);
      // Handle both old format (recommendation.allocation) and new format (recommendation directly)
      const rec = response.data.recommendation;
      setRecommendation(rec);
    } catch (error) {
      console.error('Failed to get recommendation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to get recommendation';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRebalance = async () => {
    if (!selectedPortfolio) return;
    setError(null);
    try {
      setLoading(true);
      const response = await rebalancePortfolio(selectedPortfolio.id);
      setRebalanceAdvice(response.data.rebalanceAdvice);
    } catch (error) {
      console.error('Failed to get rebalance advice:', error);
      setError(error.response?.data?.error || 'Failed to get rebalance advice');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async (e) => {
    e.preventDefault();
    try {
      await createPortfolio(newPortfolio);
      setShowCreateModal(false);
      setNewPortfolio({ name: '', type: 'BALANCED', initialDeposit: 10000 });
      loadPortfolios();
    } catch (error) {
      console.error('Failed to create portfolio:', error);
      setError(error.response?.data?.error || 'Failed to create portfolio');
    }
  };

  const handleSellHolding = () => {
    setConfirmDialog({
      open: true,
      title: 'Sell Holding',
      message: `Are you sure you want to sell your ${selectedHolding?.symbol} holding?`,
      variant: 'warning',
      confirmText: 'Sell',
      onConfirm: () => {
        alert('Sell feature coming soon!');
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });
      }
    });
  };

  const handleExport = (format) => {
    downloadExport(exportPortfolios, format, 'portfolio-dashboard');
  };

  // Prepare chart data
  const getAllocationData = () => {
    if (recommendation?.allocation) {
      return recommendation.allocation.map(item => ({
        name: item.asset,
        value: item.percentage,
        amount: item.amount
      }));
    }
    if (selectedPortfolio?.holdings?.length > 0) {
      return selectedPortfolio.holdings.map(h => ({
        name: h.name || h.symbol,
        value: (h.shares * (h.currentPrice || h.avgCost) / selectedPortfolio.totalValue) * 100
      }));
    }
    return [
      { name: 'US Stocks', value: 40 },
      { name: 'International', value: 20 },
      { name: 'Bonds', value: 30 },
      { name: 'Cash', value: 10 }
    ];
  };

  const getPerformanceData = () => {
    // Generate sample performance data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseValue = selectedPortfolio?.totalValue || 10000;
    return months.map((month, index) => ({
      month,
      value: Math.round(baseValue * (1 + (index * 0.02) + (Math.random() * 0.05 - 0.025))),
      benchmark: Math.round(baseValue * (1 + (index * 0.015)))
    }));
  };

  const getRiskReturnData = () => {
    return [
      { name: 'Conservative', risk: 5, return: 4 },
      { name: 'Moderate', risk: 10, return: 7 },
      { name: 'Aggressive', risk: 18, return: 10 },
      { name: 'Your Portfolio', risk: 12, return: 8, fill: '#ff7300' }
    ];
  };

  if (loading && portfolios.length === 0) {
    return (
      <div className="portfolio-dashboard">
        <div className="dashboard-header">
          <h1>Portfolio Dashboard</h1>
        </div>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="detail-panel" count={1} />
      </div>
    );
  }

  return (
    <div className="portfolio-dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Portfolio Dashboard</h1>
          <ExportButton onExport={handleExport} />
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> New Portfolio
        </button>
      </div>

      {/* Risk Profile Warning */}
      {!hasRiskProfile && (
        <div className="warning-banner">
          <span className="warning-icon"><AlertTriangle size={24} color="#e65100" /></span>
          <div className="warning-content">
            <strong>Complete Your Risk Profile First</strong>
            <p>To get personalized portfolio recommendations, please complete the risk assessment or use quick setup.</p>
          </div>
          <div className="warning-actions">
            <button
              className="btn-quick-setup"
              onClick={createQuickRiskProfile}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Quick Setup (Default Profile)'}
            </button>
            <Link to="/risk-assessment" className="btn-warning">
              Full Assessment
            </Link>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon"><XCircle size={20} /></span>
          <span>{error}</span>
          {error.includes('risk profile') && (
            <Link to="/risk-assessment" className="btn-link">Complete Risk Assessment</Link>
          )}
          <button className="btn-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Portfolio Selection */}
      {portfolios.length > 0 && (
        <div className="portfolio-selector">
          <select
            value={selectedPortfolio?.id || ''}
            onChange={(e) => setSelectedPortfolio(portfolios.find(p => p.id === e.target.value))}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} - ${p.totalValue?.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div
          className="summary-card clickable"
          onClick={() => document.querySelector('.chart-card')?.scrollIntoView({ behavior: 'smooth' })}
          title="View allocation details"
        >
          <h3>Total Value</h3>
          <p className="value">${(selectedPortfolio?.totalValue || 0).toLocaleString()}</p>
          <span className="change positive">+5.2% this month</span>
        </div>
        <div
          className="summary-card clickable"
          onClick={() => navigate('/import')}
          title="Import transactions"
        >
          <h3>Cash Balance</h3>
          <p className="value">${(selectedPortfolio?.cashBalance || 0).toLocaleString()}</p>
          <span className="label">Available for investment</span>
        </div>
        <div
          className="summary-card clickable"
          onClick={() => document.querySelector('.holdings-table')?.scrollIntoView({ behavior: 'smooth' })}
          title="View holdings"
        >
          <h3>Holdings</h3>
          <p className="value">{selectedPortfolio?.holdings?.length || 0}</p>
          <span className="label">Different securities</span>
        </div>
        <div
          className="summary-card clickable"
          onClick={() => navigate('/risk-assessment')}
          title="Update risk profile"
        >
          <h3>Type</h3>
          <p className="value">{selectedPortfolio?.type || 'N/A'}</p>
          <span className="label">Investment strategy</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Allocation Pie Chart */}
        <div className="chart-card clickable" onClick={() => handleGetRecommendation()} title="Click to get AI recommendation">
          <h3>Asset Allocation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getAllocationData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {getAllocationData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Chart */}
        <div className="chart-card clickable" onClick={() => navigate('/fraud-detection')} title="View transaction history">
          <h3>Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={getPerformanceData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.3}
                name="Portfolio"
              />
              <Area
                type="monotone"
                dataKey="benchmark"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.3}
                name="Benchmark"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk/Return Chart */}
        <div className="chart-card clickable" onClick={() => navigate('/risk-assessment')} title="Update risk profile">
          <h3>Risk vs Return</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getRiskReturnData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="risk" fill="#ff8042" name="Risk %" />
              <Bar dataKey="return" fill="#0088FE" name="Expected Return %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Holdings Table */}
        <div className="chart-card holdings-table">
          <h3>Holdings</h3>
          {selectedPortfolio?.holdings?.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Allocation</th>
                </tr>
              </thead>
              <tbody>
                {selectedPortfolio.holdings.map(h => {
                  const value = h.shares * (h.currentPrice || h.avgCost);
                  const allocation = (value / selectedPortfolio.totalValue) * 100;
                  const gainLoss = h.currentPrice ? ((h.currentPrice - h.avgCost) / h.avgCost * 100) : 0;
                  return (
                    <tr
                      key={h.id}
                      className="clickable-row"
                      onClick={() => setSelectedHolding({ ...h, value, allocation, gainLoss })}
                    >
                      <td><strong>{h.symbol}</strong></td>
                      <td>{h.name}</td>
                      <td>{h.shares.toFixed(2)}</td>
                      <td>${(h.currentPrice || h.avgCost).toFixed(2)}</td>
                      <td>${value.toLocaleString()}</td>
                      <td>{allocation.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="no-data">No holdings yet. Get a recommendation to start investing.</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="actions-section">
        <button className="btn-primary" onClick={handleGetRecommendation} disabled={loading}>
          Get AI Recommendation
        </button>
        <button
          className="btn-secondary"
          onClick={handleRebalance}
          disabled={loading || !selectedPortfolio}
        >
          Analyze for Rebalancing
        </button>
      </div>

      {/* Recommendation Display */}
      {recommendation && (
        <div className="recommendation-section">
          <h2>AI Portfolio Recommendation</h2>
          <div className="recommendation-card">
            <div className="rec-header">
              <h3>{recommendation.portfolioType} Portfolio</h3>
              <span className="expected-return">
                Expected Return: {recommendation.expectedReturn?.low}-{recommendation.expectedReturn?.high}%
              </span>
            </div>
            <p className="description">{recommendation.description}</p>

            <div className="allocation-details">
              <h4>Recommended Allocation</h4>
              <div className="allocation-list">
                {recommendation.allocation?.map((item, index) => (
                  <div
                    key={index}
                    className="allocation-item clickable-row"
                    onClick={() => setSelectedAllocation({ ...item, color: COLORS[index % COLORS.length] })}
                  >
                    <div className="allocation-bar" style={{
                      width: `${item.percentage}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }} />
                    <div className="allocation-info">
                      <span className="asset">{item.asset}</span>
                      <span className="etf">{item.etf} - {item.etfName}</span>
                      <span className="percentage">{item.percentage}% (${item.amount?.toLocaleString()})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rec-details">
              <p><strong>Volatility:</strong> {recommendation.volatility}</p>
              <p><strong>Rebalance Frequency:</strong> {recommendation.rebalanceFrequency}</p>
              <p><strong>Total Expense Ratio:</strong> {recommendation.weightedExpenseRatio}%</p>
            </div>

            <div className="reasoning">
              <h4>Why This Portfolio?</h4>
              <p>{recommendation.reasoning}</p>
            </div>

            {/* Market Outlook */}
            {recommendation.marketOutlook && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#f0f7ff', borderRadius:'8px', borderLeft:'4px solid #1976d2'}}>
                <h4 style={{margin:'0 0 8px', color:'#1976d2'}}>Market Outlook</h4>
                <p style={{margin:0}}>{recommendation.marketOutlook}</p>
              </div>
            )}

            {/* Risk Analysis */}
            {recommendation.riskAnalysis && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#fff8e1', borderRadius:'8px', borderLeft:'4px solid #f57c00'}}>
                <h4 style={{margin:'0 0 12px', color:'#f57c00'}}>Risk Analysis</h4>
                <p><strong>Max Drawdown:</strong> {recommendation.riskAnalysis.maxDrawdown}</p>
                {recommendation.riskAnalysis.riskFactors?.length > 0 && (
                  <>
                    <p style={{margin:'8px 0 4px', fontWeight:600}}>Risk Factors:</p>
                    <ul style={{margin:'0 0 8px', paddingLeft:'20px'}}>
                      {recommendation.riskAnalysis.riskFactors.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </>
                )}
                {recommendation.riskAnalysis.mitigations?.length > 0 && (
                  <>
                    <p style={{margin:'8px 0 4px', fontWeight:600}}>How We Mitigate:</p>
                    <ul style={{margin:0, paddingLeft:'20px'}}>
                      {recommendation.riskAnalysis.mitigations.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Growth Projections */}
            {recommendation.growthProjections && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#e8f5e9', borderRadius:'8px', borderLeft:'4px solid #388e3c'}}>
                <h4 style={{margin:'0 0 12px', color:'#388e3c'}}>Growth Projections</h4>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px'}}>
                  {Object.entries(recommendation.growthProjections).map(([period, vals]) => (
                    <div key={period} style={{background:'white', padding:'12px', borderRadius:'6px', textAlign:'center'}}>
                      <div style={{fontWeight:700, color:'#388e3c', marginBottom:'6px'}}>{period.replace('year', 'Year ')}</div>
                      <div style={{fontSize:'13px', color:'#666'}}>Conservative: <strong>${vals.conservative?.toLocaleString()}</strong></div>
                      <div style={{fontSize:'15px', color:'#2e7d32', fontWeight:700}}>Expected: ${vals.expected?.toLocaleString()}</div>
                      <div style={{fontSize:'13px', color:'#666'}}>Optimistic: <strong>${vals.optimistic?.toLocaleString()}</strong></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Contribution */}
            {recommendation.monthlyContribution && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#f3e5f5', borderRadius:'8px', borderLeft:'4px solid #7b1fa2'}}>
                <h4 style={{margin:'0 0 8px', color:'#7b1fa2'}}>Recommended Monthly Contribution</h4>
                <p style={{fontSize:'20px', fontWeight:700, margin:'0 0 8px'}}>${recommendation.monthlyContribution.recommended?.toLocaleString()}/month</p>
                <p style={{margin:0, color:'#555'}}>{recommendation.monthlyContribution.impact}</p>
              </div>
            )}

            {/* Tax Strategy */}
            {recommendation.taxStrategy && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#e3f2fd', borderRadius:'8px', borderLeft:'4px solid #0288d1'}}>
                <h4 style={{margin:'0 0 8px', color:'#0288d1'}}>Tax Strategy</h4>
                <p style={{margin:0}}>{recommendation.taxStrategy}</p>
              </div>
            )}

            {/* Next Steps */}
            {recommendation.nextSteps?.length > 0 && (
              <div className="ai-section" style={{marginTop:'16px', padding:'16px', background:'#fce4ec', borderRadius:'8px', borderLeft:'4px solid #c62828'}}>
                <h4 style={{margin:'0 0 12px', color:'#c62828'}}>Next Steps</h4>
                <ol style={{margin:0, paddingLeft:'20px'}}>
                  {recommendation.nextSteps.map((step, i) => (
                    <li key={i} style={{marginBottom:'6px'}}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rebalance Advice */}
      {rebalanceAdvice && (
        <div className="rebalance-section">
          <h2>Rebalancing Analysis</h2>
          <div className="rebalance-card">
            {rebalanceAdvice.needsRebalancing ? (
              <>
                <p className="alert warning">Your portfolio needs rebalancing</p>
                <div className="actions-list">
                  <h4>Recommended Actions:</h4>
                  {rebalanceAdvice.actions?.map((action, index) => (
                    <div key={index} className={`action-item ${action.action.toLowerCase()}`}>
                      <span className="action-type">{action.action}</span>
                      <span className="action-symbol">{action.symbol}</span>
                      <span className="action-shares">{action.shares} shares</span>
                      <span className="action-reason">{action.reason}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="alert success">Your portfolio is well-balanced!</p>
            )}
            <p className="reasoning">{rebalanceAdvice.reasoning}</p>
          </div>
        </div>
      )}

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create New Portfolio</h2>
            <form onSubmit={handleCreatePortfolio}>
              <div className="form-group">
                <label>Portfolio Name</label>
                <input
                  type="text"
                  value={newPortfolio.name}
                  onChange={(e) => setNewPortfolio({ ...newPortfolio, name: e.target.value })}
                  placeholder="My Investment Portfolio"
                  required
                />
              </div>
              <div className="form-group">
                <label>Portfolio Type</label>
                <select
                  value={newPortfolio.type}
                  onChange={(e) => setNewPortfolio({ ...newPortfolio, type: e.target.value })}
                >
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="GROWTH">Growth</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="form-group">
                <label>Initial Deposit ($)</label>
                <input
                  type="number"
                  value={newPortfolio.initialDeposit}
                  onChange={(e) => setNewPortfolio({ ...newPortfolio, initialDeposit: parseFloat(e.target.value) })}
                  min="0"
                  step="100"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Portfolio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holding Detail Modal */}
      {selectedHolding && (
        <div className="modal-overlay" onClick={() => setSelectedHolding(null)}>
          <div className="modal holding-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedHolding.symbol}</h2>
              <button className="close-btn" onClick={() => setSelectedHolding(null)}>×</button>
            </div>
            <div className="modal-body">
              <h3>{selectedHolding.name}</h3>
              <div className="holding-stats">
                <div className="stat-item">
                  <span className="stat-label">Shares</span>
                  <span className="stat-value">{selectedHolding.shares?.toFixed(4)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Avg Cost</span>
                  <span className="stat-value">${selectedHolding.avgCost?.toFixed(2)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Current Price</span>
                  <span className="stat-value">${(selectedHolding.currentPrice || selectedHolding.avgCost)?.toFixed(2)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Value</span>
                  <span className="stat-value large">${selectedHolding.value?.toLocaleString()}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Allocation</span>
                  <span className="stat-value">{selectedHolding.allocation?.toFixed(2)}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Gain/Loss</span>
                  <span className={`stat-value ${selectedHolding.gainLoss >= 0 ? 'positive' : 'negative'}`}>
                    {selectedHolding.gainLoss >= 0 ? '+' : ''}{selectedHolding.gainLoss?.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="holding-type">
                <span className="label">Asset Type:</span>
                <span className="value">{selectedHolding.assetType}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedHolding(null)}>Close</button>
              <button className="btn-edit" onClick={() => alert('Edit holding feature coming soon!')}><Edit2 size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> Edit</button>
              <button className="btn-delete" onClick={handleSellHolding}><Trash2 size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> Sell</button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Detail Modal */}
      {selectedAllocation && (
        <div className="modal-overlay" onClick={() => setSelectedAllocation(null)}>
          <div className="modal allocation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderLeftColor: selectedAllocation.color }}>
              <h2>{selectedAllocation.asset}</h2>
              <button className="close-btn" onClick={() => setSelectedAllocation(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="allocation-highlight" style={{ backgroundColor: selectedAllocation.color }}>
                <span className="percentage">{selectedAllocation.percentage}%</span>
                <span className="amount">${selectedAllocation.amount?.toLocaleString()}</span>
              </div>
              <div className="etf-details">
                <h4>Recommended ETF</h4>
                <div className="etf-card">
                  <span className="etf-symbol">{selectedAllocation.etf}</span>
                  <span className="etf-name">{selectedAllocation.etfName}</span>
                  {selectedAllocation.expenseRatio && (
                    <span className="expense-ratio">Expense Ratio: {selectedAllocation.expenseRatio}%</span>
                  )}
                </div>
              </div>
              <div className="allocation-info-section">
                <p>This allocation represents {selectedAllocation.percentage}% of your recommended portfolio,
                   totaling ${selectedAllocation.amount?.toLocaleString()}.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedAllocation(null)}>Close</button>
              <button className="btn-primary" onClick={() => alert('Buy this ETF feature coming soon!')}><Wallet size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> Buy</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' })}
      />
    </div>
  );
}

export default PortfolioDashboard;
