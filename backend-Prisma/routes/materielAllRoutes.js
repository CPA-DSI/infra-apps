// src/routes/materielAllRoutes.js 
import express from 'express'; // Utilisez 'import' au lieu de 'require'
//const { prisma } = require('../server.js'); // Le chemin relatif vers server.js
import { PrismaClient } from '@prisma/client'; 

import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';
import { encryptPassMail } from '../services/passMailCrypto.js';

const prisma = new PrismaClient();

const router = express.Router();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ===============================================
// ROUTES CRUD POUR LE MODÈLE MATERIEL
// (Ces routes sont relatives et fonctionneront sous /api/materiels_all)
// ===============================================

// 1. GET all materiels (URL complète: /api/materiels_all/)
router.get('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    let where = {};
    if (userRole === 'USER') {
        const currentUser = await prisma.users.findUnique({
            where: { id_user: userId },
            select: { id_n: true },
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        where = { id_n: currentUser.id_n };
    }

    // 1. On récupère les données avec les relations incluses
    const materielsAvecRelations = await prisma.Materiels.findMany({
        where,
        include: {
            local: true,  
            marque: true, 
            _count: {
                select: {
                    documents_lies: true,
                },
            },
        },
        orderBy: {
            id_n: 'asc' // Remplacez 'nom' par le champ souhaité (ex: 'id', 'date_achat', etc.)
        }
    });

    // 2. On reformate le tableau de résultats pour "aplatir" les données
    const materielsReformates = materielsAvecRelations.map(materiel => {
        return {
            ...materiel,
            // Utilisation d'un fallback 'Non assigné' si la relation est nulle
            nom_local: materiel.local ? materiel.local.nom_local : 'Non assigné',
            nom_marque: materiel.marque ? materiel.marque.nom_marque : 'Non assigné',
            url: materiel.marque ? materiel.marque.url : 'Non assigné',
            documents_count: materiel._count?.documents_lies || 0,
            // On supprime les objets internes pour nettoyer la réponse finale
            local: undefined, 
            marque: undefined,
            _count: undefined,
            documents_lies: undefined,
        };
    });
    
    // 3. On renvoie le nouveau tableau reformaté
    res.json(materielsReformates);
}));


// 1bis. GET technicians (équipe Informatique DSI) pour l'assignation de tickets
// Accessible à tout utilisateur actif authentifié (liste minimale, sans données d'équipement sensibles)
router.get('/technicians', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const technicians = await prisma.Materiels.findMany({
        where: { equipe: 'Informatique DSI' },
        select: { id_n: true, utilisateur: true, equipe: true, local: { select: { nom_local: true } } },
        orderBy: { id_n: 'asc' },
    });

    const uniqueTechnicians = Array.from(
        new Map(technicians.map(t => [t.id_n, {
            id_n: t.id_n,
            utilisateur: t.utilisateur,
            equipe: t.equipe,
            nom_local: t.local?.nom_local || null,
        }])).values()
    );

    res.json(uniqueTechnicians);
}));

// 2. GET materiel by ID (URL complète: /api/materiels_all/:id)
router.get('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // --- CORRECTION APPLIQUÉE ICI ---
    
    // 1. Convertir l'ID de l'URL (string) en nombre entier (integer)
    const materielId = parseInt(id, 10); 

    // 2. Valider si la conversion a réussi (pour éviter les erreurs si l'URL est /api/materiels_all/abc)
    if (isNaN(materielId)) {
        res.status(400).json({ error: "L'identifiant fourni n'est pas valide." });
        return; // Arrête l'exécution de la fonction
    }

    const userRole = req.user?.role;
    const userId = req.user?.userId;

    let where = { id_materiels: materielId };
    if (userRole === 'USER') {
        const currentUser = await prisma.users.findUnique({
            where: { id_user: userId },
            select: { id_n: true },
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        where.id_n = currentUser.id_n;
    }

    // 3. Effectuer la requête Prisma dans un bloc try/catch (asyncHandler peut aussi gérer ça)
    const materiel = await prisma.Materiels.findUnique({
        where: {
            // Utilisation de la variable materielId correctement déclarée et typée
            ...where,
        },
    });

    // 4. Gérer le cas où aucun matériel n'est trouvé
    if (!materiel) {
        res.status(404).json({ error: `Matériel avec l'ID ${materielId} non trouvé.` });
        return; // Arrête l'exécution de la fonction
    }
    
    // 5. Renvoyer le résultat si tout va bien
    res.json(materiel);
    
    // --- FIN DE LA CORRECTION ---
}));

