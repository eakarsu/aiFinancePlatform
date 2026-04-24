import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, ArrowRight, BarChart3, Plus, Edit2, Trash2 } from 'lucide-react';
import { getCryptos, addCrypto, deleteCrypto, analyzeCrypto, analyzeAllCryptos, updateCrypto, toggleCryptoTracking, bulkDeleteCryptos, exportCryptos, downloadExport } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

function CryptoAnalyzer() {
  const [cryptos, setCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [editingCrypto, setEditingCrypto] = useState(null);
  const [formData, setFormData] = useState({
    symbol: '', name: '', currentPrice: '', priceChange24h: '', priceChange7d: '',
    marketCap: '', volume24h: '', circulatingSupply: '', totalSupply: '', allTimeHigh: '', allTimeLow: ''
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

  useEffect(() => { loadCryptos(); }, [search, sortBy, sortOrder, offset, limit]);

  const loadCryptos = async () => {
    try {
      setLoading(true);
      const response = await getCryptos({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setCryptos(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load cryptos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      Object.keys(data).forEach(key => {
        if (data[key] === '') data[key] = null;
        else if (key !== 'symbol' && key !== 'name') data[key] = parseFloat(data[key]) || null;
      });

      if (editingCrypto) {
        await updateCrypto(editingCrypto.id, data);
      } else {
        await addCrypto(data);
      }
      setShowForm(false);
      setEditingCrypto(null);
      setFormData({ symbol: '', name: '', currentPrice: '', priceChange24h: '', priceChange7d: '', marketCap: '', volume24h: '', circulatingSupply: '', totalSupply: '', allTimeHigh: '', allTimeLow: '' });
      loadCryptos();
    } catch (error) {
      console.error('Failed to save crypto:', error);
    }
  };

  const handleAnalyze = async (crypto) => {
    setAnalyzing(crypto.id);
    try {
      const response = await analyzeCrypto(crypto.id);
      const ai = response.data.analysis || {};
      setSelectedCrypto({
        ...crypto,
        aiScore: ai.aiScore,
        aiRiskLevel: ai.aiRiskLevel,
        aiTrend: ai.aiTrend,
        aiAnalysis: ai.analysis,
        aiPricePrediction: ai.pricePrediction,
      });
      loadCryptos();
    } catch (error) {
      console.error('Failed to analyze crypto:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Cryptocurrency',
      message: 'Delete this cryptocurrency?',
      onConfirm: async () => {
        await deleteCrypto(id);
        loadCryptos();
        if (selectedCrypto?.id === id) setSelectedCrypto(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleEdit = (crypto) => {
    setEditingCrypto(crypto);
    setFormData({
      symbol: crypto.symbol || '', name: crypto.name || '', currentPrice: crypto.currentPrice || '',
      priceChange24h: crypto.priceChange24h || '', priceChange7d: crypto.priceChange7d || '',
      marketCap: crypto.marketCap || '', volume24h: crypto.volume24h || '',
      circulatingSupply: crypto.circulatingSupply || '', totalSupply: crypto.totalSupply || '',
      allTimeHigh: crypto.allTimeHigh || '', allTimeLow: crypto.allTimeLow || ''
    });
    setShowForm(true);
  };

  const handleTrack = async (id) => {
    await toggleCryptoTracking(id);
    loadCryptos();
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const response = await analyzeAllCryptos();
      setPortfolioAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze all cryptos:', error);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected cryptocurrency(ies)?`,
      onConfirm: async () => {
        await bulkDeleteCryptos(selectedIds);
        setSelectedIds([]);
        loadCryptos();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleExport = async (format) => {
    await downloadExport(exportCryptos, format, 'crypto');
  };

  const handleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === cryptos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cryptos.map(c => c.id));
    }
  };

  const getRiskColor = (risk) => {
    if (risk === 'low') return '#4CAF50';
    if (risk === 'medium') return '#FF9800';
    if (risk === 'high') return '#f44336';
    return '#9C27B0';
  };

  const getTrendIcon = (trend) => {
    if (trend === 'bullish') return <TrendingUp size={16} color="#4CAF50" />;
    if (trend === 'bearish') return <TrendingDown size={16} color="#f44336" />;
    if (trend === 'volatile') return <Zap size={16} color="#FF9800" />;
    return <ArrowRight size={16} color="#999" />;
  };

  const sortColumns = [
    { field: 'createdAt', label: 'Date' },
    { field: 'symbol', label: 'Symbol' },
    { field: 'currentPrice', label: 'Price' },
    { field: 'aiScore', label: 'AI Score' }
  ];

  if (loading && cryptos.length === 0) return <LoadingSkeleton type="cards" count={6} />;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Crypto Analyzer</h1>
        <p>Analyze cryptocurrencies with AI-powered insights and predictions</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingCrypto(null); }}><Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Add Crypto</button>
          {cryptos.length > 1 && (
            <button className="btn-secondary" onClick={handleAnalyzeAll} disabled={analyzingAll}>
              {analyzingAll ? 'Scanning...' : 'Scan All Cryptos'}
            </button>
          )}
        </div>
      </div>

      {portfolioAnalysis && portfolioAnalysis.analysis && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>AI Crypto Scanner Results</h3>
            <button className="btn-close" onClick={() => setPortfolioAnalysis(null)}>×</button>
          </div>

          {portfolioAnalysis.analysis?.methodology && (
            <div className="portfolio-insights" style={{background:'#e8f0fd',borderLeft:'4px solid #7C4DFF',padding:'12px 16px',marginBottom:'12px'}}>
              <h4 style={{margin:'0 0 4px',color:'#5E35B1'}}>Scoring Methodology</h4>
              <p style={{margin:0,fontSize:'0.9rem'}}>{portfolioAnalysis.analysis.methodology}</p>
              <div style={{display:'flex',gap:'8px',marginTop:'8px',flexWrap:'wrap',fontSize:'0.8rem'}}>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Market Position (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Momentum (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Tokenomics (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Risk (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Upside (20pts)</span>
              </div>
            </div>
          )}

          <div className="portfolio-score">
            <div className="score-circle" style={{ backgroundColor: getRiskColor(portfolioAnalysis.analysis?.overallScore >= 70 ? 'low' : portfolioAnalysis.analysis?.overallScore >= 40 ? 'medium' : 'high') }}>
              <span className="score">{portfolioAnalysis.analysis?.overallScore || 0}</span>
            </div>
            <div className="portfolio-stats">
              <div><label>Market Sentiment</label><span>{portfolioAnalysis.analysis?.marketSentiment}</span></div>
            </div>
          </div>

          {portfolioAnalysis.analysis?.rankings?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Crypto Rankings (by 5-Strategy Score)</h4>
              <div style={{display:'grid',gap:'12px'}}>
                {portfolioAnalysis.analysis.rankings.map((r, i) => (
                  <div key={i} style={{padding:'14px',background: i === 0 ? '#f0faf0' : '#f8f9fa',borderRadius:'8px',border: i === 0 ? '2px solid #4CAF50' : '1px solid #e0e0e0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontWeight:'bold',fontSize:'1.2rem',color: i === 0 ? '#4CAF50' : '#666'}}>#{r.rank}</span>
                        <strong style={{fontSize:'1.1rem'}}>{r.symbol} - {r.name}</strong>
                        {getTrendIcon(r.trend)}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{ backgroundColor: getRiskColor(r.riskLevel === 'low' ? 'low' : r.riskLevel === 'medium' ? 'medium' : 'high'), color:'#fff',padding:'4px 12px',borderRadius:'12px',fontWeight:'bold' }}>{r.totalScore || r.score}/100</div>
                        <span className={`recommendation-badge ${r.recommendation}`} style={{padding:'3px 10px',borderRadius:'4px',fontSize:'0.85rem'}}>{r.recommendation?.replace('_',' ').toUpperCase()}</span>
                      </div>
                    </div>
                    {r.upsidePotential && <div style={{fontSize:'0.9rem',marginBottom:'6px'}}><span style={{color:'#4CAF50',fontWeight:'bold'}}>Upside: {r.upsidePotential}</span> | Risk: {r.riskLevel}</div>}
                    {r.keyInsight && <p style={{margin:'4px 0 8px',fontSize:'0.9rem',color:'#333'}}>{r.keyInsight}</p>}
                    {r.scoreBreakdown && (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px',marginTop:'8px'}}>
                        {Object.entries(r.scoreBreakdown).map(([key, val]) => (
                          <div key={key} style={{background:'#fff',padding:'6px 8px',borderRadius:'6px',textAlign:'center',border:'1px solid #e8e8e8'}}>
                            <div style={{fontSize:'0.7rem',color:'#888',textTransform:'capitalize'}}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                            <div style={{fontWeight:'bold',fontSize:'1rem',color: getRiskColor(val.score >= 16 ? 'low' : val.score >= 10 ? 'medium' : 'high')}}>{val.score}/20</div>
                            <div style={{fontSize:'0.7rem',color:'#666',lineHeight:'1.2',marginTop:'2px'}}>{val.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {portfolioAnalysis.analysis?.portfolioInsights && (
            <div className="portfolio-insights">
              <h4>Portfolio Insights</h4>
              <p><strong>Diversification:</strong> {portfolioAnalysis.analysis.portfolioInsights.diversification}</p>
              <p><strong>Overall Risk:</strong> {portfolioAnalysis.analysis.portfolioInsights.overallRisk || portfolioAnalysis.analysis.portfolioInsights.riskLevel}</p>
              {portfolioAnalysis.analysis.portfolioInsights.correlations && <p><strong>Correlations:</strong> {portfolioAnalysis.analysis.portfolioInsights.correlations}</p>}
              {portfolioAnalysis.analysis.portfolioInsights.suggestions?.length > 0 && (
                <ul>{portfolioAnalysis.analysis.portfolioInsights.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              )}
            </div>
          )}

          {portfolioAnalysis.analysis?.actionItems?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Action Items</h4>
              {portfolioAnalysis.analysis.actionItems.map((a, i) => (
                <div key={i} className="action-item">
                  <span className={`recommendation-badge ${a.action?.toLowerCase()}`} style={{padding:'2px 8px',borderRadius:'4px',fontSize:'0.8rem',minWidth:'40px',textAlign:'center'}}>{a.action}</span>
                  <strong>{a.symbol}</strong>
                  <span>{a.reason}</span>
                  <span className={`badge ${a.urgency}`} style={{fontSize:'0.75rem'}}>{a.urgency}</span>
                </div>
              ))}
            </div>
          )}
          <p className="powered-by" style={{fontSize:'0.8rem',color:'#999',marginTop:'12px'}}>Powered by OpenRouter AI | 5-Strategy Analysis: Market Position + Momentum + Tokenomics + Risk + Upside</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingCrypto ? 'Edit' : 'Add'} Cryptocurrency</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Symbol *</label><input value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} required placeholder="BTC" /></div>
                <div className="form-group"><label>Name *</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Bitcoin" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Current Price ($)</label><input type="number" step="0.01" value={formData.currentPrice} onChange={e => setFormData({...formData, currentPrice: e.target.value})} /></div>
                <div className="form-group"><label>Market Cap ($)</label><input type="number" value={formData.marketCap} onChange={e => setFormData({...formData, marketCap: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>24h Change (%)</label><input type="number" step="0.01" value={formData.priceChange24h} onChange={e => setFormData({...formData, priceChange24h: e.target.value})} /></div>
                <div className="form-group"><label>7d Change (%)</label><input type="number" step="0.01" value={formData.priceChange7d} onChange={e => setFormData({...formData, priceChange7d: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>24h Volume ($)</label><input type="number" value={formData.volume24h} onChange={e => setFormData({...formData, volume24h: e.target.value})} /></div>
                <div className="form-group"><label>Circulating Supply</label><input type="number" value={formData.circulatingSupply} onChange={e => setFormData({...formData, circulatingSupply: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>All Time High ($)</label><input type="number" step="0.01" value={formData.allTimeHigh} onChange={e => setFormData({...formData, allTimeHigh: e.target.value})} /></div>
                <div className="form-group"><label>All Time Low ($)</label><input type="number" step="0.01" value={formData.allTimeLow} onChange={e => setFormData({...formData, allTimeLow: e.target.value})} /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingCrypto ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Cryptos ({total})</h3>

          <div className="list-toolbar">
            <SearchBar value={search} onChange={(val) => { setSearch(val); setOffset(0); }} placeholder="Search cryptos..." />
            <SortControls columns={sortColumns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={(field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); }} />
            <ExportButton onExport={handleExport} />
          </div>

          <BulkActions
            selectedCount={selectedIds.length}
            totalCount={cryptos.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
          />

          {cryptos.length === 0 ? (
            <EmptyState title="No cryptocurrencies yet" message="Add your first crypto to start analyzing." />
          ) : (
            cryptos.map(crypto => (
              <div key={crypto.id} className={`data-card clickable has-checkbox ${selectedCrypto?.id === crypto.id ? 'selected' : ''}`} onClick={() => setSelectedCrypto(crypto)}>
                <input
                  type="checkbox"
                  className="card-checkbox"
                  checked={selectedIds.includes(crypto.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectItem(crypto.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span className="symbol">{crypto.symbol}</span>
                    {crypto.isTracked && <span className="badge tracked"><Activity size={14} /></span>}
                    {crypto.aiTrend && <span className="trend-icon">{getTrendIcon(crypto.aiTrend)}</span>}
                  </div>
                  {crypto.aiScore && <div className="ai-score" style={{ backgroundColor: getRiskColor(crypto.aiRiskLevel) }}>{crypto.aiScore}</div>}
                </div>
                <p className="card-subtitle">{crypto.name}</p>
                <div className="card-details">
                  {crypto.currentPrice && <span>Price: ${crypto.currentPrice.toLocaleString()}</span>}
                  {crypto.priceChange24h && <span className={crypto.priceChange24h >= 0 ? 'positive' : 'negative'}>{crypto.priceChange24h >= 0 ? '+' : ''}{crypto.priceChange24h.toFixed(2)}%</span>}
                </div>
                {crypto.aiRiskLevel && <div className={`risk-badge ${crypto.aiRiskLevel}`}>{crypto.aiRiskLevel.toUpperCase()} RISK</div>}
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleTrack(crypto.id); }} className="btn-icon">{crypto.isTracked ? <BarChart3 size={16} /> : <TrendingUp size={16} />}</button>
                  <button onClick={(e) => { e.stopPropagation(); handleAnalyze(crypto); }} disabled={analyzing === crypto.id} className="btn-small">{analyzing === crypto.id ? 'Analyzing...' : 'AI Analyze'}</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(crypto); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(crypto.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}

          <Pagination offset={offset} limit={limit} total={total} onPageChange={setOffset} />
        </div>

        <div className="detail-panel">
          {selectedCrypto ? (
            <div className="detail-content">
              <h2>{selectedCrypto.symbol} - {selectedCrypto.name}</h2>
              <div className="detail-section">
                <h3>Market Data</h3>
                <div className="info-grid">
                  <div className="info-item"><label>Current Price</label><span>${selectedCrypto.currentPrice?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>24h Change</label><span className={selectedCrypto.priceChange24h >= 0 ? 'positive' : 'negative'}>{selectedCrypto.priceChange24h?.toFixed(2)}%</span></div>
                  <div className="info-item"><label>7d Change</label><span className={selectedCrypto.priceChange7d >= 0 ? 'positive' : 'negative'}>{selectedCrypto.priceChange7d?.toFixed(2)}%</span></div>
                  <div className="info-item"><label>Market Cap</label><span>${selectedCrypto.marketCap?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>24h Volume</label><span>${selectedCrypto.volume24h?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>All Time High</label><span>${selectedCrypto.allTimeHigh?.toLocaleString() || 'N/A'}</span></div>
                </div>
              </div>

              {selectedCrypto.aiAnalysis && (
                <div className="ai-analysis-section">
                  <h3>AI Analysis</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getRiskColor(selectedCrypto.aiRiskLevel) }}>
                      <span className="score-value">{selectedCrypto.aiScore}</span>
                      <span className="score-label">AI Score</span>
                    </div>
                    <div className="ai-meta">
                      <div><span className="label">Risk Level:</span><span className={`value ${selectedCrypto.aiRiskLevel}`}>{selectedCrypto.aiRiskLevel?.toUpperCase()}</span></div>
                      <div><span className="label">Trend:</span><span>{getTrendIcon(selectedCrypto.aiTrend)} {selectedCrypto.aiTrend?.toUpperCase()}</span></div>
                    </div>
                  </div>

                  <div className="analysis-content">
                    <div className="analysis-summary"><h4>Summary</h4><p>{selectedCrypto.aiAnalysis.summary}</p></div>

                    {selectedCrypto.aiAnalysis.fundamentals && (
                      <div className="analysis-section">
                        <h4>Fundamentals</h4>
                        <div className="fundamentals-grid">
                          {Object.entries(selectedCrypto.aiAnalysis.fundamentals).map(([key, value]) => (
                            <div key={key} className="fundamental-item"><label>{key}</label><p>{value}</p></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCrypto.aiAnalysis.risks && (
                      <div className="analysis-list"><h4>Risks</h4><ul className="cons-list">{selectedCrypto.aiAnalysis.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                    )}

                    {selectedCrypto.aiAnalysis.opportunities && (
                      <div className="analysis-list"><h4>Opportunities</h4><ul className="pros-list">{selectedCrypto.aiAnalysis.opportunities.map((o, i) => <li key={i}>{o}</li>)}</ul></div>
                    )}

                    {selectedCrypto.aiPricePrediction && (
                      <div className="price-predictions">
                        <h4>Price Predictions</h4>
                        <div className="predictions-grid">
                          {Object.entries(selectedCrypto.aiPricePrediction).map(([term, data]) => (
                            <div key={term} className="prediction-card">
                              <h5>{term.replace(/([A-Z])/g, ' $1').trim()}</h5>
                              <p className="range">${data.low?.toLocaleString()} - ${data.high?.toLocaleString()}</p>
                              <p className="timeframe">{data.timeframe}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedCrypto.aiAnalysis && (
                <div className="no-analysis">
                  <p>No AI analysis yet. Click "AI Analyze" to get insights.</p>
                  <button onClick={() => handleAnalyze(selectedCrypto)} disabled={analyzing === selectedCrypto.id} className="btn-primary">{analyzing === selectedCrypto.id ? 'Analyzing...' : 'Generate AI Analysis'}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection"><p>Select a cryptocurrency to view details</p></div>
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

export default CryptoAnalyzer;
