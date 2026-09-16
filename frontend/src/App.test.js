import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./services/api', () => ({
  apiClient: { post: jest.fn() },
  login: jest.fn(),
  getCurrentUserProfile: jest.fn().mockRejectedValue(new Error('no session')),
}));

jest.mock('sweetalert2', () => ({
  fire: jest.fn().mockResolvedValue({}),
}));

jest.mock('sweetalert2-react-content', () => (Swal) => Swal);

jest.mock('react-parallax-tilt', () => ({ children }) => <div>{children}</div>);

test('redirige vers /login quand aucun utilisateur n\'est authentifié', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });
});
