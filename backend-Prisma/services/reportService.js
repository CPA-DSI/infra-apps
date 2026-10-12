// services/reportService.js - Génération du rapport Excel et envoi par email
// Partagé par le robot d'envoi (cron-worker.js) et les routes d'envoi manuel/test.
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import { CRON_TIMEZONE } from '../constants/cron.js';

// Toutes les dates du rapport (noms de fichiers, "Généré le", colonnes) sont exprimées
// dans le fuseau CRON_TIMEZONE et non dans celui du serveur.
const getZonedParts = (date = new Date()) => Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
        timeZone: CRON_TIMEZONE, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
        .formatToParts(date)
        .map(p => [p.type, p.value])
);

// Formate une date en "JJ/MM/AAAA" dans le fuseau du robot
export const formatDate = (date) => date
    ? new Date(date).toLocaleDateString('fr-FR', { timeZone: CRON_TIMEZONE })
    : '';

// Formate une date en "JJ/MM/AAAA HH:MM:SS" dans le fuseau du robot
export const formatDateTime = (date) => date
    ? new Date(date).toLocaleString('fr-FR', { timeZone: CRON_TIMEZONE })
    : '';

// Fonction utilitaire pour obtenir la date actuelle formatée (JJ-MM-AAAA)
export const getCurrentDate = () => {
    const p = getZonedParts();
    return `${p.day}-${p.month}-${p.year}`;
};

// Date et heure actuelles pour les noms de fichiers (JJ-MM-AAAA_17h05)
export const getCurrentDateTime = () => {
    const p = getZonedParts();
    return `${p.day}-${p.month}-${p.year}_${Number(p.hour)}h${p.minute}`;
};

// Fonction utilitaire pour obtenir le mois actuel formaté
export const getCurrentMonth = () => {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: CRON_TIMEZONE,
        year: 'numeric',
        month: 'long'
    }).format(new Date());
};

// Config email renvoyée au client : jamais le mot de passe SMTP, seulement s'il est défini
export const toPublicEmailConfig = (config) => {
    if (!config) return config;
    const { email_pass, ...rest } = config;
    return { ...rest, hasPassword: Boolean(email_pass) };
};

// Mot de passe SMTP envoyé par le client : undefined si vide/absent (=> conserver l'existant)
export const getNewEmailPass = (value) =>
    typeof value === 'string' && value.trim() !== '' ? value : undefined;

// Décalage (ms) entre CRON_TIMEZONE et UTC à l'instant `date`
const getTimezoneOffsetMs = (date) => {
    const p = getZonedParts(date);
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    return asUtc - Math.floor(date.getTime() / 60000) * 60000;
};

/**
 * Premier jour couvert par un rapport périodique, en date calendaire (minuit
 * UTC, comme les colonnes @db.Date) du fuseau CRON_TIMEZONE :
 * - hebdomadaire : même jour la semaine précédente (J-7) ;
 * - mensuel : même jour le mois précédent (borné au dernier jour de ce mois).
 * Le jour de l'envoi précédent est inclus : un mouvement saisi ce jour-là
 * après l'envoi n'est ainsi jamais perdu. Renvoie null pour tout l'historique.
 */
export const getDebutPeriode = (periode, now = new Date()) => {
    const p = getZonedParts(now);
    const annee = Number(p.year), mois = Number(p.month) - 1, jour = Number(p.day);
    if (periode === 'hebdomadaire') {
        return new Date(Date.UTC(annee, mois, jour - 7));
    }
    if (periode === 'mensuel') {
        const dernierJourMoisPrecedent = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
        return new Date(Date.UTC(annee, mois - 1, Math.min(jour, dernierJourMoisPrecedent)));
    }
    return null;
};

// Fonction utilitaire pour ajuster la largeur des colonnes automatiquement
export const autoSizeColumns = (worksheet) => {
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) maxLength = columnLength;
        });
        column.width = maxLength < 12 ? 12 : maxLength + 3;
    });
};

