// marquesRoutes.js (Version conforme à votre schéma Prisma)

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

// Route GET toutes les marques COMPLÈTES (avec URL)
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    console.log('📥 Récupération de toutes les marques...');
    
    const marques = await prisma.marques.findMany({
        select: {
            id_marque: true,
            nom_marque: true,
            url: true,
            date_modification: true,
        },
        orderBy: {
            nom_marque: 'asc',
        }
    });
    
    // Nettoyer les données avant envoi
    const cleanedMarques = marques.map(marque => ({
        id_marque: marque.id_marque,
        nom_marque: marque.nom_marque,
        url: marque.url && marque.url !== 'null' && marque.url !== 'undefined' ? marque.url : null,
        date_modification: marque.date_modification
    }));
    
    console.log(`✅ ${cleanedMarques.length} marques trouvées`);
    res.status(200).json(cleanedMarques);
  } catch (error) {
    console.error('❌ Erreur GET /:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des marques.' });
  }
});

// Route GET toutes les marques pour le SELECT
router.get('/select', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    const marques = await prisma.marques.findMany({
        select: {
            id_marque: true,
            nom_marque: true,
        },
        orderBy: {
            nom_marque: 'asc',
        }
    });
    res.status(200).json(marques);
  } catch (error) {
    console.error('Erreur GET /select:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des marques.' });
  }
});

// Route GET - Marques avec nombre d'équipements (pour DashboardMarque)
router.get('/with-count', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    console.log('📊 Récupération des marques avec comptage des équipements...');
    
    // Récupérer toutes les marques
    const marques = await prisma.marques.findMany({
      select: {
        id_marque: true,
        nom_marque: true,
        url: true,
        date_modification: true,
      },
      orderBy: {
        nom_marque: 'asc',
      }
    });
    
    // Compter le nombre d'équipements pour chaque marque
    const marquesWithCount = await Promise.all(marques.map(async (marque) => {
      const nombre_equipements = await prisma.materiels.count({
        where: {
          id_marque: marque.id_marque
        }
      });
      
      return {
        id_marque: marque.id_marque,
        nom_marque: marque.nom_marque,
        url: marque.url,
        date_modification: marque.date_modification,
        nombre_equipements: nombre_equipements
      };
    }));
    
    // Trier par nombre d'équipements décroissant
    const sortedMarques = marquesWithCount.sort((a, b) => b.nombre_equipements - a.nombre_equipements);
    
    console.log(`✅ ${sortedMarques.length} marques avec comptage retourné`);
    res.status(200).json(sortedMarques);
    
  } catch (error) {
    console.error('❌ Erreur GET /with-count:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des marques avec comptage.' });
  }
});

// Route GET - Statistiques des équipes et états (pour DashboardMarque)
router.get('/stats-equipes-etats', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    console.log('📊 Récupération des statistiques équipes et états...');
    
    // Récupérer tous les équipements avec leurs équipes et états
    // 🔥 CORRECTION : Utiliser le bon nom de champ (etat_pc au lieu de etat)
    const materiels = await prisma.materiels.findMany({
      select: {
        id_materiels: true,
        equipe: true,
        etat_pc: true,  // ✅ Changé de 'etat' à 'etat_pc'
        id_marque: true
      }
    });
    
    // Compter par équipe
    const equipeCount = {};
    let totalEquipements = materiels.length;
    
    // Compter par état
    const etatsCount = {};
    
    // Ensemble des équipes uniques
    const equipesSet = new Set();
    
    materiels.forEach(materiel => {
      // Compter par équipe
      const equipe = materiel.equipe || 'Sans équipe';
      equipeCount[equipe] = (equipeCount[equipe] || 0) + 1;
      equipesSet.add(equipe);
      
      // Compter par état - 🔥 Utiliser etat_pc
      const etat = materiel.etat_pc || 'Inconnu';  // ✅ Changé de 'etat' à 'etat_pc'
      etatsCount[etat] = (etatsCount[etat] || 0) + 1;
    });
    
    // Compter les équipements avec état défini (non null et non vide)
    const nombreAvecEtat = materiels.filter(m => m.etat_pc && m.etat_pc.trim() !== '').length;  // ✅ Changé
    
    const result = {
      nombreEquipes: equipesSet.size,
      nombreAvecEtat: nombreAvecEtat,
      etatsCount: etatsCount,
      equipeCount: equipeCount,
      totalEquipements: totalEquipements
    };
    
    console.log(`✅ Stats: ${result.nombreEquipes} équipes, ${totalEquipements} équipements`);
    console.log('📊 États trouvés:', Object.keys(etatsCount));
    res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Erreur GET /stats-equipes-etats:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques.',
      details: error.message 
    });
  }
});

