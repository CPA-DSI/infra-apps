// Example: routes/mouvementsRoute.js
import express from 'express';
import multer from 'multer';
import prisma from '../prismaClient.js';
import { importMouvementsFromBuffer } from '../services/importMouvements.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { creerNouveauProduit, ProduitDejaExistantError } from '../services/produitsService.js';

const router = express.Router();

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
          lte: new Date(Date.UTC(targetYear + 1, 0, 1)),
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
    const ALLOWED_TYPES = ['ENTREE', 'ENTREE_QUANTITE', 'SORTIE'];
    if (!type_mouvement || !ALLOWED_TYPES.includes(type_mouvement)) {
        return res.status(400).json({ error: "Type de mouvement invalide.", message: `Le type fourni '${type_mouvement}' n'est pas autorisé.` });
    }
    
    // Validation quantité
    if (isNaN(quantite_int) || quantite_int <= 0) {
        return res.status(400).json({ error: "La quantité doit être un nombre positif." });
    }
    
    // Validation date
    let mouvementDate;
    if (date_mouvement) {
        mouvementDate = new Date(date_mouvement);
        if (isNaN(mouvementDate.getTime())) {
            return res.status(400).json({ error: "La date fournie est invalide." });
        }
    } else {
        mouvementDate = new Date(); // date par défaut = maintenant
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
    
    // Transaction
    try {
        const mouvementCree = await prisma.$transaction(async (tx) => {
            let ancienneQuantiteStock = null;
            let ancienneDateStock = null;
            let produitId = id_produit_int;
            let produitCree = null;
            
            if (type_mouvement === 'ENTREE') {
                produitCree = await creerNouveauProduit(tx, {
                    nomProduit: nom_produit,
                    quantiteInitiale: quantite_int,
                    dateMouvement: mouvementDate
                });
                produitId = produitCree.id_produit;
                ancienneQuantiteStock = 0;
            }
            else if (type_mouvement === 'ENTREE_QUANTITE') {
                const oldStockData = await tx.produits.findUnique({ 
                    where: { id_produit: produitId }, 
                    select: { quantite_en_stock: true, last_date: true, nom_produit: true, seuil_alerte: true } 
                });
                if (!oldStockData) throw new Error(`Produit avec l'ID ${produitId} introuvable.`);
                ancienneQuantiteStock = oldStockData.quantite_en_stock;
                ancienneDateStock = oldStockData.last_date;
                await tx.produits.update({ 
                    where: { id_produit: produitId }, 
                    data: { quantite_en_stock: { increment: quantite_int }, last_date: mouvementDate }
                });
            } 
            else if (type_mouvement === 'SORTIE') {
                const produit = await tx.produits.findUnique({ 
                    where: { id_produit: produitId },
                    select: { quantite_en_stock: true, nom_produit: true, seuil_alerte: true, last_date: true }
                });
                if (!produit) throw new Error(`Produit avec l'ID ${produitId} introuvable.`);
                if (produit.quantite_en_stock < quantite_int) {
                    throw new Error(`Stock insuffisant pour "${produit.nom_produit}". Disponible: ${produit.quantite_en_stock}, Demandé: ${quantite_int}`);
                }
                ancienneQuantiteStock = produit.quantite_en_stock;
                ancienneDateStock = produit.last_date;
                const nouveauStock = produit.quantite_en_stock - quantite_int;
                await tx.produits.update({ 
                    where: { id_produit: produitId }, 
                    data: { quantite_en_stock: { decrement: quantite_int }, last_date: mouvementDate }
                });
                if (produit.seuil_alerte && nouveauStock <= produit.seuil_alerte) {
                    console.log(`⚠️ Stock bas pour "${produit.nom_produit}" : ${nouveauStock} <= seuil ${produit.seuil_alerte}`);
                }
            }
            
            // Historique pour toutes les opérations (entrées et sorties)
            if ((type_mouvement === 'ENTREE' || type_mouvement === 'ENTREE_QUANTITE' || type_mouvement === 'SORTIE') && produitId) {
                await tx.historiqueArrive.create({ 
                    data: { 
                        id_produit: produitId, 
                        quantite_arrivee: type_mouvement === 'SORTIE' ? -quantite_int : quantite_int,
                        date_arrivee: mouvementDate, 
                        ancienne_quantite_stock: ancienneQuantiteStock, 
                        ancienne_date_stock: ancienneDateStock || null 
                    } 
                });
            }
            
            // Création du mouvement
            const mouvement = await tx.Mouvement.create({
                data: { 
                    id_produit: produitId,
                    id_local_source: id_local_source_int,
                    id_local_destination: id_local_destination_int,
                    quantite: quantite_int,
                    id_materiels: id_materiels_int,
                    nom_utilisateur: nom_utilisateur || null,
                    date_mouvement: mouvementDate,
                    type_mouvement: type_mouvement,
                    motif: motif || null
                },
                include: {
                    produits: { select: { nom_produit: true, quantite_en_stock: true, seuil_alerte: true } }
                }
            });
            return mouvement;
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
        let errorMessage = err.message;
        let statusCode = 400;
        if (err.message.includes("introuvable")) statusCode = 404;
        res.status(statusCode).json({ error: 'Erreur de traitement du mouvement', message: errorMessage });
    }
});

// ----------------------------------------------------
// UPDATE an existing movement (PUT /:id)
// ----------------------------------------------------
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  const { date_mouvement, quantite, id_produit, id_local_source, id_local_destination, id_materiels, type_mouvement, motif, nom_utilisateur, ...rest } = req.body;

  try {
    const mouvementId = parseInt(id, 10);
    
    // Récupérer l'ancien mouvement avant modification
    const ancienMouvement = await prisma.Mouvement.findUnique({
      where: { id_mouvement: mouvementId },
      include: { produits: true }
    });

    if (!ancienMouvement) {
      return res.status(404).json({ error: `Mouvement avec l'id ${id} introuvable.` });
    }

    // Préparer les données de mise à jour
    const dataToUpdate = { ...rest };
    
    if (date_mouvement) {
      const parsedDate = new Date(date_mouvement);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "La date fournie est invalide." });
      }
      dataToUpdate.date_mouvement = parsedDate;
    }
    
    const ancienneQuantite = ancienMouvement.quantite;
    const nouvelleQuantite = quantite !== undefined ? parseInt(quantite, 10) : ancienneQuantite;
    const ancienType = ancienMouvement.type_mouvement;
    const nouveauType = type_mouvement || ancienType;
    const ancienProduitId = ancienMouvement.id_produit;
    const nouveauProduitId = id_produit !== undefined ? (id_produit ? parseInt(id_produit, 10) : null) : ancienProduitId;
    const nouvelleDate = dataToUpdate.date_mouvement || ancienMouvement.date_mouvement;
    
    // Validation des nouveaux champs
    if (nouvelleQuantite <= 0) {
      return res.status(400).json({ error: "La quantité doit être un nombre positif." });
    }
    
    const ALLOWED_TYPES = ['ENTREE', 'ENTREE_QUANTITE', 'SORTIE'];
    if (!ALLOWED_TYPES.includes(nouveauType)) {
      return res.status(400).json({ error: "Type de mouvement invalide." });
    }
    
    // Vérifier si le produit a changé
    const produitChange = ancienProduitId !== nouveauProduitId;
    
    // Transaction pour mettre à jour le mouvement et ajuster le stock
    const updatedMouvement = await prisma.$transaction(async (tx) => {
      
      // Cas 1: Le produit ou le type a changé
      if (produitChange || ancienType !== nouveauType) {
        // Annuler complètement l'ancien mouvement
        await annulerEffetMouvement(tx, ancienMouvement);
        // Appliquer le nouveau mouvement
        await appliquerEffetMouvement(tx, nouveauProduitId, nouveauType, nouvelleQuantite, nouvelleDate);
      } 
      // Cas 2: Même produit et même type, mais quantité modifiée
      else if (ancienneQuantite !== nouvelleQuantite) {
        // Calculer la différence de quantité
        const differenceQuantite = nouvelleQuantite - ancienneQuantite;
        
        console.log(`📊 Ajustement de quantité pour ${nouveauType}:`);
        console.log(`   Ancienne quantité: ${ancienneQuantite}`);
        console.log(`   Nouvelle quantité: ${nouvelleQuantite}`);
        console.log(`   Différence: ${differenceQuantite}`);
        
        // Ajuster le stock en fonction de la différence
        const produit = await tx.produits.findUnique({
          where: { id_produit: nouveauProduitId }
        });
        
        if (!produit) {
          throw new Error(`Produit avec l'ID ${nouveauProduitId} introuvable`);
        }
        
        if (nouveauType === 'ENTREE' || nouveauType === 'ENTREE_QUANTITE') {
          // Pour une entrée: ajouter la différence (positive ou négative)
          const nouveauStock = produit.quantite_en_stock + differenceQuantite;
          if (nouveauStock < 0) {
            throw new Error(`Impossible de réduire la quantité car cela rendrait le stock négatif pour "${produit.nom_produit}". Stock actuel: ${produit.quantite_en_stock}, Différence: ${differenceQuantite}`);
          }
          
          await tx.produits.update({
            where: { id_produit: nouveauProduitId },
            data: { 
              quantite_en_stock: { increment: differenceQuantite },
              last_date: nouvelleDate || new Date()
            }
          });
          
          console.log(`✅ Ajustement ${nouveauType}: ${differenceQuantite >= 0 ? '+' : ''}${differenceQuantite} au produit "${produit.nom_produit}"`);
        } 
        else if (nouveauType === 'SORTIE') {
          // Pour une sortie: soustraire la différence (inverser la logique car on enlève du stock)
          const ajustementSortie = -differenceQuantite; // Si nouvelleQuantite > ancienneQuantite, on enlève plus
          
          if (ajustementSortie > 0) {
            // On doit enlever plus de stock
            if (produit.quantite_en_stock < ajustementSortie) {
              throw new Error(`Stock insuffisant pour "${produit.nom_produit}". Disponible: ${produit.quantite_en_stock}, À enlever: ${ajustementSortie}`);
            }
            await tx.produits.update({
              where: { id_produit: nouveauProduitId },
              data: { 
                quantite_en_stock: { decrement: ajustementSortie },
                last_date: nouvelleDate || new Date()
              }
            });
          } else if (ajustementSortie < 0) {
            // On doit enlever moins de stock (donc en rajouter)
            await tx.produits.update({
              where: { id_produit: nouveauProduitId },
              data: { 
                quantite_en_stock: { increment: -ajustementSortie },
                last_date: nouvelleDate || new Date()
              }
            });
          }
          
          console.log(`✅ Ajustement SORTIE: ${ajustementSortie >= 0 ? '-' : '+'}${Math.abs(ajustementSortie)} du produit "${produit.nom_produit}"`);
        }
        
        // Vérifier le seuil d'alerte après ajustement
        const produitMisAJour = await tx.produits.findUnique({
          where: { id_produit: nouveauProduitId }
        });
        
        if (produitMisAJour.seuil_alerte && produitMisAJour.quantite_en_stock <= produitMisAJour.seuil_alerte) {
          console.log(`⚠️ ALERTE: Stock bas pour "${produitMisAJour.nom_produit}" : ${produitMisAJour.quantite_en_stock} <= seuil ${produitMisAJour.seuil_alerte}`);
        }
      }
      
      // Mettre à jour le mouvement
      if (quantite !== undefined) dataToUpdate.quantite = nouvelleQuantite;
      if (type_mouvement !== undefined) dataToUpdate.type_mouvement = nouveauType;
      if (id_produit !== undefined) dataToUpdate.id_produit = nouveauProduitId;
      if (id_local_source !== undefined) dataToUpdate.id_local_source = id_local_source ? parseInt(id_local_source, 10) : null;
      if (id_local_destination !== undefined) dataToUpdate.id_local_destination = id_local_destination ? parseInt(id_local_destination, 10) : null;
      if (id_materiels !== undefined) dataToUpdate.id_materiels = id_materiels ? parseInt(id_materiels, 10) : null;
      if (motif !== undefined) dataToUpdate.motif = motif;
      if (nom_utilisateur !== undefined) dataToUpdate.nom_utilisateur = nom_utilisateur;
      
      const mouvement = await tx.Mouvement.update({
        where: { id_mouvement: mouvementId },
        data: dataToUpdate,
        include: { produits: true }
      });
      
      return mouvement;
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
      res.status(400).json({ error: error.message || "Erreur lors de la mise à jour du mouvement." });
    }
  }
});

