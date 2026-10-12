// Example: routes/mouvementsRoute.js
import express from 'express';
import multer from 'multer';
import prisma from '../prismaClient.js';
import { importMouvementsFromBuffer } from '../services/importMouvements.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { ProduitDejaExistantError } from '../services/produitsService.js';
import {
    StockError, TYPES_MOUVEMENT, creerMouvement, creerProduitAvecStock,
    annulerEffetMouvement, modifierEffetMouvement, verrouillerMouvement
} from '../services/stockService.js';
import { toDateOnly, todayDateOnly } from '../services/dateOnly.js';
import { validateIdParam } from '../middleware/validateIdParam.js';

const router = express.Router();
router.param('id', validateIdParam);

router.use(authenticateToken, ensureActiveUser);

// Configuration de multer pour l'upload de fichiers
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (validExtensions.includes(`.${ext}`)) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv'));
        }
    }
});

// ====================================================
// ROUTE D'IMPORTATION DES MOUVEMENTS
// ====================================================
// routes/mouvementsRoute.js - Ajoutez cette route d'import

// Route d'importation avec meilleure gestion des erreurs
router.post('/import', requirePermission(PERMISSIONS.STOCKS_WRITE), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        console.log(`📥 Fichier reçu: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Vérifier l'extension du fichier
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = req.file.originalname.split('.').pop().toLowerCase();
        if (!validExtensions.includes(`.${ext}`)) {
            return res.status(400).json({
                success: false,
                message: `Format de fichier non supporté. Utilisez: ${validExtensions.join(', ')}`
            });
        }
        
        const result = await importMouvementsFromBuffer(req.file.buffer, req.file.originalname);
        
        res.status(200).json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Erreur import:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de l\'importation',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});


// ----------------------------------------------------
// READ all movements (GET /)
// ----------------------------------------------------
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    const mouvements = await prisma.Mouvement.findMany({
      include: {
        materiels: { 
          select: {
            id_n: true, utilisateur: true, equipe: true,
            marque: { select: { id_marque: true, nom_marque: true, url: true } }
          }
        },
        produits: { select: { nom_produit: true, quantite_en_stock: true } },
        localSource: { select: { nom_local: true } },
        localDestination: { select: { nom_local: true } }
      },
      orderBy: { updated_at: 'desc' },
    });

    console.log(`Données renvoyées par l'API: ${mouvements.length} lignes.`);
    return res.status(200).json({ mouvements });
  } catch (error) {
    console.error("Erreur GET /api/mouvements:", error.message);
    return res.status(500).json({ 
        error: "Une erreur interne est survenue lors de la récupération des mouvements.", 
        message: error.message 
    });
  }
});

// ----------------------------------------------------
// STATS par année (GET /stats/:year)
// ----------------------------------------------------
router.get('/stats/:year', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  const { year } = req.params;
  const targetYear = parseInt(year);

  try {
    const mouvements = await prisma.Mouvement.findMany({
      where: {
        date_mouvement: {
          gte: new Date(Date.UTC(targetYear, 0, 1)),
          // borne haute exclusive : le 1er janvier N+1 n'appartient pas à l'année N
          lt: new Date(Date.UTC(targetYear + 1, 0, 1)),
        },
      },
      select: { date_mouvement: true, type_mouvement: true, quantite: true },
    });

    const statsMensuelles = mouvements.reduce((acc, m) => {
      const date = new Date(m.date_mouvement);
      const moisIndex = date.getUTCMonth();
      const qte = Number(m.quantite) || 0;
      const type = m.type_mouvement ? m.type_mouvement.trim().toUpperCase() : "";

      if (type.includes('ENTREE')) acc[moisIndex].total_entrees += qte;
      else if (type.includes('SORTIE')) acc[moisIndex].total_sorties += qte;
      return acc;
    }, Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, total_entrees: 0, total_sorties: 0 })));

    res.json(statsMensuelles);
  } catch (error) {
    console.error("Erreur Backend /stats/:year:", error);
    res.status(500).json({ message: "Erreur serveur lors du calcul des stats" });
  }
});

