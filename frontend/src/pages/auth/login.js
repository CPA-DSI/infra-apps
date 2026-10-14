import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';

import AuthLogo from '../../components/AuthLogo/AuthLogo';

// --- IMPORTS CSS ---
import './auth-base.css';
import './login.css';
import { swalButtons } from '../../utils/swal';

const Login = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [focusedField, setFocusedField] = useState(null);

  const validateField = useCallback((name, value) => {
    let error = '';
    switch (name) {
      case 'email':
        if (!value.trim()) {
          error = "L'email est requis";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Veuillez entrer un email valide';
        }
        break;
      case 'password':
        if (!value) {
          error = 'Le mot de passe est requis';
        } else if (value.length < 7) {
          error = 'Le mot de passe doit contenir au moins 7 caractères';
        }
        break;
      default:
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
    return error === '';
  }, []);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (errors.email) validateField('email', value);
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (errors.password) validateField('password', value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);

    if (!emailValid || !passwordValid) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur de validation',
        text: 'Veuillez remplir correctement tous les champs',
        ...swalButtons('primary'),
      });
      return;
    }

    setIsLoading(true);

    try {
      const data = await Promise.race([
        login(email, password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Le serveur met trop de temps à répondre.')), 10000)),
      ]);

      const authData = await checkAuth();

      const mustChangePwd = Boolean(authData?.must_change_password) || Boolean(data?.user?.must_change_password);

      Swal.fire({
        icon: 'success',
        title: 'Connexion réussie !',
        text: 'Bienvenue sur la plateforme InvTech IT',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        if (mustChangePwd) {
          navigate('/change-password', { state: { mustChangePassword: mustChangePwd } });
        } else {
          navigate('/Home');
        }
      });
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Email ou mot de passe incorrect';
      Swal.fire({
        icon: 'error',
        title: 'Erreur de connexion',
        text: errorMessage,
        ...swalButtons('primary'),
      });
      setEmail('');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const wrapInputClasses = (fieldName) => {
    const base = 'wrap-input validate-input';
    const isFocused = focusedField === fieldName;
    const hasValue = fieldName === 'email' ? email.trim() !== '' : password !== '';
    const hasError = errors[fieldName];

    return [base, isFocused && 'focus', hasValue && 'has-val', hasError && 'input-error']
      .filter(Boolean)
      .join(' ');
  };

  return (
    <main className="login-container">
      <div className="wrap-login">
        <Tilt tiltMaxAngleX={15} tiltMaxAngleY={15} scale={1.05} transitionSpeed={400}>
          <div className="login-pic">
            <AuthLogo />
          </div>
          <div className="brand-text-wrapper login-brand-text-wrapper">
            <span className="brand-text login-brand-text">
              InvTech <span className="text-accent">IT</span>
            </span>
          </div>
        </Tilt>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <span className="login-title">Connexion Membre</span>

          <div className={wrapInputClasses('email')}>
            <input
              className={`input-field ${errors.email ? 'input-error' : ''}`}
              type="text"
              name="email"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              autoComplete="email"
              disabled={isLoading}
            />
            <span className="focus-input100 focus-input" aria-hidden="true" />
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaEnvelope aria-hidden="true" />
            </span>
            {errors.email && (
              <span className="error-text" id="email-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className={wrapInputClasses('password')}>
            <input
              className={`input-field ${errors.password ? 'input-error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Mot de passe"
              value={password}
              onChange={handlePasswordChange}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <span className="focus-input100 focus-input" aria-hidden="true" />
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaLock aria-hidden="true" />
            </span>
            <span
              className="eye-icon"
              onClick={() => setShowPassword((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowPassword((prev) => !prev);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
            >
              {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
            </span>
            {errors.password && (
              <span className="error-text" id="password-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <div className="checkbox-container">
            <input
              className="checkbox-input"
              id="ckb1"
              type="checkbox"
              name="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
            <label className="checkbox-custom" htmlFor="ckb1">
              <span className="checkbox-checkmark" />
              Se souvenir de moi
            </label>
            <Link to="/forgot-password" className="forgot-password-link">
              Mot de passe oublié ?
            </Link>
          </div>

          <div className="login-button-wrap">
            <button
              className={`login-button ${isLoading ? 'loading' : ''}`}
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <FaSpinner className="fa-spinner icon-spin" aria-hidden="true" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default Login;
