import React, { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { forceChangePassword } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { FaLock, FaEye, FaEyeSlash, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

import '../../assets/vendor/animate/animate.css';
import '../../assets/vendor/css-hamburgers/hamburgers.min.css';
import '../../assets/vendor/select2/select2.min.css';
import '../../assets/vendor/bootstrap/css/bootstrap.min.css';
import '../../assets/css/util.css';
import '../../assets/css/main.css';

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

const FirstLoginPasswordChange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mustChangePassword, setMustChangePassword, checkAuth, user, isLoading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({ newPassword: '', confirmPassword: '' });
  const [focusedField, setFocusedField] = useState(null);

  const validateField = (name, value, currentNewPassword = newPassword) => {
    let error = '';
    switch (name) {
      case 'newPassword':
        if (!value) {
          error = 'Le nouveau mot de passe est requis';
        } else if (value.length < 7) {
          error = 'Le mot de passe doit contenir au moins 7 caractères';
        } else if (!/[A-Z]/.test(value)) {
          error = 'Le mot de passe doit contenir au moins une majuscule';
        } else if (!/[a-z]/.test(value)) {
          error = 'Le mot de passe doit contenir au moins une minuscule';
        } else if (!/[0-9]/.test(value)) {
          error = 'Le mot de passe doit contenir au moins un chiffre';
        } else if (!/[^A-Za-z0-9]/.test(value)) {
          error = 'Le mot de passe doit contenir au moins un caractère spécial';
        }
        break;
      case 'confirmPassword':
        if (!value) {
          error = 'La confirmation du mot de passe est requise';
        } else if (value !== currentNewPassword) {
          error = 'Les mots de passe ne correspondent pas';
        }
        break;
      default:
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
    return error === '';
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    validateField('newPassword', value);
    if (confirmPassword) {
      validateField('confirmPassword', confirmPassword, value);
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    validateField('confirmPassword', value);
  };

  const username = user?.username || user?.name || user?.email || '';

  const ruleResults = [
    {
      id: 'length',
      label: 'La longueur minimale doit être d\'au moins 7 caractères',
      passed: newPassword.length >= 7,
    },
    {
      id: 'uppercase',
      label: 'Doit contenir au moins 1 caractère(s) majuscule(s)',
      passed: /[A-Z]/.test(newPassword),
    },
    {
      id: 'lowercase',
      label: 'Doit contenir au moins 1 caractère(s) minuscule(s)',
      passed: /[a-z]/.test(newPassword),
    },
    {
      id: 'number',
      label: 'Nombre de chiffres à inclure 1',
      passed: /[0-9]/.test(newPassword),
    },
    {
      id: 'special',
      label: 'Nombre de caractères spéciaux à inclure 1',
      passed: /[^A-Za-z0-9]/.test(newPassword),
    },
    {
      id: 'noTripleRepeat',
      label: 'Ne doit contenir aucun caractère plus de 3 fois de manière consécutive',
      passed: !newPassword || !/(.)\1{3,}/.test(newPassword),
    },
    {
      id: 'notPalindrome',
      label: 'Ne doit pas être un palindrome',
      passed: !newPassword || (() => {
        const normalized = newPassword.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized.length < 2 || normalized !== normalized.split('').reverse().join('');
      })(),
    },
    {
      id: 'noUsernameSequence',
      label: 'Ne doit pas avoir 5 caractère(s) consécutif(s) du nom d\'utilisateur',
      passed: !newPassword || !username || username.length < 5 || (() => {
        const lowerPw = newPassword.toLowerCase();
        const lowerUser = username.toLowerCase();
        for (let i = 0; i <= lowerUser.length - 5; i++) {
          if (lowerPw.includes(lowerUser.substring(i, i + 5))) {
            return false;
          }
        }
        return true;
      })(),
    },
    {
      id: 'noRestrictedPatterns',
      label: 'Ne doit pas contenir de modèles restreints',
      passed: !newPassword || (() => {
        const restricted = ['password', '123456', 'azerty', 'qwerty', 'letmein', 'welcome'];
        return !restricted.some(pattern => newPassword.toLowerCase().includes(pattern));
      })(),
    },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    const newPasswordValid = validateField('newPassword', newPassword);
    const confirmPasswordValid = validateField('confirmPassword', confirmPassword);

    if (!newPasswordValid || !confirmPasswordValid) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur de validation',
        text: 'Veuillez remplir correctement tous les champs',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await forceChangePassword(newPassword, confirmPassword);

      setMustChangePassword(false);

      await checkAuth();

      Swal.fire({
        icon: 'success',
        title: 'Mot de passe modifié !',
        text: 'Votre mot de passe a été mis à jour avec succès.',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        navigate('/Home');
      });
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Une erreur est survenue';
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: errorMessage,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const wrapInputClasses = (fieldName) => {
    const base = 'wrap-input validate-input';
    const isFocused = focusedField === fieldName;
    const hasValue = fieldName === 'newPassword' ? newPassword !== '' : confirmPassword !== '';
    const hasError = errors[fieldName];

    return [base, isFocused && 'focus', hasValue && 'has-val', hasError && 'input-error']
      .filter(Boolean)
      .join(' ');
  };

  if (authLoading) {
    return <div className="login-container"><div className="wrap-login"><div>Chargement...</div></div></div>;
  }

  const mustChangePwd = location.state?.mustChangePassword || mustChangePassword;

  if (!mustChangePwd) {
    return <Navigate to="/Home" replace />;
  }

  return (
    <main className="login-container">
      <div className="wrap-login first-login-wrap">
        

        <div className="password-rules-panel" aria-label="Exigences du mot de passe">
          <span className="password-rules-title">Exigences du mot de passe</span>
          <div>
            {ruleResults.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '6px',
                  fontSize: '13px',
                  color: rule.passed ? '#2e7d32' : '#e53935',
                }}
              >
                {rule.passed ? (
                  <FaCheckCircle style={{ marginRight: '8px', fontSize: '14px' }} />
                ) : (
                  <FaTimesCircle style={{ marginRight: '8px', fontSize: '14px' }} />
                )}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <span className="login-title">Première connexion</span>
          <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
            Veuillez modifier votre mot de passe par défaut pour continuer.
          </p>

          <div className={wrapInputClasses('newPassword')}>
            <input
              className={`input-field ${errors.newPassword ? 'input-error' : ''}`}
              type={showNewPassword ? 'text' : 'password'}
              name="newPassword"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={handleNewPasswordChange}
              onFocus={() => setFocusedField('newPassword')}
              onBlur={() => setFocusedField(null)}
              aria-invalid={errors.newPassword ? 'true' : 'false'}
              aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <span className="focus-input100 focus-input" aria-hidden="true" />
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaLock aria-hidden="true" />
            </span>
            <span
              className="eye-icon"
              onClick={() => setShowNewPassword((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowNewPassword((prev) => !prev);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showNewPassword}
            >
              {showNewPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
            </span>
          </div>

          <div className={wrapInputClasses('confirmPassword')}>
            <input
              className={`input-field ${errors.confirmPassword ? 'input-error' : ''}`}
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField(null)}
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <span className="focus-input100 focus-input" aria-hidden="true" />
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaLock aria-hidden="true" />
            </span>
            <span
              className="eye-icon"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowConfirmPassword((prev) => !prev);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
            </span>
            {errors.confirmPassword && (
              <span className="error-text" id="confirmPassword-error" role="alert">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <div style={{ width: '100%' }}>
            <button
              className={`login-button ${isSubmitting ? 'loading' : ''}`}
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="fa-spinner icon-spin" aria-hidden="true" />
                  <span>Mise à jour en cours...</span>
                </>
              ) : (
                'Modifier mon mot de passe'
              )}
            </button>
          </div>
        </form>
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
      </div>
    </main>
  );
};

export default FirstLoginPasswordChange;
