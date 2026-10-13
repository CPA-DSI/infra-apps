// services/documentService.js
// Documents et pièces jointes : stockage des fichiers dans uploads/, types
// acceptés, liaisons (matériels, produits, marque, ticket) et accès Prisma.
import prisma from '../prismaClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export class DocumentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'DocumentError';
    this.status = status;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.join(__dirname, '../uploads');
// multer.diskStorage ne crée pas le dossier de destination lui-même
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
export const INLINE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);

export const getExtension = (filename = '') => path.extname(filename).slice(1).toLowerCase();

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

// Supprime un fichier physique du dossier uploads si présent (ignore l'absence)
export const deleteFileIfExists = async (cheminStockage) => {
  const fullPath = resolveStoredFilePath(cheminStockage);
  if (!fullPath) return;
  try {
    await fs.promises.unlink(fullPath);
  } catch (e) {
    // Le fichier est déjà absent du disque, on ignore silencieusement
  }
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

// Relations renvoyées avec un document (liste et détail)
const DOCUMENT_INCLUDE = {
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
};

// Après création/modification : mêmes relations, sans les pièces jointes
const { pieces_jointes: _pj, ...DOCUMENT_INCLUDE_SANS_PJ } = DOCUMENT_INCLUDE;

const documentIntrouvable = (id) => new DocumentError(`Document avec ID ${id} non trouvé`, 404);
const pieceJointeIntrouvable = (id) => new DocumentError(`Pièce jointe avec ID ${id} non trouvée`, 404);

/**
 * Valide les liaisons envoyées dans le FormData (matériels, produits, marque,
 * ticket) et vérifie leur existence en base.
 * @returns {Promise<{ materielIds: number[], produitIds: number[], parsedIdMarque: number|null, parsedIdTicket: number|null }>}
 */
const validerLiaisons = async ({ id_materiels, id_produits, id_marque, id_ticket }) => {
  const materielIds = parseIdArray(id_materiels);
  if (materielIds === null) {
    throw new DocumentError('Format invalide pour les matériels.', 400);
  }
  if (materielIds.length > 0) {
    const existingMateriels = await prisma.materiels.findMany({
      where: { id_materiels: { in: materielIds } },
      select: { id_materiels: true },
    });
    const existingIds = new Set(existingMateriels.map(m => m.id_materiels));
    const invalidIds = materielIds.filter(id => !existingIds.has(id));
    if (invalidIds.length > 0) {
      throw new DocumentError(`Matériel(s) introuvable(s): ${invalidIds.join(', ')}`, 400);
    }
  }

  const produitIds = parseIdArray(id_produits);
  if (produitIds === null) {
    throw new DocumentError('Format invalide pour les produits.', 400);
  }
  if (produitIds.length > 0) {
    const existingProduits = await prisma.produits.findMany({
      where: { id_produit: { in: produitIds } },
      select: { id_produit: true },
    });
    const existingProdIds = new Set(existingProduits.map(p => p.id_produit));
    const invalidProdIds = produitIds.filter(id => !existingProdIds.has(id));
    if (invalidProdIds.length > 0) {
      throw new DocumentError(`Produit(s) introuvable(s): ${invalidProdIds.join(', ')}`, 400);
    }
  }

  const parsedIdMarque = id_marque ? parseInt(id_marque, 10) : null;
  if (id_marque && (isNaN(parsedIdMarque) || parsedIdMarque < 1)) {
    throw new DocumentError('Identifiant de marque invalide.', 400);
  }
  if (parsedIdMarque) {
    const marqueExists = await prisma.marques.findUnique({ where: { id_marque: parsedIdMarque } });
    if (!marqueExists) {
      throw new DocumentError(`Marque avec ID ${parsedIdMarque} introuvable.`, 404);
    }
  }

  const parsedIdTicket = id_ticket ? parseInt(id_ticket, 10) : null;
  if (id_ticket && (isNaN(parsedIdTicket) || parsedIdTicket < 1)) {
    throw new DocumentError('Identifiant de ticket invalide.', 400);
  }
  if (parsedIdTicket) {
    const ticketExists = await prisma.ticket.findUnique({ where: { idTicket: parsedIdTicket } });
    if (!ticketExists) {
      throw new DocumentError(`Ticket avec ID ${parsedIdTicket} introuvable.`, 404);
    }
  }

  return { materielIds, produitIds, parsedIdMarque, parsedIdTicket };
};

export function listDocuments() {
  return prisma.document.findMany({
    include: DOCUMENT_INCLUDE,
    orderBy: {
      date_upload: 'desc',
    },
  });
}

export async function getDocumentStats() {
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

  return {
    totalDocuments,
    totalPiecesJointes,
    documentsAvecPj: avecPjCount,
    documentsSansPj,
    documentsPublics,
    documentsPrives,
    byCategory: byCategory.map(c => ({ categorie: c.categorie, count: c._count.id })),
  };
}

export async function getDocument(id) {
  const document = await prisma.document.findUnique({
    where: { id: parseInt(id, 10) },
    include: DOCUMENT_INCLUDE,
  });
  if (!document) throw documentIntrouvable(id);
  return document;
}

// Nom et emplacement du fichier principal d'un document (téléchargement)
export async function getDocumentFichier(id) {
  const document = await prisma.document.findUnique({
    where: { id: parseInt(id, 10) },
    select: { nom_fichier: true, chemin_stockage: true },
  });
  if (!document) throw documentIntrouvable(id);
  return document;
}

// Nom et emplacement du fichier d'une pièce jointe (téléchargement)
export async function getPieceJointeFichier(pjId) {
  const pieceJointe = await prisma.pieceJointe.findUnique({
    where: { id: parseInt(pjId, 10) },
    select: { nom_fichier: true, chemin_stockage: true },
  });
  if (!pieceJointe) throw pieceJointeIntrouvable(pjId);
  return pieceJointe;
}

/**
 * Crée un document à partir du fichier reçu par multer.
 * @param {object} body Champs du FormData.
 * @param {Express.Multer.File|undefined} file
 * @param {number} userId id_user de l'utilisateur connecté (uploader).
 */
export async function createDocument(body, file, userId) {
  const { nom_fichier, categorie, description, est_public, version } = body;

  if (!nom_fichier || !nom_fichier.trim()) {
    throw new DocumentError('Le nom du fichier est obligatoire.', 400);
  }

  if (!file) {
    throw new DocumentError('Le fichier du document est obligatoire.', 400);
  }

  const chemin_stockage = `/uploads/${file.filename}`;
  const taille = file.size;
  const type_mime = getStoredMimeType(file.originalname);

  const user = await prisma.users.findUnique({
    where: { id_user: userId },
    select: { id_n: true },
  });

  if (!user) {
    throw new DocumentError('Utilisateur non trouvé.', 404);
  }

  const { materielIds, produitIds, parsedIdMarque, parsedIdTicket } = await validerLiaisons(body);

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

  return prisma.document.findUnique({
    where: { id: document.id },
    include: DOCUMENT_INCLUDE_SANS_PJ,
  });
}

/**
 * Met à jour un document ; le fichier est remplacé si un nouveau est reçu.
 * @param {string|number} id
 * @param {object} body Champs du FormData.
 * @param {Express.Multer.File|undefined} file
 */
export async function updateDocument(id, body, file) {
  const { nom_fichier, categorie, description, est_public, version } = body;

  const documentId = parseInt(id, 10);

  const existing = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!existing) throw documentIntrouvable(documentId);

  let chemin_stockage = existing.chemin_stockage;
  let taille = existing.taille;
  let type_mime = existing.type_mime;

  if (file) {
    chemin_stockage = `/uploads/${file.filename}`;
    taille = file.size;
    type_mime = getStoredMimeType(file.originalname);
  }

  const { materielIds, produitIds, parsedIdMarque, parsedIdTicket } = await validerLiaisons(body);

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
  if (file && existing.chemin_stockage && existing.chemin_stockage !== chemin_stockage) {
    await deleteFileIfExists(existing.chemin_stockage);
  }

  return prisma.document.findUnique({
    where: { id: documentId },
    include: DOCUMENT_INCLUDE_SANS_PJ,
  });
}

