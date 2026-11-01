import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the login form', () => {
  render(<App config={{ apiBaseUrl: 'https://example.com/api', pollIntervalMs: 200 }} />);
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
});
