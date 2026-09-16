import { hasPermission, validatePassword, PERMISSIONS } from './api';

describe('hasPermission', () => {
  test('IT_ADMIN et DIRECTION ont exactement les mêmes permissions', () => {
    Object.values(PERMISSIONS).forEach((permission) => {
      expect(hasPermission('IT_ADMIN', permission)).toBe(hasPermission('DIRECTION', permission));
    });
  });

  test('USER a un accès restreint (pas de gestion des utilisateurs)', () => {
    expect(hasPermission('USER', PERMISSIONS.USERS_READ)).toBe(false);
    expect(hasPermission('USER', PERMISSIONS.TICKETS_READ)).toBe(true);
  });

  test('un rôle inconnu ou absent ne donne aucune permission', () => {
    expect(hasPermission('ROLE_INEXISTANT', PERMISSIONS.TICKETS_READ)).toBe(false);
    expect(hasPermission(undefined, PERMISSIONS.TICKETS_READ)).toBe(false);
  });
});

describe('validatePassword', () => {
  test('accepte une valeur vide (pas de saisie)', () => {
    expect(validatePassword('')).toBeNull();
  });

  test('refuse un mot de passe de moins de 7 caractères', () => {
    expect(validatePassword('abc123')).toMatch(/au moins 7 caractères/);
  });

  test('accepte un mot de passe de 7 caractères ou plus', () => {
    expect(validatePassword('abcdefg')).toBeNull();
  });
});
