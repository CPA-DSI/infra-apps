// Rejette un paramètre :id non numérique avec une 400, avant que la route ne
// l'utilise (parseInt -> NaN -> erreur Prisma -> 500). Enregistré par
// router.param('id', validateIdParam) dans chaque routeur qui utilise :id.
export const validateIdParam = (req, res, next, value) => {
  if (!/^\d+$/.test(value)) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }
  next();
};
