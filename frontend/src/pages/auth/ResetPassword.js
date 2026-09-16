import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../config/api';
import { FaLock, FaEye, FaEyeSlash, FaSpinner, FaLongArrowAltLeft } from 'react-icons/fa';

// --- IMPORTS CSS ---
import '../../assets/vendor/animate/animate.css';
import '../../assets/vendor/css-hamburgers/hamburgers.min.css';
import '../../assets/vendor/select2/select2.min.css';
import '../../assets/vendor/bootstrap/css/bootstrap.min.css';
import '../../assets/css/util.css';
import '../../assets/css/main.css';
import './login.css';

// SVG Icon
const LockIcon = () => (
  <svg 
    viewBox="0 0 200 200" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '180px', height: '180px' }}
  >
    <defs>
      <linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#667eea', stopOpacity: 1}} />
        <stop offset="100%" style={{stopColor: '#764ba2', stopOpacity: 1}} />
      </linearGradient>
    </defs>
    <g>
      {/* Corps du cadenas */}
      <rect x="50" y="80" width="100" height="80" rx="10" fill="url(#lockGrad)" />
      {/* Anneau du cadenas */}
      <path d="M65 80 V55 A35 35 0 0 1 135 55 V80" fill="none" stroke="url(#lockGrad)" strokeWidth="14" strokeLinecap="round" />
      {/* Trou de serrure */}
      <circle cx="100" cy="120" r="15" fill="#fff" />
      <rect x="92" y="120" width="16" height="25" fill="#fff" />
    </g>
  </svg>
);

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(null);

  useEffect(() => {
    // Vérifier si le token est présent
    if (!token) {
      setIsValidToken(false);
      Swal.fire({
        icon: 'error',
        title: 'Lien invalide',
        text: 'Lien de réinitialisation invalide. Veuillez demander un nouveau lien.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
    } else {
      setIsValidToken(true);
    }
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!password) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Le mot de passe est requis',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    if (password.length < 7) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Le mot de passe doit contenir au moins 7 caractères',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Les mots de passe ne correspondent pas',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Mot de passe réinitialisé !',
          text: 'Votre mot de passe a été réinitialisé avec succès.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#667eea'
        }).then(() => {
          navigate('/login');
        });
        setPassword('');
        setConfirmPassword('');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: data.message || 'Une erreur est survenue. Veuillez réessayer.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#667eea'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Impossible de连接到服务器. Veuillez réessayer plus tard.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputFocus = (e) => {
    e.target.closest('.wrap-input').classList.add('focus', 'has-val');
  };
  
  const handleInputBlur = (e) => {
    const wrapInput = e.target.closest('.wrap-input');
    const value = e.target.value;
    
    if (value === '') {
      wrapInput.classList.remove('has-val');
    }
    wrapInput.classList.remove('focus');
  };

  if (isValidToken === false) {
    return (
      <main className="login-container">
        <div className="wrap-login">
          <div className="login-form" style={{ textAlign: 'center' }}>
            <span className="login-title">
              Lien invalide
            </span>
            <Link to="/forgot-password" className="login-button" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Demander un nouveau lien
            </Link>
            <div className="text-center p-t-12" style={{ marginTop: '20px' }}>
              <Link to="/login" className="txt2">
                <FaLongArrowAltLeft className="m-l-5" aria-hidden="true" />
                Retour à la connexion
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-container">
      <div className="wrap-login">
        <Tilt tiltMaxAngleX={15} tiltMaxAngleY={15} scale={1.05} transitionSpeed={400}>
          <div className="login-pic">
            <LockIcon />
          </div>
        </Tilt>

        <form className="login-form" onSubmit={handleSubmit}>
          <span className="login-title">
            Nouveau mot de passe
          </span>
          
          <p className="forgot-description">
            Entrez votre nouveau mot de passe ci-dessous.
          </p>

          {/* Nouveau mot de passe */}
          <div className="wrap-input">
            <input 
              className="input-field" 
              type={showPassword ? "text" : "password"} 
              name="password"
              placeholder="Nouveau mot de passe" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              onFocus={handleInputFocus} 
              onBlur={handleInputBlur}
              autoComplete="new-password"
            />
            <span className="focus-input100 focus-input"></span>
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaLock aria-hidden="true" />
            </span>
            <span 
              className="eye-icon" 
              onClick={() => setShowPassword(!showPassword)}
              role="button"
              tabIndex={0}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
            </span>
          </div>

          {/* Confirmer le mot de passe */}
          <div className="wrap-input">
            <input 
              className="input-field" 
              type={showConfirmPassword ? "text" : "password"} 
              name="confirmPassword"
              placeholder="Confirmer le mot de passe" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={handleInputFocus} 
              onBlur={handleInputBlur}
              autoComplete="new-password"
            />
            <span className="focus-input100 focus-input"></span>
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaLock aria-hidden="true" />
            </span>
            <span 
              className="eye-icon" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              role="button"
              tabIndex={0}
              aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showConfirmPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
            </span>
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
                  <span>Réinitialisation...</span>
                </>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>
          </div>

          <div className="text-center p-t-12" style={{ marginTop: '20px' }}>
            <Link to="/login" className="txt2">
              <FaLongArrowAltLeft className="m-l-5" aria-hidden="true" />
              Retour à la connexion
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
};

export default ResetPassword;
