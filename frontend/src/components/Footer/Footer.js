import React from 'react';
import { Link } from 'react-router-dom';
import { FaLifeRing } from 'react-icons/fa';
import './Footer.css';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <span className="footer-copyright">
          © {year} <span className="text-accent">InvTech IT</span> — Tous droits réservés
        </span>
        <Link to="/Tickets" className="footer-support-link">
          <FaLifeRing />
          <span>Support</span>
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