// Ajoutez cette route après la route stats-equipes-etats
// Route GET - Nombre de matériels par local (pour DashboardMarque)
router.get('/materiels-by-local', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    console.log('🏢 Récupération du nombre de matériels par local...');
    
    // Récupérer tous les locaux avec le compte des matériels
    const locauxWithCount = await prisma.locaux.findMany({
      select: {
        id_local: true,
        nom_local: true,
        materiels: {
          select: {
            id_materiels: true
          }
        }
      },
      orderBy: {
        nom_local: 'asc'
      }
    });
    
    // Transformer les données pour avoir le compte par local
    const result = locauxWithCount.map(local => ({
      id_local: local.id_local,
      nom_local: local.nom_local,
      nombre_materiels: local.materiels.length
    }));
    
    // Filtrer les locaux qui ont au moins un matériel (optionnel)
    const filteredResult = result.filter(local => local.nombre_materiels > 0);
    
    console.log(`✅ ${filteredResult.length} locaux avec matériels trouvés`);
    res.status(200).json(filteredResult);
    
  } catch (error) {
    console.error('❌ Erreur GET /materiels-by-local:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques par local.',
      details: error.message 
    });
  }
});

// Route GET une marque par ID
router.get('/:id_marque', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  const { id_marque } = req.params;
  try {
    const marque = await prisma.marques.findUnique({
      where: { id_marque: parseInt(id_marque) },
      select: {
        id_marque: true,
        nom_marque: true,
        url: true,
        date_modification: true,
      }
    });
    
    if (!marque) {
      return res.status(404).json({ error: 'Marque non trouvée.' });
    }
    
    const cleanedMarque = {
      ...marque,
      url: marque.url && marque.url !== 'null' && marque.url !== 'undefined' ? marque.url : null
    };
    
    res.status(200).json(cleanedMarque);
  } catch (error) {
    console.error('❌ Erreur GET /:id_marque:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la marque.' });
  }
});

