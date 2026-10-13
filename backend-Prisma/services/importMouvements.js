// backend/services/importMouvements.js
import prisma from '../prismaClient.js';
import * as XLSX from 'xlsx';
import { creerNouveauProduit, trouverProduitParNom } from './produitsService.js';
import { creerMouvement, TYPES_MOUVEMENT } from './stockService.js';
import { dateOnlyFromParts, toDateOnly, formatDateOnly } from './dateOnly.js';

/**
 * Crée un jeu de caches isolé pour un import.
 * Chaque appel à importerMouvements() doit utiliser son propre jeu de caches
 * pour éviter toute contamination entre imports exécutés en parallèle
 * (ex: deux requêtes HTTP simultanées sur le même serveur).
 */
function createCaches() {
    return {
        produitCache: new Map(),
        localCache: new Map(),
        materielCache: new Map()
    };
}

/**
 * Convertit une date Excel (nombre) ou une chaîne en date calendaire.
 * Renvoie null si la date est vide, invalide ou hors plage (2000-2100) : la
 * ligne est alors rejetée. Utiliser la date du jour ferait passer un réimport
 * du même fichier un autre jour à travers la détection des doublons.
 *
 * Toutes les dates renvoyées sont à minuit UTC (Date.UTC) : la colonne
 * mouvements.date_mouvement est un @db.Date, et une date construite en heure
 * locale (new Date(y, m, d)) sur un serveur en +03 serait stockée à J-1.
 */
function excelDateToJSDate(excelDate, warnings) {
    // Si null, undefined ou vide
    if (!excelDate || excelDate === '' || excelDate === ' ') {
        return null;
    }

    // Si c'est déjà une date valide
    if (excelDate instanceof Date && !isNaN(excelDate)) {
        return toDateOnly(excelDate);
    }

    // Si c'est un nombre (format Excel - jours depuis 1900)
    if (typeof excelDate === 'number') {
        // Excel : le jour 1 est le 01/01/1900 (avec le faux 29/02/1900), d'où
        // l'origine au 30/12/1899. La partie décimale (heure) est ignorée.
        const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(excelDate) * 86400000);

        // Vérifier que la date est plausible (entre 2000 et 2100)
        if (date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100) {
            return date;
        }

        if (warnings) warnings.push(`date hors plage ("${excelDate}")`);
        return null;
    }

    // Si c'est une chaîne
    if (typeof excelDate === 'string') {
        const cleanDate = excelDate.trim();

        // Format: "2025-01-16 00:00:00" (AAAA-MM-JJ HH:MM:SS) ou "2025-01-16" (AAAA-MM-JJ)
        // L'heure éventuelle est ignorée (colonne date seule).
        let match = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+\d{2}:\d{2}:\d{2})?$/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);

            if (year >= 2000 && year <= 2100) {
                const date = dateOnlyFromParts(year, month, day);
                if (date) return date;
            }
        }

        // Format: "16/01/2025" (JJ/MM/AAAA)
        const parts = cleanDate.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);

            if (year < 100) {
                year += 2000;
            }

            if (year >= 2000 && year <= 2100 && !isNaN(day) && !isNaN(month)) {
                const date = dateOnlyFromParts(year, month, day);
                if (date) return date;
            }
        }

        // Format: "16-01-2025" (JJ-MM-AAAA)
        const partsDash = cleanDate.split('-');
        if (partsDash.length === 3 && partsDash[0].length <= 2) {
            const day = parseInt(partsDash[0], 10);
            const month = parseInt(partsDash[1], 10) - 1;
            let year = parseInt(partsDash[2], 10);

            if (year < 100) {
                year += 2000;
            }

            if (year >= 2000 && year <= 2100 && !isNaN(day) && !isNaN(month)) {
                const date = dateOnlyFromParts(year, month, day);
                if (date) return date;
            }
        }

        // Essayer de parser avec Date (dernier recours)
        const date = toDateOnly(cleanDate);
        if (date && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100) {
            return date;
        }
    }

    if (warnings) warnings.push(`date invalide ("${excelDate}")`);
    return null;
}