// ----------------------------------------------------
// ANNÉES DISPONIBLES (GET /annees/disponibles)
// ----------------------------------------------------
router.get('/annees/disponibles', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    const result = await prisma.Mouvement.aggregate({
      _min: { date_mouvement: true },
      _max: { date_mouvement: true },
    });

    const currentYear = new Date().getFullYear();
    const minYear = result._min.date_mouvement ? result._min.date_mouvement.getUTCFullYear() : currentYear;
    const maxYear = result._max.date_mouvement
      ? Math.max(result._max.date_mouvement.getUTCFullYear(), currentYear)
      : currentYear;

    res.json({ minYear, maxYear });
  } catch (error) {
    console.error("Erreur GET /api/mouvements/annees/disponibles:", error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des années disponibles" });
  }
});

// ----------------------------------------------------
// READ one movement by ID (GET /:id)
// ----------------------------------------------------
router.get('/:id', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  const { id } = req.params;

  try {
    const mouvement = await prisma.Mouvement.findUnique({
      where: { id_mouvement: parseInt(id, 10) },
      include: {
        produits: { select: { nom_produit: true, quantite_en_stock: true, seuil_alerte: true } },
        localSource: { select: { nom_local: true } },
        localDestination: { select: { nom_local: true } },
        materiels: {
          select: {
            utilisateur: true,
            equipe: true,
            code_pc: true,
            caracteristiques: true,
            etat_pc: true,
            etat_batterie: true,
            ecran: true,
            code_ecran: true,
            hdmi: true,
            clavier: true,
            lan: true,
            usb: true,
            salle: true,
            date_pc: true,
            date_ecran: true,
            commentaire: true,
            marque: { select: { nom_marque: true, url: true } }
          }
        }
      }
    });

    if (mouvement) {
      const responseWithUrl = { ...mouvement, url_detail_api: `${req.baseUrl}/${id}` };
      res.json(responseWithUrl);
    } else {
      res.status(404).json({ error: `Mouvement avec l'id ${id} introuvable.` });
    }
  } catch (error) {
    console.error("Erreur Prisma lors de la récupération:", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la récupération du mouvement." });
  }
});