// Route POST créer une nouvelle marque (AVEC mise à jour automatique des matériels)
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { nom_marque, url, updateMateriels = true, matchingField = 'caracteristiques' } = req.body;
  
  console.log('📥 Requête POST reçue:', { nom_marque, url, updateMateriels, matchingField });
  
  if (!nom_marque || nom_marque.trim() === '') {
    return res.status(400).json({ error: 'Le nom de la marque est requis.' });
  }
  
  try {
    // Vérifier si la marque existe déjà
    const existingMarque = await prisma.marques.findFirst({
      where: { 
        nom_marque: {
          equals: nom_marque.trim(),
          mode: 'insensitive'
        }
      }
    });
    
    if (existingMarque) {
      return res.status(409).json({ error: 'Cette marque existe déjà.' });
    }
    
    // Nettoyer l'URL
    let cleanUrl = null;
    if (url && typeof url === 'string' && url.trim() !== '' && url.trim() !== 'null' && url.trim() !== 'undefined') {
      cleanUrl = url.trim();
    }
    
    // Créer la nouvelle marque
    const nouvelleMarque = await prisma.marques.create({
      data: { 
        nom_marque: nom_marque.trim(),
        url: cleanUrl,
        date_modification: new Date(),
      },
    });
    
    console.log('✅ Marque créée avec succès:', nouvelleMarque);
    
    let materielsUpdated = 0;
    let updateDetails = [];
    
    // Mettre à jour les matériels qui ont id_marque = null
    if (updateMateriels) {
      console.log(`🔍 Recherche des matériels sans marque (id_marque = null) correspondant à "${nouvelleMarque.nom_marque}"...`);
      
      const searchPattern = nouvelleMarque.nom_marque.toLowerCase();
      
      // Récupérer tous les matériels avec id_marque = null
      const materielsSansMarque = await prisma.materiels.findMany({
        where: {
          id_marque: null
        },
        select: {
          id_materiels: true,
          caracteristiques: true,
          code_pc: true
        }
      });
      
      console.log(`📊 ${materielsSansMarque.length} matériel(s) sans marque trouvé(s)`);
      
      // Filtrer les matériels qui correspondent à la marque
      const materielsACorrespondre = materielsSansMarque.filter(materiel => {
        switch(matchingField) {
          case 'caracteristiques':
            return materiel.caracteristiques && 
                   materiel.caracteristiques.toLowerCase().includes(searchPattern);
          
          case 'code_pc':
            return materiel.code_pc && 
                   materiel.code_pc.toLowerCase().includes(searchPattern);
          
          case 'tout':
            return (materiel.caracteristiques && materiel.caracteristiques.toLowerCase().includes(searchPattern)) ||
                   (materiel.code_pc && materiel.code_pc.toLowerCase().includes(searchPattern));
          
          default:
            return materiel.caracteristiques && 
                   materiel.caracteristiques.toLowerCase().includes(searchPattern);
        }
      });
      
      if (materielsACorrespondre.length > 0) {
        console.log(`🎯 ${materielsACorrespondre.length} matériel(s) potentiel(s) à mettre à jour`);
        
        const updateResult = await prisma.materiels.updateMany({
          where: {
            id_materiels: {
              in: materielsACorrespondre.map(m => m.id_materiels)
            }
          },
          data: {
            id_marque: nouvelleMarque.id_marque,
            date_modification: new Date()
          }
        });
        
        materielsUpdated = updateResult.count;
        
        updateDetails = materielsACorrespondre.map(m => ({
          id_materiels: m.id_materiels,
          caracteristiques: m.caracteristiques,
          raison: `Correspondance avec "${matchingField}" contenant "${nouvelleMarque.nom_marque}"`
        }));
        
        console.log(`✅ ${materielsUpdated} matériel(s) mis à jour avec la marque "${nouvelleMarque.nom_marque}"`);
      } else {
        console.log(`ℹ️ Aucun matériel sans marque ne correspond à "${nouvelleMarque.nom_marque}"`);
      }
    }
    
    res.status(201).json({
      id_marque: nouvelleMarque.id_marque,
      nom_marque: nouvelleMarque.nom_marque,
      url: nouvelleMarque.url,
      date_modification: nouvelleMarque.date_modification,
      materielsUpdated: materielsUpdated,
      updateDetails: updateDetails,
      message: materielsUpdated > 0 
        ? `Marque créée et ${materielsUpdated} matériel(s) ont été automatiquement associés.`
        : 'Marque créée avec succès.'
    });
    
  } catch (error) {
    console.error('❌ Erreur POST /:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Cette marque existe déjà.' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la création de la marque.' });
    }
  }
});

// Route POST créer une nouvelle marque avec mise à jour personnalisée basée sur une liste d'IDs
router.post('/with-materiels', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { nom_marque, url, materielIds = [] } = req.body;
  
  console.log('📥 Requête POST /with-materiels reçue:', { nom_marque, url, materielIdsCount: materielIds.length });
  
  if (!nom_marque || nom_marque.trim() === '') {
    return res.status(400).json({ error: 'Le nom de la marque est requis.' });
  }
  
  try {
    const existingMarque = await prisma.marques.findFirst({
      where: { 
        nom_marque: {
          equals: nom_marque.trim(),
          mode: 'insensitive'
        }
      }
    });
    
    if (existingMarque) {
      return res.status(409).json({ error: 'Cette marque existe déjà.' });
    }
    
    let cleanUrl = null;
    if (url && typeof url === 'string' && url.trim() !== '' && url.trim() !== 'null' && url.trim() !== 'undefined') {
      cleanUrl = url.trim();
    }
    
    const result = await prisma.$transaction(async (prisma) => {
      const nouvelleMarque = await prisma.marques.create({
        data: { 
          nom_marque: nom_marque.trim(),
          url: cleanUrl,
          date_modification: new Date(),
        },
      });
      
      let materielsUpdated = 0;
      
      if (materielIds && materielIds.length > 0) {
        const updateResult = await prisma.materiels.updateMany({
          where: {
            id_materiels: {
              in: materielIds
            },
            id_marque: null
          },
          data: {
            id_marque: nouvelleMarque.id_marque,
            date_modification: new Date()
          }
        });
        
        materielsUpdated = updateResult.count;
        console.log(`✅ ${materielsUpdated} matériel(s) mis à jour avec la nouvelle marque`);
      }
      
      return { nouvelleMarque, materielsUpdated };
    });
    
    res.status(201).json({
      id_marque: result.nouvelleMarque.id_marque,
      nom_marque: result.nouvelleMarque.nom_marque,
      url: result.nouvelleMarque.url,
      date_modification: result.nouvelleMarque.date_modification,
      materielsUpdated: result.materielsUpdated,
      message: `Marque créée avec succès. ${result.materielsUpdated} matériel(s) ont été associés.`
    });
    
  } catch (error) {
    console.error('❌ Erreur POST /with-materiels:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Cette marque existe déjà.' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la création de la marque.' });
    }
  }
});

