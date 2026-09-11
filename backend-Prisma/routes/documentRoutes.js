import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Supprime un fichier physique du dossier uploads si présent (ignore l'absence)
const deleteFileIfExists = async (cheminStockage) => {
  if (!cheminStockage) return;
  const filename = path.basename(cheminStockage);
  const fullPath = path.join(UPLOADS_DIR, filename);
  try {
    await fs.promises.access(fullPath, fs.constants.F_OK);
    await fs.promises.unlink(fullPath);
  } catch (e) {
    // Le fichier est déjà absent du disque, on ignore silencieusement
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniqueSuffix}_${safeName}`);
  }
});

const upload = multer({ storage });

const pjStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniqueSuffix}_${safeName}`);
  }
});

const uploadPj = multer({ storage: pjStorage });

router.get('/', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      include: {
        uploader: true,
        ticket: true,
        marque: true,
        produits_lies: {
          include: {
            produit: true,
          },
        },
        materiels_lies: {
          include: {
            materiel: true,
          },
        },
        acces: true,
        pieces_jointes: true,
      },
      orderBy: {
        date_upload: 'desc',
      },
    });
    res.json(documents);
  } catch (error) {
    console.error('Erreur API documents:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const [byCategory, byVisibility, avecPjCount, totalPiecesJointes] = await Promise.all([
      prisma.document.groupBy({
        by: ['categorie'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.document.groupBy({
        by: ['est_public'],
        _count: { id: true },
      }),
      prisma.document.count({
        where: { pieces_jointes: { some: {} } },
      }),
      prisma.pieceJointe.count(),
    ]);

    const totalDocuments = byCategory.reduce((sum, c) => sum + c._count.id, 0);
    const documentsSansPj = totalDocuments - avecPjCount;
    const documentsPublics = byVisibility.find(v => v.est_public === true)?._count.id || 0;
    const documentsPrives = byVisibility.find(v => v.est_public === false)?._count.id || 0;

    res.json({
      totalDocuments,
      totalPiecesJointes,
      documentsAvecPj: avecPjCount,
      documentsSansPj,
      documentsPublics,
      documentsPrives,
      byCategory: byCategory.map(c => ({ categorie: c.categorie, count: c._count.id })),
    });
  } catch (error) {
    console.error('Erreur API documents stats:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, ensureActiveUser, async (req, res) => {
  const { id } = req.params;
  try {
    const document = await prisma.document.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        uploader: true,
        ticket: true,
        marque: true,
        produits_lies: {
          include: {
            produit: true,
          },
        },
        materiels_lies: {
          include: {
            materiel: true,
          },
        },
        acces: true,
        pieces_jointes: true,
      },
    });
    if (!document) {
      return res.status(404).json({ error: `Document avec ID ${id} non trouvé` });
    }
    res.json(document);
  } catch (error) {
    console.error('Erreur API document:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, ensureActiveUser, upload.single('fichier'), async (req, res) => {
  try {
    const { nom_fichier, categorie, description, id_materiels, id_marque, id_produits, id_ticket, est_public, version } = req.body;

    if (!nom_fichier || !nom_fichier.trim()) {
      return res.status(400).json({ error: 'Le nom du fichier est obligatoire.' });
    }

    let chemin_stockage = null;
    let taille = null;
    let type_mime = null;

    if (req.file) {
      chemin_stockage = `/uploads/${req.file.filename}`;
      taille = req.file.size;
      type_mime = req.file.mimetype;
    } else {
      return res.status(400).json({ error: 'Le fichier du document est obligatoire.' });
    }

    const user = await prisma.users.findUnique({
      where: { id_user: req.user.userId },
      select: { id_n: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    let materielsArray = [];
    if (id_materiels) {
      try {
        materielsArray = JSON.parse(id_materiels);
        if (!Array.isArray(materielsArray)) {
          materielsArray = [];
        }
      } catch {
        return res.status(400).json({ error: 'Format invalide pour les matériels.' });
      }
    }

    if (materielsArray.length > 0) {
      const existingMateriels = await prisma.materiels.findMany({
        where: { id_materiels: { in: materielsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } },
        select: { id_materiels: true },
      });
      const existingIds = new Set(existingMateriels.map(m => m.id_materiels));
      const invalidIds = materielsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `Matériel(s) introuvable(s): ${invalidIds.join(', ')}` });
      }
    }

    let produitsArray = [];
    if (id_produits) {
      try {
        produitsArray = JSON.parse(id_produits);
        if (!Array.isArray(produitsArray)) {
          produitsArray = [];
        }
      } catch {
        return res.status(400).json({ error: 'Format invalide pour les produits.' });
      }
    }

    if (produitsArray.length > 0) {
      const existingProduits = await prisma.produits.findMany({
        where: { id_produit: { in: produitsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } },
        select: { id_produit: true },
      });
      const existingProdIds = new Set(existingProduits.map(p => p.id_produit));
      const invalidProdIds = produitsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && !existingProdIds.has(id));
      if (invalidProdIds.length > 0) {
        return res.status(400).json({ error: `Produit(s) introuvable(s): ${invalidProdIds.join(', ')}` });
      }
    }

    const parsedIdMarque = id_marque ? parseInt(id_marque, 10) : null;
    if (id_marque && (isNaN(parsedIdMarque) || parsedIdMarque < 1)) {
      return res.status(400).json({ error: 'Identifiant de marque invalide.' });
    }
    if (parsedIdMarque) {
      const marqueExists = await prisma.marques.findUnique({ where: { id_marque: parsedIdMarque } });
      if (!marqueExists) {
        return res.status(404).json({ error: `Marque avec ID ${parsedIdMarque} introuvable.` });
      }
    }

    const parsedIdTicket = id_ticket ? parseInt(id_ticket, 10) : null;
    if (id_ticket && (isNaN(parsedIdTicket) || parsedIdTicket < 1)) {
      return res.status(400).json({ error: 'Identifiant de ticket invalide.' });
    }
    if (parsedIdTicket) {
      const ticketExists = await prisma.ticket.findUnique({ where: { idTicket: parsedIdTicket } });
      if (!ticketExists) {
        return res.status(404).json({ error: `Ticket avec ID ${parsedIdTicket} introuvable.` });
      }
    }

    const document = await prisma.document.create({
      data: {
        nom_fichier: nom_fichier.trim(),
        categorie: categorie || 'AUTRE',
        description: description || '',
        chemin_stockage,
        taille,
        type_mime,
        marque: parsedIdMarque ? { connect: { id_marque: parsedIdMarque } } : undefined,
        ticket: parsedIdTicket ? { connect: { idTicket: parsedIdTicket } } : undefined,
        est_public: est_public === 'true' || est_public === true,
        version: version !== undefined ? parseInt(version, 10) : 1,
        uploader: { connect: { id_n: user.id_n } },
      },
      include: {
        uploader: true,
        ticket: true,
        marque: true,
        materiels_lies: {
          include: {
            materiel: true,
          },
        },
        acces: true,
      },
    });

    if (materielsArray.length > 0) {
      await prisma.materielDocument.createMany({
        data: materielsArray.map(id_m => ({ id_materiels: parseInt(id_m, 10), id_document: document.id })),
      });
    }

    const produitsArrayClean = id_produits ? (() => {
      try { return JSON.parse(id_produits); } catch { return []; }
    })() : [];

    if (produitsArrayClean.length > 0) {
      await prisma.produitDocument.createMany({
        data: produitsArrayClean.map(id_p => ({ id_produit: parseInt(id_p, 10), id_document: document.id })),
      });
    }

    const createdDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: {
        uploader: true,
        ticket: true,
        marque: true,
        produits_lies: {
          include: {
            produit: true,
          },
        },
        materiels_lies: {
          include: {
            materiel: true,
          },
        },
        acces: true,
      },
    });

    res.status(201).json(createdDocument);
  } catch (error) {
    console.error('Erreur API documents:', error);
    const message = error?.message || 'Une erreur est survenue lors de la création du document.';
    res.status(500).json({ error: message });
  }
});

