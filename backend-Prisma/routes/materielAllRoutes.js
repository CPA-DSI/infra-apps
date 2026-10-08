// src/routes/materielAllRoutes.js 
import express from 'express'; // Utilisez 'import' au lieu de 'require'
//const { prisma } = require('../server.js'); // Le chemin relatif vers server.js
import { PrismaClient } from '@prisma/client'; 

import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '../constants/roles.js';
import { encryptPassMail } from '../services/passMailCrypto.js';
import {
    affecterPC,
    ETAT_REMIS_EN_SERVICE,
    ETAT_SANS_POSTE,
    ouvrirAffectationInitiale,
    rattacherEcranParCode,
    retirerPoste,
    repondreErreurAffectation,
} from '../services/affectationService.js';

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

    // Les postes supprimés (suppression logique) ne sont plus listés.
    let where = { date_suppression: null };
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

    // 1. On récupère les données avec les relations incluses
    const materielsAvecRelations = await prisma.Materiels.findMany({
        where,
        include: {
            local: true,  
            marque: true, 
            ecran_actuel: { select: { id_ecran: true, statut: true } },
            _count: {
                select: {
                    documents_lies: true,
                },
            },
        },
        orderBy: {
            // Les postes en stock (id_n null) en tête, sinon PostgreSQL les relègue en dernière page
            id_n: { sort: 'asc', nulls: 'first' }
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
            id_ecran: materiel.ecran_actuel?.id_ecran || null,
            // On supprime les objets internes pour nettoyer la réponse finale
            local: undefined, 
            marque: undefined,
            _count: undefined,
            documents_lies: undefined,
            ecran_actuel: undefined,
        };
    });
    
    // 3. On renvoie le nouveau tableau reformaté
    res.json(materielsReformates);
}));


// 1bis. GET technicians (équipe Informatique DSI) pour l'assignation de tickets
// Accessible à tout utilisateur actif authentifié (liste minimale, sans données d'équipement sensibles)
router.get('/technicians', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const technicians = await prisma.Materiels.findMany({
        where: { equipe: 'Informatique DSI', date_suppression: null },
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

    let where = { id_materiels: materielId, date_suppression: null };
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

    // 3. CRÉATION DU MATÉRIEL, de son affectation initiale et de son écran.
    // L'écran est géré par la table ecrans : on retire ses champs de la fiche,
    // rattacherEcranParCode remplit ensuite les colonnes de transition.
    const { ecran, code_ecran, date_ecran, ...dataMateriel } = dataToCreate;

    try {
        const createdMateriel = await prisma.$transaction(async (tx) => {
            const materiel = await tx.materiels.create({ data: dataMateriel });
            await ouvrirAffectationInitiale(tx, materiel, req.user?.id_n);
            await rattacherEcranParCode(tx, materiel.id_materiels, { code_ecran, modele: ecran, date_ecran }, req.user?.id_n, 'Création du poste');
            return tx.materiels.findUnique({ where: { id_materiels: materiel.id_materiels } });
        });

        res.status(201).json({ message: 'Matériel ajouté avec succès', materiel: createdMateriel });
    } catch (error) {
        if (error.code === 'P2002') {
            console.error("Erreur lors de la création du matériel:", error);
            return res.status(400).json({ error: "Cet utilisateur a déjà un poste (N° Matricule déjà utilisé)." });
        }
        repondreErreurAffectation(res, error);
    }
}));

// GET /api/materiels_all/affectation/beneficiaires
// Liste légère des utilisateurs pour le choix du bénéficiaire d'une
// affectation (évite /api/users qui renvoie les mots de passe mail).
router.get('/affectation/beneficiaires', authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION), asyncHandler(async (req, res) => {
    const users = await prisma.users.findMany({
        select: {
            id_n: true,
            is_active: true,
            materiel: { select: { id_materiels: true, utilisateur: true, equipe: true, code_pc: true, est_vide: true } },
            emails: { select: { email: true, is_primary: true } },
        },
        orderBy: { id_n: 'asc' },
    });

    res.json(users.map(u => ({
        id_n: u.id_n,
        is_active: u.is_active,
        nom: u.materiel?.utilisateur || null,
        equipe: u.materiel?.equipe || null,
        email: (u.emails.find(e => e.is_primary) || u.emails[0])?.email || null,
        // Un poste vide n'est pas un poste : l'utilisateur peut recevoir un PC.
        poste: u.materiel && !u.materiel.est_vide ? { id_materiels: u.materiel.id_materiels, code_pc: u.materiel.code_pc } : null,
        poste_vide: Boolean(u.materiel?.est_vide),
    })));
}));

