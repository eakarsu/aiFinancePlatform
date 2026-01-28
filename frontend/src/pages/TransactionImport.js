import React, { useState, useEffect } from 'react';
import {
  importCSV,
  getImportHistory,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction
} from '../services/api';

function TransactionImport() {
  const [activeTab, setActiveTab] = useState('examples');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [exampleTransactions, setExampleTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});

  // Single transaction form
  const [singleTransaction, setSingleTransaction] = useState({
    type: 'PURCHASE',
    amount: '',
    merchant: '',
    category: '',
    location: '',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = [
    'Food & Drink', 'Groceries', 'Gas', 'Transportation', 'Shopping',
    'Electronics', 'Entertainment', 'Utilities', 'Healthcare', 'Travel',
    'Income', 'Transfer', 'Cash', 'Software', 'Home Improvement'
  ];

  const transactionTypes = [
    { value: 'PURCHASE', label: 'Purchase' },
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'WITHDRAWAL', label: 'Withdrawal' },
    { value: 'TRANSFER', label: 'Transfer' },
    { value: 'REFUND', label: 'Refund' }
  ];

  useEffect(() => {
    loadExampleTransactions();
    loadImportHistory();
  }, []);

  const loadExampleTransactions = async () => {
    try {
      const response = await getTransactions();
      setExampleTransactions(response.data.slice(0, 30));
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const loadImportHistory = async () => {
    try {
      const response = await getImportHistory();
      setImportHistory(response.data);
    } catch (error) {
      console.error('Failed to load import history:', error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setCsvContent(content);

      const lines = content.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
        const preview = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
          const row = {};
          headers.forEach((h, i) => row[h] = values[i]);
          return row;
        });
        setPreviewData({ headers, preview, totalRows: lines.length - 1 });
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!csvContent) {
      alert('Please upload a CSV file first');
      return;
    }

    try {
      setLoading(true);
      const response = await importCSV(csvContent, fileName, true);
      setImportResult(response.data);
      setMessage({ type: 'success', text: `Successfully imported ${response.data.results?.imported || 0} transactions!` });
      loadImportHistory();
      loadExampleTransactions();
    } catch (error) {
      console.error('Import failed:', error);
      setMessage({ type: 'error', text: 'Import failed. Please check your CSV format.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSingleImport = async (e) => {
    e.preventDefault();

    if (!singleTransaction.amount || !singleTransaction.merchant) {
      setMessage({ type: 'error', text: 'Please fill in amount and merchant' });
      return;
    }

    try {
      setLoading(true);
      await addTransaction({
        type: singleTransaction.type,
        amount: parseFloat(singleTransaction.amount),
        merchant: singleTransaction.merchant,
        category: singleTransaction.category,
        location: singleTransaction.location || 'Unknown',
        date: singleTransaction.date
      });

      setMessage({ type: 'success', text: 'Transaction added successfully!' });
      setSingleTransaction({
        type: 'PURCHASE',
        amount: '',
        merchant: '',
        category: '',
        location: '',
        date: new Date().toISOString().split('T')[0]
      });
      loadExampleTransactions();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      setMessage({ type: 'error', text: 'Failed to add transaction' });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (txn) => {
    setSelectedTransaction(txn);
    setEditMode(false);
    setEditData({
      type: txn.type,
      amount: txn.amount,
      merchant: txn.merchant,
      category: txn.category,
      location: txn.location
    });
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      await updateTransaction(selectedTransaction.id, editData);
      setMessage({ type: 'success', text: 'Transaction updated successfully!' });
      setEditMode(false);
      setSelectedTransaction(null);
      loadExampleTransactions();
    } catch (error) {
      console.error('Failed to update transaction:', error);
      setMessage({ type: 'error', text: 'Failed to update transaction' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      setLoading(true);
      await deleteTransaction(selectedTransaction.id);
      setMessage({ type: 'success', text: 'Transaction deleted successfully!' });
      setSelectedTransaction(null);
      loadExampleTransactions();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete transaction' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTransaction(null);
    setEditMode(false);
  };

  const downloadTemplate = () => {
    const template = `Date,Type,Amount,Merchant,Category,Location
2024-01-15,PURCHASE,5.75,Starbucks,Food & Drink,San Francisco CA
2024-01-15,PURCHASE,89.50,Whole Foods,Groceries,San Francisco CA
2024-01-16,PURCHASE,45.00,Shell Gas Station,Gas,Oakland CA
2024-01-16,PURCHASE,125.99,Amazon,Shopping,Online
2024-01-17,PURCHASE,15.99,Netflix,Entertainment,Online
2024-01-17,PURCHASE,150.00,PG&E,Utilities,San Francisco CA
2024-01-18,DEPOSIT,3500.00,Direct Deposit - Employer,Income,Online
2024-01-18,PURCHASE,25.50,Uber,Transportation,San Francisco CA
2024-01-19,TRANSFER,500.00,Venmo Transfer,Transfer,Online
2024-01-19,WITHDRAWAL,200.00,ATM Withdrawal,Cash,San Francisco CA
2024-01-20,PURCHASE,249.00,Best Buy,Electronics,San Francisco CA
2024-01-20,PURCHASE,67.50,Target,Shopping,San Francisco CA
2024-01-21,PURCHASE,12.99,Chipotle,Food & Drink,San Francisco CA
2024-01-21,REFUND,45.99,Amazon Refund,Shopping,Online
2024-01-22,PURCHASE,450.00,Delta Airlines,Travel,SFO Airport`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaction_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'DEPOSIT': return '#22c55e';
      case 'REFUND': return '#22c55e';
      case 'WITHDRAWAL': return '#ef4444';
      case 'TRANSFER': return '#3b82f6';
      default: return '#f59e0b';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'DEPOSIT': return '💰';
      case 'REFUND': return '↩️';
      case 'WITHDRAWAL': return '🏧';
      case 'TRANSFER': return '↔️';
      default: return '🛒';
    }
  };

  return (
    <div className="transaction-import">
      <h1>Import Transactions</h1>
      <p className="subtitle">View example transactions, add single transaction, or bulk import from CSV</p>

      {/* Message */}
      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="import-tabs">
        <button
          className={`tab ${activeTab === 'examples' ? 'active' : ''}`}
          onClick={() => setActiveTab('examples')}
        >
          📋 Example Transactions
        </button>
        <button
          className={`tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          ➕ Add Single
        </button>
        <button
          className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          📄 Bulk CSV Import
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Import History
        </button>
      </div>

      {/* Example Transactions Tab */}
      {activeTab === 'examples' && (
        <div className="examples-section">
          <div className="section-header">
            <h3>Recent Transactions</h3>
            <span className="count">{exampleTransactions.length} transactions • Click row for details</span>
          </div>

          {exampleTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No transactions yet. Add some transactions to get started.</p>
            </div>
          ) : (
            <div className="transactions-list">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exampleTransactions.map((txn, index) => (
                    <tr
                      key={txn.id || index}
                      className={`clickable-row ${txn.fraudScore > 70 ? 'flagged' : ''}`}
                      onClick={() => handleRowClick(txn)}
                    >
                      <td>{new Date(txn.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className="type-badge" style={{ backgroundColor: getTypeColor(txn.type) }}>
                          {getTypeIcon(txn.type)} {txn.type}
                        </span>
                      </td>
                      <td className="merchant">{txn.merchant}</td>
                      <td>{txn.category}</td>
                      <td>{txn.location}</td>
                      <td className={`amount ${txn.type === 'DEPOSIT' || txn.type === 'REFUND' ? 'positive' : 'negative'}`}>
                        {txn.type === 'DEPOSIT' || txn.type === 'REFUND' ? '+' : '-'}${txn.amount?.toFixed(2)}
                      </td>
                      <td>
                        <span className={`status-badge ${txn.reviewStatus?.toLowerCase()}`}>
                          {txn.reviewStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Single Transaction Tab */}
      {activeTab === 'single' && (
        <div className="single-transaction-section">
          <div className="form-card">
            <h3>Add Single Transaction</h3>
            <form onSubmit={handleSingleImport}>
              <div className="form-row">
                <div className="form-group">
                  <label>Transaction Type</label>
                  <select
                    value={singleTransaction.type}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, type: e.target.value })}
                  >
                    {transactionTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={singleTransaction.date}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={singleTransaction.amount}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Merchant *</label>
                  <input
                    type="text"
                    placeholder="e.g., Starbucks, Amazon"
                    value={singleTransaction.merchant}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, merchant: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={singleTransaction.category}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, category: e.target.value })}
                  >
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    placeholder="e.g., San Francisco, CA"
                    value={singleTransaction.location}
                    onChange={(e) => setSingleTransaction({ ...singleTransaction, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : '➕ Add Transaction'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSingleTransaction({
                    type: 'PURCHASE',
                    amount: '',
                    merchant: '',
                    category: '',
                    location: '',
                    date: new Date().toISOString().split('T')[0]
                  })}
                >
                  Clear
                </button>
              </div>
            </form>

            {/* Quick Add Buttons */}
            <div className="quick-add">
              <h4>Quick Add Examples:</h4>
              <div className="quick-buttons">
                <button onClick={() => setSingleTransaction({
                  type: 'PURCHASE', amount: '5.75', merchant: 'Starbucks',
                  category: 'Food & Drink', location: 'San Francisco, CA',
                  date: new Date().toISOString().split('T')[0]
                })}>☕ Coffee</button>
                <button onClick={() => setSingleTransaction({
                  type: 'PURCHASE', amount: '45.00', merchant: 'Shell Gas Station',
                  category: 'Gas', location: 'San Francisco, CA',
                  date: new Date().toISOString().split('T')[0]
                })}>⛽ Gas</button>
                <button onClick={() => setSingleTransaction({
                  type: 'PURCHASE', amount: '89.50', merchant: 'Whole Foods',
                  category: 'Groceries', location: 'San Francisco, CA',
                  date: new Date().toISOString().split('T')[0]
                })}>🛒 Groceries</button>
                <button onClick={() => setSingleTransaction({
                  type: 'DEPOSIT', amount: '3500.00', merchant: 'Direct Deposit',
                  category: 'Income', location: 'Online',
                  date: new Date().toISOString().split('T')[0]
                })}>💰 Salary</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Tab */}
      {activeTab === 'bulk' && (
        <div className="csv-upload-section">
          <div className="upload-card">
            <h3>Bulk CSV Import</h3>
            <div className="upload-area">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                id="csv-input"
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-input" className="upload-label">
                <span className="upload-icon">📁</span>
                <span className="upload-text">
                  {fileName ? fileName : 'Click to upload or drag & drop'}
                </span>
                <span className="upload-hint">CSV files only</span>
              </label>
            </div>

            <div className="template-download">
              <button className="btn-link" onClick={downloadTemplate}>
                📥 Download CSV Template (15 example transactions)
              </button>
            </div>
          </div>

          {/* Preview */}
          {previewData && (
            <div className="preview-section">
              <h3>Preview ({previewData.totalRows} transactions)</h3>
              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {previewData.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row, i) => (
                      <tr key={i}>
                        {previewData.headers.map((h, j) => (
                          <td key={j}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="preview-note">Showing first 5 rows</p>

              <div className="import-actions">
                <button
                  className="btn-primary"
                  onClick={handleBulkImport}
                  disabled={loading}
                >
                  {loading ? 'Importing...' : `📤 Import ${previewData.totalRows} Transactions`}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCsvContent('');
                    setFileName('');
                    setPreviewData(null);
                    setImportResult(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`import-result ${importResult.status?.toLowerCase()}`}>
              <h3>Import {importResult.status}</h3>
              <div className="result-stats">
                <div className="stat">
                  <span className="stat-value success">{importResult.results?.imported || 0}</span>
                  <span className="stat-label">Imported</span>
                </div>
                <div className="stat">
                  <span className="stat-value warning">{importResult.results?.skipped || 0}</span>
                  <span className="stat-label">Skipped</span>
                </div>
                <div className="stat">
                  <span className="stat-value error">{importResult.results?.failed || 0}</span>
                  <span className="stat-label">Failed</span>
                </div>
              </div>
            </div>
          )}

          {/* CSV Format Guide */}
          <div className="format-guide">
            <h3>CSV Format Guide</h3>
            <div className="guide-content">
              <p>Your CSV file should include these columns:</p>
              <ul>
                <li><strong>Date</strong> - Transaction date (YYYY-MM-DD)</li>
                <li><strong>Type</strong> - PURCHASE, DEPOSIT, WITHDRAWAL, TRANSFER, or REFUND</li>
                <li><strong>Amount</strong> - Transaction amount (positive number)</li>
                <li><strong>Merchant</strong> - Merchant/payee name</li>
                <li><strong>Category</strong> - Transaction category</li>
                <li><strong>Location</strong> - Transaction location (optional)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-section">
          <h3>Import History</h3>
          {importHistory.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No imports yet. Upload a CSV file to get started.</p>
            </div>
          ) : (
            <div className="history-list">
              {importHistory.map(imp => (
                <div
                  key={imp.id}
                  className={`history-item clickable-row ${imp.status?.toLowerCase()}`}
                  onClick={() => setSelectedTransaction({ ...imp, isImport: true })}
                >
                  <div className="history-icon">
                    {imp.source === 'csv' ? '📄' : imp.source === 'manual' ? '✏️' : '🏦'}
                  </div>
                  <div className="history-info">
                    <div className="history-header">
                      <span className="source">{imp.source?.toUpperCase()}</span>
                      <span className={`status ${imp.status?.toLowerCase()}`}>{imp.status}</span>
                    </div>
                    {imp.fileName && <p className="filename">{imp.fileName}</p>}
                    <div className="history-stats">
                      <span className="success">{imp.processedRecords} imported</span>
                      {imp.failedRecords > 0 && (
                        <span className="error">{imp.failedRecords} failed</span>
                      )}
                    </div>
                    <p className="history-date">
                      {new Date(imp.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && !selectedTransaction.isImport && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transaction Details</h2>
              <button className="close-btn" onClick={handleClose}>×</button>
            </div>
            <div className="modal-body">
              {editMode ? (
                // Edit Form
                <div className="edit-form">
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={editData.type}
                      onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                    >
                      {transactionTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.amount}
                      onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Merchant</label>
                    <input
                      type="text"
                      value={editData.merchant}
                      onChange={(e) => setEditData({ ...editData, merchant: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={editData.category}
                      onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    >
                      <option value="">Select category...</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="detail-row">
                    <span className="label">Type:</span>
                    <span className="type-badge" style={{ backgroundColor: getTypeColor(selectedTransaction.type) }}>
                      {getTypeIcon(selectedTransaction.type)} {selectedTransaction.type}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Amount:</span>
                    <span className={`amount large ${selectedTransaction.type === 'DEPOSIT' || selectedTransaction.type === 'REFUND' ? 'positive' : 'negative'}`}>
                      {selectedTransaction.type === 'DEPOSIT' || selectedTransaction.type === 'REFUND' ? '+' : '-'}${selectedTransaction.amount?.toFixed(2)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Merchant:</span>
                    <span className="value">{selectedTransaction.merchant || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Category:</span>
                    <span className="value">{selectedTransaction.category || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Location:</span>
                    <span className="value">{selectedTransaction.location || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date:</span>
                    <span className="value">{new Date(selectedTransaction.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className={`status-badge ${selectedTransaction.reviewStatus?.toLowerCase()}`}>
                      {selectedTransaction.reviewStatus}
                    </span>
                  </div>
                  {selectedTransaction.fraudScore !== null && selectedTransaction.fraudScore !== undefined && (
                    <div className="detail-row">
                      <span className="label">Fraud Score:</span>
                      <span className={`fraud-score ${selectedTransaction.fraudScore > 70 ? 'high' : selectedTransaction.fraudScore > 40 ? 'medium' : 'low'}`}>
                        {selectedTransaction.fraudScore?.toFixed(0)}/100
                      </span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="label">Transaction ID:</span>
                    <span className="value mono">{selectedTransaction.id}</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {editMode ? (
                <>
                  <button className="btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveEdit} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={handleClose}>Close</button>
                  <button className="btn-edit" onClick={handleEdit}>✏️ Edit</button>
                  <button className="btn-delete" onClick={handleDelete} disabled={loading}>
                    {loading ? 'Deleting...' : '🗑️ Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Detail Modal */}
      {selectedTransaction && selectedTransaction.isImport && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Details</h2>
              <button className="close-btn" onClick={handleClose}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="label">Source:</span>
                <span className="value">{selectedTransaction.source?.toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="label">File Name:</span>
                <span className="value">{selectedTransaction.fileName || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Status:</span>
                <span className={`status-badge ${selectedTransaction.status?.toLowerCase()}`}>
                  {selectedTransaction.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Total Records:</span>
                <span className="value">{selectedTransaction.totalRecords}</span>
              </div>
              <div className="detail-row">
                <span className="label">Processed:</span>
                <span className="value success">{selectedTransaction.processedRecords}</span>
              </div>
              <div className="detail-row">
                <span className="label">Failed:</span>
                <span className="value error">{selectedTransaction.failedRecords}</span>
              </div>
              <div className="detail-row">
                <span className="label">Date:</span>
                <span className="value">{new Date(selectedTransaction.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleClose}>Close</button>
              <button className="btn-delete" onClick={handleDelete} disabled={loading}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionImport;
