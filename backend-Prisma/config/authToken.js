// Durée de session glissante : le cookie est réémis à chaque requête
// authentifiée (voir authenticateToken dans middleware/authMiddleware.js),
// donc cette valeur représente le délai d'inactivité avant expiration,
// pas une durée de vie fixe du token.
export const TOKEN_EXPIRES_IN = '10m';
export const TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