// DELETE a movement (DELETE /:id)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;

  try {
    const mouvementId = parseInt(id, 10);
    
    const mouvement = await prisma.Mouvement.findUnique({
      where: { id_mouvement: mouvementId }
    });

    if (!mouvement) {
      return res.status(404).json({ error: `Mouvement avec l'id ${id} introuvable.` });
    }

    // Transaction pour supprimer le mouvement et ajuster le stock
    const deletedMouvement = await prisma.$transaction(async (tx) => {
      // Pour une SORTIE : réintégrer la quantité
      if (mouvement.type_mouvement === 'SORTIE') {
        console.log(`📦 RÉINTÉGRATION STOCK: Produit ID ${mouvement.id_produit} +${mouvement.quantite}`);
        await tx.produits.update({
          where: { id_produit: mouvement.id_produit },
          data: { quantite_en_stock: { increment: mouvement.quantite } }
        });
      }
      // Pour une ENTREE ou ENTREE_QUANTITE : soustraire la quantité
      else if (mouvement.type_mouvement === 'ENTREE' || mouvement.type_mouvement === 'ENTREE_QUANTITE') {
        console.log(`📦 SOUSTRACTION STOCK: Produit ID ${mouvement.id_produit} -${mouvement.quantite}`);
        await tx.produits.update({
          where: { id_produit: mouvement.id_produit },
          data: { quantite_en_stock: { decrement: mouvement.quantite } }
        });
      }
      
      // Supprimer le mouvement
      const deleted = await tx.Mouvement.delete({
        where: { id_mouvement: mouvementId },
      });
      
      return deleted;
    });
    
    res.status(200).json({ 
      message: `Mouvement supprimé avec succès. Stock ajusté.`, 
      deletedItem: deletedMouvement 
    });
  } catch (error) {
    console.error('Erreur DELETE:', error);
    res.status(500).json({ error: error.message || "Erreur lors de la suppression." });
  }
});

