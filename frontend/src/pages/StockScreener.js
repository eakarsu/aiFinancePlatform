import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Star, StarOff, Edit2, Trash2, Plus } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import RowDetailModal from '../components/RowDetailModal';
import { getStocks, addStock, deleteStock, analyzeStock, analyzeAllStocks, updateStock, toggleWatchlist, bulkDeleteStocks, exportStocks, downloadExport } from '../services/api';

function StockScreener() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [formData, setFormData] = useState({
    symbol: '', companyName: '', sector: '', industry: '', marketCap: '',
    peRatio: '', pbRatio: '', dividendYield: '', eps: '', revenueGrowth: '',
    profitMargin: '', debtToEquity: '', currentPrice: '', targetPrice: '', analystRating: ''
  });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [detailModal, setDetailModal] = useState({ open: false, data: null });

  useEffect(() => {
    loadStocks();
  }, [search, sortBy, sortOrder, offset, limit]);

  const loadStocks = async () => {
    try {
      const response = await getStocks({ search, sortBy, sortOrder, offset, limit });
      const result = response.data;
      setStocks(result.data || result);
      setTotal(result.total || (result.data || result).length);
    } catch (error) {
      console.error('Failed to load stocks:', error);
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
        else if (['marketCap', 'peRatio', 'pbRatio', 'dividendYield', 'eps', 'revenueGrowth', 'profitMargin', 'debtToEquity', 'currentPrice', 'targetPrice'].includes(key)) {
          data[key] = parseFloat(data[key]) || null;
        }
      });

      if (editingStock) {
        await updateStock(editingStock.id, data);
      } else {
        await addStock(data);
      }
      setShowForm(false);
      setEditingStock(null);
      setFormData({ symbol: '', companyName: '', sector: '', industry: '', marketCap: '', peRatio: '', pbRatio: '', dividendYield: '', eps: '', revenueGrowth: '', profitMargin: '', debtToEquity: '', currentPrice: '', targetPrice: '', analystRating: '' });
      loadStocks();
    } catch (error) {
      console.error('Failed to save stock:', error);
    }
  };

  const handleAnalyze = async (stock) => {
    setAnalyzing(stock.id);
    try {
      const response = await analyzeStock(stock.id);
      const ai = response.data.analysis || {};
      setSelectedStock({
        ...stock,
        aiScore: ai.aiScore,
        aiSentiment: ai.aiSentiment,
        aiRecommendation: ai.aiRecommendation,
        aiAnalysis: ai.analysis,
      });
      loadStocks();
    } catch (error) {
      console.error('Failed to analyze stock:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Stock',
      message: 'Are you sure you want to delete this stock?',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        await deleteStock(id);
        loadStocks();
        if (selectedStock?.id === id) setSelectedStock(null);
      },
      onCancel: () => setConfirmDialog({ open: false })
    });
  };

  const handleEdit = (stock) => {
    setEditingStock(stock);
    setFormData({
      symbol: stock.symbol || '', companyName: stock.companyName || '', sector: stock.sector || '',
      industry: stock.industry || '', marketCap: stock.marketCap || '', peRatio: stock.peRatio || '',
      pbRatio: stock.pbRatio || '', dividendYield: stock.dividendYield || '', eps: stock.eps || '',
      revenueGrowth: stock.revenueGrowth || '', profitMargin: stock.profitMargin || '',
      debtToEquity: stock.debtToEquity || '', currentPrice: stock.currentPrice || '',
      targetPrice: stock.targetPrice || '', analystRating: stock.analystRating || ''
    });
    setShowForm(true);
  };

  const handleWatchlist = async (id) => {
    await toggleWatchlist(id);
    loadStocks();
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const response = await analyzeAllStocks();
      setPortfolioAnalysis(response.data);
    } catch (error) {
      console.error('Failed to analyze all stocks:', error);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Selected',
      message: `Delete ${selectedIds.length} selected stocks?`,
      variant: 'danger',
      confirmText: 'Delete All',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        await bulkDeleteStocks(selectedIds);
        setSelectedIds([]);
        loadStocks();
      },
      onCancel: () => setConfirmDialog({ open: false })
    });
  };

  const handleExport = (format) => {
    downloadExport(exportStocks, format, 'stocks');
  };

  const handleSelectToggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleRowClick = (stock) => {
    setDetailModal({ open: true, data: stock });
  };

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
    setOffset(0);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#f44336';
  };

  const getSentimentIcon = (sentiment) => {
    if (sentiment === 'bullish') return <TrendingUp size={16} color="#4CAF50" />;
    if (sentiment === 'bearish') return <TrendingDown size={16} color="#f44336" />;
    return <ArrowRight size={16} color="#999" />;
  };

  if (loading) return <div className="feature-page"><LoadingSkeleton variant="card" count={5} /></div>;

  return (
    <div className="feature-page">
      <div className="page-header">
        <h1>AI Stock Screener</h1>
        <p>Screen stocks with AI-powered analysis and recommendations</p>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingStock(null); }}>
            <Plus size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Add Stock
          </button>
          {stocks.length > 1 && (
            <button className="btn-secondary" onClick={handleAnalyzeAll} disabled={analyzingAll}>
              {analyzingAll ? 'Scanning...' : 'Scan All Stocks'}
            </button>
          )}
        </div>
      </div>

      <BulkActions
        selectedCount={selectedIds.length}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedIds([])}
      />

      <div className="list-toolbar">
        <SearchBar value={search} onChange={val => { setSearch(val); setOffset(0); }} placeholder="Search stocks..." />
        <SortControls
          columns={[
            { field: 'createdAt', label: 'Date' },
            { field: 'symbol', label: 'Symbol' },
            { field: 'currentPrice', label: 'Price' },
            { field: 'aiScore', label: 'AI Score' }
          ]}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <ExportButton onExport={handleExport} />
      </div>

      {portfolioAnalysis && portfolioAnalysis.analysis && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>AI Stock Scanner Results</h3>
            <button className="btn-close" onClick={() => setPortfolioAnalysis(null)}>×</button>
          </div>

          {portfolioAnalysis.analysis?.methodology && (
            <div className="portfolio-insights" style={{background:'#e8f4fd',borderLeft:'4px solid #2196F3',padding:'12px 16px',marginBottom:'12px'}}>
              <h4 style={{margin:'0 0 4px',color:'#1565C0'}}>Scoring Methodology</h4>
              <p style={{margin:0,fontSize:'0.9rem'}}>{portfolioAnalysis.analysis.methodology}</p>
              <div style={{display:'flex',gap:'8px',marginTop:'8px',flexWrap:'wrap',fontSize:'0.8rem'}}>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Value (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Growth (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Quality (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Health (20pts)</span>
                <span style={{background:'#fff',padding:'2px 8px',borderRadius:'4px'}}>Momentum (20pts)</span>
              </div>
            </div>
          )}

          <div className="portfolio-score">
            <div className="score-circle" style={{ backgroundColor: getScoreColor(portfolioAnalysis.analysis?.overallScore || 0) }}>
              <span className="score">{portfolioAnalysis.analysis?.overallScore || 0}</span>
            </div>
            <div className="portfolio-stats">
              <div><label>Market Outlook</label><span>{portfolioAnalysis.analysis?.marketOutlook}</span></div>
            </div>
          </div>

          {portfolioAnalysis.analysis?.rankings?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Stock Rankings (by 5-Strategy Score)</h4>
              <div style={{display:'grid',gap:'12px'}}>
                {portfolioAnalysis.analysis.rankings.map((r, i) => (
                  <div key={i} style={{padding:'14px',background: i === 0 ? '#f0faf0' : '#f8f9fa',borderRadius:'8px',border: i === 0 ? '2px solid #4CAF50' : '1px solid #e0e0e0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontWeight:'bold',fontSize:'1.2rem',color: i === 0 ? '#4CAF50' : '#666'}}>#{r.rank}</span>
                        <strong style={{fontSize:'1.1rem'}}>{r.symbol} - {r.company}</strong>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{ backgroundColor: getScoreColor(r.totalScore || r.score), color:'#fff',padding:'4px 12px',borderRadius:'12px',fontWeight:'bold' }}>{r.totalScore || r.score}/100</div>
                        <span className={`recommendation-badge ${r.recommendation}`} style={{padding:'3px 10px',borderRadius:'4px',fontSize:'0.85rem'}}>{r.recommendation?.replace('_',' ').toUpperCase()}</span>
                      </div>
                    </div>
                    {r.upsidePotential && <div style={{fontSize:'0.9rem',marginBottom:'6px'}}><span style={{color:'#4CAF50',fontWeight:'bold'}}>Upside: {r.upsidePotential}</span> | Risk: {r.riskLevel}</div>}
                    {r.keyInsight && <p style={{margin:'4px 0 8px',fontSize:'0.9rem',color:'#333'}}>{r.keyInsight}</p>}
                    {r.scoreBreakdown && (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px',marginTop:'8px'}}>
                        {Object.entries(r.scoreBreakdown).map(([key, val]) => (
                          <div key={key} style={{background:'#fff',padding:'6px 8px',borderRadius:'6px',textAlign:'center',border:'1px solid #e8e8e8'}}>
                            <div style={{fontSize:'0.7rem',color:'#888',textTransform:'capitalize'}}>{key.replace('Score','')}</div>
                            <div style={{fontWeight:'bold',fontSize:'1rem',color: getScoreColor(val.score * 5)}}>{val.score}/20</div>
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

          {portfolioAnalysis.analysis?.sectorAnalysis?.length > 0 && (
            <div className="portfolio-insights">
              <h4>Sector Analysis</h4>
              {portfolioAnalysis.analysis.sectorAnalysis.map((s, i) => (
                <div key={i} style={{marginBottom:'6px'}}>
                  <strong>{s.sector}:</strong> {s.outlook} {s.bestPick && <span style={{color:'#4CAF50'}}>(Best pick: {s.bestPick})</span>}
                </div>
              ))}
            </div>
          )}

          {portfolioAnalysis.analysis?.portfolioInsights && (
            <div className="portfolio-insights">
              <h4>Portfolio Insights</h4>
              <p><strong>Diversification:</strong> {portfolioAnalysis.analysis.portfolioInsights.diversification}</p>
              <p><strong>Overall Risk:</strong> {portfolioAnalysis.analysis.portfolioInsights.overallRisk || portfolioAnalysis.analysis.portfolioInsights.riskLevel}</p>
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
          <p className="powered-by" style={{fontSize:'0.8rem',color:'#999',marginTop:'12px'}}>Powered by OpenRouter AI | 5-Strategy Analysis: Value + Growth + Quality + Health + Momentum</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingStock ? 'Edit Stock' : 'Add Stock'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Symbol *</label>
                  <input value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sector</label>
                  <input value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Industry</label>
                  <input value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Price ($)</label>
                  <input type="number" step="0.01" value={formData.currentPrice} onChange={e => setFormData({...formData, currentPrice: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Target Price ($)</label>
                  <input type="number" step="0.01" value={formData.targetPrice} onChange={e => setFormData({...formData, targetPrice: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Market Cap ($)</label>
                  <input type="number" value={formData.marketCap} onChange={e => setFormData({...formData, marketCap: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>P/E Ratio</label>
                  <input type="number" step="0.01" value={formData.peRatio} onChange={e => setFormData({...formData, peRatio: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>EPS ($)</label>
                  <input type="number" step="0.01" value={formData.eps} onChange={e => setFormData({...formData, eps: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Dividend Yield (%)</label>
                  <input type="number" step="0.01" value={formData.dividendYield} onChange={e => setFormData({...formData, dividendYield: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Revenue Growth (%)</label>
                  <input type="number" step="0.01" value={formData.revenueGrowth} onChange={e => setFormData({...formData, revenueGrowth: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Profit Margin (%)</label>
                  <input type="number" step="0.01" value={formData.profitMargin} onChange={e => setFormData({...formData, profitMargin: e.target.value})} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingStock ? 'Update' : 'Add'} Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="data-list">
          <h3>Your Stocks ({stocks.length})</h3>
          {stocks.length === 0 ? (
            <EmptyState title="No stocks yet" description="Add your first stock to start screening." actionLabel="Add Stock" onAction={() => { setShowForm(true); setEditingStock(null); }} />
          ) : (
            stocks.map(stock => (
              <div key={stock.id} className={`data-card clickable has-checkbox ${selectedStock?.id === stock.id ? 'selected' : ''}`} onClick={() => setSelectedStock(stock)}>
                <input
                  type="checkbox"
                  className="data-card-checkbox"
                  checked={selectedIds.includes(stock.id)}
                  onChange={(e) => { e.stopPropagation(); handleSelectToggle(stock.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="card-header">
                  <div className="card-title">
                    <span className="symbol">{stock.symbol}</span>
                    {stock.isWatchlisted && <span className="badge watchlist">★</span>}
                    {stock.aiSentiment && <span className="sentiment-icon">{getSentimentIcon(stock.aiSentiment)}</span>}
                  </div>
                  {stock.aiScore && (
                    <div className="ai-score" style={{ backgroundColor: getScoreColor(stock.aiScore) }}>
                      {stock.aiScore}
                    </div>
                  )}
                </div>
                <p className="card-subtitle">{stock.companyName}</p>
                <div className="card-details">
                  {stock.currentPrice && <span>Price: ${stock.currentPrice.toFixed(2)}</span>}
                  {stock.peRatio && <span>P/E: {stock.peRatio.toFixed(1)}</span>}
                  {stock.sector && <span>{stock.sector}</span>}
                </div>
                {stock.aiRecommendation && (
                  <div className={`recommendation-badge ${stock.aiRecommendation}`}>
                    {stock.aiRecommendation.replace('_', ' ').toUpperCase()}
                  </div>
                )}
                <div className="card-actions">
                  <button onClick={(e) => { e.stopPropagation(); handleWatchlist(stock.id); }} className="btn-icon" title="Toggle Watchlist">
                    {stock.isWatchlisted ? <Star size={16} fill="gold" color="gold" /> : <StarOff size={16} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleAnalyze(stock); }} disabled={analyzing === stock.id} className="btn-small">
                    {analyzing === stock.id ? 'Analyzing...' : 'AI Analyze'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(stock); }} className="btn-icon"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(stock.id); }} className="btn-icon delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
          <Pagination total={total} offset={offset} limit={limit} onPageChange={setOffset} onLimitChange={(l) => { setLimit(l); setOffset(0); }} />
        </div>

        <div className="detail-panel">
          {selectedStock ? (
            <div className="detail-content">
              <h2>{selectedStock.symbol} - {selectedStock.companyName}</h2>

              <div className="detail-section">
                <h3>Stock Information</h3>
                <div className="info-grid">
                  <div className="info-item"><label>Sector</label><span>{selectedStock.sector || 'N/A'}</span></div>
                  <div className="info-item"><label>Industry</label><span>{selectedStock.industry || 'N/A'}</span></div>
                  <div className="info-item"><label>Current Price</label><span>${selectedStock.currentPrice?.toFixed(2) || 'N/A'}</span></div>
                  <div className="info-item"><label>Target Price</label><span>${selectedStock.targetPrice?.toFixed(2) || 'N/A'}</span></div>
                  <div className="info-item"><label>Market Cap</label><span>${selectedStock.marketCap?.toLocaleString() || 'N/A'}</span></div>
                  <div className="info-item"><label>P/E Ratio</label><span>{selectedStock.peRatio?.toFixed(2) || 'N/A'}</span></div>
                  <div className="info-item"><label>EPS</label><span>${selectedStock.eps?.toFixed(2) || 'N/A'}</span></div>
                  <div className="info-item"><label>Dividend Yield</label><span>{selectedStock.dividendYield ? selectedStock.dividendYield + '%' : 'N/A'}</span></div>
                </div>
              </div>

              {selectedStock.aiAnalysis && (
                <div className="ai-analysis-section">
                  <h3>AI Analysis</h3>
                  <div className="ai-header">
                    <div className="ai-score-large" style={{ backgroundColor: getScoreColor(selectedStock.aiScore) }}>
                      <span className="score-value">{selectedStock.aiScore}</span>
                      <span className="score-label">AI Score</span>
                    </div>
                    <div className="ai-meta">
                      <div className="sentiment">
                        <span className="label">Sentiment:</span>
                        <span className={`value ${selectedStock.aiSentiment}`}>{getSentimentIcon(selectedStock.aiSentiment)} {selectedStock.aiSentiment?.toUpperCase()}</span>
                      </div>
                      <div className="recommendation">
                        <span className="label">Recommendation:</span>
                        <span className={`value ${selectedStock.aiRecommendation}`}>{selectedStock.aiRecommendation?.replace('_', ' ').toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="analysis-content">
                    <div className="analysis-summary">
                      <h4>Summary</h4>
                      <p>{selectedStock.aiAnalysis.summary}</p>
                    </div>

                    {selectedStock.aiAnalysis.strengths && (
                      <div className="analysis-list">
                        <h4>Strengths</h4>
                        <ul className="pros-list">
                          {selectedStock.aiAnalysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedStock.aiAnalysis.weaknesses && (
                      <div className="analysis-list">
                        <h4>Weaknesses</h4>
                        <ul className="cons-list">
                          {selectedStock.aiAnalysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedStock.aiAnalysis.priceTarget && (
                      <div className="price-targets">
                        <h4>Price Targets</h4>
                        <div className="targets-grid">
                          <div className="target bear"><span className="label">Bear Case</span><span className="value">${selectedStock.aiAnalysis.priceTarget.bearCase}</span></div>
                          <div className="target base"><span className="label">Base Case</span><span className="value">${selectedStock.aiAnalysis.priceTarget.baseCase}</span></div>
                          <div className="target bull"><span className="label">Bull Case</span><span className="value">${selectedStock.aiAnalysis.priceTarget.bullCase}</span></div>
                        </div>
                      </div>
                    )}

                    {selectedStock.aiAnalysis.technicalAnalysis && (
                      <div className="analysis-item">
                        <h4>Technical Analysis</h4>
                        <p>{selectedStock.aiAnalysis.technicalAnalysis}</p>
                      </div>
                    )}

                    {selectedStock.aiAnalysis.fundamentalAnalysis && (
                      <div className="analysis-item">
                        <h4>Fundamental Analysis</h4>
                        <p>{selectedStock.aiAnalysis.fundamentalAnalysis}</p>
                      </div>
                    )}
                  </div>
                  <p className="powered-by">Powered by OpenRouter AI</p>
                </div>
              )}

              {!selectedStock.aiAnalysis && (
                <div className="no-analysis">
                  <p>No AI analysis yet. Click "AI Analyze" to get insights.</p>
                  <button onClick={() => handleAnalyze(selectedStock)} disabled={analyzing === selectedStock.id} className="btn-primary">
                    {analyzing === selectedStock.id ? 'Analyzing...' : 'Generate AI Analysis'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a stock to view details</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirmDialog.open} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />
    </div>
  );
}

export default StockScreener;
