// D:\infra-apps\backend-Prisma\routes\materielRoutes.js

// Remplacez 'const express = require(...)' par 'import express from ...'
import express from 'express'; // Utilisez 'import' au lieu de 'require'
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '../constants/roles.js';
import { sendError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION));

router.get('/', async (req, res) => {
  try {
    
    // --- CORRECTION 1: Utilisation de prisma.materiels au pluriel ---
    // Les postes vides (utilisateur sans PC) ne sont pas des matériels.
    const totalMaterielsCount = await prisma.materiels.count({ where: { date_suppression: null, est_vide: false } });

    // --- CORRECTION 2 & 3: Utilisation de prisma.materiels au pluriel & include correct ---
    const materielsDetails = await prisma.materiels.findMany({ 
      where: { date_suppression: null, est_vide: false },
      orderBy: {
        // Le champ id_n existe dans le schéma, on le garde.
        id_n: 'asc', 
      },
      include: {
        // Le nom de la relation est 'marque' dans le modèle Materiels, c'est correct
        marque: { 
          select: {
            nom_marque: true,
            url: true,
          }
        },
        // Le nom de la relation est 'local' dans le modèle Materiels, c'est correct
        local: true 
      },
    });

    // 3. Formater les données (inchangé)
    const formattedResults = materielsDetails.map(item => ({
      ...item, 
      marque_nom: item.marque?.nom_marque || null,
      marque_url: item.marque?.url || null,
      nombre_total_lignes: totalMaterielsCount, 
      // Mettre les objets de relation à undefined pour qu'ils ne soient pas inclus dans la réponse finale
      marque: undefined,
      local: undefined,
    }));
        
    res.status(200).json(formattedResults);
  } catch (error) {
    sendError(res, error, 'GET /api/materiels', 'Erreur serveur interne lors de la récupération des matériels.');
  }
});

// Nouvelle route : GET /api/materiels/stats-ecrans
// Lit la table ecrans (écrans affectés, en stock ou en réparation ; les écrans
// réformés sont exclus). Format inchangé pour DashboardEcran : une ligne par
// écran avec son modèle dans `ecran`, plus son statut.
router.get('/stats-ecrans', async (req, res) => {
    try {
        const ecrans = await prisma.ecran.findMany({
            where: {
                modele: { not: null },
                statut: { not: 'REFORME' },
            },
            select: { modele: true, statut: true },
        });

        const formattedData = ecrans.map(item => ({
            ecran: item.modele,
            statut: item.statut,
            nombre_total_lignes: ecrans.length
        }));

        res.json(formattedData);

    } catch (error) {
        sendError(res, error, 'GET /api/materiels/stats-ecrans', "Erreur serveur interne lors de la récupération des statistiques d'écrans.");
    }
});

// Route GET /api/materiels/capacite-ssd
router.get('/capacite-ssd', async (req, res) => {
    try {
        // La requête SQL brute pour les stats d'écrans/HDD
        // Postes réels uniquement : ni supprimés, ni fiches « Sans poste » (est_vide).
        const result = await prisma.$queryRaw`
            SELECT
                CASE
                    WHEN caracteristiques ILIKE '%SSD%' AND REGEXP_REPLACE(caracteristiques, '^(.*?)(\\d+[GM]o\\s*SSD)(.*)$', '\\2') IS NOT NULL
                         THEN REGEXP_REPLACE(caracteristiques, '^(.*?)(\\d+[GM]o\\s*SSD)(.*)$', '\\2')
                    WHEN caracteristiques ILIKE '%HDD%'
                         THEN 'HDD'
                    ELSE 'Autre/Non Spécifié' 
                END AS capacite_stockage,
                COUNT(*) AS nombre_total
            FROM
                materiels
            WHERE
                date_suppression IS NULL
                AND est_vide = false
            GROUP BY
                capacite_stockage
            ORDER BY
                nombre_total DESC;
        `;

        // --- CORRECTION BIGINT ---
        // On mappe le résultat pour convertir explicitement 'nombre_total' en String
        const serializedResult = result.map(item => ({
            ...item,
            // Convertit le BigInt en String pour une sérialisation JSON sécurisée
            nombre_total: item.nombre_total.toString() 
        }));

        res.json(serializedResult);
    } catch (error) {
        sendError(res, error, 'GET /api/materiels/capacite-ssd', 'Erreur serveur lors de la récupération des capacités SSD/HDD');
    }
});

