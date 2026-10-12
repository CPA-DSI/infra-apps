import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateIdParam } from '../middleware/validateIdParam.js';

const router = express.Router();
router.param('id', validateIdParam);
router.param('pjId', validateIdParam);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.join(__dirname, '../uploads');
// multer.diskStorage ne crée pas le dossier de destination lui-même
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Origines du frontend autorisées à afficher un PDF dans une iframe (aperçu rapide)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000'];

// --- Types de fichiers acceptés ---
// L'extension fait foi : le type MIME envoyé par le navigateur n'est qu'indicatif
// (certains postes envoient application/octet-stream pour les fichiers Office/zip).
// Le Content-Type servi au téléchargement est toujours déduit de l'extension.
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 Mo

export const ALLOWED_FILE_TYPES = {
  pdf: { contentType: 'application/pdf', mimes: ['application/pdf'] },
  png: { contentType: 'image/png', mimes: ['image/png'] },
  jpg: { contentType: 'image/jpeg', mimes: ['image/jpeg', 'image/pjpeg'] },
  jpeg: { contentType: 'image/jpeg', mimes: ['image/jpeg', 'image/pjpeg'] },
  gif: { contentType: 'image/gif', mimes: ['image/gif'] },
  webp: { contentType: 'image/webp', mimes: ['image/webp'] },
  doc: { contentType: 'application/msword', mimes: ['application/msword'] },
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  },
  xls: { contentType: 'application/vnd.ms-excel', mimes: ['application/vnd.ms-excel'] },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  },
  pptx: {
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
  },
  txt: { contentType: 'text/plain; charset=utf-8', mimes: ['text/plain'] },
  csv: { contentType: 'text/csv; charset=utf-8', mimes: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'] },
  zip: { contentType: 'application/zip', mimes: ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'] },
};

// Types affichables directement dans le navigateur (aperçu rapide) via ?inline=1
const INLINE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);

const getExtension = (filename = '') => path.extname(filename).slice(1).toLowerCase();

export const isAllowedUpload = (originalname, mimetype) => {
  const fileType = ALLOWED_FILE_TYPES[getExtension(originalname)];
  if (!fileType) return false;
  const mime = (mimetype || '').toLowerCase();
  return mime === 'application/octet-stream' || fileType.mimes.includes(mime);
};

// Type MIME enregistré en base : déduit de l'extension, pas du navigateur
const getStoredMimeType = (filename) => {
  const fileType = ALLOWED_FILE_TYPES[getExtension(filename)];
  return fileType ? fileType.contentType.split(';')[0] : 'application/octet-stream';
};

// Résout le chemin physique d'un fichier à partir de chemin_stockage (ex: /uploads/123_x.pdf).
// Seul le nom de fichier est conservé, et le résultat doit rester dans UPLOADS_DIR.
export const resolveStoredFilePath = (cheminStockage) => {
  if (!cheminStockage || typeof cheminStockage !== 'string') return null;
  const filename = path.posix.basename(cheminStockage.replace(/\\/g, '/'));
  if (!filename || filename === '.' || filename === '..') return null;
  const fullPath = path.resolve(UPLOADS_DIR, filename);
  const relative = path.relative(UPLOADS_DIR, fullPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fullPath;
};

// En-tête Content-Disposition : nom ASCII de secours + nom UTF-8 (RFC 6266 / 5987)
export const buildContentDisposition = (type, filename) => {
  const name = filename || 'fichier';
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name)
    .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

// Nom proposé au téléchargement : le nom saisi, complété de l'extension réelle si besoin
export const buildDownloadName = (nomFichier, storedPath) => {
  const ext = getExtension(storedPath);
  const base = path.posix.basename(String(nomFichier || '').replace(/\\/g, '/')).trim() || 'fichier';
  if (!ext || getExtension(base) === ext) return base;
  return `${base}.${ext}`;
};

// Envoie un fichier stocké : en pièce jointe par défaut, inline (?inline=1)
// uniquement pour les types sûrs utilisés par l'aperçu rapide (PDF, images).
const sendStoredFile = (req, res, cheminStockage, nomFichier) => {
  const fullPath = resolveStoredFilePath(cheminStockage);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Fichier introuvable.' });
  }

  const ext = getExtension(fullPath);
  const fileType = ALLOWED_FILE_TYPES[ext];
  const inline = req.query.inline === '1' && INLINE_EXTENSIONS.has(ext);

  res.setHeader('Content-Type', fileType ? fileType.contentType : 'application/octet-stream');
  res.setHeader('Content-Disposition', buildContentDisposition(inline ? 'inline' : 'attachment', buildDownloadName(nomFichier, fullPath)));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  if (inline && ext === 'pdf') {
    // La visionneuse PDF des navigateurs refuse de s'afficher dans un document
    // sandboxé : on se limite à n'autoriser l'iframe que depuis le frontend.
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${allowedOrigins.join(' ')}`);
  } else {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  }

  return res.sendFile(path.basename(fullPath), { root: UPLOADS_DIR, dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) {
      console.error('Erreur envoi fichier document:', err);
      res.status(err.status || 500).json({ error: 'Impossible de lire le fichier.' });
    }
  });
};

// Supprime un fichier physique du dossier uploads si présent (ignore l'absence)
const deleteFileIfExists = async (cheminStockage) => {
  const fullPath = resolveStoredFilePath(cheminStockage);
  if (!fullPath) return;
  try {
    await fs.promises.unlink(fullPath);
  } catch (e) {
    // Le fichier est déjà absent du disque, on ignore silencieusement
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Suffixe aléatoire : deux pièces jointes de même nom reçues dans la même
    // milliseconde ne doivent pas entrer en collision (chemin_stockage est unique).
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const safeName = path.basename(file.originalname).replace(/[^\w.-]+/g, '_');
    cb(null, `${uniqueSuffix}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedUpload(file.originalname, file.mimetype)) {
      const error = new Error(`Type de fichier non autorisé (${file.originalname}). Formats acceptés : ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}.`);
      error.isUploadValidation = true;
      return cb(error);
    }
    cb(null, true);
  },
});

