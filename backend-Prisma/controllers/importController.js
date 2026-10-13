// controllers/importController.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../middleware/errorHandler.js';
import { importMateriels, listLocaux } from '../services/importService.js';

// POST /api/import : import Excel de l'inventaire des matériels
export const importerMateriels = asyncHandler(async (req, res) => {
    try {
        const result = await importMateriels(req.body?.items, req.user?.id_n);
        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error, 'POST /api/import', "Erreur lors de l'import.");
    }
});

// GET /api/import/locaux : liste de tous les locaux
export const getLocaux = asyncHandler(async (req, res) => {
    try {
        const locaux = await listLocaux();
        return res.json(locaux);
    } catch (error) {
        return sendError(res, error, 'GET /api/import/locaux', 'Erreur lors de la récupération des locaux.');
    }
});
