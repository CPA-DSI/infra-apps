import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Tilt from 'react-parallax-tilt';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../config/api';
import { CSRF_HEADERS } from '../../services/api/client';
import { FaEnvelope, FaSpinner, FaLongArrowAltLeft } from 'react-icons/fa';

import AuthLogo from '../../components/AuthLogo/AuthLogo';

// --- IMPORTS CSS ---
import './auth-base.css';
import './login.css';
import { swalButtons } from '../../utils/swal';

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
        ...swalButtons('brand')
      });
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez entrer un email valide',
        confirmButtonText: 'OK',
        ...swalButtons('brand')
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...CSRF_HEADERS,
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
          ...swalButtons('brand')
        });
        setEmail('');
      } else if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Email envoyé !',
          text: 'Un email de réinitialisation a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.',
          confirmButtonText: 'OK',
          ...swalButtons('brand')
        });
        setEmail('');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: data.error || data.message || 'Une erreur est survenue. Veuillez réessayer.',
          confirmButtonText: 'OK',
          ...swalButtons('brand')
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
          text: 'Impossible de se connecter au serveur. Veuillez réessayer plus tard.',
        confirmButtonText: 'OK',
        ...swalButtons('brand')
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
            <AuthLogo variant="key" size={180} />
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
          
          <div className="login-button-wrap">
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

          <div className="text-center p-t-12 m-t-20">
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
