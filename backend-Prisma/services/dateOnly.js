// backend-Prisma/services/dateOnly.js
//
// Helpers pour les colonnes Prisma `@db.Date` (date sans heure).
//
// Prisma envoie un DateTime JS à PostgreSQL en UTC : une date construite en
// heure locale (new Date(y, m, d) ou new Date() pour "aujourd'hui") sur un
// serveur en +03 vaut la veille à 21h UTC, et PostgreSQL stocke alors J-1.
// On construit donc toujours les dates "calendaires" à minuit UTC
// (Date.UTC(y, m, d)), en prenant le jour calendaire LOCAL du serveur
// (fuseau de l'entreprise) pour "aujourd'hui".

/**
 * Construit une date calendaire (minuit UTC) à partir d'année / mois (0-11) / jour.
 * Retourne null si la combinaison n'existe pas (ex: 31/02).
 */
export function dateOnlyFromParts(year, monthIndex, day) {
    if (![year, monthIndex, day].every(Number.isInteger)) return null;
    const d = new Date(Date.UTC(year, monthIndex, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) {
        return null;
    }
    return d;
}

/**
 * Date du jour (jour calendaire local du serveur) à minuit UTC.
 */
export function todayDateOnly(now = new Date()) {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Convertit une valeur (Date, "AAAA-MM-JJ", ISO, timestamp) en date calendaire
 * à minuit UTC. Retourne null si la valeur est vide ou invalide.
 *
 * - "AAAA-MM-JJ" (input HTML type=date) : pris tel quel.
 * - Date / ISO déjà à minuit UTC (valeur relue d'une colonne @db.Date) : conservée.
 * - Toute autre date/heure : on garde le jour calendaire LOCAL du serveur
 *   (ex: "2025-01-15T21:00:00Z" sur un serveur +03 => 16/01/2025).
 */
export function toDateOnly(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'string') {
        const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            return dateOnlyFromParts(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        }
    }

    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;

    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
        return new Date(d.getTime());
    }
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Formate une date calendaire (minuit UTC) en "AAAA-MM-JJ".
 */
export function formatDateOnly(date) {
    return date.toISOString().split('T')[0];
}
