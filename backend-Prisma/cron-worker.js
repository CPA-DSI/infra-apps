// cron-Worker.js - Gestion des envois quotidiens, hebdomadaires et mensuels
//
// Chaque robot actif tourne chaque minute et compare le jour/l'heure courants, dans le
// fuseau CRON_TIMEZONE (Europe/Paris par défaut), à ceux de sa config.
// On n'utilise pas d'expression cron précise ("15 17 * * 5") : dans node-cron 4.2.1, le
// calcul de la prochaine exécution est faux pour les jours de semaine et, avec un
// fuseau, pour les jours du mois (il saute au 1er janvier) et l'envoi n'aurait jamais lieu.
// reloadCronTasks() doit être appelée après toute modification d'une config email
// ou d'un état actif/inactif : elle détruit les tâches existantes et les recrée.
import cron from 'node-cron';
import { generateExcelReport, sendEmail, getCurrentDate, getCurrentMonth } from './services/reportService.js';

export const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Europe/Paris';

// Tâches actuellement planifiées, par type
const tasks = { quotidien: null, hebdomadaire: null, mensuel: null };

// Parse "HH:MM" ou "H:MM" -> { hours, minutes }, ou null si invalide
export const parseHeureEnvoi = (heure) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(heure ?? '').trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
};

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Date/heure courante décomposée dans le fuseau du robot
const getZonedNow = (date) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: CRON_TIMEZONE, hourCycle: 'h23',
            year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric',
        })
            .formatToParts(date)
            .map(p => [p.type, p.value])
    );
    const year = Number(parts.year);
    const month = Number(parts.month);
    return {
        weekday: WEEKDAYS[parts.weekday],
        day: Number(parts.day),
        lastDay: new Date(Date.UTC(year, month, 0)).getUTCDate(),
        hours: Number(parts.hour),
        minutes: Number(parts.minute),
    };
};

// ============================================================
// DÉFINITION DES ROBOTS
// ============================================================
const ROBOTS = {
    quotidien: {
        label: 'QUOTIDIEN',
        loadConfig: (prisma) => prisma.configEmailQuotidien.findUnique({ where: { id: 1 } }),
        isActive: (config) => config.cron_actif,
        // Du lundi au vendredi
        isDueToday: (config, now) => now.weekday >= 1 && now.weekday <= 5,
        describe: (config) => `du lundi au vendredi à ${config.heure_envoi}`,
        send: async (prisma, config) => {
            const buffer = await generateExcelReport(prisma);
            await sendEmail(
                config,
                config.objet_mail || `Rapport Quotidien des Stocks - ${getCurrentDate()}`,
                config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport des stocks du ${getCurrentDate()}.`,
                buffer,
                `Rapport_Quotidien_${getCurrentDate()}.xlsx`
            );
        },
    },
    hebdomadaire: {
        label: 'HEBDOMADAIRE',
        loadConfig: (prisma) => prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } }),
        isActive: (config) => config.cron_actif_hebdo,
        // jour_envoi : 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi (même convention que cron)
        isDueToday: (config, now) => {
            const jour = Number.isInteger(config.jour_envoi) && config.jour_envoi >= 0 && config.jour_envoi <= 6 ? config.jour_envoi : 1;
            return now.weekday === jour;
        },
        describe: (config) => `jour ${config.jour_envoi ?? 1} de la semaine à ${config.heure_envoi}`,
        send: async (prisma, config) => {
            const buffer = await generateExcelReport(prisma);
            await sendEmail(
                config,
                config.objet_mail_hebdo || `Rapport Hebdomadaire des Stocks - ${getCurrentDate()}`,
                config.message_mail_hebdo || `Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks du ${getCurrentDate()}.`,
                buffer,
                `Rapport_Hebdomadaire_${getCurrentDate()}.xlsx`
            );
        },
    },
    mensuel: {
        label: 'MENSUEL',
        loadConfig: (prisma) => prisma.configEmailMensuel.findUnique({ where: { id: 1 } }),
        isActive: (config) => config.cron_actif,
        // Le jour configuré, ou le dernier jour du mois pour les mois plus courts (ex. 31 -> 30 ou 28/29)
        isDueToday: (config, now) => now.day === Math.min(getMonthlyDay(config), now.lastDay),
        describe: (config) => `le ${getMonthlyDay(config)} du mois à ${config.heure_envoi}`,
        send: async (prisma, config) => {
            const monthName = getCurrentMonth();
            const buffer = await generateExcelReport(prisma);
            await sendEmail(
                config,
                config.objet_mail || `Rapport Mensuel des Stocks - ${monthName}`,
                config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks du ${monthName}.`,
                buffer,
                `Rapport_Mensuel_${getCurrentDate()}.xlsx`
            );
        },
    },
};

function getMonthlyDay(config) {
    const jour = Number(config.jour_envoi);
    return Number.isInteger(jour) && jour >= 1 && jour <= 31 ? jour : 1;
}

// ============================================================
// PLANIFICATION
// ============================================================
const scheduleRobot = (prisma, type, config) => {
    const robot = ROBOTS[type];
    if (!parseHeureEnvoi(config.heure_envoi)) {
        console.warn(`⚠️ Robot d'envoi ${robot.label} : heure d'envoi invalide (${config.heure_envoi}), non planifié.`);
        return null;
    }

    const task = cron.createTask('* * * * *', async ({ date }) => {
        try {
            // Relire la config à chaque minute (heure, destinataires, état actif)
            const current = await robot.loadConfig(prisma);
            if (!current || !robot.isActive(current)) return;

            const heure = parseHeureEnvoi(current.heure_envoi);
            const now = getZonedNow(date);
            if (!heure || heure.hours !== now.hours || heure.minutes !== now.minutes) return;
            if (!robot.isDueToday(current, now)) return;

            console.log(`[${new Date().toLocaleString('fr-FR', { timeZone: CRON_TIMEZONE })}] Démarrage de l'envoi ${robot.label}...`);
            await robot.send(prisma, current);
            console.log(`✅ Rapport ${robot.label} envoyé à ${current.email_dest}`);
        } catch (e) {
            console.error(`❌ Erreur critique Cron ${robot.label}:`, e);
        }
    }, { timezone: CRON_TIMEZONE, name: `rapport-${type}`, noOverlap: true });

    task.start();
    console.log(`🚀 Robot d'envoi ${robot.label} : ACTIF (${robot.describe(config)}, ${CRON_TIMEZONE})`);
    return task;
};

// (Re)crée toutes les tâches à partir des configs en base
export async function reloadCronTasks(prisma) {
    for (const type of Object.keys(ROBOTS)) {
        if (tasks[type]) {
            await tasks[type].destroy();
            tasks[type] = null;
        }
        try {
            const config = await ROBOTS[type].loadConfig(prisma);
            if (config && ROBOTS[type].isActive(config)) {
                tasks[type] = scheduleRobot(prisma, type, config);
            } else {
                console.log(`💤 Robot d'envoi ${ROBOTS[type].label} : INACTIF`);
            }
        } catch (err) {
            console.error(`Erreur lors de la synchro du Robot ${ROBOTS[type].label}:`, err);
        }
    }
}

// Arrête toutes les tâches (ex. arrêt du serveur)
export async function stopAllCronTasks() {
    for (const type of Object.keys(tasks)) {
        if (tasks[type]) {
            await tasks[type].destroy();
            tasks[type] = null;
        }
    }
}

// État réel des tâches : true si le robot est planifié dans ce processus
export function getCronTasksState() {
    return Object.fromEntries(Object.entries(tasks).map(([type, task]) => [type, Boolean(task)]));
}
