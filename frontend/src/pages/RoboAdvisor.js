import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as api from '../services/api';

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];

function RoboAdvisor() {
  const navigate = useNavigate();
  const [riskProfile, setRiskProfile] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedAllocation, setSelectedAllocation] = useState(null);

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

  const loadRiskProfile = async () => {
    try {
      const response = await api.getRiskProfile();
      if (response.data) {
        setRiskProfile(response.data);
        setFormData({
          riskTolerance: response.data.riskTolerance || 'MODERATE',
          investmentGoal: response.data.investmentGoal || 'growth',
          timeHorizon: response.data.timeHorizon || 10,
          monthlyIncome: response.data.monthlyIncome || '',
          monthlyExpenses: response.data.monthlyExpenses || '',
          emergencyFund: response.data.emergencyFund || ''
        });
      }
    } catch (error) {
      console.error('Failed to load risk profile:', error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.saveRiskProfile(formData);
      setRiskProfile(response.data);
      alert('Risk profile saved!');
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendation = async () => {
    if (!riskProfile) {
      alert('Please save your risk profile first');
      return;
    }
    setLoading(true);
    try {
      const response = await api.getPortfolioRecommendation(investmentAmount);
      setRecommendation(response.data);
      setActiveTab('recommendation');
    } catch (error) {
      alert('Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  };

  const chartData = recommendation?.recommendation?.allocation?.map((item) => ({
    name: item.asset,
    value: item.percentage
  })) || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Robo-Advisor</h1>
        <p>AI-powered investment recommendations personalized for you</p>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          Risk Profile
        </button>
        <button
          className={activeTab === 'recommendation' ? 'active' : ''}
          onClick={() => setActiveTab('recommendation')}
        >
          Portfolio Recommendation
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="card">
          <h2>Your Risk Profile</h2>
          <form onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="form-group">
                <label>Risk Tolerance</label>
                <select
                  value={formData.riskTolerance}
                  onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value })}
                >
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                </select>
              </div>

              <div className="form-group">
                <label>Investment Goal</label>
                <select
                  value={formData.investmentGoal}
                  onChange={(e) => setFormData({ ...formData, investmentGoal: e.target.value })}
                >
                  <option value="retirement">Retirement</option>
                  <option value="growth">Wealth Growth</option>
                  <option value="income">Passive Income</option>
                  <option value="preservation">Capital Preservation</option>
                </select>
              </div>

              <div className="form-group">
                <label>Time Horizon (years)</label>
                <input
                  type="number"
                  value={formData.timeHorizon}
                  onChange={(e) => setFormData({ ...formData, timeHorizon: parseInt(e.target.value) })}
                  min={1}
                  max={50}
                />
              </div>

              <div className="form-group">
                <label>Monthly Income ($)</label>
                <input
                  type="number"
                  value={formData.monthlyIncome}
                  onChange={(e) => setFormData({ ...formData, monthlyIncome: parseFloat(e.target.value) })}
                  placeholder="5000"
                />
              </div>

              <div className="form-group">
                <label>Monthly Expenses ($)</label>
                <input
                  type="number"
                  value={formData.monthlyExpenses}
                  onChange={(e) => setFormData({ ...formData, monthlyExpenses: parseFloat(e.target.value) })}
                  placeholder="3000"
                />
              </div>

              <div className="form-group">
                <label>Emergency Fund ($)</label>
                <input
                  type="number"
                  value={formData.emergencyFund}
                  onChange={(e) => setFormData({ ...formData, emergencyFund: parseFloat(e.target.value) })}
                  placeholder="10000"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <div className="recommendation-section">
            <h3>Get AI Recommendation</h3>
            <div className="form-group">
              <label>Investment Amount ($)</label>
              <input
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(parseFloat(e.target.value))}
                placeholder="10000"
              />
            </div>
            <button onClick={getRecommendation} className="btn-secondary" disabled={loading}>
              {loading ? 'Analyzing...' : 'Get AI Portfolio Recommendation'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'recommendation' && recommendation && (
        <div className="recommendation-results">
          <div className="card clickable" onClick={() => navigate('/portfolio-dashboard')} title="View portfolio dashboard">
            <h2>{recommendation.recommendation?.portfolioType} Portfolio</h2>
            <div className="recommendation-grid" onClick={(e) => e.stopPropagation()}>
              <div className="chart-section">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
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
                  <div
                    key={index}
                    className="allocation-item clickable-row"
                    onClick={() => setSelectedAllocation({ ...item, color: COLORS[index % COLORS.length] })}
                  >
                    <div className="allocation-header">
                      <span className="allocation-asset">{item.asset}</span>
                      <span className="allocation-percentage">{item.percentage}%</span>
                    </div>
                    {item.etf && (
                      <div className="allocation-etf">
                        <strong>{item.etf}</strong> - {item.etfName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card clickable" onClick={() => navigate('/risk-assessment')} title="Update risk assessment">
            <h3>Investment Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Investment Amount</label>
                <span>${recommendation.investmentAmount?.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <label>Expected Return</label>
                <span>
                  {recommendation.recommendation?.expectedReturn?.low}% - {recommendation.recommendation?.expectedReturn?.high}% annually
                </span>
              </div>
              <div className="summary-item">
                <label>Risk Level</label>
                <span className={`risk-badge ${recommendation.recommendation?.riskLevel?.toLowerCase()}`}>
                  {recommendation.recommendation?.riskLevel}
                </span>
              </div>
              <div className="summary-item">
                <label>Rebalance Frequency</label>
                <span>{recommendation.recommendation?.rebalanceFrequency}</span>
              </div>
            </div>
          </div>

          <div className="card clickable" onClick={() => navigate('/credit-scoring')} title="View credit scoring">
            <h3>AI Analysis</h3>
            <p className="reasoning">{recommendation.recommendation?.reasoning}</p>
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
                <span className="amount">${((recommendation.investmentAmount || 10000) * selectedAllocation.percentage / 100).toLocaleString()}</span>
              </div>
              {selectedAllocation.etf && (
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
              )}
              <div className="allocation-info-section">
                <p>This allocation represents {selectedAllocation.percentage}% of your recommended portfolio.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedAllocation(null)}>Close</button>
              <button className="btn-primary" onClick={() => navigate('/portfolio-dashboard')}>
                View Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoboAdvisor;
