import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { toneClass } from '../../utils/tones';

// Types d'intervention : libellé et tonalité (couleurs dans styles/tones.css).
// Liste identique à l'enum InterventionType du schéma Prisma.
export const TYPE_CONFIG = {
  DEPANNAGE:    { label: 'Dépannage',    tone: 'warning' },
  INSTALLATION: { label: 'Installation', tone: 'success' },
  PREVENTIF:    { label: 'Préventif',    tone: 'info' },
  DEMENAGEMENT: { label: 'Déménagement', tone: 'secondary' },
  PRESTATAIRE:  { label: 'Prestataire',  tone: 'orange' },
  AUTRE:        { label: 'Autre',        tone: 'neutral' },
};

export const INTERVENTION_TYPES = Object.keys(TYPE_CONFIG);

// Sous-types de Dépannage / Installation (liste validée par la DSI), avec des
// exemples affichés sous la liste. Codes identiques à SOUS_TYPES du backend
// (services/interventionService.js). Les autres types n'ont pas de sous-type.
export const SOUS_TYPE_CONFIG = {
  DEPANNAGE: {
    MATERIEL_POSTE:     { label: 'Matériel – Poste de travail', exemples: 'PC qui ne démarre pas, écran, clavier, souris, disque, RAM' },
    IMPRIMANTE_SCANNER: { label: 'Imprimante / Scanner',        exemples: "Bourrage, pilote, file d'attente bloquée, scan vers mail" },
    RESEAU_CONNEXION:   { label: 'Réseau / Connexion',          exemples: "Pas d'internet, câble, Wi-Fi, prise réseau, VPN" },
    SYSTEME:            { label: "Système d'exploitation",      exemples: 'Windows lent, écran bleu, mises à jour bloquées, profil corrompu' },
    BUREAUTIQUE:        { label: 'Bureautique',                 exemples: 'Office, Outlook, PDF, navigateur' },
    MESSAGERIE:         { label: 'Messagerie',                  exemples: 'Mails non reçus, boîte pleine, synchronisation' },
    COMPTE_ACCES:       { label: 'Compte / Accès',              exemples: 'Mot de passe oublié, compte verrouillé, droits sur un dossier partagé' },
    SERVEUR_PARTAGE:    { label: 'Serveur / Partage',           exemples: 'Lecteur réseau inaccessible, NAS, sauvegarde en échec' },
  },
  INSTALLATION: {
    NOUVEAU_POSTE:  { label: 'Nouveau poste',            exemples: "Préparation et mise en service d'un PC ou d'un portable" },
    LOGICIEL:       { label: 'Installation logiciel',    exemples: 'Logiciel métier, Office, utilitaires' },
    MISE_A_JOUR:    { label: 'Mise à jour / Upgrade',    exemples: "Version d'un logiciel, Windows, firmware" },
    PERIPHERIQUE:   { label: 'Périphérique',             exemples: 'Imprimante, scanner, écran supplémentaire, webcam, casque' },
    RESEAU:         { label: 'Réseau',                   exemples: 'Prise réseau, switch, borne Wi-Fi, câblage' },
    SERVEUR_INFRA:  { label: 'Serveur / Infrastructure', exemples: 'Serveur, NAS, onduleur, solution de sauvegarde' },
    SECURITE:       { label: 'Sécurité',                 exemples: 'Antivirus, pare-feu, chiffrement' },
    SALLE_REUNION:  { label: 'Salle de réunion',         exemples: 'Vidéoprojecteur, écran, système de visioconférence' },
  },
};

// Clé des statistiques pour les interventions sans sous-type
export const SOUS_TYPE_NON_PRECISE = 'NON_PRECISE';

export const libelleSousType = (type, sousType) =>
  (sousType && SOUS_TYPE_CONFIG[type]?.[sousType]?.label) || null;

// Liste unique Type + Sous-type du formulaire : valeur « TYPE:SOUS_TYPE » pour
// Dépannage / Installation, « TYPE » seul pour les types sans sous-type.
// En base, type et sous_type restent deux champs distincts.
export const valeurTypeSousType = (type, sousType) => {
  if (!type) return '';
  if (!SOUS_TYPE_CONFIG[type]) return type;
  return sousType ? `${type}:${sousType}` : '';
};

export const lireTypeSousType = (valeur) => {
  const [type = '', sousType = ''] = String(valeur || '').split(':');
  return { type, sous_type: sousType };
};

const GROUPE_AUTRES = 'Autres types';

// Options groupées pour SearchableSelect : Dépannage, Installation, puis les autres types.
export const OPTIONS_TYPE_SOUS_TYPE = [
  ...Object.entries(SOUS_TYPE_CONFIG).flatMap(([type, sousTypes]) =>
    Object.entries(sousTypes).map(([code, { label, exemples }]) => ({
      value: valeurTypeSousType(type, code),
      label,
      description: exemples,
      group: TYPE_CONFIG[type].label,
      groupClassName: `${toneClass(TYPE_CONFIG[type].tone)} tone-chip`,
      display: (
        <span className="itv-type-choisi">
          <span className={`itv-type-choisi-tag ${toneClass(TYPE_CONFIG[type].tone)} tone-chip`}>{TYPE_CONFIG[type].label}</span>
          {label}
        </span>
      ),
    }))),
  ...INTERVENTION_TYPES.filter(t => !SOUS_TYPE_CONFIG[t]).map(t => ({
    value: t,
    label: TYPE_CONFIG[t].label,
    group: GROUPE_AUTRES,
    groupClassName: `${toneClass('neutral')} tone-chip`,
  })),
];

export const PERIODES = [
  { key: 'jour', label: 'Jour' },
  { key: 'mois', label: 'Mois' },
  { key: 'annee', label: 'Année' },
];

const UNITE = { jour: 'day', mois: 'month', annee: 'year' };

// Paramètre `date` attendu par l'API selon la période.
export const dateParam = (periode, ref) =>
  ref.format(periode === 'annee' ? 'YYYY' : periode === 'mois' ? 'YYYY-MM' : 'YYYY-MM-DD');

export const decaler = (periode, ref, n) => ref.add(n, UNITE[periode]);

export const libellePeriode = (periode, ref) => {
  const d = ref.locale('fr');
  if (periode === 'annee') return d.format('YYYY');
  if (periode === 'mois') return d.format('MMMM YYYY');
  return d.format('dddd D MMMM YYYY');
};

export const estPeriodeCourante = (periode, ref) => ref.isSame(dayjs(), UNITE[periode]);

// Période entièrement à venir (commence après maintenant) : rien à afficher.
export const estPeriodeFuture = (periode, ref) => ref.startOf(UNITE[periode]).isAfter(dayjs());

// Libellés de l'axe du graphique (série renvoyée par l'API).
export const libelleSerie = (periode, index) => {
  if (periode === 'annee') return dayjs().month(index).locale('fr').format('MMM');
  if (periode === 'mois') return String(index);
  return `${index}h`;
};

// Durées au format hh:mm (utilitaire partagé avec les tickets).
export { formatDuree } from '../../utils/duree';