/**
 * Nettoie une chaîne de caractères
 */
function cleanString(str) {
    if (!str) return '';
    return String(str).trim();
}

/**
 * Normalise les noms de colonnes pour correspondre aux noms attendus
 */
function normalizeColumnNames(row) {
    const normalized = {};

    const setNormalized = (field, value, sourceKey) => {
        if (Object.prototype.hasOwnProperty.call(normalized, field)) {
            console.warn(`⚠️ Colonne ambiguë: "${sourceKey}" écrase la valeur déjà mappée sur "${field}"`);
        }
        normalized[field] = value;
    };

    for (const [key, value] of Object.entries(row)) {
        const cleanKey = key.trim().toLowerCase();

        if (cleanKey === 'date_mouvement' ||
            cleanKey === 'date_mouve' || 
            cleanKey === 'date mouvement' || 
            cleanKey === 'date' ||
            cleanKey === 'jour' ||
            cleanKey.includes('date')) {
            setNormalized('date_mouvement', value, key);
        }
        else if (cleanKey === 'id_produit' || 
                 cleanKey === 'produit' || 
                 cleanKey === 'nom_produit' ||
                 cleanKey === 'id produit' ||
                 cleanKey === 'produit(s)' ||
                 cleanKey.includes('produit')) {
            setNormalized('id_produit', value, key);
        }
        else if (cleanKey === 'type_mouvement' || 
                 cleanKey === 'type mouvement' || 
                 cleanKey === 'type' ||
                 cleanKey === 'typemouvement' ||
                 cleanKey === 'type(s)' ||
                 cleanKey.includes('type')) {
            setNormalized('type_mouvement', value, key);
        }
        else if (cleanKey === 'quantité' || 
                 cleanKey === 'quantite' || 
                 cleanKey === 'qte' ||
                 cleanKey === 'qté(s)' ||
                 cleanKey === 'qté' ||
                 cleanKey === 'quantite(s)' ||
                 cleanKey.includes('quant')) {
            setNormalized('quantite', value, key);
        }
        else if (cleanKey === 'remarque' || 
                 cleanKey === 'remarques' || 
                 cleanKey === 'commentaire' ||
                 cleanKey.includes('remarque')) {
            setNormalized('remarque', value, key);
        }
        else if (cleanKey === 'id_materiels' || 
                 cleanKey === 'id materiels' || 
                 cleanKey === 'materiels' ||
                 cleanKey === 'matériels' ||
                 cleanKey === 'id_materiel' ||
                 cleanKey.includes('materiel')) {
            setNormalized('id_materiels', value, key);
        }
        else if (cleanKey === 'nom_utilisateur' || 
                 cleanKey === 'nom utilisateur' || 
                 cleanKey === 'utilisateur' ||
                 cleanKey === 'user' ||
                 cleanKey.includes('utilisateur')) {
            setNormalized('nom_utilisateur', value, key);
        }
        else if (cleanKey === 'id_local_destination' || 
                 cleanKey === 'id local destination' || 
                 cleanKey === 'local_destination' ||
                 cleanKey === 'local destination' ||
                 cleanKey === 'destination' ||
                 cleanKey.includes('destination')) {
            setNormalized('id_local_destination', value, key);
        }
        else if (cleanKey === 'id_local_source' || 
                 cleanKey === 'id local source' || 
                 cleanKey === 'local_source' ||
                 cleanKey === 'local source' ||
                 cleanKey === 'source' ||
                 cleanKey === 'id_local' ||
                 cleanKey.includes('local') ||
                 cleanKey.includes('source')) {
            setNormalized('id_local_source', value, key);
        }
        else if (cleanKey === 'motif' || 
                 cleanKey === 'raison' ||
                 cleanKey.includes('motif')) {
            setNormalized('motif', value, key);
        }
        else {
            normalized[key] = value;
        }
    }
    
    return normalized;
}

