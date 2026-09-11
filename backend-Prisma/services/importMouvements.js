// backend/services/importMouvements.js
import prisma from '../prismaClient.js';
import * as XLSX from 'xlsx';

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
 * Convertit une date Excel (nombre) ou une chaîne en Date JavaScript
 * Version CORRIGÉE et ROBUSTE
 */
function excelDateToJSDate(excelDate, warnings) {
    // Si null, undefined ou vide
    if (!excelDate || excelDate === '' || excelDate === ' ') {
        return new Date();
    }
    
    // Si c'est déjà une date valide
    if (excelDate instanceof Date && !isNaN(excelDate)) {
        return excelDate;
    }
    
    // Si c'est un nombre (format Excel - jours depuis 1900)
    if (typeof excelDate === 'number') {
        // Excel considère que 1900-01-01 = 1, donc on soustrait 1
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + excelDate * 86400000);
        
        // Vérifier que la date est plausible (entre 2000 et 2100)
        if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
            return date;
        }
        
        // Si la date est trop ancienne, essayer de la corriger
        // Certaines versions d'Excel ont un bug de conversion
        if (date.getFullYear() < 1900) {
            // Essayer de parser comme chaîne
            const strDate = String(excelDate);
            const match = strDate.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const day = parseInt(match[3], 10);
                if (year >= 2000 && year <= 2100) {
                    return new Date(year, month, day);
                }
            }
        }
        
        // Si la date est dans le futur ou trop ancienne, utiliser la date du jour
        if (date.getFullYear() < 2000 || date.getFullYear() > 2100) {
            console.warn(`⚠️ Date hors plage: ${date.toISOString()}, utilisation de la date du jour`);
            if (warnings) warnings.push(`date hors plage ("${excelDate}")`);
            return new Date();
        }
        
        return date;
    }
    
    // Si c'est une chaîne
    if (typeof excelDate === 'string') {
        const cleanDate = excelDate.trim();
        
        // Format: "2025-01-16 00:00:00" (AAAA-MM-JJ HH:MM:SS)
        let match = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);
            const hours = parseInt(match[4], 10);
            const minutes = parseInt(match[5], 10);
            const seconds = parseInt(match[6], 10);
            
            if (year >= 2000 && year <= 2100) {
                return new Date(year, month, day, hours, minutes, seconds);
            }
        }
        
        // Format: "2025-01-16" (AAAA-MM-JJ)
        match = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);
            
            if (year >= 2000 && year <= 2100) {
                return new Date(year, month, day);
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
                return new Date(year, month, day);
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
                return new Date(year, month, day);
            }
        }
        
        // Essayer de parser avec Date (dernier recours)
        const date = new Date(cleanDate);
        if (!isNaN(date) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
            return date;
        }
    }
    
    // Si tout échoue, utiliser la date du jour
    console.warn(`⚠️ Date invalide: "${excelDate}", utilisation de la date du jour`);
    if (warnings) warnings.push(`date invalide ("${excelDate}")`);
    return new Date();
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
 * Récupère un produit existant ou le crée s'il n'existe pas
 */
