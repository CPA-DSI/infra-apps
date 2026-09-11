import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const router = express.Router();
const prisma = new PrismaClient();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.CONFIG_WRITE));

// Fonction utilitaire pour ajuster la largeur des colonnes automatiquement
const autoSizeColumns = (worksheet) => {
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 3;
    });
};

router.post('/send-report', asyncHandler(async (req, res) => {
    const configQuotidien = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
    const configHebdo = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });

    let config = null;
    if (configQuotidien && configQuotidien.email_exp) {
        config = configQuotidien;
    } else if (configHebdo && configHebdo.email_exp) {
        config = configHebdo;
    }

    if (!config || !config.email_exp) return res.status(400).json({ message: "Configuration email manquante." });

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const [historiqueArrivees, tousLesMouvements, tousLesProduits] = await Promise.all([
        prisma.historique_arrive.findMany({ orderBy: { date_arrivee: 'desc' }, include: { produit: true } }),
        prisma.Mouvement.findMany({ 
            orderBy: { date_mouvement: 'desc' }, 
            include: { produits: true, localSource: true, localDestination: true } 
        }),
        prisma.produits.findMany({ orderBy: { nom_produit: 'asc' } })
    ]);

    const workbook = new ExcelJS.Workbook();
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } }
    };

    // --- FEUILLE 0 : SOMMAIRE ---
    const sheet0 = workbook.addWorksheet('Sommaire', { views: [{ showGridLines: false }] });
    sheet0.addRow(['RAPPORT LOGISTIQUE GLOBAL']).font = { bold: true, size: 16 };
    sheet0.addRow(['Généré le : ' + fullDateTime]);
    sheet0.addRow([]);

    const totalProduits = tousLesProduits.length;
    const produitsEnAlerte = tousLesProduits.filter(p => (p.quantite_en_stock || 0) <= (p.seuil_alerte || 0)).length;
    const mouvementsEntrees = tousLesMouvements.filter(m => m.type_mouvement === 'ENTREE' || m.type_mouvement === 'ENTREE_QUANTITE');
    const volumeEntrees = mouvementsEntrees.reduce((sum, m) => sum + (m.quantite || 0), 0);
    const mouvementsSorties = tousLesMouvements.filter(m => m.type_mouvement === 'SORTIE');
    const volumeSorties = mouvementsSorties.reduce((sum, m) => sum + (m.quantite || 0), 0);

    sheet0.addRow(['Résumé du Stock :']).font = { bold: true, underline: true };
    sheet0.addRow(['• Total de références produits :', totalProduits]);
    const alerteRow = sheet0.addRow(['• Produits sous le seuil d\'alerte :', produitsEnAlerte]);
    if (produitsEnAlerte > 0) alerteRow.getCell(2).font = { color: { argb: 'FF0000' }, bold: true };

    sheet0.addRow([]);
    sheet0.addRow(['Activité des flux (Volumes) :']).font = { bold: true, underline: true };
    sheet0.addRow(['• Volume total d\'ENTRÉES :', `${volumeEntrees} articles (${mouvementsEntrees.length} opérations)`]).getCell(2).font = { color: { argb: '008000' }, bold: true };
    sheet0.addRow(['• Volume total de SORTIES :', `${volumeSorties} articles (${mouvementsSorties.length} opérations)`]).getCell(2).font = { color: { argb: 'FF0000' }, bold: true };

    sheet0.addRow([]);
    sheet0.addRow(['Navigation rapide :']).font = { bold: true };
    const links = [
        { text: '→ Voir l\'inventaire des Produits', sheet: 'État des Produits' },
        { text: '→ Voir l\'historique des Arrivées', sheet: 'Historique Arrivées' },
        { text: '→ Voir les Mouvements de stock', sheet: 'Mouvements Généraux' }
    ];
    links.forEach(l => {
        const row = sheet0.addRow([l.text]);
        row.getCell(1).value = { text: l.text, hyperlink: `#'${l.sheet}'!A1` };
        row.getCell(1).font = { color: { argb: '0563C1' }, underline: true };
    });
    autoSizeColumns(sheet0);

    // --- FEUILLE 1 : Historique Arrivées ---
    const sheet1 = workbook.addWorksheet('Historique Arrivées');
    sheet1.columns = [{ header: 'Produit', key: 'nom' }, { header: 'Qté Ajoutée', key: 'qte' }, { header: 'Ancien Stock', key: 'ancien' }, { header: 'Date Arrivée', key: 'date' }];
    sheet1.getRow(1).eachCell(cell => cell.style = headerStyle);
    historiqueArrivees.forEach(h => sheet1.addRow({ nom: h.produit?.nom_produit, qte: h.quantite_arrivee, ancien: h.ancienne_quantite_stock, date: h.date_arrivee.toLocaleString() }));
    autoSizeColumns(sheet1);

    // --- FEUILLE 2 : Mouvements Généraux ---
    const sheet2 = workbook.addWorksheet('Mouvements Généraux');
    sheet2.columns = [
        { header: 'Date', key: 'date' }, { header: 'Produit', key: 'prod' }, { header: 'Type', key: 'type' }, 
        { header: 'Quantité', key: 'qte' }, { header: 'Source', key: 'source' }, { header: 'Destination', key: 'dest' }, 
        { header: 'Utilisateur', key: 'user' }, { header: 'Motif', key: 'motif' }
    ];
    sheet2.getRow(1).eachCell(cell => cell.style = headerStyle);
    tousLesMouvements.forEach(m => {
        const row = sheet2.addRow({
            date: m.date_mouvement.toLocaleDateString(), prod: m.produits?.nom_produit || 'N/A', type: m.type_mouvement,
            qte: m.quantite, source: m.localSource?.nom_local || '---', dest: m.localDestination?.nom_local || '---',
            user: m.nom_utilisateur, motif: m.motif || '-'
        });
        const type = m.type_mouvement?.toUpperCase();
        if (type?.includes('ENTREE')) row.eachCell(cell => cell.font = { color: { argb: '008000' }, bold: true });
        else if (type === 'SORTIE') row.eachCell(cell => cell.font = { color: { argb: 'FF0000' }, bold: true });
    });
    autoSizeColumns(sheet2);

    // --- FEUILLE 3 : État des Produits ---
    const sheet3 = workbook.addWorksheet('État des Produits');
    sheet3.columns = [{ header: 'Nom Produit', key: 'nom' }, { header: 'Stock Actuel', key: 'stock' }, { header: 'Seuil Alerte', key: 'seuil' }, { header: 'Dernière Mise à jour', key: 'last' }];
    sheet3.getRow(1).eachCell(cell => cell.style = headerStyle);
    tousLesProduits.forEach(p => {
        const row = sheet3.addRow({ nom: p.nom_produit, stock: p.quantite_en_stock || 0, seuil: p.seuil_alerte || 0, last: p.last_date ? p.last_date.toLocaleDateString() : 'N/A' });
        if ((p.quantite_en_stock || 0) <= (p.seuil_alerte || 0)) {
            row.getCell('stock').font = { color: { argb: 'FF0000' }, bold: true };
            row.getCell('nom').font = { color: { argb: 'FF0000' } };
        }
    });
    autoSizeColumns(sheet3);

    const buffer = await workbook.xlsx.writeBuffer();
    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Logistique" <${config.email_exp}>`,
        to: config.email_dest,
        subject: config.objet_mail || `Rapport Stock Complet - ${fullDateTime}`,
        text: config.message_mail || "Ci-joint l'export complet automatique.",
        attachments: [{ filename: `Rapport_Complet_${fullDateTime}.xlsx`, content: buffer }]
    });

    res.status(200).json({ success: true, message: "Rapport avec auto-ajustement envoyé." });
}));

