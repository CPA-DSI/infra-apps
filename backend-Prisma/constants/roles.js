export const UserRole = {
  USER: 'USER',
  IT_ADMIN: 'IT_ADMIN',
  DIRECTION: 'DIRECTION',
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
  [UserRole.USER]: [
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_WRITE,
    PERMISSIONS.MATERIELS_READ,
  ],
  [UserRole.IT_ADMIN]: IT_ADMIN_PERMISSIONS,
  [UserRole.DIRECTION]: IT_ADMIN_PERMISSIONS,
};

export const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};