export async function deleteDocument(id) {
  const documentId = parseInt(id, 10);

  const existing = await prisma.document.findUnique({
    where: { id: documentId },
    include: { pieces_jointes: true },
  });

  if (!existing) throw documentIntrouvable(id);

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
}

export function listPiecesJointes(id) {
  return prisma.pieceJointe.findMany({
    where: { id_document: parseInt(id, 10) },
    orderBy: { date_upload: 'desc' },
  });
}

export async function addPieceJointe(id, file) {
  const documentId = parseInt(id, 10);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) throw documentIntrouvable(id);

  if (!file) {
    throw new DocumentError('Aucun fichier fourni.', 400);
  }

  return prisma.pieceJointe.create({
    data: {
      id_document: documentId,
      nom_fichier: file.originalname,
      chemin_stockage: `/uploads/${file.filename}`,
      taille: file.size,
      type_mime: getStoredMimeType(file.originalname),
    },
  });
}

export async function deletePieceJointe(pjId) {
  const pieceJointeId = parseInt(pjId, 10);

  const pieceJointe = await prisma.pieceJointe.findUnique({
    where: { id: pieceJointeId },
  });

  if (!pieceJointe) throw pieceJointeIntrouvable(pjId);

  await prisma.pieceJointe.delete({
    where: { id: pieceJointeId },
  });

  // Suppression du fichier physique associé, après la suppression en base
  await deleteFileIfExists(pieceJointe.chemin_stockage);
}