// --- Route de test pour email quotidien ---
router.post('/send-test-quotidien', asyncHandler(async (req, res) => {
    const config = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ message: "Configuration email quotidienne manquante. Veuillez d'abord sauvegarder la configuration." });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Logistique Test" <${config.email_exp}>`,
        to: config.email_dest,
        subject: config.objet_mail ? `${config.objet_mail} - TEST` : `Rapport Quotidien - TEST ${fullDateTime}`,
        text: config.message_mail || "Ceci est un email de test pour vérifier la configuration."
    });

    res.status(200).json({ success: true, message: "Email de test quotidien envoyé avec succès !" });
}));

// --- Route de test pour email hebdomadaire ---
router.post('/send-test-hebdomadaire', asyncHandler(async (req, res) => {
    const config = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ message: "Configuration email hebdomadaire manquante. Veuillez d'abord sauvegarder la configuration." });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Logistique Test" <${config.email_exp}>`,
        to: config.email_dest,
        subject: config.objet_mail_hebdo ? `${config.objet_mail_hebdo} - TEST` : `Rapport Hebdomadaire - TEST ${fullDateTime}`,
        text: config.message_mail_hebdo || "Ceci est un email de test pour vérifier la configuration."
    });

    res.status(200).json({ success: true, message: "Email de test hebdomadaire envoyé avec succès !" });
}));

// --- Route de test pour email mensuel ---
router.post('/send-test-mensuel', asyncHandler(async (req, res) => {
    // Récupérer la configuration mensuelle
    const config = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ 
            message: "Configuration email mensuelle manquante. Veuillez d'abord sauvegarder la configuration." 
        });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", 
        port: 465, 
        secure: true,
        auth: { 
            user: config.email_exp, 
            pass: config.email_pass 
        }
    });

    try {
        await transporter.sendMail({
            from: `"Logistique Test" <${config.email_exp}>`,
            to: config.email_dest,
            subject: config.objet_mail_mensuel ? 
                `${config.objet_mail_mensuel} - TEST` : 
                `Rapport Mensuel - TEST ${fullDateTime}`,
            text: config.message_mail_mensuel || 
                "Ceci est un email de test pour vérifier la configuration mensuelle."
        });

        res.status(200).json({ 
            success: true, 
            message: "Email de test mensuel envoyé avec succès !" 
        });
    } catch (error) {
        console.error("Erreur d'envoi d'email:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erreur lors de l'envoi de l'email de test: " + error.message 
        });
    }
}));

export default router;