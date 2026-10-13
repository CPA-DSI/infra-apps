import React from 'react';
import './PageHeader.css';

/**
 * En-tête de page commun : icône, titre, sous-titre et zone d'actions.
 *
 *  - icon : élément react-icons
 *  - title, subtitle
 *  - actions : boutons alignés à droite (utiliser .btn-pill-* / .btn-refresh)
 *  - background : dégradé spécifique à la page (défaut : --gradient-header)
 *  - children : contenu additionnel sous le titre (badges, filtres…)
 */
const PageHeader = ({ icon, title, subtitle, actions, background, className = '', children }) => (
  <header
    className={`page-header ${className}`.trim()}
    style={background ? { '--page-header-bg': background } : undefined}
  >
    <div className="page-header__main">
      {icon && <div className="page-header__icon" aria-hidden="true">{icon}</div>}
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>
);

export default PageHeader;
