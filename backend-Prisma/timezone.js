// backend-Prisma/timezone.js
//
// Impose au processus Node le fuseau de l'entreprise (Madagascar, UTC+03 par
// défaut, cf. CRON_TIMEZONE), quel que soit celui de la machine hôte.
//
// Tout le code serveur raisonne en « heure locale » : bornes Jour / Mois / Année
// des interventions (new Date(a, m, j)), heures de pointe (getHours / getDay),
// jour calendaire des colonnes @db.Date (services/dateOnly.js). Sur un serveur
// en UTC (Docker, hébergeur…), ces calculs seraient décalés de 3 h : une
// intervention de 1 h du matin compterait pour la veille.
//
// À importer en tout premier, juste après dotenv (server.js, tests/setup.js) :
// Node prend en compte un changement de process.env.TZ pour toutes les dates
// calculées ensuite.
import { CRON_TIMEZONE } from './constants/cron.js';

process.env.TZ = CRON_TIMEZONE;

export const APP_TIMEZONE = CRON_TIMEZONE;
