// cron-Worker.js - Gestion des envois quotidiens, hebdomadaires et mensuels
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';

// Fonction utilitaire pour obtenir la date actuelle formatée
const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');
};

// Fonction utilitaire pour obtenir le mois actuel formaté
const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long'
    });
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
const generateExcelReport = async (prisma) => {
    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const [historiqueArrivees, tousLesMouvements, tousLesProduits] = await Promise.all([
        prisma.HistoriqueArrive.findMany({ orderBy: { date_arrivee: 'desc' }, include: { produit: true } }),
        prisma.Mouvement.findMany({ 
            orderBy: { date_mouvement: 'desc' }, 
            include: { produits: true, localSource: true, localDestination: true } 
        }),
        prisma.Produits.findMany({ orderBy: { nom_produit: 'asc' } })
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

    return workbook.xlsx.writeBuffer();
};

// Fonction pour envoyer un email
const sendEmail = async (config, subject, text, buffer, filename) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Rapport Automatique" <${config.email_exp}>`,
        to: config.email_dest,
        subject: subject,
        text: text,
        attachments: [{ filename: filename, content: buffer }]
    });
};

// ============================================================
// CRON JOB QUOTIDIEN
// ============================================================
export const createDailyCronTask = (prisma) => {
    return cron.schedule('*/1 * * * 1-5', async () => {
        try {
            const config = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
            
            // Vérifier si l'envoi quotidien est activé
            if (!config || !config.cron_actif || !config.heure_envoi) {
                return; 
            }

            const [configHours, configMinutes] = config.heure_envoi.split(':');
            const now = new Date();
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');

            if (currentHours !== configHours || currentMinutes !== configMinutes) return;

            console.log(`[${now.toLocaleString()}] 🟢 Démarrage de l'envoi QUOTIDIEN...`);

            const buffer = await generateExcelReport(prisma);
            
            await sendEmail(
                config,
                config.objet_mail || `Rapport Quotidien des Stocks - ${getCurrentDate()}`,
                config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport des stocks du ${getCurrentDate()}.`,
                buffer,
                `Rapport_Quotidien_${getCurrentDate()}.xlsx`
            );

            console.log(`[${new Date().toLocaleString()}] ✅ Rapport QUOTIDIEN envoyé à ${config.email_dest}`);
        } catch (e) {
            console.error("❌ Erreur critique Cron Quotidien:", e);
        }
    }, { scheduled: false });
};

// ============================================================
// CRON JOB HEBDOMADAIRE
// ============================================================
export const createWeeklyCronTask = (prisma) => {
    return cron.schedule('*/1 * * * *', async () => {
        try {
            const config = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
            
            // Vérifier si l'envoi hebdomadaire est activé
            if (!config || !config.cron_actif_hebdo || !config.heure_envoi) {
                return;
            }

            const [configHours, configMinutes] = config.heure_envoi.split(':');
            const now = new Date();
            const currentDayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const targetDay = config.jour_envoi || 1; // Par défaut, Lundi

            // Vérifier si c'est le bon jour et la bonne heure
            if (currentDayOfWeek !== targetDay || currentHours !== configHours || currentMinutes !== configMinutes) {
                return;
            }

            console.log(`[${now.toLocaleString()}] 🔵 Démarrage de l'envoi HEBDOMADAIRE...`);

            const buffer = await generateExcelReport(prisma);
            
            await sendEmail(
                config,
                config.objet_mail_hebdo || `Rapport Hebdomadaire des Stocks - ${getCurrentDate()}`,
                config.message_mail_hebdo || `Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks du ${getCurrentDate()}.`,
                buffer,
                `Rapport_Hebdomadaire_${getCurrentDate()}.xlsx`
            );

            console.log(`[${now.toLocaleString()}] ✅ Rapport HEBDOMADAIRE envoyé à ${config.email_dest}`);
        } catch (e) {
            console.error("❌ Erreur critique Cron Hebdomadaire:", e);
        }
    }, { scheduled: false });
};

// ============================================================
// CRON JOB MENSUEL (NOUVEAU)
// ============================================================
export const createMonthlyCronTask = (prisma) => {
    return cron.schedule('*/1 * * * *', async () => {
        try {
            const config = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });
            
            // Vérifier si l'envoi mensuel est activé
            if (!config || !config.cron_actif || !config.heure_envoi) {
                return;
            }

            const [configHours, configMinutes] = config.heure_envoi.split(':');
            const now = new Date();
            const currentDayOfMonth = now.getDate(); // 1-31
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const targetDay = config.jour_envoi || 1; // Par défaut, le 1er du mois

            // Vérifier si c'est le bon jour du mois et la bonne heure
            if (currentDayOfMonth !== targetDay || currentHours !== configHours || currentMinutes !== configMinutes) {
                return;
            }

            const monthName = getCurrentMonth();
            console.log(`[${now.toLocaleString()}] 🟣 Démarrage de l'envoi MENSUEL (${monthName})...`);

            const buffer = await generateExcelReport(prisma);
            
            await sendEmail(
                config,
                config.objet_mail || `Rapport Mensuel des Stocks - ${monthName}`,
                config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks du ${monthName}.`,
                buffer,
                `Rapport_Mensuel_${getCurrentDate()}.xlsx`
            );

            console.log(`[${now.toLocaleString()}] ✅ Rapport MENSUEL envoyé à ${config.email_dest}`);
        } catch (e) {
            console.error("❌ Erreur critique Cron Mensuel:", e);
        }
    }, { scheduled: false });
};

// ============================================================
// FONCTION PRINCIPALE DE CRÉATION DES TÂCHES
// ============================================================
export const createCronTasks = (prisma) => {
    const dailyTask = createDailyCronTask(prisma);
    const weeklyTask = createWeeklyCronTask(prisma);
    const monthlyTask = createMonthlyCronTask(prisma);
    
    return {
        dailyTask,
        weeklyTask,
        monthlyTask
    };
};

// Fonction de synchronisation du statut des cron jobs
export async function syncCronStatus(prisma, dailyTask, weeklyTask, monthlyTask) {
    try {
        // Récupérer la config quotidienne
        const configQuotidien = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
        
        // Récupérer la config hebdomadaire
        const configHebdo = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
        
        // Récupérer la config mensuelle
        const configMensuel = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });
        
        // Synchroniser le job quotidien
        if (configQuotidien?.cron_actif) {
            dailyTask.start();
            console.log("🚀 Robot d'envoi QUOTIDIEN rétabli : ACTIF");
        } else {
            console.log("💤 Robot d'envoi QUOTIDIEN au démarrage : INACTIF");
        }

        // Synchroniser le job hebdomadaire
        if (configHebdo?.cron_actif_hebdo) {
            weeklyTask.start();
            console.log("🚀 Robot d'envoi HEBDOMADAIRE rétabli : ACTIF");
        } else {
            console.log("💤 Robot d'envoi HEBDOMADAIRE au démarrage : INACTIF");
        }

        // Synchroniser le job mensuel (NOUVEAU)
        if (configMensuel?.cron_actif) {
            monthlyTask.start();
            console.log(`🚀 Robot d'envoi MENSUEL rétabli : ACTIF (Jour ${configMensuel.jour_envoi || 1} à ${configMensuel.heure_envoi})`);
        } else {
            console.log("💤 Robot d'envoi MENSUEL au démarrage : INACTIF");
        }
    } catch (err) {
        console.error("Erreur lors de la synchro du Robot:", err);
    }
}

// Fonction pour arrêter tous les jobs
export function stopAllCronTasks(dailyTask, weeklyTask, monthlyTask) {
    if (dailyTask) {
        dailyTask.stop();
        console.log("⏹️ Job QUOTIDIEN arrêté");
    }
    if (weeklyTask) {
        weeklyTask.stop();
        console.log("⏹️ Job HEBDOMADAIRE arrêté");
    }
    if (monthlyTask) {
        monthlyTask.stop();
        console.log("⏹️ Job MENSUEL arrêté");
    }
}

// Fonction pour redémarrer tous les jobs avec les nouvelles configs
export async function restartAllCronTasks(prisma, dailyTask, weeklyTask, monthlyTask) {
    console.log("🔄 Redémarrage de tous les jobs Cron...");
    stopAllCronTasks(dailyTask, weeklyTask, monthlyTask);
    await syncCronStatus(prisma, dailyTask, weeklyTask, monthlyTask);
    console.log("✅ Tous les jobs Cron ont été redémarrés");
}