import React from 'react';
import { Link } from 'react-router-dom';
import { FaCompass, FaHome } from 'react-icons/fa';
import PageHeader from '../../components/PageHeader/PageHeader';
import './NotFound.css';

// Page 404 : hors AppLayout (pas de navbar), l'utilisateur peut ne pas être connecté.
// /Home redirige vers la connexion si nécessaire.
const NotFound = () => (
  <main className="not-found">
    <div className="not-found__card">
      <PageHeader
        icon={<FaCompass />}
        title="Page introuvable"
        subtitle="Erreur 404"
      />
      <p className="not-found__text">
        La page demandée n'existe pas ou a été déplacée.
      </p>
      <Link to="/Home" className="btn-pill btn-pill-primary not-found__action">
        <FaHome aria-hidden="true" /> Retour à l'accueil
      </Link>
    </div>
  </main>
);

export default NotFound;
