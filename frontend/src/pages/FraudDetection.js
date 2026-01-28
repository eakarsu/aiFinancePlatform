import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

function FraudDetection() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [transactionDetail, setTransactionDetail] = useState(null);
  const [batchResult, setBatchResult] = useState(null);

  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    merchantName: '',
    merchantCategory: '',
    location: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [transRes, alertRes, statsRes] = await Promise.all([
        api.getTransactions(50),
        api.getFraudAlerts(),
        api.getFraudStats()
      ]);
      setTransactions(transRes.data);
      setAlerts(alertRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.monitorTransaction({
        ...newTransaction,
        amount: parseFloat(newTransaction.amount)
      });
      setTransactions([{ ...response.data, ...newTransaction, amount: parseFloat(newTransaction.amount) }, ...transactions]);
      setNewTransaction({ amount: '', merchantName: '', merchantCategory: '', location: '', description: '' });
      loadData();

      if (response.data.riskLevel !== 'LOW') {
        alert(`Transaction flagged! Risk: ${response.data.riskLevel}\nFlags: ${response.data.flags.join(', ')}`);
      }
    } catch (error) {
      alert('Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const analyzeTransaction = async (transactionId) => {
    setLoading(true);
    setSelectedTransaction(transactionId);
    try {
      const response = await api.analyzeTransaction(transactionId);
      setAnalysisResult(response.data);
      loadData();
    } catch (error) {
      alert('Failed to analyze transaction');
    } finally {
      setLoading(false);
    }
  };

  const analyzeBatch = async () => {
    setLoading(true);
    try {
      const response = await api.analyzeBatch();
      setBatchResult(response.data);
      loadData();
    } catch (error) {
      console.error('Batch analysis error:', error);
      alert('Failed to run batch analysis: ' + (error.response?.data?.details || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score >= 70) return '#F44336';
    if (score >= 40) return '#FF9800';
    return '#4CAF50';
  };

  const getRiskLabel = (score) => {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Fraud Detection</h1>
        <p>AI-powered real-time transaction monitoring for SMBs</p>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card clickable" onClick={() => setActiveTab('transactions')} title="View transactions">
            <span className="stat-value">{stats.totalTransactions}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-card warning clickable" onClick={() => setActiveTab('transactions')} title="View flagged transactions">
            <span className="stat-value">{stats.flaggedTransactions}</span>
            <span className="stat-label">Flagged</span>
          </div>
          <div className="stat-card clickable" onClick={() => setActiveTab('alerts')} title="View alerts">
            <span className="stat-value">{stats.totalAlerts}</span>
            <span className="stat-label">Alerts</span>
          </div>
          <div className="stat-card clickable" onClick={() => navigate('/import')} title="Import transactions">
            <span className="stat-value">{stats.averageRiskScore}%</span>
            <span className="stat-label">Avg Risk Score</span>
          </div>
          <div className="stat-card clickable" onClick={() => navigate('/alerts')} title="View all alerts">
            <span className="stat-value">{stats.flagRate}%</span>
            <span className="stat-label">Flag Rate</span>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'transactions' ? 'active' : ''}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button
          className={activeTab === 'add' ? 'active' : ''}
          onClick={() => setActiveTab('add')}
        >
          Add Transaction
        </button>
        <button
          className={activeTab === 'alerts' ? 'active' : ''}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts ({alerts.length})
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div className="card">
          <div className="card-header">
            <h2>Recent Transactions</h2>
            <button onClick={analyzeBatch} className="btn-secondary" disabled={loading}>
              {loading ? 'Analyzing...' : 'Run Batch Analysis'}
            </button>
          </div>

          <div className="transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Risk Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`clickable-row ${tx.fraudScore >= 50 ? 'flagged' : ''}`}
                    onClick={() => setTransactionDetail(tx)}
                  >
                    <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td>${tx.amount?.toLocaleString()}</td>
                    <td>{tx.merchantName || tx.merchant || '-'}</td>
                    <td>{tx.merchantCategory || tx.category || '-'}</td>
                    <td>{tx.location || '-'}</td>
                    <td>
                      {tx.fraudScore !== null ? (
                        <span
                          className="risk-badge"
                          style={{ backgroundColor: getRiskColor(tx.fraudScore) }}
                        >
                          {tx.fraudScore} ({getRiskLabel(tx.fraudScore)})
                        </span>
                      ) : (
                        <span className="risk-badge unanalyzed">Not analyzed</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); analyzeTransaction(tx.id); }}
                        className="btn-small"
                        disabled={loading && selectedTransaction === tx.id}
                      >
                        {loading && selectedTransaction === tx.id ? 'Analyzing...' : 'Analyze'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="card">
          <h2>Add New Transaction</h2>
          <p className="card-subtitle">Submit a transaction for real-time fraud analysis</p>

          <form onSubmit={handleAddTransaction}>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  placeholder="150.00"
                  required
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Merchant Name</label>
                <input
                  type="text"
                  value={newTransaction.merchantName}
                  onChange={(e) => setNewTransaction({ ...newTransaction, merchantName: e.target.value })}
                  placeholder="Amazon"
                />
              </div>

              <div className="form-group">
                <label>Merchant Category</label>
                <select
                  value={newTransaction.merchantCategory}
                  onChange={(e) => setNewTransaction({ ...newTransaction, merchantCategory: e.target.value })}
                >
                  <option value="">Select category</option>
                  <option value="retail">Retail</option>
                  <option value="grocery">Grocery</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="gas">Gas Station</option>
                  <option value="travel">Travel</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="utilities">Utilities</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={newTransaction.location}
                  onChange={(e) => setNewTransaction({ ...newTransaction, location: e.target.value })}
                  placeholder="New York, NY"
                />
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  placeholder="Online purchase"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Transaction'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="card">
          <h2>Fraud Alerts</h2>

          {alerts.length === 0 ? (
            <p className="no-data">No fraud alerts</p>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div key={alert.id} className={`alert-item ${alert.severity?.toLowerCase()}`}>
                  <div className="alert-header">
                    <span className={`alert-severity ${alert.severity?.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                    <span className="alert-type">{alert.alertType?.replace('_', ' ')}</span>
                    <span className="alert-date">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="alert-body">
                    <p>{alert.description}</p>
                    {alert.transaction && (
                      <div className="alert-transaction">
                        <strong>Transaction:</strong> ${alert.transaction.amount} at {alert.transaction.merchantName || 'Unknown'}
                      </div>
                    )}
                  </div>
                  <div className="alert-footer">
                    <span>Confidence: {alert.aiConfidence}%</span>
                    <span className={`alert-status ${alert.status?.toLowerCase()}`}>
                      {alert.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {analysisResult && (
        <div className="modal-overlay" onClick={() => setAnalysisResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>AI Fraud Analysis</h2>
              <button className="close-btn" onClick={() => setAnalysisResult(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="analysis-score">
                <div
                  className="score-circle"
                  style={{ borderColor: getRiskColor(analysisResult.analysis?.riskScore || 0) }}
                >
                  <span className="score-number">{analysisResult.analysis?.riskScore}</span>
                  <span className="score-label">{analysisResult.analysis?.riskLevel}</span>
                </div>
              </div>

              <div className="analysis-details">
                <div className="detail-item">
                  <label>Recommendation</label>
                  <span className={`recommendation ${analysisResult.analysis?.recommendation?.toLowerCase()}`}>
                    {analysisResult.analysis?.recommendation}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Confidence</label>
                  <span>{analysisResult.analysis?.confidence}%</span>
                </div>
                <div className="detail-item">
                  <label>Is Fraudulent</label>
                  <span>{analysisResult.analysis?.isFraudulent ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {analysisResult.analysis?.flags?.length > 0 && (
                <div className="flags-section">
                  <h4>Risk Flags</h4>
                  {analysisResult.analysis.flags.map((flag, index) => (
                    <div key={index} className={`flag-item ${flag.severity?.toLowerCase()}`}>
                      <span className="flag-severity">{flag.severity}</span>
                      <span className="flag-text">{flag.flag}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="reasoning-section">
                <h4>AI Reasoning</h4>
                <p>{analysisResult.analysis?.reasoning}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {transactionDetail && (
        <div className="modal-overlay" onClick={() => setTransactionDetail(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transaction Details</h2>
              <button className="close-btn" onClick={() => setTransactionDetail(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="label">Amount:</span>
                <span className="value amount large">${transactionDetail.amount?.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="label">Merchant:</span>
                <span className="value">{transactionDetail.merchantName || transactionDetail.merchant || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Category:</span>
                <span className="value">{transactionDetail.merchantCategory || transactionDetail.category || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Location:</span>
                <span className="value">{transactionDetail.location || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Date:</span>
                <span className="value">{new Date(transactionDetail.createdAt).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="label">Type:</span>
                <span className="value">{transactionDetail.type || 'PURCHASE'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Risk Score:</span>
                <span className={`fraud-score ${transactionDetail.fraudScore >= 70 ? 'high' : transactionDetail.fraudScore >= 40 ? 'medium' : 'low'}`}>
                  {transactionDetail.fraudScore !== null ? `${transactionDetail.fraudScore}/100` : 'Not analyzed'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Status:</span>
                <span className={`status-badge ${transactionDetail.reviewStatus?.toLowerCase()}`}>
                  {transactionDetail.reviewStatus || 'PENDING'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Transaction ID:</span>
                <span className="value mono">{transactionDetail.id}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setTransactionDetail(null)}>Close</button>
              <button className="btn-edit" onClick={() => navigate('/import')}>✏️ Edit</button>
              <button
                className="btn-delete"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete this transaction?')) {
                    try {
                      await api.deleteTransaction(transactionDetail.id);
                      setTransactionDetail(null);
                      loadData();
                    } catch (error) {
                      alert('Failed to delete transaction');
                    }
                  }
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Analysis Result Modal */}
      {batchResult && (
        <div className="modal-overlay" onClick={() => setBatchResult(null)}>
          <div className="modal batch-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header batch-header">
              <div className="batch-icon">
                {batchResult.overallRiskLevel === 'CRITICAL' ? '🚨' :
                 batchResult.overallRiskLevel === 'HIGH' ? '⚠️' :
                 batchResult.overallRiskLevel === 'MEDIUM' ? '📊' : '✅'}
              </div>
              <div>
                <h2>Batch Analysis Complete</h2>
                <span className="batch-subtitle">AI-Powered Fraud Detection Results</span>
              </div>
              <button className="close-btn" onClick={() => setBatchResult(null)}>×</button>
            </div>

            <div className="modal-body">
              {/* Stats Summary */}
              <div className="batch-stats">
                <div className="batch-stat">
                  <span className="batch-stat-value">{batchResult.analyzed}</span>
                  <span className="batch-stat-label">Transactions Analyzed</span>
                </div>
                <div className={`batch-stat risk-${batchResult.overallRiskLevel?.toLowerCase()}`}>
                  <span className="batch-stat-value">{batchResult.overallRiskLevel}</span>
                  <span className="batch-stat-label">Overall Risk Level</span>
                </div>
                <div className="batch-stat">
                  <span className="batch-stat-value">{batchResult.patternAlerts?.length || 0}</span>
                  <span className="batch-stat-label">Alerts Generated</span>
                </div>
              </div>

              {/* Pattern Alerts */}
              {batchResult.patternAlerts && batchResult.patternAlerts.length > 0 && (
                <div className="batch-alerts-section">
                  <h4>🔍 Pattern Alerts Detected</h4>
                  <ul className="batch-alerts-list">
                    {batchResult.patternAlerts.map((alert, index) => (
                      <li key={index} className="batch-alert-item">
                        <span className="alert-bullet">•</span>
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              {batchResult.summary && (
                <div className="batch-summary">
                  <h4>📋 Analysis Summary</h4>
                  <p>{batchResult.summary}</p>
                </div>
              )}

              {/* Individual Results */}
              {batchResult.batchAnalysis && batchResult.batchAnalysis.length > 0 && (
                <div className="batch-details">
                  <h4>📊 Transaction Risk Breakdown</h4>
                  <div className="batch-breakdown">
                    {batchResult.batchAnalysis.slice(0, 5).map((item, index) => (
                      <div key={index} className={`breakdown-item risk-${item.riskLevel?.toLowerCase()}`}>
                        <span className="breakdown-index">#{item.index}</span>
                        <span className="breakdown-score">{item.riskScore}</span>
                        <span className={`breakdown-level ${item.riskLevel?.toLowerCase()}`}>{item.riskLevel}</span>
                        <span className={`breakdown-action ${item.recommendation?.toLowerCase()}`}>{item.recommendation}</span>
                      </div>
                    ))}
                    {batchResult.batchAnalysis.length > 5 && (
                      <p className="more-results">+ {batchResult.batchAnalysis.length - 5} more transactions analyzed</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setBatchResult(null)}>Close</button>
              <button className="btn-primary" onClick={() => { setBatchResult(null); setActiveTab('alerts'); }}>
                View All Alerts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FraudDetection;
