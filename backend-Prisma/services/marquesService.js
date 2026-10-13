// services/marquesService.js
// Gestion des marques et statistiques du tableau de bord des marques.
import prisma from '../prismaClient.js';

export class MarqueError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MarqueError';
    this.status = status;
  }
}

// Matériels pris en compte dans les statistiques : ni supprimés (soft delete),
// ni fiches "Sans poste" (est_vide).
const MATERIELS_ACTIFS = { date_suppression: null, est_vide: false };

// URL "vide" stockée en texte ('null', 'undefined') → null
const nettoyerUrlLue = (url) => (url && url !== 'null' && url !== 'undefined' ? url : null);

// URL saisie : chaîne non vide, hors 'null'/'undefined', sinon null
const nettoyerUrlSaisie = (url) => {
  if (url && typeof url === 'string' && url.trim() !== '' && url.trim() !== 'null' && url.trim() !== 'undefined') {
    return url.trim();
  }
  return null;
};

const exigerNomMarque = (nom_marque) => {
  if (!nom_marque || nom_marque.trim() === '') {
    throw new MarqueError('Le nom de la marque est requis.', 400);
  }
};

// Filtre des matériels dont le champ choisi contient le motif (insensible à la casse)
const correspondAuMotif = (materiel, matchingField, motif) => {
  switch (matchingField) {
    case 'caracteristiques':
      return materiel.caracteristiques &&
             materiel.caracteristiques.toLowerCase().includes(motif);
    case 'code_pc':
      return materiel.code_pc &&
             materiel.code_pc.toLowerCase().includes(motif);
    case 'tout':
      return (materiel.caracteristiques && materiel.caracteristiques.toLowerCase().includes(motif)) ||
             (materiel.code_pc && materiel.code_pc.toLowerCase().includes(motif));
    default:
      return materiel.caracteristiques &&
             materiel.caracteristiques.toLowerCase().includes(motif);
  }
};

// Le nom de marque est unique en base : une violation concurrente devient une 409
const traduireDoublon = (error) => {
  if (error?.code === 'P2002') return new MarqueError('Cette marque existe déjà.', 409);
  return error;
};

// Toutes les marques complètes (avec URL)
export async function listMarques() {
  const marques = await prisma.marques.findMany({
    select: {
      id_marque: true,
      nom_marque: true,
      url: true,
      date_modification: true,
    },
    orderBy: {
      nom_marque: 'asc',
    }
  });

  return marques.map(marque => ({
    id_marque: marque.id_marque,
    nom_marque: marque.nom_marque,
    url: nettoyerUrlLue(marque.url),
    date_modification: marque.date_modification
  }));
}

// Toutes les marques pour le SELECT
export function listMarquesSelect() {
  return prisma.marques.findMany({
    select: {
      id_marque: true,
      nom_marque: true,
    },
    orderBy: {
      nom_marque: 'asc',
    }
  });
}

// Marques avec nombre d'équipements (pour DashboardMarque)
export async function listMarquesAvecComptage() {
  const marques = await prisma.marques.findMany({
    select: {
      id_marque: true,
      nom_marque: true,
      url: true,
      date_modification: true,
    },
    orderBy: {
      nom_marque: 'asc',
    }
  });

  // Compter le nombre d'équipements pour chaque marque
  const marquesWithCount = await Promise.all(marques.map(async (marque) => {
    const nombre_equipements = await prisma.materiels.count({
      where: {
        id_marque: marque.id_marque,
        ...MATERIELS_ACTIFS
      }
    });

    return {
      id_marque: marque.id_marque,
      nom_marque: marque.nom_marque,
      url: marque.url,
      date_modification: marque.date_modification,
      nombre_equipements: nombre_equipements
    };
  }));

  // Trier par nombre d'équipements décroissant
  return marquesWithCount.sort((a, b) => b.nombre_equipements - a.nombre_equipements);
}

