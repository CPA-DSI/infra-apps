// Configuration API centralisée
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  UPDATE_PASSWORD: `${API_BASE_URL}/api/auth/update-passwords`
};

export const PAGE_TITLES = {
  '/Home': 'Tableau de Bord',
  '/Materiels': 'Gestion des Matériels',
  '/MailInfo': 'Gestion des Utilisateurs',
  '/Mouvements': 'Mouvements de Stock',
  '/HistoriqueArrivees': 'Historique des Arrivées',
  '/ProduitLocaux': 'Produits & Locaux',
   '/Tickets': 'Tickets de Support',
   '/EmailHome': 'Configuration E-mail',
   '/Documents': 'Gestion Documentaire',
   '/Factures': 'Factures',
   '/Contrats': 'Contrats',
   '/Garanties': 'Garanties'
 };

export const ROLES = {
  'USER': { label: 'Utilisateur', className: 'role-user' },
  'IT_ADMIN': { label: 'Admin IT', className: 'role-admin' },
  'DIRECTION': { label: 'Direction', className: 'role-direction' }
};

export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  MATERIELS_READ: 'materiels:read',
  MATERIELS_WRITE: 'materiels:write',
  MATERIELS_DELETE: 'materiels:delete',
  TICKETS_READ: 'tickets:read',
  TICKETS_WRITE: 'tickets:write',
  TICKETS_CLOSE: 'tickets:close',
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_WRITE: 'documents:write',
  DOCUMENTS_DELETE: 'documents:delete',
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  STOCKS_READ: 'stocks:read',
  STOCKS_WRITE: 'stocks:write',
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
};

// DIRECTION a exactement les mêmes droits qu'IT_ADMIN : les deux rôles
// partagent la même liste de permissions pour éviter toute divergence.
const IT_ADMIN_PERMISSIONS = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_WRITE,
  PERMISSIONS.MATERIELS_READ,
  PERMISSIONS.MATERIELS_WRITE,
  PERMISSIONS.MATERIELS_DELETE,
  PERMISSIONS.TICKETS_READ,
  PERMISSIONS.TICKETS_WRITE,
  PERMISSIONS.TICKETS_CLOSE,
  PERMISSIONS.DOCUMENTS_READ,
  PERMISSIONS.DOCUMENTS_WRITE,
  PERMISSIONS.DOCUMENTS_DELETE,
  PERMISSIONS.STOCKS_READ,
  PERMISSIONS.STOCKS_WRITE,
  PERMISSIONS.CONFIG_READ,
  PERMISSIONS.REPORTS_READ,
];

export const ROLE_PERMISSIONS = {
  USER: [
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_WRITE,
    PERMISSIONS.MATERIELS_READ,
  ],
  IT_ADMIN: IT_ADMIN_PERMISSIONS,
  DIRECTION: IT_ADMIN_PERMISSIONS,
};

export const hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

export const validatePassword = (password) => {
  if (!password) return null;
  if (password.length < 7) return 'Le mot de passe doit contenir au moins 7 caractères';
  return null;
};
