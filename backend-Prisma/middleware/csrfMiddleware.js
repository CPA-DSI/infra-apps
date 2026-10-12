// Protection CSRF des routes /api.
// Le frontend (Vercel) et l'API sont sur des domaines différents : le cookie de
// session doit rester en SameSite=None en production, il serait donc envoyé par
// le navigateur sur une requête forgée depuis un site tiers. Pour toute méthode
// mutante on exige :
//   1. une origine (en-tête Origin, ou Referer à défaut) présente dans la liste
//      des origines autorisées (la même que celle de CORS) ;
//   2. l'en-tête personnalisé X-Requested-With: XMLHttpRequest. Un site tiers ne
//      peut pas l'ajouter sans passer par un preflight CORS, que nous refusons.

export const CSRF_HEADER_NAME = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Extrait l'origine (schéma + hôte + port) d'une URL de Referer, null si invalide
const getOriginFromReferer = (referer) => {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

// Origine de la requête : Origin en priorité, Referer en secours
export const getRequestOrigin = (req) => {
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin;
  return getOriginFromReferer(req.get('referer'));
};

export const createCsrfGuard = (allowedOrigins = []) => {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/+$/, '')));

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const origin = getRequestOrigin(req);
    if (!origin || !allowed.has(origin)) {
      return res.status(403).json({ error: 'Requête refusée : origine non autorisée.' });
    }

    if (req.get(CSRF_HEADER_NAME) !== CSRF_HEADER_VALUE) {
      return res.status(403).json({ error: 'Requête refusée : en-tête de sécurité manquant.' });
    }

    next();
  };
};