router.put('/:id', authenticateToken, ensureActiveUser, upload.single('fichier'), async (req, res) => {
  try {
    const { nom_fichier, categorie, description, id_materiels, id_marque, id_produits, id_ticket, est_public, version } = req.body;

    const documentId = parseInt(req.params.id, 10);

    const existing = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      return res.status(404).json({ error: `Document avec ID ${documentId} non trouvé` });
    }

    let chemin_stockage = existing.chemin_stockage;
    let taille = existing.taille;
    let type_mime = existing.type_mime;

    if (req.file) {
      chemin_stockage = `/uploads/${req.file.filename}`;
      taille = req.file.size;
      type_mime = req.file.mimetype;
    }

    const materielsArray = id_materiels ? JSON.parse(id_materiels) : [];
    const produitsArray = id_produits ? JSON.parse(id_produits) : [];

    if (!Array.isArray(materielsArray)) {
      return res.status(400).json({ error: 'Format invalide pour les matériels.' });
    }
    if (materielsArray.length > 0) {
      const existingMateriels = await prisma.materiels.findMany({
        where: { id_materiels: { in: materielsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } },
        select: { id_materiels: true },
      });
      const existingIds = new Set(existingMateriels.map(m => m.id_materiels));
      const invalidIds = materielsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `Matériel(s) introuvable(s): ${invalidIds.join(', ')}` });
      }
    }

    if (!Array.isArray(produitsArray)) {
      return res.status(400).json({ error: 'Format invalide pour les produits.' });
    }
    if (produitsArray.length > 0) {
      const existingProduits = await prisma.produits.findMany({
        where: { id_produit: { in: produitsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) } },
        select: { id_produit: true },
      });
      const existingProdIds = new Set(existingProduits.map(p => p.id_produit));
      const invalidProdIds = produitsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && !existingProdIds.has(id));
      if (invalidProdIds.length > 0) {
        return res.status(400).json({ error: `Produit(s) introuvable(s): ${invalidProdIds.join(', ')}` });
      }
    }

    const parsedIdMarque = id_marque ? parseInt(id_marque, 10) : null;
    if (id_marque && (isNaN(parsedIdMarque) || parsedIdMarque < 1)) {
      return res.status(400).json({ error: 'Identifiant de marque invalide.' });
    }
    if (parsedIdMarque) {
      const marqueExists = await prisma.marques.findUnique({ where: { id_marque: parsedIdMarque } });
      if (!marqueExists) {
        return res.status(404).json({ error: `Marque avec ID ${parsedIdMarque} introuvable.` });
      }
    }

    const parsedIdTicket = id_ticket ? parseInt(id_ticket, 10) : null;
    if (id_ticket && (isNaN(parsedIdTicket) || parsedIdTicket < 1)) {
      return res.status(400).json({ error: 'Identifiant de ticket invalide.' });
    }
    if (parsedIdTicket) {
      const ticketExists = await prisma.ticket.findUnique({ where: { idTicket: parsedIdTicket } });
      if (!ticketExists) {
        return res.status(404).json({ error: `Ticket avec ID ${parsedIdTicket} introuvable.` });
      }
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        nom_fichier,
        categorie,
        description,
        chemin_stockage,
        taille,
        type_mime,
        version: version !== undefined ? parseInt(version, 10) : undefined,
        marque: id_marque ? { connect: { id_marque: parseInt(id_marque, 10) } } : { disconnect: true },
        ticket: id_ticket ? { connect: { idTicket: parseInt(id_ticket, 10) } } : { disconnect: true },
        est_public: est_public === 'true' || est_public === true,
      },
    });

    await prisma.materielDocument.deleteMany({
      where: { id_document: documentId },
    });

    if (materielsArray.length > 0) {
      await prisma.materielDocument.createMany({
        data: materielsArray.map(id_m => ({ id_materiels: parseInt(id_m, 10), id_document: documentId })),
      });
    }

    await prisma.produitDocument.deleteMany({
      where: { id_document: documentId },
    });

    if (produitsArray.length > 0) {
      await prisma.produitDocument.createMany({
        data: produitsArray.map(id_p => ({ id_produit: parseInt(id_p, 10), id_document: documentId })),
      });
    }

    const updatedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        uploader: true,
        ticket: true,
        marque: true,
        produits_lies: {
          include: {
            produit: true,
          },
        },
        materiels_lies: {
          include: {
            materiel: true,
          },
        },
        acces: true,
      },
    });

    res.json(updatedDocument);
  } catch (error) {
    console.error('Erreur API documents:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id, 10);

    const existing = await prisma.document.findUnique({
      where: { id: documentId },
      include: { pieces_jointes: true },
    });

    if (!existing) {
      return res.status(404).json({ error: `Document avec ID ${id} non trouvé` });
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    // Suppression des fichiers physiques (document principal + pièces jointes)
    await deleteFileIfExists(existing.chemin_stockage);
    if (existing.pieces_jointes && existing.pieces_jointes.length > 0) {
      await Promise.all(
        existing.pieces_jointes.map((pj) => deleteFileIfExists(pj.chemin_stockage))
      );
    }

    res.json({ message: 'Document supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur API documents:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pj', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id, 10);

    const piecesJointes = await prisma.pieceJointe.findMany({
      where: { id_document: documentId },
      orderBy: { date_upload: 'desc' },
    });

    res.json(piecesJointes);
  } catch (error) {
    console.error('Erreur API pieces jointes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/pj', authenticateToken, ensureActiveUser, uploadPj.single('pj'), async (req, res) => {
  try {
    const { id } = req.params;
    const documentId = parseInt(id, 10);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: `Document avec ID ${id} non trouvé` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const pieceJointe = await prisma.pieceJointe.create({
      data: {
        id_document: documentId,
        nom_fichier: req.file.originalname,
        chemin_stockage: `/uploads/${req.file.filename}`,
        taille: req.file.size,
        type_mime: req.file.mimetype,
      },
    });

    res.status(201).json(pieceJointe);
  } catch (error) {
    console.error('Erreur API upload piece jointe:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/pj/:pjId', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const { pjId } = req.params;
    const pieceJointeId = parseInt(pjId, 10);

    const pieceJointe = await prisma.pieceJointe.findUnique({
      where: { id: pieceJointeId },
    });

    if (!pieceJointe) {
      return res.status(404).json({ error: `Pièce jointe avec ID ${pjId} non trouvée` });
    }

    await prisma.pieceJointe.delete({
      where: { id: pieceJointeId },
    });

    // Suppression du fichier physique associé
    await deleteFileIfExists(pieceJointe.chemin_stockage);

    res.json({ message: 'Pièce jointe supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur API suppression piece jointe:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