// POST /api/materiels_all/:id/affecter
// Body : { id_n (null = stock), utilisateur, equipe, id_local?, motif?, etat_remise?, commentaire? }
router.post('/:id/affecter', authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION), asyncHandler(async (req, res) => {
    const id_materiels = parseInt(req.params.id, 10);
    if (isNaN(id_materiels)) {
        return res.status(400).json({ error: "L'identifiant fourni n'est pas valide." });
    }

    const { id_n, utilisateur, equipe, id_local, motif, etat_remise, commentaire } = req.body;
    const cibleIdN = id_n === null || id_n === undefined || id_n === '' ? null : parseInt(id_n, 10);
    if (Number.isNaN(cibleIdN)) {
        return res.status(400).json({ error: 'N° Matricule invalide.' });
    }
    const localId = id_local === undefined ? undefined : (id_local === null || id_local === '' ? null : parseInt(id_local, 10));

    try {
        const materiel = await prisma.$transaction((tx) => affecterPC(tx, {
            id_materiels, id_n: cibleIdN, utilisateur, equipe, id_local: localId, motif, etat_remise, commentaire,
        }, req.user?.id_n));
        res.json({ message: cibleIdN ? 'PC réaffecté avec succès.' : 'PC mis en stock.', materiel });
    } catch (error) {
        repondreErreurAffectation(res, error);
    }
}));

// GET /api/materiels_all/:id/affectations
// Historique des affectations du poste : PC et écrans passés par ce poste.
router.get('/:id/affectations', authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION), asyncHandler(async (req, res) => {
    const id_materiels = parseInt(req.params.id, 10);
    if (isNaN(id_materiels)) {
        return res.status(400).json({ error: "L'identifiant fourni n'est pas valide." });
    }

    const affectations = await prisma.affectationMateriel.findMany({
        where: { id_materiels },
        include: { ecran: { select: { code_ecran: true, modele: true } } },
        orderBy: [{ date_debut: 'desc' }, { id_affectation: 'desc' }],
    });
    res.json(affectations);
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

    // id_n (bénéficiaire) et les champs écran ne sont plus modifiables ici :
    // ils passent par POST /:id/affecter et POST /api/ecrans/:id/affecter, qui
    // tracent l'affectation. Les modifier directement renommait l'utilisateur
    // dans Users et ne laissait aucun historique.
    const dataToUpdate = {};
    const fields = [
        'utilisateur', 'equipe', 'date_pc', 'caracteristiques',
        'code_pc', 'hdmi', 'clavier', 'lan',
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

    // Un poste vide dont on saisit le PC redevient un poste normal, actif.
    if (dataToUpdate.code_pc || dataToUpdate.caracteristiques) {
        const actuel = await prisma.materiels.findUnique({ where: { id_materiels: parseInt(id) }, select: { est_vide: true } });
        if (actuel?.est_vide) {
            dataToUpdate.est_vide = false;
            dataToUpdate.est_actif = true;
            if (!dataToUpdate.etat_pc || dataToUpdate.etat_pc === ETAT_SANS_POSTE) {
                dataToUpdate.etat_pc = ETAT_REMIS_EN_SERVICE;
            }
        }
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

    try {
        const materiel = await prisma.materiels.update({
            where: { id_materiels: parseInt(id) },
            data: dataToUpdate,
        });

        res.json({ message: 'Matériel mis à jour', materiel });
    } catch (error) {
        console.error("Erreur Prisma détaillée:", error);
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

    // Suppression logique : la fiche, son historique et ses affectations sont
    // conservés ; l'écran repart en stock et le matricule est libéré.
    try {
        await prisma.$transaction((tx) => retirerPoste(tx, parseInt(id, 10), req.user?.id_n));
        res.status(200).json({ message: 'Matériel supprimé avec succès.' });
    } catch (error) {
        repondreErreurAffectation(res, error);
    }
}));

export default router; // N'oubliez pas d'exporter votre routeur à la fin
