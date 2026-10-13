// middleware/errorHandler.js
// Réponse d'erreur uniforme : le détail technique (Prisma, SQL, pile) reste dans
// les logs serveur, le client ne reçoit qu'un message exploitable.
import { Prisma } from '@prisma/client';

// Erreurs Prisma "attendues" → code HTTP 4xx plutôt qu'un 500
const PRISMA_HTTP = {
    P2002: [409, 'Cette valeur existe déjà.'],
    P2003: [409, "Opération impossible : l'élément est lié à d'autres données ou la référence est invalide."],
    P2025: [404, 'Élément introuvable.'],
};

/**
 * Envoie une réponse d'erreur sans exposer les messages internes.
 * - Erreur Prisma connue (P2002/P2003/P2025) → 409/409/404.
 * - Erreur métier portant un `status` 4xx (StockError, AffectationError…) → ce statut et son message.
 * - Sinon → 500 avec `fallbackMessage`.
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} context Libellé pour les logs (ex. 'GET /api/tickets').
 * @param {string} [fallbackMessage]
 */
export const sendError = (res, error, context = '', fallbackMessage = 'Erreur interne du serveur.') => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && PRISMA_HTTP[error.code]) {
        const [status, message] = PRISMA_HTTP[error.code];
        console.warn(`[${context}] ${error.code}: ${error.message}`);
        return res.status(status).json({ error: message });
    }

    const status = Number(error?.status);
    if (status >= 400 && status < 500 && error?.message) {
        return res.status(status).json({ error: error.message, ...(error.details || {}) });
    }

    console.error(`Erreur ${context}:`, error);
    return res.status(500).json({ error: fallbackMessage });
};

// Filet de sécurité pour les erreurs non interceptées (next(err), JSON invalide…)
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Corps de requête JSON invalide.' });
    }
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Requête trop volumineuse.' });
    }
    return sendError(res, err, `${req.method} ${req.originalUrl}`);
};
