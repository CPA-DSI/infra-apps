// controllers/marquesController.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../middleware/errorHandler.js';
import * as marquesService from '../services/marquesService.js';

// GET /api/marques : toutes les marques complètes (avec URL)
export const getMarques = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.listMarques());
  } catch (error) {
    sendError(res, error, 'GET /api/marques', 'Erreur lors de la récupération des marques.');
  }
});

// GET /api/marques/select : marques pour les listes déroulantes
export const getMarquesSelect = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.listMarquesSelect());
  } catch (error) {
    sendError(res, error, 'GET /api/marques/select', 'Erreur lors de la récupération des marques.');
  }
});

// GET /api/marques/with-count : marques avec nombre d'équipements
export const getMarquesWithCount = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.listMarquesAvecComptage());
  } catch (error) {
    sendError(res, error, 'GET /api/marques/with-count', 'Erreur lors de la récupération des marques avec comptage.');
  }
});

// GET /api/marques/stats-equipes-etats : statistiques des équipes et états
export const getStatsEquipesEtats = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.getStatsEquipesEtats());
  } catch (error) {
    sendError(res, error, 'GET /api/marques/stats-equipes-etats', 'Erreur lors de la récupération des statistiques.');
  }
});

// GET /api/marques/materiels-by-local : nombre de matériels par local
export const getMaterielsByLocal = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.getMaterielsParLocal());
  } catch (error) {
    sendError(res, error, 'GET /api/marques/materiels-by-local', 'Erreur lors de la récupération des statistiques par local.');
  }
});

// GET /api/marques/:id_marque
export const getMarqueById = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.getMarque(req.params.id_marque));
  } catch (error) {
    sendError(res, error, 'GET /api/marques/:id_marque', 'Erreur lors de la récupération de la marque.');
  }
});

// POST /api/marques : création (avec association automatique des matériels)
export const createMarque = asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await marquesService.createMarque(req.body ?? {}));
  } catch (error) {
    sendError(res, error, 'POST /api/marques', 'Erreur lors de la création de la marque.');
  }
});

// POST /api/marques/with-materiels : création associée à une liste de matériels
export const createMarqueWithMateriels = asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await marquesService.createMarqueAvecMateriels(req.body ?? {}));
  } catch (error) {
    sendError(res, error, 'POST /api/marques/with-materiels', 'Erreur lors de la création de la marque.');
  }
});

// PUT /api/marques/:id_marque
export const updateMarque = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.updateMarque(req.params.id_marque, req.body ?? {}));
  } catch (error) {
    sendError(res, error, 'PUT /api/marques/:id_marque', 'Erreur lors de la modification de la marque.');
  }
});

// DELETE /api/marques/:id_marque
export const deleteMarque = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.deleteMarque(req.params.id_marque));
  } catch (error) {
    sendError(res, error, 'DELETE /api/marques/:id_marque', 'Erreur lors de la suppression de la marque.');
  }
});

// DELETE /api/marques/:id_marque/replace/:default_marque_id
export const deleteMarqueWithReplace = asyncHandler(async (req, res) => {
  try {
    const { id_marque, default_marque_id } = req.params;
    res.status(200).json(await marquesService.deleteMarqueAvecRemplacement(id_marque, default_marque_id));
  } catch (error) {
    sendError(res, error, 'DELETE /api/marques/:id_marque/replace/:default_marque_id', 'Erreur lors de la suppression avec remplacement.');
  }
});

// PUT /api/marques/update-materiels/:id_marque
export const updateMaterielsMarque = asyncHandler(async (req, res) => {
  try {
    res.status(200).json(await marquesService.associerMateriels(req.params.id_marque, req.body ?? {}));
  } catch (error) {
    sendError(res, error, 'PUT /api/marques/update-materiels/:id_marque', 'Erreur lors de la mise à jour des matériels.');
  }
});
