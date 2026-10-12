// backend-Prisma/constants/cron.js

/**
 * Fuseau horaire des robots d'envoi et des dates affichées dans les rapports.
 * Isolé dans un module sans dépendance pour être importé à la fois par
 * cron-worker.js et services/reportService.js sans import circulaire.
 */
export const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Europe/Paris';