// Route PUT modifier une marque
router.put('/:id_marque', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id_marque } = req.params;
  const { nom_marque, url } = req.body;
  
  if (!nom_marque || nom_marque.trim() === '') {
    return res.status(400).json({ error: 'Le nom de la marque est requis.' });
  }
  
  try {
    const existingMarque = await prisma.marques.findFirst({
      where: {
        nom_marque: {
          equals: nom_marque.trim(),
          mode: 'insensitive'
        },
        id_marque: {
          not: parseInt(id_marque)
        }
      }
    });
    
    if (existingMarque) {
      return res.status(409).json({ error: 'Une autre marque porte déjà ce nom.' });
    }
    
    let cleanUrl = null;
    if (url && typeof url === 'string' && url.trim() !== '' && url.trim() !== 'null' && url.trim() !== 'undefined') {
      cleanUrl = url.trim();
    }
    
    const marqueModifiee = await prisma.marques.update({
      where: { id_marque: parseInt(id_marque) },
      data: {
        nom_marque: nom_marque.trim(),
        url: cleanUrl,
        date_modification: new Date(),
      },
    });
    
    console.log('✏️ Marque modifiée:', marqueModifiee);
    res.status(200).json({
      id_marque: marqueModifiee.id_marque,
      nom_marque: marqueModifiee.nom_marque,
      url: marqueModifiee.url,
      date_modification: marqueModifiee.date_modification
    });
  } catch (error) {
    console.error('❌ Erreur PUT /:id_marque:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Marque non trouvée.' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la modification de la marque.' });
    }
  }
});

// Route DELETE supprimer une marque par ID
router.delete('/:id_marque', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id_marque } = req.params;
  
  try {
    const marque = await prisma.marques.findUnique({
      where: { id_marque: parseInt(id_marque) },
      include: {
        _count: {
          select: {
            materiels: true
          }
        }
      }
    });
    
    if (!marque) {
      return res.status(404).json({ error: 'Marque non trouvée.' });
    }
    
    const materielsCount = marque._count.materiels;
    
    if (materielsCount > 0) {
      console.log(`⚠️ La marque "${marque.nom_marque}" est utilisée par ${materielsCount} matériel(s). Mise à jour en cours...`);
      
      await prisma.materiels.updateMany({
        where: {
          id_marque: parseInt(id_marque)
        },
        data: {
          id_marque: null,
          date_modification: new Date()
        }
      });
      
      console.log(`✅ ${materielsCount} matériel(s) mis à jour (id_marque passé à NULL)`);
    }
    
    await prisma.marques.delete({
      where: { id_marque: parseInt(id_marque) },
    });
    
    const message = materielsCount > 0 
      ? `Marque "${marque.nom_marque}" supprimée avec succès. ${materielsCount} matériel(s) ont été mis à jour.`
      : `Marque "${marque.nom_marque}" supprimée avec succès.`;
    
    console.log(`🗑️ ${message}`);
    
    res.status(200).json({ 
      message: message,
      materielsUpdated: materielsCount,
      deletedMarque: {
        id_marque: marque.id_marque,
        nom_marque: marque.nom_marque
      }
    });
  } catch (error) {
    console.error('❌ Erreur DELETE /:id_marque:', error);
    
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Marque non trouvée.' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression de la marque.' });
    }
  }
});