// Statistiques des équipes et états (pour DashboardMarque)
export async function getStatsEquipesEtats() {
  const materiels = await prisma.materiels.findMany({
    where: MATERIELS_ACTIFS,
    select: {
      id_materiels: true,
      equipe: true,
      etat_pc: true,
      id_marque: true
    }
  });

  const equipeCount = {};
  const etatsCount = {};
  const equipesSet = new Set();

  materiels.forEach(materiel => {
    // Compter par équipe
    const equipe = materiel.equipe || 'Sans équipe';
    equipeCount[equipe] = (equipeCount[equipe] || 0) + 1;
    equipesSet.add(equipe);

    // Compter par état
    const etat = materiel.etat_pc || 'Inconnu';
    etatsCount[etat] = (etatsCount[etat] || 0) + 1;
  });

  // Compter les équipements avec état défini (non null et non vide)
  const nombreAvecEtat = materiels.filter(m => m.etat_pc && m.etat_pc.trim() !== '').length;

  return {
    nombreEquipes: equipesSet.size,
    nombreAvecEtat: nombreAvecEtat,
    etatsCount: etatsCount,
    equipeCount: equipeCount,
    totalEquipements: materiels.length
  };
}

// Nombre de matériels par local (pour DashboardMarque), locaux vides exclus
export async function getMaterielsParLocal() {
  const locauxWithCount = await prisma.locaux.findMany({
    select: {
      id_local: true,
      nom_local: true,
      materiels: {
        where: MATERIELS_ACTIFS,
        select: {
          id_materiels: true
        }
      }
    },
    orderBy: {
      nom_local: 'asc'
    }
  });

  return locauxWithCount
    .map(local => ({
      id_local: local.id_local,
      nom_local: local.nom_local,
      nombre_materiels: local.materiels.length
    }))
    .filter(local => local.nombre_materiels > 0);
}

// Une marque par ID
export async function getMarque(id_marque) {
  const marque = await prisma.marques.findUnique({
    where: { id_marque: parseInt(id_marque) },
    select: {
      id_marque: true,
      nom_marque: true,
      url: true,
      date_modification: true,
    }
  });

  if (!marque) {
    throw new MarqueError('Marque non trouvée.', 404);
  }

  return { ...marque, url: nettoyerUrlLue(marque.url) };
}

// Vérifie qu'aucune marque (hors excluId) ne porte déjà ce nom, sans tenir compte de la casse
const verifierNomLibre = async (nom_marque, excluId, message) => {
  const existingMarque = await prisma.marques.findFirst({
    where: {
      nom_marque: {
        equals: nom_marque.trim(),
        mode: 'insensitive'
      },
      ...(excluId !== undefined ? { id_marque: { not: excluId } } : {})
    }
  });
  if (existingMarque) {
    throw new MarqueError(message, 409);
  }
};

// Création d'une marque, avec association automatique des matériels sans marque
// dont le champ choisi contient le nom de la marque
export async function createMarque({ nom_marque, url, updateMateriels = true, matchingField = 'caracteristiques' }) {
  exigerNomMarque(nom_marque);
  await verifierNomLibre(nom_marque, undefined, 'Cette marque existe déjà.');

  const cleanUrl = nettoyerUrlSaisie(url);

  try {
    // Création de la marque + association des matériels : tout ou rien
    const { nouvelleMarque, materielsUpdated, updateDetails } = await prisma.$transaction(async (tx) => {
      const nouvelleMarque = await tx.marques.create({
        data: {
          nom_marque: nom_marque.trim(),
          url: cleanUrl,
          date_modification: new Date(),
        },
      });

      let materielsUpdated = 0;
      let updateDetails = [];

      // Mettre à jour les matériels qui ont id_marque = null
      if (updateMateriels) {
        const searchPattern = nouvelleMarque.nom_marque.toLowerCase();

        const materielsSansMarque = await tx.materiels.findMany({
          where: {
            id_marque: null
          },
          select: {
            id_materiels: true,
            caracteristiques: true,
            code_pc: true
          }
        });

        const materielsACorrespondre = materielsSansMarque.filter(
          materiel => correspondAuMotif(materiel, matchingField, searchPattern)
        );

        if (materielsACorrespondre.length > 0) {
          const updateResult = await tx.materiels.updateMany({
            where: {
              id_materiels: {
                in: materielsACorrespondre.map(m => m.id_materiels)
              }
            },
            data: {
              id_marque: nouvelleMarque.id_marque,
              date_modification: new Date()
            }
          });

          materielsUpdated = updateResult.count;

          updateDetails = materielsACorrespondre.map(m => ({
            id_materiels: m.id_materiels,
            caracteristiques: m.caracteristiques,
            raison: `Correspondance avec "${matchingField}" contenant "${nouvelleMarque.nom_marque}"`
          }));

          console.log(`✅ ${materielsUpdated} matériel(s) mis à jour avec la marque "${nouvelleMarque.nom_marque}"`);
        }
      }

      return { nouvelleMarque, materielsUpdated, updateDetails };
    });

    return {
      id_marque: nouvelleMarque.id_marque,
      nom_marque: nouvelleMarque.nom_marque,
      url: nouvelleMarque.url,
      date_modification: nouvelleMarque.date_modification,
      materielsUpdated: materielsUpdated,
      updateDetails: updateDetails,
      message: materielsUpdated > 0
        ? `Marque créée et ${materielsUpdated} matériel(s) ont été automatiquement associés.`
        : 'Marque créée avec succès.'
    };
  } catch (error) {
    throw traduireDoublon(error);
  }
}

