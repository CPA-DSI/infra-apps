import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('./services/api', () => ({
  apiClient: { post: vi.fn() },
  login: vi.fn(),
  getCurrentUserProfile: vi.fn().mockRejectedValue(new Error('no session')),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({}) },
}));

vi.mock('sweetalert2-react-content', () => ({ default: (Swal) => Swal }));

vi.mock('react-parallax-tilt', () => ({ default: ({ children }) => <div>{children}</div> }));

test('redirige vers /login quand aucun utilisateur n\'est authentifié', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });
});
