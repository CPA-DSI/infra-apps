import React, { useId } from 'react';
import './AuthLogo.css';

// Illustrations des pages d'authentification (écran, clé, cadenas).
// Le dégradé suit les couleurs de marque du thème ; l'id est unique par instance.
const ScreenShapes = ({ grad }) => (
  <>
    <rect x="20" y="20" width="160" height="110" rx="8" ry="8" fill="#333" />
    <rect x="28" y="28" width="144" height="94" rx="4" ry="4" fill={grad} />
    <text x="35" y="50" fill="#fff" fontFamily="monospace" fontSize="14">SUPPORT IT</text>
    <text x="35" y="65" fill="#fff" fontFamily="monospace" fontSize="10">Help Desk</text>
    <text x="35" y="80" fill="#fff" fontFamily="monospace" fontSize="10">Tickets</text>
    <text x="35" y="95" fill="#fff" fontFamily="monospace" fontSize="10">data</text>
    <rect x="70" y="130" width="60" height="25" fill="#444" />
    <rect x="50" y="155" width="100" height="8" rx="4" ry="4" fill="#333" />
    <rect x="40" y="170" width="120" height="15" rx="3" ry="3" fill="#444" />
    <line x1="50" y1="175" x2="150" y2="175" stroke="#555" strokeWidth="2" />
    <ellipse cx="160" cy="172" rx="8" ry="12" fill="#444" />
  </>
);

const KeyShapes = ({ grad }) => (
  <>
    {/* Anneau de la clé */}
    <circle cx="70" cy="70" r="40" fill="none" stroke={grad} strokeWidth="12" />
    <circle cx="70" cy="70" r="18" fill="none" stroke={grad} strokeWidth="8" />
    {/* Tige et dents */}
    <rect x="105" y="60" width="80" height="20" rx="4" fill={grad} />
    <rect x="145" y="80" width="12" height="20" rx="2" fill={grad} />
    <rect x="165" y="80" width="12" height="15" rx="2" fill={grad} />
  </>
);

const LockShapes = ({ grad }) => (
  <>
    {/* Corps et anneau du cadenas */}
    <rect x="50" y="80" width="100" height="80" rx="10" fill={grad} />
    <path d="M65 80 V55 A35 35 0 0 1 135 55 V80" fill="none" stroke={grad} strokeWidth="14" strokeLinecap="round" />
    {/* Trou de serrure */}
    <circle cx="100" cy="120" r="15" fill="#fff" />
    <rect x="92" y="120" width="16" height="25" fill="#fff" />
  </>
);

const SHAPES = { screen: ScreenShapes, key: KeyShapes, lock: LockShapes };

const AuthLogo = ({ variant = 'screen', size = 200, className = '' }) => {
  const gradId = `auth-logo-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const Shapes = SHAPES[variant] || ScreenShapes;

  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={`auth-logo ${className}`.trim()}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="auth-logo-stop-start" />
          <stop offset="100%" className="auth-logo-stop-end" />
        </linearGradient>
      </defs>
      <g>
        <Shapes grad={`url(#${gradId})`} />
      </g>
    </svg>
  );
};

export default AuthLogo;
