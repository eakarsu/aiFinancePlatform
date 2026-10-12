import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BudgetCoach from './pages/BudgetCoach';
import { getBudgetPlans, getExpenses, getExpenseSummary } from './services/api';
import { listPayload } from './services/listPayload';

jest.mock('./services/api', () => ({
  getBudgetPlans: jest.fn(), getExpenses: jest.fn(), getExpenseSummary: jest.fn()
}));

test('record list accepts paginated data and renders twenty real fixture cards on both tabs', async () => {
  const plans = Array.from({ length: 20 }, (_, i) => ({
    id: `plan-${i}`, name: `Budget ${i + 1}`, totalIncome: 4000,
    totalBudget: 3000, period: 'monthly', categories: []
  }));
  const expenses = Array.from({ length: 20 }, (_, i) => ({
    id: `expense-${i}`, category: 'Food', amount: 20 + i,
    description: `Expense ${i + 1}`, date: '2026-10-01'
  }));
  getBudgetPlans.mockResolvedValue({ data: { data: plans, total: 20, offset: 0, limit: 20 } });
  getExpenses.mockResolvedValue({ data: { data: expenses, pagination: { total: 20 } } });
  getExpenseSummary.mockResolvedValue({ data: {} });
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { container } = render(<BudgetCoach />);
    await waitFor(() => expect(container.querySelectorAll('.data-card')).toHaveLength(20));
    fireEvent.click(screen.getByRole('button', { name: 'Expenses' }));
    expect(container.querySelectorAll('.expense-card')).toHaveLength(20);
    expect(error).not.toHaveBeenCalled();
  } finally { error.mockRestore(); }
});

test('list payload guards malformed responses and honors pagination total', () => {
  expect(listPayload({ data: { error: 'unavailable' } })).toEqual({ data: [], total: 0 });
  expect(listPayload({ data: [{ id: 1 }], pagination: { total: 18 } })).toEqual({ data: [{ id: 1 }], total: 18 });
});