// Réception d'un fichier avec une 400 propre en cas de refus (taille, type...).
// Si la requête échoue ensuite (validation, erreur base), le fichier reçu est supprimé.
const handleUpload = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? `Fichier trop volumineux (maximum ${MAX_UPLOAD_SIZE / (1024 * 1024)} Mo).`
          : `Envoi du fichier refusé : ${err.message}`;
        return res.status(400).json({ error: message });
      }
      if (err.isUploadValidation) {
        return res.status(400).json({ error: err.message });
      }
      console.error('Erreur upload document:', err);
      return res.status(500).json({ error: 'Erreur lors de la réception du fichier.' });
    }

    if (req.file) {
      const uploadedFilename = req.file.filename;
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          deleteFileIfExists(uploadedFilename);
        }
      });
    }
    next();
  });
};

// Parse un tableau d'identifiants envoyé en JSON dans le FormData.
// Retourne null si le format est invalide ; les valeurs non numériques sont ignorées.
const parseIdArray = (raw) => {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return [...new Set(parsed.map(id => parseInt(id, 10)).filter(id => !isNaN(id)))];
};

// Seuls IT_ADMIN et DIRECTION ont les permissions documents (constants/roles.js) :
// un USER n'utilise aucune de ces routes côté frontend.
const canRead = requirePermission(PERMISSIONS.DOCUMENTS_READ);
const canWrite = requirePermission(PERMISSIONS.DOCUMENTS_WRITE);
const canDelete = requirePermission(PERMISSIONS.DOCUMENTS_DELETE);

router.get('/', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
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

router.get('/stats', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
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

router.get('/:id', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
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

// Téléchargement authentifié du fichier principal d'un document
router.get('/:id/fichier', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      select: { nom_fichier: true, chemin_stockage: true },
    });
    if (!document) {
      return res.status(404).json({ error: `Document avec ID ${req.params.id} non trouvé` });
    }
    return sendStoredFile(req, res, document.chemin_stockage, document.nom_fichier);
  } catch (error) {
    console.error('Erreur API téléchargement document:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier.' });
  }
});

// Téléchargement authentifié d'une pièce jointe
router.get('/pj/:pjId/fichier', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
  try {
    const pieceJointe = await prisma.pieceJointe.findUnique({
      where: { id: parseInt(req.params.pjId, 10) },
      select: { nom_fichier: true, chemin_stockage: true },
    });
    if (!pieceJointe) {
      return res.status(404).json({ error: `Pièce jointe avec ID ${req.params.pjId} non trouvée` });
    }
    return sendStoredFile(req, res, pieceJointe.chemin_stockage, pieceJointe.nom_fichier);
  } catch (error) {
    console.error('Erreur API téléchargement pièce jointe:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier.' });
  }
});