// Création d'une marque associée à une liste explicite de matériels (sans marque)
export async function createMarqueAvecMateriels({ nom_marque, url, materielIds = [] }) {
  exigerNomMarque(nom_marque);
  await verifierNomLibre(nom_marque, undefined, 'Cette marque existe déjà.');

  const cleanUrl = nettoyerUrlSaisie(url);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const nouvelleMarque = await tx.marques.create({
        data: {
          nom_marque: nom_marque.trim(),
          url: cleanUrl,
          date_modification: new Date(),
        },
      });

      let materielsUpdated = 0;

      if (materielIds && materielIds.length > 0) {
        const updateResult = await tx.materiels.updateMany({
          where: {
            id_materiels: {
              in: materielIds
            },
            id_marque: null
          },
          data: {
            id_marque: nouvelleMarque.id_marque,
            date_modification: new Date()
          }
        });

        materielsUpdated = updateResult.count;
        console.log(`✅ ${materielsUpdated} matériel(s) mis à jour avec la nouvelle marque`);
      }

      return { nouvelleMarque, materielsUpdated };
    });

    return {
      id_marque: result.nouvelleMarque.id_marque,
      nom_marque: result.nouvelleMarque.nom_marque,
      url: result.nouvelleMarque.url,
      date_modification: result.nouvelleMarque.date_modification,
      materielsUpdated: result.materielsUpdated,
      message: `Marque créée avec succès. ${result.materielsUpdated} matériel(s) ont été associés.`
    };
  } catch (error) {
    throw traduireDoublon(error);
  }
}

// Modification du nom / de l'URL d'une marque
export async function updateMarque(id_marque, { nom_marque, url }) {
  exigerNomMarque(nom_marque);
  await verifierNomLibre(nom_marque, parseInt(id_marque), 'Une autre marque porte déjà ce nom.');

  const cleanUrl = nettoyerUrlSaisie(url);

  try {
    const marqueModifiee = await prisma.marques.update({
      where: { id_marque: parseInt(id_marque) },
      data: {
        nom_marque: nom_marque.trim(),
        url: cleanUrl,
        date_modification: new Date(),
      },
    });

    return {
      id_marque: marqueModifiee.id_marque,
      nom_marque: marqueModifiee.nom_marque,
      url: marqueModifiee.url,
      date_modification: marqueModifiee.date_modification
    };
  } catch (error) {
    if (error?.code === 'P2025') throw new MarqueError('Marque non trouvée.', 404);
    throw error;
  }
}

// Suppression d'une marque : ses matériels repassent sans marque
export async function deleteMarque(id_marque) {
  const idMarque = parseInt(id_marque);
  const marque = await prisma.marques.findUnique({
    where: { id_marque: idMarque },
    include: {
      _count: {
        select: {
          materiels: true
        }
      }
    }
  });

  if (!marque) {
    throw new MarqueError('Marque non trouvée.', 404);
  }

  const materielsCount = marque._count.materiels;

  try {
    // Détachement des matériels + suppression de la marque : tout ou rien
    await prisma.$transaction(async (tx) => {
      if (materielsCount > 0) {
        await tx.materiels.updateMany({
          where: {
            id_marque: idMarque
          },
          data: {
            id_marque: null,
            date_modification: new Date()
          }
        });
      }

      await tx.marques.delete({
        where: { id_marque: idMarque },
      });
    });
  } catch (error) {
    if (error?.code === 'P2025') throw new MarqueError('Marque non trouvée.', 404);
    throw error;
  }

  const message = materielsCount > 0
    ? `Marque "${marque.nom_marque}" supprimée avec succès. ${materielsCount} matériel(s) ont été mis à jour.`
    : `Marque "${marque.nom_marque}" supprimée avec succès.`;

  console.log(`🗑️ ${message}`);

  return {
    message: message,
    materielsUpdated: materielsCount,
    deletedMarque: {
      id_marque: marque.id_marque,
      nom_marque: marque.nom_marque
    }
  };
}