// 3. POST create new materiel (URL complète: /api/materiels_all/)
router.post('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    const { 
        id_materiels, // Ignoré (auto-incrément)
        nom_marque,   // Jointure ignorée
        nom_local,    // Jointure ignorée
        user,         // Objet relationnel ignoré
        marque,
        local,
        ...rawData 
    } = req.body;

    // 1. Nettoyage et formatage des données (identique à l'update)
    const dataToCreate = {};
    const fields = [
        'utilisateur', 'id_n', 'equipe', 'date_pc', 'date_ecran', 'caracteristiques', 
        'code_pc', 'ecran', 'code_ecran', 'hdmi', 'clavier', 'lan', 
        'usb', 'etat_pc', 'salle', 'mdp_pc', 'mdp_admin', 
        'etat_batterie', 'commentaire', 'est_actif', 'id_marque', 'id_local', 'date_modification'
    ];

    fields.forEach(field => {
        if (rawData[field] !== undefined) {
            let value = rawData[field];
            if (['id_n', 'id_marque', 'id_local'].includes(field)) {
                dataToCreate[field] = (value !== null && value !== "") ? parseInt(value, 10) : null;
            } else if (['date_pc', 'date_ecran', 'date_modification'].includes(field)) {
                dataToCreate[field] = value ? new Date(value) : null;
            } else if (['hdmi', 'clavier', 'lan', 'usb'].includes(field)) {
                dataToCreate[field] = value === true || value === 'true';
            } else {
                dataToCreate[field] = value === "" ? null : value;
            }
        }
    });

    // Valeur par défaut pour utilisateur obligatoire
    if (!dataToCreate.utilisateur || dataToCreate.utilisateur === null) {
        dataToCreate.utilisateur = 'Non défini';
    }

    console.log("--- Début synchronisation POST ---");

    // 2. SYNCHRONISATION : Création de l'utilisateur si id_n est fourni
    if (dataToCreate.id_n) {
        const userExists = await prisma.Users.findUnique({ 
            where: { id_n: dataToCreate.id_n } 
        });
        
        if (!userExists) {
            console.log(`🛠️ Création du parent Users ${dataToCreate.id_n} pour l'ajout du matériel.`);
            
            // Hachage du mot de passe par défaut
            const hashedPass = await bcrypt.hash('123456789', 12);
            
            await prisma.Users.create({
                data: {
                    id_n: dataToCreate.id_n,
                    emails: {
                        create: [
                            { email: `rfc_${dataToCreate.id_n}@rfc-production.com`, password: hashedPass, pass_mail: encryptPassMail('default_pass'), is_primary: true },
                            { email: `cpa_${dataToCreate.id_n}@cpa-experts.com`, password: hashedPass, pass_mail: encryptPassMail('default_pass'), is_primary: false }
                        ]
                    },
                    role: 'USER'
                }
            });
             console.log("✅ Parent Users créé.");
        }
    }

    // 3. CRÉATION DU MATÉRIEL
    try {
        // Utiliser createMany au lieu de create pour éviter les problèmes de relation
        const materiel = await prisma.materiels.createMany({
            data: [dataToCreate],
        });
        
        // Récupérer le matériel créé pour le retourner
        const createdMateriel = await prisma.materiels.findFirst({
            where: { code_pc: dataToCreate.code_pc },
            orderBy: { id_materiels: 'desc' }
        });
        
        res.status(201).json({ message: 'Matériel ajouté avec succès', materiel: createdMateriel });
    } catch (error) {
        console.error("Erreur lors de la création du matériel:", error);
        
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Contrainte d'unicité violée (ex: id_n ou code_pc déjà utilisé)." });
        }
        // Renvoyer le message d'erreur réel pour le débogage
        res.status(500).json({ error: `Erreur interne lors de la création: ${error.message}` });
    }
}));

