// D:\infra-apps\backend-Prisma\routes\materielRoutes.js

// Remplacez 'const express = require(...)' par 'import express from ...'
import express from 'express'; // Utilisez 'import' au lieu de 'require'
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();

// Middleware pour gérer les erreurs de manière centralisée (facultatif mais recommandé)
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION));

router.get('/', async (req, res) => {
  try {
    
    // --- CORRECTION 1: Utilisation de prisma.materiels au pluriel ---
    const totalMaterielsCount = await prisma.materiels.count(); 

    // --- CORRECTION 2 & 3: Utilisation de prisma.materiels au pluriel & include correct ---
    const materielsDetails = await prisma.materiels.findMany({ 
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
  } catch (err) {
    console.error("ERREUR PRISMA FATALE DANS materielRoutes.js:", err);
    res.status(500).send("Erreur serveur interne lors de la récupération des matériels.");
  }
});

// Nouvelle route : GET /api/materiels/stats-ecrans
router.get('/stats-ecrans', async (req, res) => {
    try {
        // --- CORRECTION 4: Utilisation de prisma.materiels au pluriel ---
        const totalEcrans = await prisma.materiels.count({
            where: {
                ecran: {
                    not: null, 
                },
            },
        });

        // --- CORRECTION 5: Utilisation de prisma.materiels au pluriel ---
        const materielsAvecEcrans = await prisma.materiels.findMany({
            where: {
                ecran: {
                    not: null,
                },
            },
            select: {
                ecran: true, 
            },
        });

        const formattedData = materielsAvecEcrans.map(item => ({
            ecran: item.ecran,
            nombre_total_lignes: totalEcrans 
        }));

        res.json(formattedData);

    } catch (error) {
        console.error("Erreur API /api/materiels/stats-ecrans:", error);
        res.status(500).json({ error: "Erreur serveur interne lors de la récupération des statistiques d'écrans." });
    }
});

// Route GET /api/materiels/capacite-ssd
router.get('/capacite-ssd', async (req, res) => {
    try {
        // La requête SQL brute pour les stats d'écrans/HDD
        const query = `
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
            GROUP BY
                capacite_stockage
            ORDER BY
                nombre_total DESC;
        `;
        
        // Utilisation de $queryRawUnsafe
        const result = await prisma.$queryRawUnsafe(query); 

        // --- CORRECTION BIGINT ---
        // On mappe le résultat pour convertir explicitement 'nombre_total' en String
        const serializedResult = result.map(item => ({
            ...item,
            // Convertit le BigInt en String pour une sérialisation JSON sécurisée
            nombre_total: item.nombre_total.toString() 
        }));

        res.json(serializedResult);
    } catch (err) {
        console.error("Erreur dans /api/materiels/capacite-ssd:", err.message);
        // Le message d'erreur sera désormais plus précis dans la console si d'autres erreurs surviennent
        res.status(500).send('Erreur serveur lors de la récupération des capacités SSD/HDD');
    }
});

// Route GET /api/materiels/count-equipe
router.get('/count-equipe', async (req, res) => {
  try {
    // Utilisation d'une jointure SQL car nom_local est dans la table locaux
    const query = `
      SELECT m.equipe, l.nom_local, COUNT(*) as nombre_equipe 
      FROM materiels m
      LEFT JOIN locaux l ON m.id_local = l.id_local
      GROUP BY m.equipe, l.nom_local
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    
    // Conversion sécurisée des BigInt en String pour éviter l'erreur 500
    const serializedResult = result.map(item => ({
      equipe: item.equipe || 'Non assignée',
      nom_local: item.nom_local || 'Lieu inconnu',
      nombre_equipe: item.nombre_equipe.toString() 
    }));

    res.status(200).json(serializedResult);
  } catch (error) {
    console.error("Erreur Prisma SQL:", error);
    res.status(500).json({ message: "Erreur lors du comptage", error: error.message });
  }
});

// Route GET /api/materiels/equipe-details - Données détaillées par équipe
router.get('/equipe-details', async (req, res) => {
  try {
    const query = `
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
      ORDER BY m.equipe, m.utilisateur
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    
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
    console.error("Erreur Prisma SQL:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des détails", error: error.message });
  }
});

// Route GET /api/materiels/count-by-local
router.get('/count-by-local', async (req, res) => {
  try {
    // Requête SQL pour grouper les matériels par local
    const query = `
      SELECT l.nom_local, COUNT(m.id_materiels) as nombre_materiels
      FROM materiels m
      LEFT JOIN locaux l ON m.id_local = l.id_local
      GROUP BY l.nom_local
      ORDER BY nombre_materiels DESC
    `;
    
    const result = await prisma.$queryRawUnsafe(query);
    
    // Conversion sécurisée des BigInt en String
    const serializedResult = result.map(item => ({
      nom_local: item.nom_local || 'Non assigné',
      nombre_materiels: Number(item.nombre_materiels)
    }));

    res.status(200).json(serializedResult);
  } catch (error) {
    console.error("Erreur Prisma SQL:", error);
    res.status(500).json({ message: "Erreur lors du comptage par local", error: error.message });
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
    console.error("Erreur Backend API:", error.message);
    res.status(500).json({ error: error.message });
  }
});





export default router;
