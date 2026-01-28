import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

function CreditScoring() {
  const navigate = useNavigate();
  const [creditProfile, setCreditProfile] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedLoan, setSelectedLoan] = useState(null);

  const [formData, setFormData] = useState({
    annualIncome: '',
    employmentStatus: 'EMPLOYED',
    employmentYears: '',
    housingStatus: 'RENTER',
    monthlyRent: '',
    rentPaymentHistory: '',
    utilityPaymentHistory: '',
    phonePaymentHistory: '',
    bankAccountAge: '',
    averageBalance: '',
    overdraftCount: '',
    traditionalScore: ''
  });

  useEffect(() => {
    loadCreditProfile();
  }, []);

  const loadCreditProfile = async () => {
    try {
      const response = await api.getCreditProfile();
      if (response.data) {
        setCreditProfile(response.data);
        setFormData({
          annualIncome: response.data.annualIncome || '',
          employmentStatus: response.data.employmentStatus || 'EMPLOYED',
          employmentYears: response.data.employmentYears || '',
          housingStatus: response.data.housingStatus || 'RENTER',
          monthlyRent: response.data.monthlyRent || '',
          rentPaymentHistory: response.data.rentPaymentHistory || '',
          utilityPaymentHistory: response.data.utilityPaymentHistory || '',
          phonePaymentHistory: response.data.phonePaymentHistory || '',
          bankAccountAge: response.data.bankAccountAge || '',
          averageBalance: response.data.averageBalance || '',
          overdraftCount: response.data.overdraftCount || '',
          traditionalScore: response.data.traditionalScore || ''
        });
        if (response.data.aiCreditScore) {
          setScoreResult({
            score: response.data.aiCreditScore,
            confidence: response.data.aiConfidence,
            factors: response.data.aiFactors
          });
        }
      }
    } catch (error) {
      console.error('Failed to load credit profile:', error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.saveCreditProfile(formData);
      setCreditProfile(response.data);
      alert('Credit profile saved!');
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = async () => {
    if (!creditProfile) {
      alert('Please save your credit profile first');
      return;
    }
    setLoading(true);
    try {
      const response = await api.calculateCreditScore();
      setScoreResult(response.data);
      setActiveTab('score');
    } catch (error) {
      alert('Failed to calculate score');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 750) return '#4CAF50';
    if (score >= 670) return '#8BC34A';
    if (score >= 580) return '#FF9800';
    return '#F44336';
  };

  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Credit Scoring</h1>
        <p>Alternative credit scoring using non-traditional data for thin-file consumers</p>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          Credit Profile
        </button>
        <button
          className={activeTab === 'score' ? 'active' : ''}
          onClick={() => setActiveTab('score')}
        >
          AI Credit Score
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="card">
          <h2>Your Credit Profile</h2>
          <p className="card-subtitle">Enter your financial information for AI analysis</p>

          <form onSubmit={handleSaveProfile}>
            <h3>Employment & Income</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Annual Income ($)</label>
                <input
                  type="number"
                  value={formData.annualIncome}
                  onChange={(e) => setFormData({ ...formData, annualIncome: parseFloat(e.target.value) })}
                  placeholder="50000"
                />
              </div>

              <div className="form-group">
                <label>Employment Status</label>
                <select
                  value={formData.employmentStatus}
                  onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                >
                  <option value="EMPLOYED">Employed Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="SELF_EMPLOYED">Self-Employed</option>
                  <option value="UNEMPLOYED">Unemployed</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </div>

              <div className="form-group">
                <label>Years at Current Job</label>
                <input
                  type="number"
                  value={formData.employmentYears}
                  onChange={(e) => setFormData({ ...formData, employmentYears: parseInt(e.target.value) })}
                  placeholder="3"
                />
              </div>
            </div>

            <h3>Housing</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Housing Status</label>
                <select
                  value={formData.housingStatus}
                  onChange={(e) => setFormData({ ...formData, housingStatus: e.target.value })}
                >
                  <option value="OWNER">Home Owner</option>
                  <option value="RENTER">Renter</option>
                  <option value="LIVING_WITH_FAMILY">Living with Family</option>
                </select>
              </div>

              <div className="form-group">
                <label>Monthly Rent/Mortgage ($)</label>
                <input
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) })}
                  placeholder="1500"
                />
              </div>
            </div>

            <h3>Payment History (Alternative Data)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Rent On-Time Payments (months)</label>
                <input
                  type="number"
                  value={formData.rentPaymentHistory}
                  onChange={(e) => setFormData({ ...formData, rentPaymentHistory: parseInt(e.target.value) })}
                  placeholder="24"
                />
              </div>

              <div className="form-group">
                <label>Utility On-Time Payments (months)</label>
                <input
                  type="number"
                  value={formData.utilityPaymentHistory}
                  onChange={(e) => setFormData({ ...formData, utilityPaymentHistory: parseInt(e.target.value) })}
                  placeholder="24"
                />
              </div>

              <div className="form-group">
                <label>Phone Bill On-Time Payments (months)</label>
                <input
                  type="number"
                  value={formData.phonePaymentHistory}
                  onChange={(e) => setFormData({ ...formData, phonePaymentHistory: parseInt(e.target.value) })}
                  placeholder="24"
                />
              </div>
            </div>

            <h3>Banking Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Bank Account Age (months)</label>
                <input
                  type="number"
                  value={formData.bankAccountAge}
                  onChange={(e) => setFormData({ ...formData, bankAccountAge: parseInt(e.target.value) })}
                  placeholder="36"
                />
              </div>

              <div className="form-group">
                <label>Average Balance ($)</label>
                <input
                  type="number"
                  value={formData.averageBalance}
                  onChange={(e) => setFormData({ ...formData, averageBalance: parseFloat(e.target.value) })}
                  placeholder="5000"
                />
              </div>

              <div className="form-group">
                <label>Overdraft Count (last 12 months)</label>
                <input
                  type="number"
                  value={formData.overdraftCount}
                  onChange={(e) => setFormData({ ...formData, overdraftCount: parseInt(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            <h3>Traditional Score (Optional)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Existing Credit Score (if any)</label>
                <input
                  type="number"
                  value={formData.traditionalScore}
                  onChange={(e) => setFormData({ ...formData, traditionalScore: parseInt(e.target.value) })}
                  placeholder="Leave blank if no credit history"
                  min={300}
                  max={850}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <div className="recommendation-section">
            <button onClick={calculateScore} className="btn-secondary" disabled={loading}>
              {loading ? 'Calculating...' : 'Calculate AI Credit Score'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'score' && scoreResult && (
        <div className="score-results">
          <div className="card score-card clickable" onClick={() => setActiveTab('profile')} title="Update profile">
            <div className="score-display">
              <div
                className="score-circle"
                style={{ borderColor: getScoreColor(scoreResult.score) }}
              >
                <span className="score-number">{scoreResult.score}</span>
                <span className="score-label">{getScoreLabel(scoreResult.score)}</span>
              </div>
              <div className="score-meta">
                <p>AI Credit Score</p>
                <span className="confidence">Confidence: {scoreResult.confidence}%</span>
              </div>
            </div>
          </div>

          <div className="card clickable" onClick={() => navigate('/risk-assessment')} title="View risk assessment">
            <h3>Risk Assessment</h3>
            <div className={`risk-indicator ${scoreResult.riskLevel?.toLowerCase()}`}>
              {scoreResult.riskLevel} Risk
            </div>
          </div>

          <div className="factors-grid">
            <div className="card factors-card positive clickable" onClick={() => navigate('/portfolio-dashboard')} title="View portfolio">
              <h3>Positive Factors</h3>
              <ul>
                {scoreResult.factors?.positive?.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>

            <div className="card factors-card negative clickable" onClick={() => setActiveTab('profile')} title="Improve profile">
              <h3>Areas for Improvement</h3>
              <ul>
                {scoreResult.factors?.negative?.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>

          {scoreResult.recommendations && (
            <div className="card">
              <h3>Recommendations</h3>
              <ul className="recommendations-list">
                {scoreResult.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {scoreResult.loanApprovalLikelihood && (
            <div className="card">
              <h3>Loan Approval Likelihood</h3>
              <div className="loan-grid">
                {Object.entries(scoreResult.loanApprovalLikelihood).map(([loan, likelihood]) => (
                  <div
                    key={loan}
                    className="loan-item clickable"
                    onClick={() => setSelectedLoan({ type: loan, likelihood, score: scoreResult.score })}
                  >
                    <span className="loan-type">{loan.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={`loan-likelihood ${likelihood.toLowerCase().replace(' ', '-')}`}>
                      {likelihood}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scoreResult.paymentStats && (
            <div className="card">
              <h3>Payment Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{scoreResult.paymentStats.totalPayments}</span>
                  <span className="stat-label">Total Payments</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{scoreResult.paymentStats.onTimePercentage}%</span>
                  <span className="stat-label">On-Time Rate</span>
                </div>
                <div className="stat-item positive">
                  <span className="stat-value">{scoreResult.paymentStats.onTime}</span>
                  <span className="stat-label">On-Time</span>
                </div>
                <div className="stat-item warning">
                  <span className="stat-value">{scoreResult.paymentStats.late}</span>
                  <span className="stat-label">Late</span>
                </div>
                <div className="stat-item negative">
                  <span className="stat-value">{scoreResult.paymentStats.missed}</span>
                  <span className="stat-label">Missed</span>
                </div>
              </div>
            </div>
          )}

          {scoreResult.reasoning && (
            <div className="card clickable" onClick={() => navigate('/robo-advisor')} title="Get investment advice">
              <h3>AI Analysis</h3>
              <p className="reasoning">{scoreResult.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Loan Detail Modal */}
      {selectedLoan && (
        <div className="modal-overlay" onClick={() => setSelectedLoan(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedLoan.type.replace(/([A-Z])/g, ' $1').trim()}</h2>
              <button className="close-btn" onClick={() => setSelectedLoan(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="label">Approval Likelihood:</span>
                <span className={`loan-likelihood large ${selectedLoan.likelihood.toLowerCase().replace(' ', '-')}`}>
                  {selectedLoan.likelihood}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Your Credit Score:</span>
                <span className="value">{selectedLoan.score}</span>
              </div>
              <div className="detail-row">
                <span className="label">Typical Requirement:</span>
                <span className="value">
                  {selectedLoan.type === 'personalLoan' ? '580+' :
                   selectedLoan.type === 'autoLoan' ? '620+' :
                   selectedLoan.type === 'mortgage' ? '680+' :
                   selectedLoan.type === 'creditCard' ? '650+' : '600+'}
                </span>
              </div>
              <div className="loan-tips">
                <h4>Tips to Improve Approval Chances</h4>
                <ul>
                  <li>Maintain consistent payment history</li>
                  <li>Keep credit utilization below 30%</li>
                  <li>Avoid opening new accounts before applying</li>
                  <li>Consider a co-signer if needed</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedLoan(null)}>Close</button>
              <button className="btn-primary" onClick={() => { setSelectedLoan(null); setActiveTab('profile'); }}>
                Improve Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreditScoring;
