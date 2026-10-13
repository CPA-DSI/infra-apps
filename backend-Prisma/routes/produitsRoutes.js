// routes/produitsRoutes.js
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { ajusterStockVers, enregistrerHistorique, StockError } from '../services/stockService.js';
import { toDateOnly } from '../services/dateOnly.js';
import { sendError } from '../middleware/errorHandler.js';


const router = express.Router();
router.param('id', validateIdParam);

// Le middleware spécifique pour s'assurer que req.prisma est disponible (au cas où) est une bonne pratique.
router.use((req, res, next) => {
    if (!req.prisma) {
        return res.status(500).json({ error: "Prisma client non disponible dans la requête." });
    }
    next();
});

router.use(authenticateToken, ensureActiveUser);

// 1. GET all products (READ)
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    // Utilisez 'prisma' directement au lieu de 'req.prisma'
    const produits = await prisma.Produits.findMany({
      orderBy: {
        last_date: 'desc', 
      },
    }); 
    res.json(produits);
  } catch (error) {
    sendError(res, error, 'GET /api/produits', 'Une erreur interne est survenue.');
  }
});


// 2. GET a single product by ID (READ one)
router.get('/:id', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
    const { id } = req.params;
    try {
        // Assurez-vous que le champ de l'ID dans votre schéma Prisma est bien 'id_produit'
        const produit = await req.prisma.Produits.findUnique({
            where: { id_produit: parseInt(id) },
        });
        if (produit) {
            res.json(produit);
        } else {
            res.status(404).json({ error: 'Produit non trouvé' });
        }
    } catch (error) {
        sendError(res, error, 'GET /api/produits/:id');
    }
});

// --- Helpers de validation ---------------------------------------------------
// `undefined` = champ absent (on ne touche pas à la valeur en base),
// "" / null = champ vidé. 0 est une valeur valide (et non plus convertie en null).

// Entier >= 0 optionnel. Retourne undefined (absent), null (vidé), un entier, ou NaN (invalide).
function parseEntierPositifOptionnel(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

// Date calendaire optionnelle (colonne @db.Date). undefined / null / Date / NaN (invalide).
function parseDateOptionnelle(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = toDateOnly(value);
  return d || NaN;
}

// Les parseurs ci-dessus signalent une valeur invalide par NaN
const estInvalide = (v) => typeof v === 'number' && Number.isNaN(v);

// 3. POST create a new product (CREATE)
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { nom_produit } = req.body;
  const quantite_en_stock = parseEntierPositifOptionnel(req.body.quantite_en_stock);
  const seuil_alerte = parseEntierPositifOptionnel(req.body.seuil_alerte);
  const last_date = parseDateOptionnelle(req.body.last_date);

  if (typeof nom_produit !== 'string' || nom_produit.trim() === '') {
    return res.status(400).json({ error: "Le nom du produit est requis." });
  }
  if (estInvalide(quantite_en_stock)) {
    return res.status(400).json({ error: "La quantité en stock doit être un entier positif ou nul." });
  }
  if (estInvalide(seuil_alerte)) {
    return res.status(400).json({ error: "Le seuil d'alerte doit être un entier positif ou nul." });
  }
  if (estInvalide(last_date)) {
    return res.status(400).json({ error: "La date fournie est invalide." });
  }

  try {
    const stockInitial = quantite_en_stock ?? 0;
    const nouveauProduit = await prisma.$transaction(async (tx) => {
      const produit = await tx.produits.create({
        data: {
          nom_produit: nom_produit.trim(),
          // Stock absent / vide => 0 (un stock NULL ne pourrait plus être incrémenté en SQL)
          quantite_en_stock: stockInitial,
          seuil_alerte: seuil_alerte ?? null,
          last_date: last_date ?? null,
        },
      });
      // Stock initial historisé comme une arrivée (ancienne quantité = 0)
      if (stockInitial > 0) {
        await enregistrerHistorique(tx, {
          idProduit: produit.id_produit,
          delta: stockInitial,
          ancienneQuantite: 0,
          remarque: 'Stock initial (création de la fiche produit)'
        });
      }
      return produit;
    });
    res.status(201).json(nouveauProduit);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: "Ce produit existe déjà." });
    }
    sendError(res, error, 'POST /api/produits', 'Erreur lors de la création du produit.');
  }
});

// 4. PUT update a product (UPDATE)
// Mise à jour partielle : seuls les champs présents dans le corps sont modifiés.
// Un changement de quantite_en_stock n'est pas écrit directement : il passe par
// stockService (ajustement atomique + ligne d'historique "Ajustement manuel").
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  const idProduit = parseInt(id, 10);
  const { nom_produit } = req.body;
  const quantite_en_stock = parseEntierPositifOptionnel(req.body.quantite_en_stock);
  const seuil_alerte = parseEntierPositifOptionnel(req.body.seuil_alerte);
  const last_date = parseDateOptionnelle(req.body.last_date);

  if (nom_produit !== undefined && (typeof nom_produit !== 'string' || nom_produit.trim() === '')) {
    return res.status(400).json({ error: "Le nom du produit ne peut pas être vide." });
  }
  if (estInvalide(quantite_en_stock)) {
    return res.status(400).json({ error: "La quantité en stock doit être un entier positif ou nul." });
  }
  if (estInvalide(seuil_alerte)) {
    return res.status(400).json({ error: "Le seuil d'alerte doit être un entier positif ou nul." });
  }
  if (estInvalide(last_date)) {
    return res.status(400).json({ error: "La date fournie est invalide." });
  }

  try {
    const produitMisAJour = await prisma.$transaction(async (tx) => {
      // Stock : "" / null (champ vidé dans le formulaire, qui affiche aussi 0 comme vide)
      // => stock inchangé ; une valeur différente du stock actuel => ajustement historisé.
      if (Number.isInteger(quantite_en_stock)) {
        await ajusterStockVers(tx, {
          idProduit,
          quantiteCible: quantite_en_stock,
          remarque: 'Ajustement manuel (fiche produit)'
        });
      }

      const data = {};
      if (nom_produit !== undefined) data.nom_produit = nom_produit.trim();
      if (seuil_alerte !== undefined) data.seuil_alerte = seuil_alerte;
      if (last_date !== undefined) data.last_date = last_date;

      if (Object.keys(data).length === 0) {
        const produit = await tx.produits.findUnique({ where: { id_produit: idProduit } });
        if (!produit) throw new StockError('Produit non trouvé', 404);
        return produit;
      }
      return tx.produits.update({
        where: { id_produit: idProduit },
        data,
      });
    });
    res.json(produitMisAJour);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: "Un autre produit porte déjà ce nom." });
    }
    // StockError : son statut 4xx et son message
    sendError(res, error, 'PUT /api/produits/:id', 'Erreur lors de la mise à jour du produit.');
  }
});

// 5. DELETE a product (DELETE)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.Produits.delete({
      where: { id_produit: parseInt(id) },
    });
    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Ce produit a des mouvements ou un historique : il ne peut pas être supprimé.' });
    }
    sendError(res, error, 'DELETE /api/produits/:id', 'Erreur lors de la suppression du produit.');
  }
});

export default router;
