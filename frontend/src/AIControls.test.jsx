import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockRecommend from './pages/StockRecommend';
import LoanAdvisor from './pages/LoanAdvisor';
import FormattedAIReport from './components/FormattedAIReport';
import { aiStockRecommend, getLoans, login as apiLogin } from './services/api';

jest.mock('./services/api', () => ({ aiStockRecommend: jest.fn(), getLoans: jest.fn(), login: jest.fn() }));
jest.mock('./context/AuthContext', () => ({ useAuth: () => ({ login: jest.fn() }) }));

test('each stock scenario fills every editable field without generating', () => {
  render(<StockRecommend />);
  fireEvent.click(screen.getByRole('button', { name: 'Balanced income' }));
  expect(screen.getByRole('combobox')).toHaveValue('moderate');
  expect(screen.getByDisplayValue('Healthcare, Utilities')).toBeInTheDocument();
  expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  expect(screen.getByDisplayValue('25000')).toBeInTheDocument();
  expect(aiStockRecommend).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Long horizon growth' }));
  expect(screen.getByRole('combobox')).toHaveValue('aggressive');
  expect(screen.getByDisplayValue('Technology, Industrials')).toBeInTheDocument();
  expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  expect(screen.getByDisplayValue('50000')).toBeInTheDocument();
  expect(aiStockRecommend).not.toHaveBeenCalled();
});

test('structured AI output keeps nested facts, lists, false, zero and empty string', () => {
  render(<FormattedAIReport response={{ result: { approved: false, fee: 0, note: '', details: { riskLevel: 'low' }, options: [{ ticker: 'VTI', weight: 60 }] } }} />);
  expect(screen.getByText('Approved')).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getByText('Empty string')).toBeInTheDocument();
  expect(screen.getByText('Risk Level')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Ticker' })).toBeInTheDocument();
  expect(screen.getByText('VTI')).toBeInTheDocument();
});

test('demo button fills configured values without submitting login', () => {
  const oldEmail = process.env.REACT_APP_DEMO_EMAIL;
  const oldPassword = process.env.REACT_APP_DEMO_PASSWORD;
  process.env.REACT_APP_DEMO_EMAIL = 'sample@example.test';
  process.env.REACT_APP_DEMO_PASSWORD = 'test-only-placeholder';
  try {
    const { default: Login } = require('./pages/Login');
    const { MemoryRouter } = require('react-router-dom');
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Fill demo credentials' }));
    expect(screen.getByLabelText(/email address/i)).toHaveValue('sample@example.test');
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('test-only-placeholder');
    expect(apiLogin).not.toHaveBeenCalled();
  } finally {
    if (oldEmail === undefined) delete process.env.REACT_APP_DEMO_EMAIL;
    else process.env.REACT_APP_DEMO_EMAIL = oldEmail;
    if (oldPassword === undefined) delete process.env.REACT_APP_DEMO_PASSWORD;
    else process.env.REACT_APP_DEMO_PASSWORD = oldPassword;
  }
});


test('saved loan detail renders complete structured AI analysis without generation', async () => {
  getLoans.mockResolvedValue({ data: { data: [{
    id: 41, loanType: 'personal', status: 'review', loanAmount: 12000, loanTerm: 36,
    analysis: { approved: false, recommendedRate: 0, note: '', riskFactors: ['Variable income'] }
  }], total: 1 } });
  render(<LoanAdvisor />);
  await waitFor(() => expect(screen.getByText('Your Loan Applications (1)')).toBeInTheDocument());
  fireEvent.click(screen.getByText('PERSONAL'));
  expect(screen.getByText('Complete AI analysis')).toBeInTheDocument();
  expect(screen.getByText('Approved')).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
  expect(screen.getByText('Empty string')).toBeInTheDocument();
  expect(screen.getByText('Variable income')).toBeInTheDocument();
  expect(aiStockRecommend).not.toHaveBeenCalled();
});