router.post('/', authenticateToken, ensureActiveUser, canWrite, handleUpload('fichier'), async (req, res) => {
  try {
    const { nom_fichier, categorie, description, id_materiels, id_marque, id_produits, id_ticket, est_public, version } = req.body;

    if (!nom_fichier || !nom_fichier.trim()) {
      return res.status(400).json({ error: 'Le nom du fichier est obligatoire.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Le fichier du document est obligatoire.' });
    }

    const chemin_stockage = `/uploads/${req.file.filename}`;
    const taille = req.file.size;
    const type_mime = getStoredMimeType(req.file.originalname);

    const user = await prisma.users.findUnique({
      where: { id_user: req.user.userId },
      select: { id_n: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const materielIds = parseIdArray(id_materiels);
    if (materielIds === null) {
      return res.status(400).json({ error: 'Format invalide pour les matériels.' });
    }

    if (materielIds.length > 0) {
      const existingMateriels = await prisma.materiels.findMany({
        where: { id_materiels: { in: materielIds } },
        select: { id_materiels: true },
      });
      const existingIds = new Set(existingMateriels.map(m => m.id_materiels));
      const invalidIds = materielIds.filter(id => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `Matériel(s) introuvable(s): ${invalidIds.join(', ')}` });
      }
    }

    const produitIds = parseIdArray(id_produits);
    if (produitIds === null) {
      return res.status(400).json({ error: 'Format invalide pour les produits.' });
    }

    if (produitIds.length > 0) {
      const existingProduits = await prisma.produits.findMany({
        where: { id_produit: { in: produitIds } },
        select: { id_produit: true },
      });
      const existingProdIds = new Set(existingProduits.map(p => p.id_produit));
      const invalidProdIds = produitIds.filter(id => !existingProdIds.has(id));
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

    // Document + liaisons créés dans une seule transaction : en cas d'échec rien
    // n'est écrit en base, et le fichier reçu est supprimé (voir handleUpload).
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
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
        select: { id: true },
      });

      if (materielIds.length > 0) {
        await tx.materielDocument.createMany({
          data: materielIds.map(id_m => ({ id_materiels: id_m, id_document: created.id })),
        });
      }

      if (produitIds.length > 0) {
        await tx.produitDocument.createMany({
          data: produitIds.map(id_p => ({ id_produit: id_p, id_document: created.id })),
        });
      }

      return created;
    });

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

router.put('/:id', authenticateToken, ensureActiveUser, canWrite, handleUpload('fichier'), async (req, res) => {
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
      type_mime = getStoredMimeType(req.file.originalname);
    }

    const materielIds = parseIdArray(id_materiels);
    if (materielIds === null) {
      return res.status(400).json({ error: 'Format invalide pour les matériels.' });
    }
    if (materielIds.length > 0) {
      const existingMateriels = await prisma.materiels.findMany({
        where: { id_materiels: { in: materielIds } },
        select: { id_materiels: true },
      });
      const existingIds = new Set(existingMateriels.map(m => m.id_materiels));
      const invalidIds = materielIds.filter(id => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `Matériel(s) introuvable(s): ${invalidIds.join(', ')}` });
      }
    }

    const produitIds = parseIdArray(id_produits);
    if (produitIds === null) {
      return res.status(400).json({ error: 'Format invalide pour les produits.' });
    }
    if (produitIds.length > 0) {
      const existingProduits = await prisma.produits.findMany({
        where: { id_produit: { in: produitIds } },
        select: { id_produit: true },
      });
      const existingProdIds = new Set(existingProduits.map(p => p.id_produit));
      const invalidProdIds = produitIds.filter(id => !existingProdIds.has(id));
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

    // Mise à jour du document et remplacement des liaisons dans une seule transaction
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          nom_fichier,
          categorie,
          description,
          chemin_stockage,
          taille,
          type_mime,
          version: version !== undefined ? parseInt(version, 10) : undefined,
          marque: parsedIdMarque ? { connect: { id_marque: parsedIdMarque } } : { disconnect: true },
          ticket: parsedIdTicket ? { connect: { idTicket: parsedIdTicket } } : { disconnect: true },
          est_public: est_public === 'true' || est_public === true,
        },
      });

      await tx.materielDocument.deleteMany({
        where: { id_document: documentId },
      });

      if (materielIds.length > 0) {
        await tx.materielDocument.createMany({
          data: materielIds.map(id_m => ({ id_materiels: id_m, id_document: documentId })),
        });
      }

      await tx.produitDocument.deleteMany({
        where: { id_document: documentId },
      });

      if (produitIds.length > 0) {
        await tx.produitDocument.createMany({
          data: produitIds.map(id_p => ({ id_produit: id_p, id_document: documentId })),
        });
      }
    });

    // Fichier remplacé : l'ancien n'est supprimé du disque qu'une fois la transaction validée
    if (req.file && existing.chemin_stockage && existing.chemin_stockage !== chemin_stockage) {
      await deleteFileIfExists(existing.chemin_stockage);
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

router.delete('/:id', authenticateToken, ensureActiveUser, canDelete, async (req, res) => {
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

    // Suppression unique en base (liaisons, accès et pièces jointes en cascade)
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Suppression des fichiers physiques (document principal + pièces jointes),
    // uniquement après la suppression effective en base
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

router.get('/:id/pj', authenticateToken, ensureActiveUser, canRead, async (req, res) => {
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

router.post('/:id/pj', authenticateToken, ensureActiveUser, canWrite, handleUpload('pj'), async (req, res) => {
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
        type_mime: getStoredMimeType(req.file.originalname),
      },
    });

    res.status(201).json(pieceJointe);
  } catch (error) {
    console.error('Erreur API upload piece jointe:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/pj/:pjId', authenticateToken, ensureActiveUser, canDelete, async (req, res) => {
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

    // Suppression du fichier physique associé, après la suppression en base
    await deleteFileIfExists(pieceJointe.chemin_stockage);

    res.json({ message: 'Pièce jointe supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur API suppression piece jointe:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
