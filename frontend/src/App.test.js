import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/api', () => ({
  getMe: jest.fn(),
}));

test('unauthenticated visitors reach the sign-in screen without exposing embedded credential values', async () => {
  localStorage.clear();
  render(<App />);
  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toHaveValue('');
  expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
  expect(screen.queryByText(/quick demo login/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Auto Fill Demo Credentials' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
});