/**
 * Levée quand la création d'un produit échoue dans la transaction d'une ligne
 * (typiquement : un import concurrent vient de créer le même produit, la
 * contrainte unique produits_nom_produit_norm_key a fait échouer l'INSERT et
 * la transaction PostgreSQL est alors inutilisable). La ligne est rejouée une
 * fois : le produit sera alors trouvé.
 */
class ConflitCreationProduitError extends Error {
    constructor(nomProduit, cause) {
        super(`Création du produit "${nomProduit}" impossible: ${cause?.message || cause}`);
        this.name = 'ConflitCreationProduitError';
        this.cause = cause;
    }
}

/**
 * Récupère l'id d'un produit existant (cache puis base), sans le créer.
 * La création éventuelle est faite dans la transaction de la ligne
 * (voir traiterMouvement) pour ne jamais laisser de produit orphelin si la
 * ligne échoue.
 */
async function trouverProduitImport(client, nom, caches) {
    const nomTrim = nom.trim();
    if (caches.produitCache.has(nomTrim)) {
        return caches.produitCache.get(nomTrim);
    }
    const produit = await trouverProduitParNom(client, nomTrim);
    return produit ? produit.id_produit : null;
}

/**
 * Récupère un local existant uniquement (ne crée pas)
 */
async function getLocalIfExists(nom, caches = createCaches()) {
    if (!nom || nom.trim() === '') return null;

    const nomTrim = nom.trim();
    const { localCache } = caches;

    if (localCache.has(nomTrim)) {
        return localCache.get(nomTrim);
    }

    const local = await prisma.locaux.findFirst({
        where: {
            nom_local: {
                equals: nomTrim,
                mode: 'insensitive'
            }
        }
    });

    if (local) {
        console.log(`✅ Local trouvé: "${nomTrim}" (ID: ${local.id_local})`);
        localCache.set(nomTrim, local.id_local);
        return local.id_local;
    }

    console.warn(`⚠️ Local "${nomTrim}" non trouvé, ignoré`);
    return null;
}

/**
 * Vérifie le matricule du bénéficiaire (mouvements.id_materiels référence
 * users.id_n) : un utilisateur sans PC, ou dont la fiche a été supprimée,
 * reste un bénéficiaire valide.
 */
async function getMaterielByIdN(id_n, caches = createCaches()) {
    if (!id_n) return null;

    const { materielCache } = caches;

    if (materielCache.has(id_n)) {
        return materielCache.get(id_n);
    }

    const utilisateur = await prisma.users.findUnique({
        where: { id_n: id_n },
        select: { id_n: true }
    });

    if (utilisateur) {
        materielCache.set(id_n, id_n);
        return id_n;
    }

    console.warn(`⚠️ Utilisateur avec id_n=${id_n} non trouvé dans la base`);
    return null;
}

/**
 * Extrait le numéro id_n du champ id_materiels
 */
function extractIdNFromMateriel(champ, warnings) {
    if (!champ || champ.trim() === '') return null;

    const champStr = String(champ);

    // Format: "577 Irina (577)" ou "Antisa (2)"
    const match = champStr.match(/\((\d+)\)$/);
    if (match) {
        return parseInt(match[1], 10);
    }

    // Si c'est juste un nombre
    const simpleMatch = champStr.match(/^(\d+)$/);
    if (simpleMatch) {
        return parseInt(simpleMatch[1], 10);
    }

    // Dernier recours: premier nombre trouvé dans la chaîne (approximatif, à vérifier)
    const anyMatch = champStr.match(/\d+/);
    if (anyMatch) {
        if (warnings) {
            warnings.push(`id matériel extrait de façon approximative depuis "${champStr}" (retenu: ${anyMatch[0]})`);
        }
        return parseInt(anyMatch[0], 10);
    }

    return null;
}

/**
 * Récupère les données de toutes les lignes normalisées
 */