// Route pour supprimer une marque et remplacer par une autre marque par défaut
router.delete('/:id_marque/replace/:default_marque_id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id_marque, default_marque_id } = req.params;
  
  try {
    const marqueToDelete = await prisma.marques.findUnique({
      where: { id_marque: parseInt(id_marque) }
    });
    
    if (!marqueToDelete) {
      return res.status(404).json({ error: 'Marque non trouvée.' });
    }
    
    const defaultMarque = await prisma.marques.findUnique({
      where: { id_marque: parseInt(default_marque_id) }
    });
    
    if (!defaultMarque) {
      return res.status(404).json({ error: 'Marque par défaut non trouvée.' });
    }
    
    const materielsCount = await prisma.materiels.count({
      where: { id_marque: parseInt(id_marque) }
    });
    
    if (materielsCount > 0) {
      console.log(`⚠️ Mise à jour de ${materielsCount} matériel(s) vers la marque par défaut "${defaultMarque.nom_marque}"`);
      
      await prisma.materiels.updateMany({
        where: { id_marque: parseInt(id_marque) },
        data: { 
          id_marque: parseInt(default_marque_id),
          date_modification: new Date()
        }
      });
    }
    
    await prisma.marques.delete({
      where: { id_marque: parseInt(id_marque) }
    });
    
    res.status(200).json({
      message: `Marque "${marqueToDelete.nom_marque}" supprimée avec succès. ${materielsCount} matériel(s) ont été reassignés à "${defaultMarque.nom_marque}".`,
      materielsUpdated: materielsCount,
      defaultMarqueUsed: defaultMarque.nom_marque
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE avec remplacement:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression avec remplacement.' });
  }
});

// Route: Mettre à jour les matériels avec une marque existante
router.put('/update-materiels/:id_marque', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id_marque } = req.params;
  const { matchingField = 'caracteristiques', searchPattern } = req.body;
  
  try {
    const marque = await prisma.marques.findUnique({
      where: { id_marque: parseInt(id_marque) }
    });
    
    if (!marque) {
      return res.status(404).json({ error: 'Marque non trouvée.' });
    }
    
    let materielsUpdated = 0;
    let updateDetails = [];
    
    if (searchPattern) {
      const materielsSansMarque = await prisma.materiels.findMany({
        where: {
          id_marque: null,
          OR: [
            { caracteristiques: { contains: searchPattern, mode: 'insensitive' } },
            { code_pc: { contains: searchPattern, mode: 'insensitive' } }
          ]
        },
        select: {
          id_materiels: true,
          caracteristiques: true
        }
      });
      
      if (materielsSansMarque.length > 0) {
        const updateResult = await prisma.materiels.updateMany({
          where: {
            id_materiels: {
              in: materielsSansMarque.map(m => m.id_materiels)
            }
          },
          data: {
            id_marque: parseInt(id_marque),
            date_modification: new Date()
          }
        });
        
        materielsUpdated = updateResult.count;
        updateDetails = materielsSansMarque;
      }
    } else {
      const searchPatternFromMarque = marque.nom_marque.toLowerCase();
      
      const materielsSansMarque = await prisma.materiels.findMany({
        where: {
          id_marque: null
        },
        select: {
          id_materiels: true,
          caracteristiques: true,
          code_pc: true
        }
      });
      
      const materielsACorrespondre = materielsSansMarque.filter(materiel => {
        switch(matchingField) {
          case 'caracteristiques':
            return materiel.caracteristiques && 
                   materiel.caracteristiques.toLowerCase().includes(searchPatternFromMarque);
          case 'code_pc':
            return materiel.code_pc && 
                   materiel.code_pc.toLowerCase().includes(searchPatternFromMarque);
          case 'tout':
            return (materiel.caracteristiques && materiel.caracteristiques.toLowerCase().includes(searchPatternFromMarque)) ||
                   (materiel.code_pc && materiel.code_pc.toLowerCase().includes(searchPatternFromMarque));
          default:
            return materiel.caracteristiques && 
                   materiel.caracteristiques.toLowerCase().includes(searchPatternFromMarque);
        }
      });
      
      if (materielsACorrespondre.length > 0) {
        const updateResult = await prisma.materiels.updateMany({
          where: {
            id_materiels: {
              in: materielsACorrespondre.map(m => m.id_materiels)
            }
          },
          data: {
            id_marque: parseInt(id_marque),
            date_modification: new Date()
          }
        });
        
        materielsUpdated = updateResult.count;
        updateDetails = materielsACorrespondre.map(m => ({
          id_materiels: m.id_materiels,
          caracteristiques: m.caracteristiques
        }));
      }
    }
    
    res.status(200).json({
      message: `${materielsUpdated} matériel(s) mis à jour avec la marque "${marque.nom_marque}"`,
      materielsUpdated,
      updateDetails
    });
    
  } catch (error) {
    console.error('❌ Erreur PUT /update-materiels/:id_marque:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des matériels.' });
  }
});


export default router;