// ----------------------------------------------------
// CREATE a new movement (POST /)
// ----------------------------------------------------
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
    const {
        id_produit, id_local_source, id_local_destination, quantite, id_materiels,
        nom_produit, nom_utilisateur, date_mouvement, type_mouvement, motif
    } = req.body;

    // Conversions
    const id_produit_int = id_produit ? parseInt(id_produit, 10) : null;
    const id_local_source_int = id_local_source ? parseInt(id_local_source, 10) : null;
    const id_local_destination_int = id_local_destination ? parseInt(id_local_destination, 10) : null;
    const id_materiels_int = id_materiels ? parseInt(id_materiels, 10) : null;
    const quantite_int = parseInt(quantite, 10);

    // Validation type
    if (!type_mouvement || !TYPES_MOUVEMENT.includes(type_mouvement)) {
        return res.status(400).json({ error: "Type de mouvement invalide.", message: `Le type fourni '${type_mouvement}' n'est pas autorisé.` });
    }

    // Validation quantité
    if (isNaN(quantite_int) || quantite_int <= 0) {
        return res.status(400).json({ error: "La quantité doit être un nombre positif." });
    }

    // Validation date (colonne @db.Date : date calendaire à minuit UTC pour éviter le J-1)
    let mouvementDate;
    if (date_mouvement) {
        mouvementDate = toDateOnly(date_mouvement);
        if (!mouvementDate) {
            return res.status(400).json({ error: "La date fournie est invalide." });
        }
    } else {
        mouvementDate = todayDateOnly(); // date par défaut = aujourd'hui
    }

    // Validation spécifique selon le type
    if (type_mouvement === 'ENTREE') {
        if (!nom_produit || !nom_produit.trim()) {
            return res.status(400).json({ error: "Le nom du produit est requis pour le type ENTREE." });
        }
        if (!id_local_destination_int) {
            return res.status(400).json({ error: "La destination (local) est requise pour une entrée." });
        }
    }

    if ((type_mouvement === 'ENTREE_QUANTITE' || type_mouvement === 'SORTIE') && !id_produit_int) {
        return res.status(400).json({ error: "L'ID du produit est requis pour ce type de mouvement." });
    }

    if (type_mouvement === 'SORTIE' && !id_local_source_int) {
        return res.status(400).json({ error: "La source (local) est requise pour une sortie." });
    }

    // Vérification existence produit (pour ENTREE)
    if (type_mouvement === 'ENTREE' && nom_produit) {
        const existingProduct = await prisma.produits.findFirst({
            where: { nom_produit: { equals: nom_produit.trim(), mode: 'insensitive' } }
        });
        if (existingProduct) {
            return res.status(400).json({
                error: "Produit déjà existant",
                message: `Le produit "${nom_produit}" existe déjà. Utilisez le type "Entrée Quantité Produit" pour ajouter du stock.`,
                existingProductId: existingProduct.id_produit
            });
        }
    }

    // Transaction : stock + historique + mouvement passent par stockService
    try {
        const mouvementCree = await prisma.$transaction(async (tx) => {
            const donnees = {
                id_local_source: id_local_source_int,
                id_local_destination: id_local_destination_int,
                id_materiels: id_materiels_int,
                nom_utilisateur: nom_utilisateur || null,
                motif: motif || null
            };
            const include = {
                produits: { select: { nom_produit: true, quantite_en_stock: true, seuil_alerte: true } }
            };

            if (type_mouvement === 'ENTREE') {
                // Nouveau produit : stock initial = quantité du mouvement (historisé)
                const produitCree = await creerProduitAvecStock(tx, {
                    nomProduit: nom_produit,
                    quantite: quantite_int,
                    date: mouvementDate
                });
                return tx.mouvement.create({
                    data: {
                        ...donnees,
                        id_produit: produitCree.id_produit,
                        type_mouvement,
                        quantite: quantite_int,
                        date_mouvement: mouvementDate
                    },
                    include
                });
            }

            // ENTREE_QUANTITE / SORTIE sur un produit existant
            return creerMouvement(tx, {
                idProduit: id_produit_int,
                typeMouvement: type_mouvement,
                quantite: quantite_int,
                dateMouvement: mouvementDate,
                donnees,
                include
            });
        });

        let successMessage = "Mouvement enregistré avec succès.";
        if (type_mouvement === 'ENTREE') {
            successMessage = `Produit "${nom_produit}" créé avec un stock de ${quantite_int} unités et un seuil d'alerte de ${mouvementCree.produits?.seuil_alerte}.`;
        }
        res.status(201).json({ success: true, message: successMessage, mouvement: mouvementCree });
    } catch (err) {
        if (err instanceof ProduitDejaExistantError) {
            return res.status(400).json({
                error: "Produit déjà existant",
                message: `Le produit "${err.nomProduit}" existe déjà. Utilisez le type "Entrée Quantité Produit" pour ajouter du stock.`,
                existingProductId: err.existingProductId
            });
        }
        console.error("Erreur lors de la transaction du mouvement:", err.message);
        let statusCode = err instanceof StockError ? err.status : 400;
        if (err.message.includes("introuvable")) statusCode = 404;
        // Le message détaillé (ex. "Stock insuffisant...") est mis dans `error` :
        // c'est le champ lu en premier par getErrorMessage côté frontend.
        res.status(statusCode).json({ error: err.message, message: err.message });
    }
});

// Convertit un identifiant optionnel ("" / null => null). Retourne NaN si invalide.
function parseOptionalId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