async function getProduit(nom, caches = createCaches()) {
    if (!nom || nom.trim() === '') {
        throw new Error('Le nom du produit est requis');
    }

    const nomTrim = nom.trim();
    const { produitCache } = caches;

    if (produitCache.has(nomTrim)) {
        return produitCache.get(nomTrim);
    }

    let produit = await prisma.produits.findFirst({
        where: {
            nom_produit: {
                equals: nomTrim,
                mode: 'insensitive'
            }
        }
    });

    if (!produit) {
        try {
            produit = await prisma.produits.create({
                data: {
                    nom_produit: nomTrim,
                    quantite_en_stock: 0
                }
            });
            console.log(`🆕 Produit créé: "${nomTrim}" (ID: ${produit.id_produit})`);
        } catch (error) {
            if (error.code === 'P2002') {
                // Un autre import concurrent vient de créer ce produit
                // (contrainte unique produits_nom_produit_norm_key) : on
                // récupère la ligne qu'il vient de créer.
                produit = await prisma.produits.findFirst({
                    where: {
                        nom_produit: {
                            equals: nomTrim,
                            mode: 'insensitive'
                        }
                    }
                });
                console.log(`✅ Produit créé entre-temps par un autre import: "${nomTrim}" (ID: ${produit.id_produit})`);
            } else {
                throw error;
            }
        }
    } else {
        console.log(`✅ Produit trouvé: "${nomTrim}" (ID: ${produit.id_produit})`);
    }

    produitCache.set(nomTrim, produit.id_produit);
    return produit.id_produit;
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
 * Récupère un matériel par son id_n
 */
async function getMaterielByIdN(id_n, caches = createCaches()) {
    if (!id_n) return null;

    const { materielCache } = caches;

    if (materielCache.has(id_n)) {
        return materielCache.get(id_n);
    }

    const materiel = await prisma.materiels.findFirst({
        where: { id_n: id_n }
    });

    if (materiel) {
        materielCache.set(id_n, id_n);
        console.log(`✅ Matériel trouvé: ID_N=${id_n} -> id_materiels=${materiel.id_materiels}`);
        return id_n;
    }

    console.warn(`⚠️ Matériel avec id_n=${id_n} non trouvé dans la base`);
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
        
        // Si le type est vide, le mettre en SORTIE par défaut
        if (!typeMouvement) {
            typeMouvement = 'SORTIE';
        }
        
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
 */
export async function importerMouvements(donnees) {
    console.log(`📊 Début de l'importation de ${donnees.length} mouvements...`);
    
    let count = 0;
    let errors = 0;
    const errorDetails = [];

    // Caches isolés à cette exécution : évite toute contamination avec un
    // autre import qui s'exécuterait en parallèle sur le même serveur.
    const caches = createCaches();

    const normalizedData = getNormalizedData(donnees);

    const filteredData = normalizedData.filter(row => row.produitNom && row.produitNom !== '');
    if (filteredData.length < normalizedData.length) {
        console.log(`  ⚠️ ${normalizedData.length - filteredData.length} lignes ignorées (nom de produit vide)`);
    }

    console.log('\n🔍 Étape 1: Création/vérification des produits...');
    const produitsUniques = new Set();
    const typesMouvements = new Set();
    
    for (const row of filteredData) {
        if (row.produitNom) {
            produitsUniques.add(row.produitNom);
        }
        if (row.typeMouvement) {
            typesMouvements.add(row.typeMouvement);
        }
    }
    
    for (const nomProduit of produitsUniques) {
        try {
            await getProduit(nomProduit, caches);
        } catch (error) {
            console.error(`❌ Erreur pour le produit "${nomProduit}": ${error.message}`);
        }
    }
    
    console.log(`  ✅ ${produitsUniques.size} produits vérifiés/créés`);
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
        try {
            if (row.typeMouvement === 'ENTREE' || row.typeMouvement === 'ENTREE_QUANTITE') {
                await traiterMouvement(row, true, caches, errorDetails);
            } else if (row.typeMouvement === 'SORTIE') {
                await traiterMouvement(row, false, caches, errorDetails);
            } else {
                console.warn(`  ⚠️ Type de mouvement non reconnu: "${row.typeMouvement}" pour "${row.produitNom}"`);
            }
            count++;
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
    console.log(`❌ Erreurs: ${errors}`);
    console.log(`📊 Total lignes: ${donnees.length}`);
    
    if (errorDetails.length > 0) {
        console.log('\n📋 Détails des erreurs:');
        errorDetails.forEach(err => console.log(`  - ${err}`));
    }
    console.log('='.repeat(50));

    return { 
        success: count > 0, 
        imported: count, 
        errors: errors, 
        errorDetails,
        total: donnees.length,
        autoEntriesCreated: 0
    };
}

/**
 * Traite un mouvement individuel
 */
async function traiterMouvement(row, isEntree, caches, errorDetails) {
    if (!Number.isInteger(row.quantite) || row.quantite <= 0) {
        throw new Error(`Quantité invalide ("${row.quantiteBrute}") pour "${row.produitNom}"`);
    }

    const produitId = await getProduit(row.produitNom, caches);
    const localSourceId = row.localSourceNom ? await getLocalIfExists(row.localSourceNom, caches) : null;
    const localDestinationId = row.localDestinationNom ? await getLocalIfExists(row.localDestinationNom, caches) : null;

    // Traiter la date
    let dateMouvement;
    let dateCorrigeeRaison = null;
    if (row.dateMouvement && row.dateMouvement !== '' && row.dateMouvement !== ' ') {
        const dateWarnings = [];
        dateMouvement = excelDateToJSDate(row.dateMouvement, dateWarnings);
        if (dateWarnings.length > 0) {
            dateCorrigeeRaison = dateWarnings[0];
        }
        if (!dateMouvement || isNaN(dateMouvement.getTime()) || dateMouvement.getFullYear() < 2000 || dateMouvement.getFullYear() > 2100) {
            dateMouvement = new Date();
            dateCorrigeeRaison = dateCorrigeeRaison || `date invalide ("${row.dateMouvement}")`;
            console.warn(`  ⚠️ Date invalide pour "${row.produitNom}", utilisation de la date du jour`);
        }
    } else {
        dateMouvement = new Date();
        dateCorrigeeRaison = 'date manquante';
    }

    if (dateCorrigeeRaison && errorDetails) {
        errorDetails.push(
            `⚠️ Date corrigée automatiquement pour "${row.produitNom}" (${dateCorrigeeRaison}) : ` +
            `date du jour (${dateMouvement.toISOString().split('T')[0]}) utilisée à la place.`
        );
    }

    console.log(`  📅 Date pour "${row.produitNom}": ${dateMouvement.toISOString().split('T')[0]} (depuis "${row.dateMouvement}")`);
    
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

    const mouvement = await prisma.$transaction(async (tx) => {
        // SELECT ... FOR UPDATE : verrouille la ligne du produit le temps de la
        // transaction pour éviter que deux imports/mouvements concurrents sur le
        // même produit lisent le même stock avant que l'un des deux ne l'ait mis
        // à jour (ce qui pouvait mener à un stock négatif malgré le contrôle ci-dessous).
        const rows = await tx.$queryRaw`SELECT * FROM produits WHERE id_produit = ${produitId} FOR UPDATE`;
        const produit = rows[0];

        if (!produit) {
            throw new Error(`Produit avec ID ${produitId} introuvable`);
        }

        const stockActuel = produit.quantite_en_stock ?? 0;
        console.log(`  Stock actuel de "${row.produitNom}": ${stockActuel}`);

        if (isEntree) {
            await tx.produits.update({
                where: { id_produit: produitId },
                data: {
                    quantite_en_stock: { increment: row.quantite },
                    last_date: dateMouvement
                }
            });

            await tx.historiqueArrive.create({
                data: {
                    id_produit: produitId,
                    quantite_arrivee: row.quantite,
                    date_arrivee: dateMouvement,
                    ancienne_quantite_stock: stockActuel,
                    ancienne_date_stock: produit.last_date || null,
                    remarque: row.motif ? row.motif.substring(0, 255) : null
                }
            });
            console.log(`  ✅ HistoriqueArrive créé pour "${row.produitNom}" (+${row.quantite})`);
            console.log(`  ✅ Entrée: +${row.quantite} -> nouveau stock: ${stockActuel + row.quantite}`);

        } else {
            if (stockActuel < row.quantite) {
                throw new Error(
                    `Stock insuffisant pour "${row.produitNom}". ` +
                    `Disponible: ${stockActuel}, Demandé: ${row.quantite}`
                );
            }

            await tx.produits.update({
                where: { id_produit: produitId },
                data: {
                    quantite_en_stock: { decrement: row.quantite },
                    last_date: dateMouvement
                }
            });
            console.log(`  ✅ Sortie: -${row.quantite} -> nouveau stock: ${stockActuel - row.quantite}`);
        }

        return await tx.mouvement.create({
            data: {
                id_produit: produitId,
                date_mouvement: dateMouvement,
                type_mouvement: row.typeMouvement,
                quantite: row.quantite,
                id_local_source: localSourceId,
                id_local_destination: localDestinationId,
                id_materiels: materielId,
                motif: row.motif,
                remarque: row.remarque || null,
                nom_utilisateur: row.nomUtilisateur
            }
        });
    });
    
    console.log(`  ✅ Mouvement créé (ID: ${mouvement.id_mouvement})`);
    return mouvement;
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
                console.log(`📅 Date Excel en nombre: ${firstDate} (correspond au ${new Date(1899, 11, 30 + firstDate).toISOString().split('T')[0]})`);
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
        
        return {
            success: result.success,
            imported: result.imported,
            errors: result.errors,
            errorDetails: result.errorDetails,
            total: data.length,
            autoEntriesCreated: result.autoEntriesCreated || 0,
            message: result.imported > 0 
                ? `${result.imported} mouvements importés sur ${data.length} (${result.autoEntriesCreated || 0} entrées automatiques)`
                : 'Aucun mouvement n\'a pu être importé'
        };

    } catch (error) {
        console.error('❌ Erreur lors de l\'importation:', error);
        throw error;
    }
}

export default {
    importMouvementsFromBuffer,
    importerMouvements,
    getProduit,
    getLocalIfExists,
    getMaterielByIdN,
    normalizeColumnNames
};