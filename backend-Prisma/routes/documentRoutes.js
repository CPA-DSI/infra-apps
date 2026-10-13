import express from 'express';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { validateIdParam } from '../middleware/validateIdParam.js';
import {
  UPLOADS_DIR,
  MAX_UPLOAD_SIZE,
  ALLOWED_FILE_TYPES,
  isAllowedUpload,
  deleteFileIfExists,
} from '../services/documentService.js';
import {
  getDocuments,
  getDocumentStats,
  getDocumentById,
  downloadDocumentFile,
  downloadPieceJointeFile,
  createDocument,
  updateDocument,
  deleteDocument,
  getPiecesJointes,
  addPieceJointe,
  deletePieceJointe,
} from '../controllers/documentController.js';

const router = express.Router();
router.param('id', validateIdParam);
router.param('pjId', validateIdParam);

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

// Seuls IT_ADMIN et DIRECTION ont les permissions documents (constants/roles.js) :
// un USER n'utilise aucune de ces routes côté frontend.
const canRead = requirePermission(PERMISSIONS.DOCUMENTS_READ);
const canWrite = requirePermission(PERMISSIONS.DOCUMENTS_WRITE);
const canDelete = requirePermission(PERMISSIONS.DOCUMENTS_DELETE);

router.get('/', authenticateToken, ensureActiveUser, canRead, getDocuments);
router.get('/stats', authenticateToken, ensureActiveUser, canRead, getDocumentStats);
router.get('/:id', authenticateToken, ensureActiveUser, canRead, getDocumentById);

// Téléchargement authentifié du fichier principal d'un document
router.get('/:id/fichier', authenticateToken, ensureActiveUser, canRead, downloadDocumentFile);

// Téléchargement authentifié d'une pièce jointe
router.get('/pj/:pjId/fichier', authenticateToken, ensureActiveUser, canRead, downloadPieceJointeFile);

router.post('/', authenticateToken, ensureActiveUser, canWrite, handleUpload('fichier'), createDocument);
router.put('/:id', authenticateToken, ensureActiveUser, canWrite, handleUpload('fichier'), updateDocument);
router.delete('/:id', authenticateToken, ensureActiveUser, canDelete, deleteDocument);

router.get('/:id/pj', authenticateToken, ensureActiveUser, canRead, getPiecesJointes);
router.post('/:id/pj', authenticateToken, ensureActiveUser, canWrite, handleUpload('pj'), addPieceJointe);
router.delete('/pj/:pjId', authenticateToken, ensureActiveUser, canDelete, deletePieceJointe);

export default router;
