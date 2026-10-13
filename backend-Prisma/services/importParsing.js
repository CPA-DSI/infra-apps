// services/importParsing.js
// Fonctions pures de lecture des lignes d'un fichier Excel importé (dates,
// booléens, chaînes, alias de colonnes, marque, site) : aucun accès base.

// Fonction pour convertir les dates Excel (nombre de jours depuis 1900-01-01)
// Époque au 30/12/1899 (et non 31/12) : Excel compte le 29/02/1900 inexistant,
// ce qui décalait toutes les dates d'un jour (45000 = 15/03/2023).
export const excelDateToJSDate = (excelDate) => {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const result = new Date(excelEpoch.getTime() + (excelDate * msPerDay));
    return result;
};

// Fonction pour valider et convertir une date
export const validateDate = (dateValue) => {
    if (!dateValue && dateValue !== 0) {
        return null;
    }
    
    try {
        let date = null;
        
        // Si c'est un nombre (format Excel)
        if (typeof dateValue === 'number') {
            // Les dates Excel valides sont généralement entre 1 et 100000
            if (dateValue > 1 && dateValue < 100000) {
                date = excelDateToJSDate(dateValue);
                return date;
            }
            return null;
        }
        
        // Si c'est une chaîne
        if (typeof dateValue === 'string') {
            const cleanDateString = dateValue.trim();
            
            if (cleanDateString === '' || 
                cleanDateString.toLowerCase() === 'null' || 
                cleanDateString.toLowerCase() === 'undefined') {
                return null;
            }
            
            // 1. Date Excel pure (ex: "44651" ou "+44651" ou "-44651")
            const excelNumMatch = cleanDateString.match(/^[+-]?(\d{4,5})$/);
            if (excelNumMatch) {
                const excelNum = parseInt(excelNumMatch[1]);
                if (excelNum > 1 && excelNum < 100000) {
                    date = excelDateToJSDate(excelNum);
                    return date;
                }
                return null;
            }
            
            // 2. Date Excel avec décimales (ex: "44651.0")
            const decimalMatch = cleanDateString.match(/^[+-]?(\d{4,5})\.\d+$/);
            if (decimalMatch) {
                const excelNum = parseInt(decimalMatch[1]);
                if (excelNum > 1 && excelNum < 100000) {
                    date = excelDateToJSDate(excelNum);
                    return date;
                }
                return null;
            }
            
            // 3. Format ISO avec temps "2024-11-25 00:00:00"
            const dateTimeMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
            if (dateTimeMatch) {
                const year = parseInt(dateTimeMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(dateTimeMatch[2]) - 1,
                        parseInt(dateTimeMatch[3])
                    ));
                    return date;
                }
            }
            
            // 4. Format ISO "YYYY-MM-DD"
            const isoMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(isoMatch[2]) - 1,
                        parseInt(isoMatch[3])
                    ));
                    return date;
                }
            }
            
            // 5. Format français "30/07/2026"
            const frenchMatch = cleanDateString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (frenchMatch) {
                const year = parseInt(frenchMatch[3]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(frenchMatch[2]) - 1,
                        parseInt(frenchMatch[1])
                    ));
                    return date;
                }
            }
            
            // 6. Format avec temps "2024-11-25T00:00:00"
            const isoTimeMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (isoTimeMatch) {
                const year = parseInt(isoTimeMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(isoTimeMatch[2]) - 1,
                        parseInt(isoTimeMatch[3])
                    ));
                    return date;
                }
            }
            
            // 7. Dernier essai avec new Date() : la chaîne est lue en heure
            // locale (serveur en +03), on garde le jour local et on le pose à
            // minuit UTC pour la colonne @db.Date (sinon veille en base).
            date = new Date(cleanDateString);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                if (year >= 1990 && year <= 2100) {
                    return new Date(Date.UTC(year, date.getMonth(), date.getDate()));
                }
            }

            // Pas de repli sur un simple préfixe numérique (ex: code postal,
            // référence produit, matricule collé à du texte) : un serial Excel
            // légitime est déjà couvert par les cas 1 et 2 ci-dessus, qui exigent
            // que la chaîne entière soit le nombre. Deviner à partir d'un préfixe
            // produit trop de fausses dates silencieuses.
            return null;
        }
        
        if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime())
                ? null
                : new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
        }
        
        return null;
        
    } catch (error) {
        console.error(`[ERREUR] validateDate:`, error.message);
        return null;
    }
};

// Fonction pour convertir les booléens
export const convertBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        return lowerValue === 'true' || lowerValue === 'vrai' || lowerValue === '1' || lowerValue === 'oui' || lowerValue === 'o' || lowerValue === 'yes' || lowerValue === 'y';
    }
    if (typeof value === 'number') return value === 1;
    return false;
};

// Fonction pour nettoyer les chaînes
export const cleanString = (value) => {
    if (!value) return null;
    if (typeof value !== 'string') return String(value).trim();
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' ? null : trimmed;
};

// Tronquer une chaîne pour respecter les limites @db.VarChar(n) du schéma Prisma
export const truncate = (value, maxLength) => {
    if (value === null || value === undefined) return value;
    const str = String(value);
    return str.length > maxLength ? str.slice(0, maxLength) : str;
};

// Cherche la première valeur non vide parmi une liste d'alias de colonnes
// (insensible à la casse) : mutualise le pattern répété pour chaque champ
// du fichier importé (Code PC, Salle, Commentaire, HDMI, ...).
export const findFieldValue = (item, allKeys, aliases) => {
    for (const key of allKeys) {
        if (aliases.some(a => a.toLowerCase() === key.toLowerCase())) {
            const value = item[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return null;
};

// Extraire la marque depuis le champ caracteristiques
export const extractMarqueFromCaracteristiques = (caracteristiques) => {
    if (!caracteristiques) return null;
    
    let cleanCarac = caracteristiques.trim();
    let parts = cleanCarac.split(/[\s\/-]/);
    
    for (const part of parts) {
        if (part && part.length > 0) {
            const marqueValid = part.match(/^[A-Za-z]{2,}/);
            if (marqueValid) {
                return marqueValid[0].toUpperCase();
            }
        }
    }
    
    return null;
};

// Fonction pour extraire le site de l'item
export const extractSiteFromItem = (item) => {
    // 1. Chercher dans les clés spécifiques (exactes)
    const siteKeys = ['Site', 'site', 'SITE', 'id_local', 'Id_local', 'ID_LOCAL', 'local_id'];

    for (const key of siteKeys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
            return item[key];
        }
    }

    // 2. Chercher dans TOUTES les clés (insensible à la casse)
    for (const key of Object.keys(item)) {
        const keyLower = key.toLowerCase().trim();
        if (keyLower === 'site' || keyLower === 'local' || keyLower === 'id_local' || keyLower === 'local_id') {
            const value = item[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }

    // 3. Chercher dans les valeurs qui ressemblent à un site connu
    const knownSites = ['BNI', 'MATURA', 'MADAFIT', 'ANTSIRABE'];
    for (const key of Object.keys(item)) {
        const value = item[key];
        if (typeof value === 'string' && value.trim() !== '') {
            const trimmed = value.trim().toUpperCase();
            if (knownSites.some(site => site.toUpperCase() === trimmed)) {
                return trimmed;
            }
        }
    }

    // Pas de site deviné à partir d'une valeur quelconque de la ligne : sans
    // colonne Site/Local, le matériel n'est rattaché à aucun local plutôt que
    // de créer en base un local au nom fantaisiste (nom, modèle, équipe...).
    return null;
};