// 4. PUT update materiel (URL complète: /api/materiels_all/:id)
router.put('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    const { 
        id_materiels, nom_marque, nom_local, user, marque, local, url, 
        ...rawData 
    } = req.body;

    const dataToUpdate = {};
    const fields = [
        'utilisateur', 'id_n', 'equipe', 'date_pc', 'date_ecran', 'caracteristiques', 
        'code_pc', 'ecran', 'code_ecran', 'hdmi', 'clavier', 'lan', 
        'usb', 'etat_pc', 'salle', 'mdp_pc', 'mdp_admin', 
        'etat_batterie', 'commentaire', 'est_actif', 'id_marque', 'id_local', 
        'date_modification'
    ];

    fields.forEach(field => {
        if (rawData[field] !== undefined) {
            let value = rawData[field];
            if (['id_n', 'id_marque', 'id_local'].includes(field)) {
                const parsed = (value !== null && value !== "") ? parseInt(value, 10) : null;
                dataToUpdate[field] = isNaN(parsed) ? null : parsed;
            } else if (['date_pc', 'date_ecran', 'date_modification'].includes(field)) {
                dataToUpdate[field] = value ? new Date(value) : null;
            } else if (['hdmi', 'clavier', 'lan', 'usb'].includes(field)) {
                dataToUpdate[field] = value === true || value === 'true';
            } else {
                dataToUpdate[field] = value === "" ? null : value;
            }
        }
    });

    // Valeur par défaut pour utilisateur obligatoire
    if (dataToUpdate.utilisateur !== undefined && (!dataToUpdate.utilisateur || dataToUpdate.utilisateur === null)) {
        dataToUpdate.utilisateur = 'Non défini';
    }

    console.log("--- Début du diagnostic et synchronisation ---");

    if (dataToUpdate.id_marque) {
        const marqueExists = await prisma.Marques.findUnique({ where: { id_marque: dataToUpdate.id_marque } });
        if (!marqueExists) return res.status(400).json({ error: `Marque ID ${dataToUpdate.id_marque} inexistante.` });
    }

    if (dataToUpdate.id_local) {
        const localExists = await prisma.Locaux.findUnique({ where: { id_local: dataToUpdate.id_local } });
        if (!localExists) return res.status(400).json({ error: `Local ID ${dataToUpdate.id_local} inexistant.` });
    }

    if (dataToUpdate.id_n !== undefined && dataToUpdate.id_n !== null) {
        const existingMateriel = await prisma.materiels.findUnique({
            where: { id_materiels: parseInt(id) },
        });
        const oldIdN = existingMateriel?.id_n;

        if (dataToUpdate.id_n !== oldIdN) {
            if (oldIdN !== null && oldIdN !== undefined) {
                const oldUser = await prisma.Users.findUnique({ where: { id_n: oldIdN } });
                if (oldUser) {
                    const conflict = await prisma.Users.findUnique({ where: { id_n: dataToUpdate.id_n } });
                    if (conflict && conflict.id_user !== oldUser.id_user) {
                        console.log(`⚠️ Conflit Users.id_n: ${dataToUpdate.id_n} existe déjà (user ${conflict.id_user}), mise à jour ignorée`);
                    } else {
                        await prisma.Users.update({
                            where: { id_n: oldIdN },
                            data: { id_n: dataToUpdate.id_n },
                        });
                        console.log(`✅ Users.id_n mis à jour: ${oldIdN} -> ${dataToUpdate.id_n}`);
                    }
                }
            }
        }
    }

    try {
        const materiel = await prisma.materiels.update({
            where: { id_materiels: parseInt(id) },
            data: dataToUpdate,
        });
        
        res.json({ message: 'Matériel mis à jour (id_n synchronisé)', materiel });
    } catch (error) {
        console.error("Erreur Prisma détaillée:", error);
        if (error.code === 'P2002') return res.status(400).json({ error: "Cet id_n est déjà assigné à un autre matériel." });
        res.status(500).json({ error: `Erreur interne lors de la mise à jour: ${error.message}` });
    }
}));

// 5. DELETE materiel (URL complète: /api/materiels_all/:id)
router.delete('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    await prisma.Materiels.delete({
        where: { id_materiels: parseInt(id) },
    });
    res.status(200).json({ message: 'Matériel supprimé avec succès.' });
}));

export default router; // N'oubliez pas d'exporter votre routeur à la fin
