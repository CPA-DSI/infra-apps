import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './login';
import { AuthProvider } from '../../contexts/AuthContext';

vi.mock('../../services/api', () => ({
  apiClient: { post: vi.fn() },
  login: vi.fn(),
  getCurrentUserProfile: vi.fn().mockRejectedValue(new Error('no session')),
}));

vi.mock('sweetalert2', () => {
  // Classe (et non objet simple) : AuthContext.js utilise withReactContent(Swal),
  // qui fait `class extends Swal`, et a donc besoin d'un vrai constructeur ici.
  class MockSwal {
    static fire = vi.fn().mockResolvedValue({});
    static close = vi.fn();
  }
  return { default: MockSwal };
});

vi.mock('react-parallax-tilt', () => ({ default: ({ children }) => <div>{children}</div> }));

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );

describe('Login - validation cote client', () => {
  test('affiche une erreur si l\'email est invalide', () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'pas-un-email' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'motdepasse123' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByText(/email valide/i)).toBeInTheDocument();
  });

  test('affiche une erreur si le mot de passe fait moins de 7 caracteres', () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'abc12' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByText(/au moins 7 caractères/i)).toBeInTheDocument();
  });

  test('bascule l\'affichage du mot de passe au clic sur l\'icone oeil', () => {
    renderLogin();

    const passwordInput = screen.getByPlaceholderText('Mot de passe');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /afficher le mot de passe/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /masquer le mot de passe/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
