// controllers/documentController.js
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../middleware/errorHandler.js';
import * as documentService from '../services/documentService.js';

const {
  UPLOADS_DIR,
  ALLOWED_FILE_TYPES,
  INLINE_EXTENSIONS,
  getExtension,
  resolveStoredFilePath,
  buildContentDisposition,
  buildDownloadName,
} = documentService;

// Origines du frontend autorisées à afficher un PDF dans une iframe (aperçu rapide)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000'];

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

// GET /api/documents
export const getDocuments = asyncHandler(async (req, res) => {
  try {
    res.json(await documentService.listDocuments());
  } catch (error) {
    sendError(res, error, 'GET /api/documents', 'Erreur lors de la récupération des documents.');
  }
});

// GET /api/documents/stats
export const getDocumentStats = asyncHandler(async (req, res) => {
  try {
    res.json(await documentService.getDocumentStats());
  } catch (error) {
    sendError(res, error, 'GET /api/documents/stats', 'Erreur lors de la récupération des statistiques des documents.');
  }
});

// GET /api/documents/:id
export const getDocumentById = asyncHandler(async (req, res) => {
  try {
    res.json(await documentService.getDocument(req.params.id));
  } catch (error) {
    sendError(res, error, 'GET /api/documents/:id', 'Erreur lors de la récupération du document.');
  }
});

// GET /api/documents/:id/fichier : téléchargement authentifié du fichier principal
export const downloadDocumentFile = asyncHandler(async (req, res) => {
  try {
    const document = await documentService.getDocumentFichier(req.params.id);
    return sendStoredFile(req, res, document.chemin_stockage, document.nom_fichier);
  } catch (error) {
    sendError(res, error, 'GET /api/documents/:id/fichier', 'Erreur lors du téléchargement du fichier.');
  }
});

// GET /api/documents/pj/:pjId/fichier : téléchargement authentifié d'une pièce jointe
export const downloadPieceJointeFile = asyncHandler(async (req, res) => {
  try {
    const pieceJointe = await documentService.getPieceJointeFichier(req.params.pjId);
    return sendStoredFile(req, res, pieceJointe.chemin_stockage, pieceJointe.nom_fichier);
  } catch (error) {
    sendError(res, error, 'GET /api/documents/pj/:pjId/fichier', 'Erreur lors du téléchargement du fichier.');
  }
});

// POST /api/documents (multipart, champ « fichier »)
export const createDocument = asyncHandler(async (req, res) => {
  try {
    const document = await documentService.createDocument(req.body ?? {}, req.file, req.user.userId);
    res.status(201).json(document);
  } catch (error) {
    sendError(res, error, 'POST /api/documents', 'Une erreur est survenue lors de la création du document.');
  }
});

// PUT /api/documents/:id (multipart, champ « fichier » facultatif)
export const updateDocument = asyncHandler(async (req, res) => {
  try {
    res.json(await documentService.updateDocument(req.params.id, req.body ?? {}, req.file));
  } catch (error) {
    sendError(res, error, 'PUT /api/documents/:id', 'Erreur lors de la modification du document.');
  }
});

// DELETE /api/documents/:id
export const deleteDocument = asyncHandler(async (req, res) => {
  try {
    await documentService.deleteDocument(req.params.id);
    res.json({ message: 'Document supprimé avec succès.' });
  } catch (error) {
    sendError(res, error, 'DELETE /api/documents/:id', 'Erreur lors de la suppression du document.');
  }
});

// GET /api/documents/:id/pj
export const getPiecesJointes = asyncHandler(async (req, res) => {
  try {
    res.json(await documentService.listPiecesJointes(req.params.id));
  } catch (error) {
    sendError(res, error, 'GET /api/documents/:id/pj', 'Erreur lors de la récupération des pièces jointes.');
  }
});

// POST /api/documents/:id/pj (multipart, champ « pj »)
export const addPieceJointe = asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await documentService.addPieceJointe(req.params.id, req.file));
  } catch (error) {
    sendError(res, error, 'POST /api/documents/:id/pj', "Erreur lors de l'ajout de la pièce jointe.");
  }
});

// DELETE /api/documents/pj/:pjId
export const deletePieceJointe = asyncHandler(async (req, res) => {
  try {
    await documentService.deletePieceJointe(req.params.pjId);
    res.json({ message: 'Pièce jointe supprimée avec succès.' });
  } catch (error) {
    sendError(res, error, 'DELETE /api/documents/pj/:pjId', 'Erreur lors de la suppression de la pièce jointe.');
  }
});