// Route GET /api/materiels/count-equipe
router.get('/count-equipe', async (req, res) => {
  try {
    // Utilisation d'une jointure SQL car nom_local est dans la table locaux
    // Les fiches « Sans poste » (est_vide) ne sont pas des postes : exclues.
    const result = await prisma.$queryRaw`
      SELECT m.equipe, l.nom_local, COUNT(*) as nombre_equipe 
      FROM materiels m
      LEFT JOIN locaux l ON m.id_local = l.id_local
      WHERE m.date_suppression IS NULL
        AND m.est_vide = false
      GROUP BY m.equipe, l.nom_local
    `;
    
    // Conversion sécurisée des BigInt en String pour éviter l'erreur 500
    const serializedResult = result.map(item => ({
      equipe: item.equipe || 'Non assignée',
      nom_local: item.nom_local || 'Lieu inconnu',
      nombre_equipe: item.nombre_equipe.toString() 
    }));

    res.status(200).json(serializedResult);
  } catch (error) {
    sendError(res, error, 'GET /api/materiels/count-equipe', 'Erreur lors du comptage');
  }
});

// Route GET /api/materiels/equipe-details - Données détaillées par équipe
router.get('/equipe-details', async (req, res) => {
  try {
    // Les fiches « Sans poste » (est_vide) ne sont pas des postes : exclues.
    const result = await prisma.$queryRaw`
      SELECT 
        m.id_materiels,
        m.utilisateur,
        m.equipe,
        m.code_pc,
        m.caracteristiques,
        m.etat_pc,
        m.salle,
        m.etat_batterie,
        m.ecran,
        m.code_ecran,
        m.hdmi,
        m.clavier,
        m.lan,
        m.usb,
        m.date_pc,
        m.commentaire,
        m.est_actif,
        l.nom_local,
        mr.nom_marque
      FROM materiels m
      LEFT JOIN locaux l ON m.id_local = l.id_local
      LEFT JOIN marques mr ON m.id_marque = mr.id_marque
      WHERE m.date_suppression IS NULL
        AND m.est_vide = false
      ORDER BY m.equipe, m.utilisateur
    `;
    
    // Conversion sécurisée des BigInt en Number et gestion des dates
    const serializedResult = result.map(item => ({
      id_materiels: Number(item.id_materiels),
      utilisateur: item.utilisateur || 'Non assigné',
      equipe: item.equipe || 'Non assignée',
      code_pc: item.code_pc || '-',
      caracteristiques: item.caracteristiques || '-',
      etat_pc: item.etat_pc || 'Non défini',
      salle: item.salle || '-',
      etat_batterie: item.etat_batterie || '-',
      ecran: item.ecran || '-',
      code_ecran: item.code_ecran || '-',
      hdmi: item.hdmi === true,
      clavier: item.clavier === true,
      lan: item.lan === true,
      usb: item.usb === true,
      date_pc: item.date_pc ? new Date(item.date_pc).toISOString().split('T')[0] : '-',
      commentaire: item.commentaire || '-',
      est_actif: item.est_actif,
      nom_local: item.nom_local || 'Non localisé',
      nom_marque: item.nom_marque || 'Non définie'
    }));

    res.status(200).json(serializedResult);
  } catch (error) {
    sendError(res, error, 'GET /api/materiels/equipe-details', 'Erreur lors de la récupération des détails');
  }
});

// Route GET /api/materiels/count-by-local
router.get('/count-by-local', async (req, res) => {
  try {
    // Requête SQL pour grouper les matériels par local
    // Les fiches « Sans poste » (est_vide) ne sont pas des postes : exclues.
    const result = await prisma.$queryRaw`
      SELECT l.nom_local, COUNT(m.id_materiels) as nombre_materiels
      FROM materiels m
      LEFT JOIN locaux l ON m.id_local = l.id_local
      WHERE m.date_suppression IS NULL
        AND m.est_vide = false
      GROUP BY l.nom_local
      ORDER BY nombre_materiels DESC
    `;
    
    // Conversion sécurisée des BigInt en String
    const serializedResult = result.map(item => ({
      nom_local: item.nom_local || 'Non assigné',
      nombre_materiels: Number(item.nombre_materiels)
    }));

    res.status(200).json(serializedResult);
  } catch (error) {
    sendError(res, error, 'GET /api/materiels/count-by-local', 'Erreur lors du comptage par local');
  }
});

router.get('/mail-count', async (req, res) => {
  try {
    const allUsers = await prisma.Users.findMany({
      include: { emails: true }
    });

    const rfcUserIds = new Set();
    const cpaUserIds = new Set();

    for (const user of allUsers) {
      for (const e of user.emails || []) {
        if (e.email.endsWith('@rfc-production.com')) rfcUserIds.add(user.id_user);
        if (e.email.endsWith('@cpa-experts.com')) cpaUserIds.add(user.id_user);
      }
    }

    const countRFC = rfcUserIds.size;
    const countCPA = cpaUserIds.size;

    const totalEmails = countRFC + countCPA;

    res.json({
      countRFC,
      countCPA,
      totalEmails,
      details: [
        { label: 'Mail RFC', count: countRFC },
        { label: 'Mail CPA', count: countCPA }
      ]
    });
  } catch (error) {
    sendError(res, error, 'GET /api/materiels/mail-count');
  }
});





export default router;