// Fonction pour générer le rapport Excel
// - depuis : date calendaire (cf. getDebutPeriode) limitant les arrivées et les
//   mouvements à la période ; null => tout l'historique.
// - includeProduits : ajoute la feuille "État des Produits" (photo du stock).
export const generateExcelReport = async (prisma, { depuis = null, includeProduits = true } = {}) => {
    const fullDateTime = getCurrentDateTime();

    // date_mouvement est un @db.Date (comparé à minuit UTC) ; date_arrivee est
    // un horodatage : on le compare à minuit dans le fuseau CRON_TIMEZONE.
    const filtreMouvements = depuis ? { date_mouvement: { gte: depuis } } : undefined;
    const filtreArrivees = depuis
        ? { date_arrivee: { gte: new Date(depuis.getTime() - getTimezoneOffsetMs(depuis)) } }
        : undefined;

    const [historiqueArrivees, tousLesMouvements, tousLesProduits] = await Promise.all([
        prisma.historiqueArrive.findMany({ where: filtreArrivees, orderBy: { date_arrivee: 'desc' }, include: { produit: true } }),
        prisma.mouvement.findMany({
            where: filtreMouvements,
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
    sheet0.addRow([depuis
        ? `Période : arrivées et mouvements depuis le ${depuis.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`
        : 'Période : tout l\'historique']);
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
        ...(includeProduits ? [{ text: '→ Voir l\'inventaire des Produits', sheet: 'État des Produits' }] : []),
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
    historiqueArrivees.forEach(h => sheet1.addRow({ nom: h.produit?.nom_produit, qte: h.quantite_arrivee, ancien: h.ancienne_quantite_stock, date: formatDateTime(h.date_arrivee) }));
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
            date: formatDate(m.date_mouvement), prod: m.produits?.nom_produit || 'N/A', type: m.type_mouvement,
            qte: m.quantite, source: m.localSource?.nom_local || '---', dest: m.localDestination?.nom_local || '---',
            user: m.nom_utilisateur, motif: m.motif || '-'
        });
        const type = m.type_mouvement?.toUpperCase();
        if (type?.includes('ENTREE')) row.eachCell(cell => cell.font = { color: { argb: '008000' }, bold: true });
        else if (type === 'SORTIE') row.eachCell(cell => cell.font = { color: { argb: 'FF0000' }, bold: true });
    });
    autoSizeColumns(sheet2);

    // --- FEUILLE 3 : État des Produits ---
    if (includeProduits) {
        const sheet3 = workbook.addWorksheet('État des Produits');
        sheet3.columns = [{ header: 'Nom Produit', key: 'nom' }, { header: 'Stock Actuel', key: 'stock' }, { header: 'Seuil Alerte', key: 'seuil' }, { header: 'Dernière Mise à jour', key: 'last' }];
        sheet3.getRow(1).eachCell(cell => cell.style = headerStyle);
        tousLesProduits.forEach(p => {
            const row = sheet3.addRow({ nom: p.nom_produit, stock: p.quantite_en_stock || 0, seuil: p.seuil_alerte || 0, last: p.last_date ? formatDate(p.last_date) : 'N/A' });
            if ((p.quantite_en_stock || 0) <= (p.seuil_alerte || 0)) {
                row.getCell('stock').font = { color: { argb: 'FF0000' }, bold: true };
                row.getCell('nom').font = { color: { argb: 'FF0000' } };
            }
        });
        autoSizeColumns(sheet3);
    }

    return workbook.xlsx.writeBuffer();
};
// Fonction pour envoyer un email avec le rapport en pièce jointe
export const sendEmail = async (config, subject, text, buffer, filename, fromName = 'Rapport Automatique') => {
    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"${fromName}" <${config.email_exp}>`,
        to: config.email_dest,
        subject: subject,
        text: text,
        attachments: [{ filename: filename, content: buffer }]
    });
};