function getNormalizedData(donnees) {
    return donnees.map(row => {
        const normalizedRow = normalizeColumnNames(row);
        
        let typeMouvement = cleanString(normalizedRow.type_mouvement);
        typeMouvement = typeMouvement.replace(/[▼▲]/g, '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        
        // Un type vide n'est pas remplacé par défaut : la ligne est rejetée
        // comme type non reconnu (une SORTIE implicite décrémenterait le stock).

        const quantiteParsee = parseInt(normalizedRow.quantite, 10);

        return {
            ...normalizedRow,
            produitNom: cleanString(normalizedRow.id_produit),
            quantite: quantiteParsee,
            quantiteBrute: normalizedRow.quantite,
            typeMouvement: typeMouvement,
            dateMouvement: normalizedRow.date_mouvement,
            localSourceNom: cleanString(normalizedRow.id_local_source),
            localDestinationNom: cleanString(normalizedRow.id_local_destination),
            materielStr: cleanString(normalizedRow.id_materiels),
            motif: cleanString(normalizedRow.motif) || cleanString(normalizedRow.remarque) || null,
            remarque: cleanString(normalizedRow.remarque) || null,
            nomUtilisateur: cleanString(normalizedRow.nom_utilisateur) || 'Inconnu'
        };
    });
}

/**
 * Fonction principale d'importation
 *
 * Chaque ligne est traitée dans sa propre transaction (création éventuelle du
 * produit + stock + historique + mouvement) : une ligne en erreur n'écrit rien,
 * en particulier aucun produit orphelin. Les lignes valides restent importées
 * (import partiel, comme auparavant).
 *
 * Doublons : une ligne identique (date, produit, type, quantité, utilisateur,
 * motif) à un mouvement DÉJÀ présent en base avant cet import est ignorée et
 * comptée dans `doublons` (ré-import du même fichier => stock non doublé).
 * Des lignes identiques au sein d'un même fichier restent importées (elles
 * peuvent être légitimes) : la k-ième occurrence n'est ignorée que si la base
 * contenait déjà au moins k mouvements identiques.
 */
export async function importerMouvements(donnees) {
    console.log(`📊 Début de l'importation de ${donnees.length} mouvements...`);

    let count = 0;
    let errors = 0;
    let doublons = 0;
    const errorDetails = [];
    const doublonDetails = [];

    // Caches isolés à cette exécution : évite toute contamination avec un
    // autre import qui s'exécuterait en parallèle sur le même serveur.
    const caches = createCaches();

    // Contexte de détection des doublons propre à cet import
    const contexteDoublons = {
        idsCrees: [],               // mouvements créés par CET import (exclus de la comparaison)
        doublonsParCle: new Map()   // nb de lignes déjà ignorées par clé de doublon
    };

    const normalizedData = getNormalizedData(donnees);

    const filteredData = normalizedData.filter(row => row.produitNom && row.produitNom !== '');
    if (filteredData.length < normalizedData.length) {
        console.log(`  ⚠️ ${normalizedData.length - filteredData.length} lignes ignorées (nom de produit vide)`);
    }

    console.log('\n🔍 Étape 1: Analyse des types de mouvements...');
    const typesMouvements = new Set(filteredData.map(row => row.typeMouvement).filter(Boolean));
    console.log(`  📊 Types de mouvements détectés: ${Array.from(typesMouvements).join(', ')}`);

    console.log('\n📍 Étape 2: Récupération des locaux existants...');
    const locauxUniques = new Set();
    for (const row of filteredData) {
        if (row.localSourceNom) {
            locauxUniques.add(row.localSourceNom);
        }
        if (row.localDestinationNom) {
            locauxUniques.add(row.localDestinationNom);
        }
    }

    let locauxTrouves = 0;
    let locauxIgnorees = 0;
    for (const nomLocal of locauxUniques) {
        const localId = await getLocalIfExists(nomLocal, caches);
        if (localId) {
            locauxTrouves++;
        } else {
            locauxIgnorees++;
        }
    }
    console.log(`  ✅ ${locauxTrouves} locaux trouvés, ${locauxIgnorees} locaux ignorés (inexistants)`);

    console.log('\n📥 Étape 3: Importation des mouvements...');
    console.log(`  📊 ${filteredData.length} mouvements à importer`);

    for (const row of filteredData) {
        if (!TYPES_MOUVEMENT.includes(row.typeMouvement)) {
            // Type inconnu : la ligne n'est PAS importée, elle compte comme une erreur
            errors++;
            errorDetails.push(
                `${row.typeMouvement || 'INCONNU'} - ${row.produitNom}: type de mouvement non reconnu ` +
                `(attendu: ${TYPES_MOUVEMENT.join(', ')})`
            );
            console.warn(`  ⚠️ Type de mouvement non reconnu: "${row.typeMouvement}" pour "${row.produitNom}"`);
            continue;
        }
        try {
            const resultat = await traiterMouvementAvecReessai(row, caches, errorDetails, contexteDoublons);
            if (resultat.doublon) {
                doublons++;
                doublonDetails.push(
                    `${row.typeMouvement} - ${row.produitNom} (${formatDateOnly(resultat.dateMouvement)}, qté ${row.quantite}, ${row.nomUtilisateur}) : déjà présent en base, ignoré`
                );
            } else {
                count++;
            }
        } catch (error) {
            errors++;
            errorDetails.push(`${row.typeMouvement || 'INCONNU'} - ${row.produitNom}: ${error.message}`);
            console.error(`❌ ${error.message}`);
        }
    }

    console.log('\n📊 Étape 4: Résumé des stocks finaux...');
    for (const [nomProduit, id] of caches.produitCache) {
        const produit = await prisma.produits.findUnique({
            where: { id_produit: id }
        });
        if (produit) {
            console.log(`  📦 "${nomProduit}" -> Stock final: ${produit.quantite_en_stock}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 RÉSUMÉ DE L'IMPORTATION`);
    console.log('='.repeat(50));
    console.log(`✅ Importations réussies: ${count}`);
    console.log(`♻️ Doublons ignorés: ${doublons}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log(`📊 Total lignes: ${donnees.length}`);

    if (errorDetails.length > 0) {
        console.log('\n📋 Détails des erreurs:');
        errorDetails.forEach(err => console.log(`  - ${err}`));
    }
    console.log('='.repeat(50));

    return {
        // Un import dont toutes les lignes sont des doublons n'est pas un échec
        success: count > 0 || doublons > 0,
        imported: count,
        errors: errors,
        errorDetails,
        doublons,
        doublonDetails,
        total: donnees.length,
        autoEntriesCreated: 0
    };
}

/**
 * Rejoue une fois une ligne dont la création de produit a échoué
 * (création concurrente du même produit par un autre import).
 */
async function traiterMouvementAvecReessai(row, caches, errorDetails, contexteDoublons) {
    try {
        return await traiterMouvement(row, caches, errorDetails, contexteDoublons);
    } catch (error) {
        if (!(error instanceof ConflitCreationProduitError)) throw error;
        console.warn(`  ⚠️ ${error.message} — nouvelle tentative`);
        try {
            return await traiterMouvement(row, caches, null, contexteDoublons);
        } catch (secondError) {
            throw secondError instanceof ConflitCreationProduitError ? (secondError.cause || secondError) : secondError;
        }
    }
}

/**
 * Traite un mouvement individuel (dans une transaction dédiée).
 * Retourne { doublon: true, dateMouvement } si la ligne est un doublon d'un
 * mouvement déjà en base, sinon { doublon: false, mouvement, dateMouvement }.
 */
async function traiterMouvement(row, caches, errorDetails, contexteDoublons) {
    if (!Number.isInteger(row.quantite) || row.quantite <= 0) {
        throw new Error(`Quantité invalide ("${row.quantiteBrute}") pour "${row.produitNom}"`);
    }

    const localSourceId = row.localSourceNom ? await getLocalIfExists(row.localSourceNom, caches) : null;
    const localDestinationId = row.localDestinationNom ? await getLocalIfExists(row.localDestinationNom, caches) : null;

    // Traiter la date (date calendaire à minuit UTC). Une date manquante ou
    // invalide rejette la ligne (voir excelDateToJSDate).
    const dateWarnings = [];
    const dateMouvement = excelDateToJSDate(row.dateMouvement, dateWarnings);
    if (!dateMouvement || isNaN(dateMouvement.getTime())) {
        const raison = dateWarnings[0] || 'date manquante';
        throw new Error(`Date du mouvement non reconnue pour "${row.produitNom}" (${raison}) : ligne ignorée`);
    }

    console.log(`  📅 Date pour "${row.produitNom}": ${formatDateOnly(dateMouvement)} (depuis "${row.dateMouvement}")`);

    let materielId = null;
    if (row.materielStr) {
        const materielWarnings = [];
        const id_n = extractIdNFromMateriel(row.materielStr, materielWarnings);
        if (id_n) {
            materielId = await getMaterielByIdN(id_n, caches);
        }
        if (materielWarnings.length > 0 && errorDetails) {
            errorDetails.push(`⚠️ Matériel pour "${row.produitNom}": ${materielWarnings[0]}`);
        }
    }

    const nomProduit = row.produitNom.trim();
    const motif = row.motif || null;

    const resultat = await prisma.$transaction(async (tx) => {
        let produitId = await trouverProduitImport(tx, nomProduit, caches);
        let cleDoublon = null;

        if (produitId) {
            // Détection des doublons par rapport aux mouvements déjà en base
            // (hors mouvements créés par cet import).
            cleDoublon = [produitId, formatDateOnly(dateMouvement), row.typeMouvement, row.quantite, row.nomUtilisateur, motif].join('|');
            const existants = await tx.mouvement.count({
                where: {
                    id_produit: produitId,
                    date_mouvement: dateMouvement,
                    type_mouvement: row.typeMouvement,
                    quantite: row.quantite,
                    nom_utilisateur: row.nomUtilisateur,
                    motif,
                    id_mouvement: { notIn: contexteDoublons.idsCrees }
                }
            });
            const dejaIgnores = contexteDoublons.doublonsParCle.get(cleDoublon) || 0;
            if (existants > dejaIgnores) {
                return { doublon: true, produitId, cleDoublon };
            }
        } else {
            // Produit inconnu : créé DANS la transaction de la ligne (annulé si la ligne échoue).
            // Stock initial à 0 : la quantité réelle est appliquée par creerMouvement().
            // Le seuil d'alerte est calculé dès la création.
            try {
                const produit = await creerNouveauProduit(tx, { nomProduit, quantiteInitiale: 0 });
                produitId = produit.id_produit;
                console.log(`🆕 Produit créé: "${nomProduit}" (ID: ${produitId}, seuil: ${produit.seuil_alerte})`);
            } catch (error) {
                throw new ConflitCreationProduitError(nomProduit, error);
            }
        }

        // Stock (décrément atomique pour une sortie) + historique + mouvement
        const mouvement = await creerMouvement(tx, {
            idProduit: produitId,
            typeMouvement: row.typeMouvement,
            quantite: row.quantite,
            dateMouvement,
            remarqueHistorique: motif,
            donnees: {
                id_local_source: localSourceId,
                id_local_destination: localDestinationId,
                id_materiels: materielId,
                motif,
                remarque: row.remarque || null,
                nom_utilisateur: row.nomUtilisateur
            }
        });
        return { doublon: false, produitId, mouvement };
    });

    // Mise en cache uniquement après validation de la transaction
    caches.produitCache.set(nomProduit, resultat.produitId);

    if (resultat.doublon) {
        contexteDoublons.doublonsParCle.set(resultat.cleDoublon, (contexteDoublons.doublonsParCle.get(resultat.cleDoublon) || 0) + 1);
        console.log(`  ♻️ Doublon ignoré pour "${row.produitNom}" (${formatDateOnly(dateMouvement)}, ${row.typeMouvement}, ${row.quantite})`);
        return { doublon: true, dateMouvement };
    }

    contexteDoublons.idsCrees.push(resultat.mouvement.id_mouvement);
    console.log(`  ✅ Mouvement créé (ID: ${resultat.mouvement.id_mouvement})`);
    return { doublon: false, mouvement: resultat.mouvement, dateMouvement };
}

/**
 * Version API pour être utilisée dans le contrôleur Express
 * CORRECTION MAJEURE: Lecture avec raw: true pour préserver les dates
 */
export async function importMouvementsFromBuffer(buffer, filename) {
    try {
        console.log(`📂 Lecture du fichier: ${filename}`);
        
        // Lire le workbook avec cellDates: false pour éviter les conversions automatiques
        const workbook = XLSX.read(buffer, { 
            type: 'buffer',
            cellDates: false,  // Désactiver la conversion automatique
            dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        if (workbook.SheetNames.length > 1) {
            console.warn(`⚠️ Le fichier contient ${workbook.SheetNames.length} feuilles (${workbook.SheetNames.join(', ')}) ; seule la première est utilisée.`);
        }
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Lire les données en mode RAW pour garder les valeurs originales
        const data = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: true,  // Garder les valeurs brutes
            dateNF: 'yyyy-mm-dd hh:mm:ss'
        });

        console.log(`📊 ${data.length} lignes trouvées dans le fichier`);

        if (data.length > 0) {
            const firstRow = data[0];
            console.log('📋 Colonnes dans le fichier:', Object.keys(firstRow));
            
            // Afficher la première date pour déboguer
            const firstDate = firstRow['date_mouvement'];
            console.log(`📅 Exemple de date brute: "${firstDate}" (type: ${typeof firstDate})`);
            
            if (typeof firstDate === 'number') {
                console.log(`📅 Date Excel en nombre: ${firstDate} (correspond au ${excelDateToJSDate(firstDate) ? formatDateOnly(excelDateToJSDate(firstDate)) : 'date invalide'})`);
            }
            
            const normalizedFirstRow = normalizeColumnNames(firstRow);
            console.log('📋 Colonnes normalisées:', Object.keys(normalizedFirstRow));
            
            const requiredColumns = ['date_mouvement', 'id_produit', 'type_mouvement'];
            const missingColumns = requiredColumns.filter(col => !(col in normalizedFirstRow));
            
            if (missingColumns.length > 0) {
                throw new Error(
                    `Colonnes manquantes: ${missingColumns.join(', ')}.\n` +
                    `Colonnes trouvées: ${Object.keys(firstRow).join(', ')}.\n` +
                    `Assurez-vous d'avoir les colonnes: date_mouvement, id_produit, type_mouvement`
                );
            }
        }
        
        const result = await importerMouvements(data);
        
        const complements = [];
        if (result.doublons > 0) complements.push(`${result.doublons} doublon(s) ignoré(s)`);
        if (result.errors > 0) complements.push(`${result.errors} erreur(s)`);
        const suffixe = complements.length > 0 ? ` — ${complements.join(', ')}` : '';

        return {
            success: result.success,
            imported: result.imported,
            errors: result.errors,
            errorDetails: result.errorDetails,
            doublons: result.doublons,
            doublonDetails: result.doublonDetails,
            total: data.length,
            autoEntriesCreated: result.autoEntriesCreated || 0,
            message: result.success
                ? `${result.imported} mouvements importés sur ${data.length}${suffixe}`
                : `Aucun mouvement n'a pu être importé${suffixe}`
        };

    } catch (error) {
        console.error('❌ Erreur lors de l\'importation:', error);
        throw error;
    }
}

export default {
    importMouvementsFromBuffer,
    importerMouvements,
    trouverProduitImport,
    getLocalIfExists,
    getMaterielByIdN,
    normalizeColumnNames
};