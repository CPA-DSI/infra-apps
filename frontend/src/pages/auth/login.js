import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';

// --- IMPORTS CSS ---
import '../../assets/vendor/animate/animate.css';
import '../../assets/vendor/css-hamburgers/hamburgers.min.css';
import '../../assets/vendor/select2/select2.min.css';
import '../../assets/vendor/bootstrap/css/bootstrap.min.css';
import '../../assets/css/util.css';
import '../../assets/css/main.css';
import './login.css';

const SVGIllustration = () => (
  <svg
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '200px', height: '200px' }}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <g>
      <rect x="20" y="20" width="160" height="110" rx="8" ry="8" fill="#333" />
      <rect x="28" y="28" width="144" height="94" rx="4" ry="4" fill="url(#screenGrad)" />
      <text x="35" y="50" fill="#fff" fontFamily="monospace" fontSize="14">SUPPORT IT</text>
      <text x="35" y="65" fill="#fff" fontFamily="monospace" fontSize="10">Help Desk</text>
      <text x="35" y="80" fill="#fff" fontFamily="monospace" fontSize="10">Tickets</text>
      <text x="35" y="95" fill="#fff" fontFamily="monospace" fontSize="10">data</text>
      <rect x="70" y="130" width="60" height="25" fill="#444" />
      <rect x="50" y="155" width="100" height="8" rx="4" ry="4" fill="#333" />
      <rect x="40" y="170" width="120" height="15" rx="3" ry="3" fill="#444" />
      <line x1="50" y1="175" x2="150" y2="175" stroke="#555" strokeWidth="2" />
      <ellipse cx="160" cy="172" rx="8" ry="12" fill="#444" />
    </g>
  </svg>
);

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
        confirmButtonColor: '#3085d6',
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
        confirmButtonColor: '#3085d6',
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
            <SVGIllustration />
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

          <div style={{ width: '100%' }}>
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
