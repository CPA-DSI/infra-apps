import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../config/api';
import { FaEnvelope, FaSpinner, FaLongArrowAltLeft } from 'react-icons/fa';

// --- IMPORTS CSS ---
import '../../assets/vendor/animate/animate.css';
import '../../assets/vendor/css-hamburgers/hamburgers.min.css';
import '../../assets/vendor/select2/select2.min.css';
import '../../assets/vendor/bootstrap/css/bootstrap.min.css';
import '../../assets/css/util.css';
import '../../assets/css/main.css';
import './login.css';

// SVG Icon
const KeyIcon = () => (
  <svg 
    viewBox="0 0 200 200" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '180px', height: '180px' }}
  >
    <defs>
      <linearGradient id="keyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#667eea', stopOpacity: 1}} />
        <stop offset="100%" style={{stopColor: '#764ba2', stopOpacity: 1}} />
      </linearGradient>
    </defs>
    <g>
      {/* Cercle de la clé */}
      <circle cx="70" cy="70" r="40" fill="none" stroke="url(#keyGrad)" strokeWidth="12" />
      <circle cx="70" cy="70" r="18" fill="none" stroke="url(#keyGrad)" strokeWidth="8" />
      {/* Tige de la clé */}
      <rect x="105" y="60" width="80" height="20" rx="4" fill="url(#keyGrad)" />
      {/* Dents de la clé */}
      <rect x="145" y="80" width="12" height="20" rx="2" fill="url(#keyGrad)" />
      <rect x="165" y="80" width="12" height="15" rx="2" fill="url(#keyGrad)" />
    </g>
  </svg>
);

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: "L'email est requis",
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez entrer un email valide',
        confirmButtonText: 'OK',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.status === 200 && data.message?.includes('Si un compte')) {
        Swal.fire({
          icon: 'info',
          title: 'Email envoyé',
          text: data.message,
          confirmButtonText: 'OK',
          confirmButtonColor: '#667eea'
        });
        setEmail('');
      } else if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Email envoyé !',
          text: 'Un email de réinitialisation a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#667eea'
        });
        setEmail('');
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
          text: 'Impossible de se connecter au serveur. Veuillez réessayer plus tard.',
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

  return (
    <main className="login-container">
      <div className="wrap-login">
        <Tilt tiltMaxAngleX={15} tiltMaxAngleY={15} scale={1.05} transitionSpeed={400}>
          <div className="login-pic">
            <KeyIcon />
          </div>
        </Tilt>

        <form className="login-form" onSubmit={handleSubmit}>
          <span className="login-title">
            Réinitialiser le mot de passe
          </span>
          
          <p className="forgot-description">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          <div className="wrap-input validate-input">
            <input className="input-field" type="text" name="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={handleInputFocus} onBlur={handleInputBlur} autoComplete="email" />
            <span className="focus-input100 focus-input"></span>
            <span className="symbol-input100 symbol-input" aria-hidden="true">
              <FaEnvelope aria-hidden="true" />
            </span>
          </div>
          
          <div style={{ width: '100%' }}>
            <button className={`login-button ${isLoading ? 'loading' : ''}`} type="submit" disabled={isLoading} aria-busy={isLoading} >
              {isLoading ? (
                <>
                  <FaSpinner className="fa-spinner icon-spin" aria-hidden="true" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                'Envoyer le lien'
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

export default ForgotPassword;