// ====================================================
// FONCTIONS UTILITAIRES POUR LA GESTION DU STOCK
// ====================================================

// Annuler l'effet d'un mouvement sur le stock
async function annulerEffetMouvement(tx, mouvement) {
  console.log(`=== Annulation du mouvement ${mouvement.id_mouvement} (${mouvement.type_mouvement}) ===`);
  
  const produit = await tx.produits.findUnique({
    where: { id_produit: mouvement.id_produit }
  });
  
  if (!produit) {
    console.error(`❌ Produit avec l'ID ${mouvement.id_produit} introuvable pour annulation`);
    throw new Error(`Produit avec l'ID ${mouvement.id_produit} introuvable pour annulation`);
  }
  
  console.log(`Produit trouvé: "${produit.nom_produit}" (ID: ${produit.id_produit})`);
  console.log(`Stock actuel: ${produit.quantite_en_stock}`);
  console.log(`Quantité du mouvement: ${mouvement.quantite}`);
  
  switch (mouvement.type_mouvement) {
    case 'ENTREE':
    case 'ENTREE_QUANTITE':
      // Une entrée/ajustement avait AJOUTÉ du stock, donc on le SOUSTRAIT pour annuler
      const nouveauStockEntree = produit.quantite_en_stock - mouvement.quantite;
      console.log(`Annulation ${mouvement.type_mouvement}: ${produit.quantite_en_stock} - ${mouvement.quantite} = ${nouveauStockEntree}`);
      
      if (nouveauStockEntree < 0) {
        throw new Error(`Impossible d'annuler ce mouvement car cela rendrait le stock négatif pour "${produit.nom_produit}"`);
      }
      
      await tx.produits.update({
        where: { id_produit: mouvement.id_produit },
        data: { quantite_en_stock: { decrement: mouvement.quantite } }
      });
      console.log(`✅ Annulation ${mouvement.type_mouvement}: -${mouvement.quantite} du produit "${produit.nom_produit}"`);
      break;
      
    case 'SORTIE':
      // Une sortie avait ENLEVÉ du stock, donc on le RÉAJOUTE pour annuler
      const nouveauStockSortie = produit.quantite_en_stock + mouvement.quantite;
      console.log(`Annulation SORTIE: ${produit.quantite_en_stock} + ${mouvement.quantite} = ${nouveauStockSortie}`);
      
      await tx.produits.update({
        where: { id_produit: mouvement.id_produit },
        data: { quantite_en_stock: { increment: mouvement.quantite } }
      });
      console.log(`✅ Annulation SORTIE: +${mouvement.quantite} du produit "${produit.nom_produit}"`);
      break;
      
    default:
      console.log(`Type de mouvement inconnu: ${mouvement.type_mouvement}`);
  }
}

