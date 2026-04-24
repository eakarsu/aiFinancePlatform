import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, CheckCircle, ArrowRight, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getRiskQuestionnaire,
  saveRiskQuestionnaire,
  getFullRiskAssessment,
  getRiskQuestions,
  aiAnalyzeRisk,
  exportRiskAssessment,
  downloadExport
} from '../services/api';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';

function RiskAssessment() {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState({});
  const [questions, setQuestions] = useState({ sections: [] });
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiResultsRef = useRef(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [questionsRes, existingRes] = await Promise.all([
        getRiskQuestions(),
        getRiskQuestionnaire()
      ]);

      setQuestions(questionsRes.data);

      if (existingRes.data) {
        // Pre-fill answers if questionnaire exists
        const prefilled = {};
        Object.keys(existingRes.data).forEach(key => {
          if (existingRes.data[key] !== null) {
            prefilled[key] = existingRes.data[key];
          }
        });
        setAnswers(prefilled);

        // If completed, show results
        if (existingRes.data.riskScore) {
          try {
            const assessmentRes = await getFullRiskAssessment();
            setAssessment(assessmentRes.data);
            setShowResults(true);
          } catch (err) {
            // Assessment not ready
          }
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentSection < questions.sections.length - 1) {
      setCurrentSection(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const response = await saveRiskQuestionnaire(answers);

      // Get full assessment
      const assessmentRes = await getFullRiskAssessment();
      setAssessment(assessmentRes.data);
      setShowResults(true);
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setConfirmDialog({
      open: true,
      title: 'Retake Assessment',
      message: 'Are you sure you want to retake the risk assessment? Your current results will be replaced.',
      onConfirm: () => {
        setShowResults(false);
        setCurrentSection(0);
        setAssessment(null);
        setAiAnalysis(null);
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const handleAIAnalyze = async () => {
    setAiLoading(true);
    try {
      const response = await aiAnalyzeRisk();
      setAiAnalysis(response.data);
      // Auto-scroll to AI results after rendering
      setTimeout(() => {
        aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('AI analysis failed:', error);
      alert('Failed to generate AI analysis. Make sure the AI API key is configured.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = (format) => {
    downloadExport(exportRiskAssessment, format, 'risk-assessment');
  };

  const renderQuestion = (question) => {
    const value = answers[question.id];

    switch (question.type) {
      case 'number':
        return (
          <div className="question-input">
            {question.prefix && <span className="prefix">{question.prefix}</span>}
            <input
              type="number"
              value={value || ''}
              onChange={(e) => handleAnswer(question.id, parseFloat(e.target.value) || null)}
              min={question.min}
              max={question.max}
              placeholder="Enter value"
            />
          </div>
        );

      case 'select':
        return (
          <div className="question-options">
            {question.options.map(option => (
              <label
                key={option.value}
                className={`option-card ${value === option.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => handleAnswer(question.id, option.value)}
                />
                <span className="option-label">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'slider':
        return (
          <div className="question-slider">
            <div className="slider-labels">
              <span>{question.labels?.[question.min]}</span>
              <span>{question.labels?.[question.max]}</span>
            </div>
            <input
              type="range"
              min={question.min}
              max={question.max}
              value={value || question.min}
              onChange={(e) => handleAnswer(question.id, parseInt(e.target.value))}
            />
            <div className="slider-value">{value || question.min}</div>
          </div>
        );

      case 'boolean':
        return (
          <div className="question-boolean">
            <label className={`bool-option ${value === true ? 'selected' : ''}`}>
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => handleAnswer(question.id, true)}
              />
              Yes
            </label>
            <label className={`bool-option ${value === false ? 'selected' : ''}`}>
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => handleAnswer(question.id, false)}
              />
              No
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const isConditionMet = (question) => {
    if (!question.condition) return true;
    return answers[question.condition.field] === question.condition.value;
  };

  const getProgress = () => {
    const totalQuestions = questions.sections.reduce(
      (sum, section) => sum + section.questions.filter(q => isConditionMet(q)).length,
      0
    );
    const answeredQuestions = Object.keys(answers).filter(key => answers[key] !== null && answers[key] !== '').length;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };

  if (loading) {
    return (
      <div className="risk-assessment questionnaire">
        <div className="questionnaire-header">
          <h1>Risk Assessment Questionnaire</h1>
          <p>Help us understand your financial situation and risk tolerance to provide personalized recommendations.</p>
        </div>
        <LoadingSkeleton variant="detail-panel" count={1} />
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (showResults && assessment) {
    return (
      <div className="risk-assessment results">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1>Your Risk Assessment Results</h1>
          <ExportButton onExport={handleExport} />
        </div>

        {/* Risk Score Display */}
        <div className="score-display">
          <div className="score-circle">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="10"
              />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={
                  assessment.riskScore >= 70 ? '#4CAF50' :
                  assessment.riskScore >= 40 ? '#FF9800' : '#2196F3'
                }
                strokeWidth="10"
                strokeDasharray={`${assessment.riskScore * 2.83} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="score-text">
              <span className="score-number">{assessment.riskScore}</span>
              <span className="score-label">Risk Score</span>
            </div>
          </div>
        </div>

        {/* Risk Profile */}
        <div className="profile-card">
          <h2>{assessment.interpretation?.title}</h2>
          <p className="risk-level">{assessment.riskTolerance}</p>
          <p className="description">{assessment.interpretation?.description}</p>

          <div className="profile-details">
            <div className="detail">
              <h4>Suitable Investments</h4>
              <p>{assessment.interpretation?.suitable}</p>
            </div>
            <div className="detail">
              <h4>Things to Consider</h4>
              <p>{assessment.interpretation?.caution}</p>
            </div>
          </div>
        </div>

        {/* Insights */}
        {assessment.insights && assessment.insights.length > 0 && (
          <div className="insights-section">
            <h2>Personalized Insights</h2>
            <div className="insights-list">
              {assessment.insights.map((insight, index) => (
                <div key={index} className={`insight-card ${insight.type}`}>
                  <span className="insight-icon">
                    {insight.type === 'success' ? <CheckCircle size={18} /> :
                     insight.type === 'warning' ? <AlertTriangle size={18} /> :
                     insight.type === 'caution' ? <AlertTriangle size={18} /> : <Info size={18} />}
                  </span>
                  <div className="insight-content">
                    <h4>{insight.title}</h4>
                    <p>{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Recommendation Preview */}
        {assessment.portfolioRecommendation && (
          <div className="portfolio-preview">
            <h2>Recommended Portfolio</h2>
            <div className="portfolio-type">
              <span className="type-badge">{assessment.portfolioRecommendation.portfolioType}</span>
              <p>{assessment.portfolioRecommendation.description}</p>
            </div>

            <div className="allocation-preview">
              {assessment.portfolioRecommendation.allocation?.map((item, index) => (
                <div key={index} className="allocation-bar-item">
                  <div className="bar-label">
                    <span>{item.asset}</span>
                    <span>{item.percentage}%</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: `hsl(${index * 60}, 70%, 50%)`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="expected-return">
              <span>Expected Annual Return: </span>
              <strong>
                {assessment.portfolioRecommendation.expectedReturn?.low}% -
                {assessment.portfolioRecommendation.expectedReturn?.high}%
              </strong>
            </div>

              </div>
        )}

        {/* AI Analysis Button */}
        {!aiAnalysis && (
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <button
              className="btn-primary"
              onClick={handleAIAnalyze}
              disabled={aiLoading}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            >
              {aiLoading ? 'Analyzing with AI...' : 'Get AI-Powered Analysis'}
            </button>
            {aiLoading && (
              <p style={{ color: '#666', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                AI is analyzing your risk profile. This may take a few seconds...
              </p>
            )}
          </div>
        )}

        {/* AI Analysis Results */}
        {aiAnalysis && (
          <div ref={aiResultsRef} className="portfolio-analysis-card">
            <div className="portfolio-header">
              <h3>AI-Powered Risk Analysis</h3>
              <button className="btn-close" onClick={() => setAiAnalysis(null)}>×</button>
            </div>

            {/* AI Interpretation */}
            {aiAnalysis.interpretation && (
              <div className="portfolio-insights">
                <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>{aiAnalysis.interpretation.title}</h4>
                <p>{aiAnalysis.interpretation.description}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <h5 style={{ color: '#4CAF50', marginBottom: '0.25rem' }}>Suitable Investments</h5>
                    <p style={{ fontSize: '0.9rem', color: '#555' }}>{aiAnalysis.interpretation.suitable}</p>
                  </div>
                  <div>
                    <h5 style={{ color: '#FF9800', marginBottom: '0.25rem' }}>Things to Consider</h5>
                    <p style={{ fontSize: '0.9rem', color: '#555' }}>{aiAnalysis.interpretation.caution}</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Insights */}
            {aiAnalysis.insights?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>AI Insights</h4>
                {aiAnalysis.insights.map((insight, i) => (
                  <div key={i} className={`insight-card ${insight.type}`} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px', background: '#f5f7fa' }}>
                    <span>
                      {insight.type === 'success' ? <CheckCircle size={18} /> :
                       insight.type === 'warning' ? <AlertTriangle size={18} /> :
                       insight.type === 'caution' ? <AlertTriangle size={18} /> : <Info size={18} />}
                    </span>
                    <div>
                      <h5 style={{ marginBottom: '0.25rem' }}>{insight.title}</h5>
                      <p style={{ fontSize: '0.85rem', color: '#555' }}>{insight.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Portfolio Tips */}
            {aiAnalysis.portfolioTips && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f7fa', borderRadius: '8px' }}>
                <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Portfolio Tips</h4>
                <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.6' }}>{aiAnalysis.portfolioTips}</p>
              </div>
            )}

            {/* AI Action Plan */}
            {aiAnalysis.actionPlan?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Personalized Action Plan</h4>
                {aiAnalysis.actionPlan.map((item, i) => (
                  <div key={i} className={`recommendation-item ${item.priority}`}>
                    <h5>{item.action}</h5>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="powered-by">Powered by OpenRouter AI</p>
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <button className="btn-secondary" onClick={handleRetake}>
            Retake Assessment
          </button>
          <button className="btn-primary" onClick={() => navigate('/portfolio-dashboard')}>
            View Portfolio Dashboard
          </button>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Retake"
          variant="warning"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
        />
      </div>
    );
  }

  const currentSectionData = questions.sections[currentSection];

  return (
    <div className="risk-assessment questionnaire">
      <div className="questionnaire-header">
        <h1>Risk Assessment Questionnaire</h1>
        <p>Help us understand your financial situation and risk tolerance to provide personalized recommendations.</p>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${getProgress()}%` }} />
        </div>
        <span className="progress-text">{getProgress()}% complete</span>
      </div>

      {/* Section Navigation */}
      <div className="section-nav">
        {questions.sections.map((section, index) => (
          <button
            key={section.id}
            className={`section-tab ${index === currentSection ? 'active' : ''} ${index < currentSection ? 'completed' : ''}`}
            onClick={() => setCurrentSection(index)}
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Questions */}
      {currentSectionData && (
        <div className="section-content">
          <h2>{currentSectionData.title}</h2>

          <div className="questions-list">
            {currentSectionData.questions.map((question) => {
              if (!isConditionMet(question)) return null;

              return (
                <div key={question.id} className="question-card">
                  <label className="question-label">
                    {question.label}
                    {question.required && <span className="required">*</span>}
                  </label>
                  {renderQuestion(question)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="questionnaire-nav">
        <button
          className="btn-secondary"
          onClick={handlePrev}
          disabled={currentSection === 0}
        >
          Previous
        </button>

        {currentSection < questions.sections.length - 1 ? (
          <button className="btn-primary" onClick={handleNext}>
            Next
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Calculating...' : 'Get Results'}
          </button>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Retake"
        variant="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
}

export default RiskAssessment;