// ----------------------------------------------------
// UPDATE an existing movement (PUT /:id)
// ----------------------------------------------------
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  // Liste blanche des champs modifiables (pas de ...rest : évite l'affectation
  // de masse sur id_mouvement, created_at, etc.)
  const {
    date_mouvement, quantite, id_produit, id_local_source, id_local_destination,
    id_materiels, type_mouvement, motif, remarque, nom_utilisateur
  } = req.body;

  try {
    const mouvementId = parseInt(id, 10);

    // Validation du corps (ne dépend pas de l'état en base)
    const dataToUpdate = {};

    if (date_mouvement) {
      const parsedDate = toDateOnly(date_mouvement);
      if (!parsedDate) {
        return res.status(400).json({ error: "La date fournie est invalide." });
      }
      dataToUpdate.date_mouvement = parsedDate;
    }

    if (quantite !== undefined && (!Number.isInteger(Number(quantite)) || Number(quantite) <= 0)) {
      return res.status(400).json({ error: "La quantité doit être un nombre positif." });
    }

    if (type_mouvement && !TYPES_MOUVEMENT.includes(type_mouvement)) {
      return res.status(400).json({ error: "Type de mouvement invalide." });
    }

    if (id_produit !== undefined && !Number.isInteger(parseOptionalId(id_produit))) {
      return res.status(400).json({ error: "L'ID du produit est requis et doit être valide." });
    }

    const idsOptionnels = {};
    for (const [champ, valeur] of Object.entries({ id_local_source, id_local_destination, id_materiels })) {
      if (valeur === undefined) continue;
      const parsed = parseOptionalId(valeur);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: `Le champ ${champ} est invalide.` });
      }
      idsOptionnels[champ] = parsed;
    }

    // Transaction : l'ancien mouvement est relu sous verrou, sinon deux
    // modifications simultanées calculent leur delta sur le même état.
    let ancienneQuantite;
    let nouvelleQuantite;
    const updatedMouvement = await prisma.$transaction(async (tx) => {
      const ancienMouvement = await verrouillerMouvement(tx, mouvementId);

      ancienneQuantite = ancienMouvement.quantite;
      nouvelleQuantite = quantite !== undefined ? Number(quantite) : ancienneQuantite;
      const ancienType = ancienMouvement.type_mouvement;
      const nouveauType = type_mouvement || ancienType;
      const ancienProduitId = ancienMouvement.id_produit;
      const nouveauProduitId = id_produit !== undefined ? parseOptionalId(id_produit) : ancienProduitId;
      const nouvelleDate = dataToUpdate.date_mouvement || ancienMouvement.date_mouvement;
      const produitChange = ancienProduitId !== nouveauProduitId;

      if (produitChange || ancienType !== nouveauType || ancienneQuantite !== nouvelleQuantite) {
        await modifierEffetMouvement(tx, ancienMouvement, {
          idProduit: nouveauProduitId,
          typeMouvement: nouveauType,
          quantite: nouvelleQuantite,
          dateMouvement: nouvelleDate
        });
      }

      // Mettre à jour le mouvement (champs explicitement autorisés uniquement)
      if (quantite !== undefined) dataToUpdate.quantite = nouvelleQuantite;
      if (type_mouvement !== undefined) dataToUpdate.type_mouvement = nouveauType;
      if (id_produit !== undefined) dataToUpdate.id_produit = nouveauProduitId;
      Object.assign(dataToUpdate, idsOptionnels);
      if (motif !== undefined) dataToUpdate.motif = motif;
      if (remarque !== undefined) dataToUpdate.remarque = remarque || null;
      if (nom_utilisateur !== undefined) dataToUpdate.nom_utilisateur = nom_utilisateur;

      return tx.mouvement.update({
        where: { id_mouvement: mouvementId },
        data: dataToUpdate,
        include: { produits: true }
      });
    });

    let successMessage = "Mouvement mis à jour avec succès";
    if (ancienneQuantite !== nouvelleQuantite) {
      successMessage = `Mouvement mis à jour: Quantité modifiée de ${ancienneQuantite} à ${nouvelleQuantite}. Stock ajusté en conséquence.`;
    }

    res.json({
      success: true,
      message: successMessage,
      mouvement: updatedMouvement
    });

  } catch (error) {
    console.error('Erreur PUT:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: `Mouvement avec l'id ${id} introuvable.` });
    } else {
      const status = error instanceof StockError ? error.status : 400;
      res.status(status).json({ error: error.message || "Erreur lors de la mise à jour du mouvement." });
    }
  }
});

// DELETE a movement (DELETE /:id)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;

  try {
    const mouvementId = parseInt(id, 10);

    // Transaction : annulation de l'effet sur le stock (historisée) puis suppression.
    // Une ENTREE ne peut plus être supprimée si son retrait rendrait le stock négatif.
    // Le mouvement est relu sous verrou (cf. PUT).
    const deletedMouvement = await prisma.$transaction(async (tx) => {
      const mouvement = await verrouillerMouvement(tx, mouvementId);
      await annulerEffetMouvement(tx, mouvement, `Suppression du mouvement #${mouvementId}`);
      return tx.mouvement.delete({
        where: { id_mouvement: mouvementId },
      });
    });

    res.status(200).json({
      message: `Mouvement supprimé avec succès. Stock ajusté.`,
      deletedItem: deletedMouvement
    });
  } catch (error) {
    console.error('Erreur DELETE:', error);
    const status = error instanceof StockError ? error.status : 500;
    res.status(status).json({ error: error.message || "Erreur lors de la suppression." });
  }
});

export default router;