// Appliquer l'effet d'un mouvement sur le stock
async function appliquerEffetMouvement(tx, produitId, typeMouvement, quantite, dateMouvement) {
  const produit = await tx.produits.findUnique({
    where: { id_produit: produitId }
  });
  
  if (!produit) {
    throw new Error(`Produit avec l'ID ${produitId} introuvable pour application`);
  }
  
  switch (typeMouvement) {
    case 'ENTREE':
    case 'ENTREE_QUANTITE':
      await tx.produits.update({
        where: { id_produit: produitId },
        data: { 
          quantite_en_stock: { increment: quantite },
          last_date: dateMouvement || new Date()
        }
      });
      console.log(`✅ Application ${typeMouvement}: +${quantite} au produit ${produit.nom_produit}`);
      break;
      
    case 'SORTIE':
      if (produit.quantite_en_stock < quantite) {
        throw new Error(`Stock insuffisant pour "${produit.nom_produit}". Disponible: ${produit.quantite_en_stock}, Demandé: ${quantite}`);
      }
      await tx.produits.update({
        where: { id_produit: produitId },
        data: { 
          quantite_en_stock: { decrement: quantite },
          last_date: dateMouvement || new Date()
        }
      });
      console.log(`✅ Application SORTIE: -${quantite} du produit ${produit.nom_produit}`);
      break;
      
    default:
      throw new Error(`Type de mouvement invalide: ${typeMouvement}`);
  }
  
  // Vérifier le seuil d'alerte après l'application
  const produitMisAJour = await tx.produits.findUnique({
    where: { id_produit: produitId }
  });
  
  if (produitMisAJour.seuil_alerte && produitMisAJour.quantite_en_stock <= produitMisAJour.seuil_alerte) {
    console.log(`⚠️ ALERTE: Stock bas pour "${produitMisAJour.nom_produit}" : ${produitMisAJour.quantite_en_stock} <= seuil ${produitMisAJour.seuil_alerte}`);
  }
}

export default router;