// Suppression d'une marque avec réaffectation de ses matériels à une autre marque
export async function deleteMarqueAvecRemplacement(id_marque, default_marque_id) {
  const idMarque = Number(id_marque);
  const idMarqueDefaut = Number(default_marque_id);

  if (!Number.isInteger(idMarque) || idMarque <= 0 || !Number.isInteger(idMarqueDefaut) || idMarqueDefaut <= 0) {
    throw new MarqueError('Identifiants de marque invalides.', 400);
  }
  // On ne peut pas réaffecter les matériels à la marque que l'on supprime
  if (idMarque === idMarqueDefaut) {
    throw new MarqueError('La marque de remplacement doit être différente de la marque supprimée.', 400);
  }

  const marqueToDelete = await prisma.marques.findUnique({
    where: { id_marque: idMarque }
  });

  if (!marqueToDelete) {
    throw new MarqueError('Marque non trouvée.', 404);
  }

  const defaultMarque = await prisma.marques.findUnique({
    where: { id_marque: idMarqueDefaut }
  });

  if (!defaultMarque) {
    throw new MarqueError('Marque par défaut non trouvée.', 404);
  }

  // Réaffectation des matériels + suppression de la marque : tout ou rien
  const materielsCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.materiels.updateMany({
      where: { id_marque: idMarque },
      data: {
        id_marque: idMarqueDefaut,
        date_modification: new Date()
      }
    });
    if (count > 0) {
      console.log(`⚠️ ${count} matériel(s) réaffecté(s) à la marque par défaut "${defaultMarque.nom_marque}"`);
    }

    await tx.marques.delete({
      where: { id_marque: idMarque }
    });
    return count;
  });

  return {
    message: `Marque "${marqueToDelete.nom_marque}" supprimée avec succès. ${materielsCount} matériel(s) ont été reassignés à "${defaultMarque.nom_marque}".`,
    materielsUpdated: materielsCount,
    defaultMarqueUsed: defaultMarque.nom_marque
  };
}

// Association d'une marque existante aux matériels sans marque correspondants
// (motif libre sur caractéristiques/code PC, ou nom de la marque sur le champ choisi)
export async function associerMateriels(id_marque, { matchingField = 'caracteristiques', searchPattern }) {
  const marque = await prisma.marques.findUnique({
    where: { id_marque: parseInt(id_marque) }
  });

  if (!marque) {
    throw new MarqueError('Marque non trouvée.', 404);
  }

  let materielsUpdated = 0;
  let updateDetails = [];

  if (searchPattern) {
    const materielsSansMarque = await prisma.materiels.findMany({
      where: {
        id_marque: null,
        OR: [
          { caracteristiques: { contains: searchPattern, mode: 'insensitive' } },
          { code_pc: { contains: searchPattern, mode: 'insensitive' } }
        ]
      },
      select: {
        id_materiels: true,
        caracteristiques: true
      }
    });

    if (materielsSansMarque.length > 0) {
      const updateResult = await prisma.materiels.updateMany({
        where: {
          id_materiels: {
            in: materielsSansMarque.map(m => m.id_materiels)
          }
        },
        data: {
          id_marque: parseInt(id_marque),
          date_modification: new Date()
        }
      });

      materielsUpdated = updateResult.count;
      updateDetails = materielsSansMarque;
    }
  } else {
    const searchPatternFromMarque = marque.nom_marque.toLowerCase();

    const materielsSansMarque = await prisma.materiels.findMany({
      where: {
        id_marque: null
      },
      select: {
        id_materiels: true,
        caracteristiques: true,
        code_pc: true
      }
    });

    const materielsACorrespondre = materielsSansMarque.filter(
      materiel => correspondAuMotif(materiel, matchingField, searchPatternFromMarque)
    );

    if (materielsACorrespondre.length > 0) {
      const updateResult = await prisma.materiels.updateMany({
        where: {
          id_materiels: {
            in: materielsACorrespondre.map(m => m.id_materiels)
          }
        },
        data: {
          id_marque: parseInt(id_marque),
          date_modification: new Date()
        }
      });

      materielsUpdated = updateResult.count;
      updateDetails = materielsACorrespondre.map(m => ({
        id_materiels: m.id_materiels,
        caracteristiques: m.caracteristiques
      }));
    }
  }

  return {
    message: `${materielsUpdated} matériel(s) mis à jour avec la marque "${marque.nom_marque}"`,
    materielsUpdated,
    updateDetails
  };
}
