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

// ──────────────────────────────────────────────
// Plage libre « du … au … » (page Historique des interventions)
// debut / fin : 'YYYY-MM-DD', bornes incluses.
// ──────────────────────────────────────────────
const FMT = 'YYYY-MM-DD';
const iso = d => d.format(FMT);
const lundi = d => d.subtract((d.day() + 6) % 7, 'day').startOf('day');
const debutTrimestre = d => d.month(Math.floor(d.month() / 3) * 3).startOf('month');

// Raccourcis du sélecteur de période (format de DateRangeFilter)
export const PRESETS_INTERVENTIONS = [
  {
    group: 'Jour',
    items: [
      { key: 'today', label: "Aujourd'hui", range: t => [t, t] },
      { key: 'yesterday', label: 'Hier', range: t => [t.subtract(1, 'day'), t.subtract(1, 'day')] },
    ],
  },
  {
    group: 'Semaine',
    items: [
      { key: 'this-week', label: 'Cette semaine', range: t => [lundi(t), lundi(t).add(6, 'day')] },
      { key: 'last-week', label: 'Semaine dernière', range: t => [lundi(t).subtract(7, 'day'), lundi(t).subtract(1, 'day')] },
    ],
  },
  {
    group: 'Mois',
    items: [
      { key: 'this-month', label: 'Ce mois', range: t => [t.startOf('month'), t.endOf('month')] },
      { key: 'last-month', label: 'Mois dernier', range: t => [t.subtract(1, 'month').startOf('month'), t.subtract(1, 'month').endOf('month')] },
      { key: 'last-12-months', label: '12 derniers mois', range: t => [t.subtract(12, 'month').add(1, 'day'), t] },
    ],
  },
  {
    group: 'Trimestre',
    items: [
      { key: 'this-quarter', label: 'Ce trimestre', range: t => [debutTrimestre(t), debutTrimestre(t).add(2, 'month').endOf('month')] },
      { key: 'last-quarter', label: 'Trimestre dernier', range: t => { const s = debutTrimestre(t).subtract(3, 'month'); return [s, s.add(2, 'month').endOf('month')]; } },
    ],
  },
  {
    group: 'Année',
    items: [
      { key: 'this-year', label: 'Cette année', range: t => [t.startOf('year'), t.endOf('year')] },
      { key: 'last-year', label: 'Année dernière', range: t => [t.subtract(1, 'year').startOf('year'), t.subtract(1, 'year').endOf('year')] },
    ],
  },
];

// Raccourci correspondant exactement à la plage (sélection dans le menu), sinon 'custom'.
export const cleRaccourci = (debut, fin, today = dayjs()) => {
  for (const p of PRESETS_INTERVENTIONS.flatMap(g => g.items)) {
    const [d, f] = p.range(today);
    if (iso(d) === debut && iso(f) === fin) return p.key;
  }
  return 'custom';
};

const plage = (debut, fin) => ({ key: cleRaccourci(debut, fin), debut, fin });

const lireJour = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).format(FMT) === v ? v : null);

// Plage lue dans l'URL : ?debut=&fin=, ou l'ancien format ?periode=jour|mois|annee&date=
// (liens du tableau de bord de l'accueil). Par défaut : le mois en cours.
export const plageDepuisUrl = (params) => {
  const debut = lireJour(params.get('debut'));
  const fin = lireJour(params.get('fin'));
  if (debut || fin) {
    const d = debut || fin;
    const f = fin || debut;
    return d <= f ? plage(d, f) : plage(f, d);
  }
  const ref = dayjs(params.get('date') || undefined);
  const r = ref.isValid() ? ref : dayjs();
  const unite = { jour: 'day', annee: 'year' }[params.get('periode')] || 'month';
  return plage(iso(r.startOf(unite)), iso(r.endOf(unite)));
};

// Plage couvrant des mois entiers : nombre de mois, sinon null.
const moisEntiers = (debut, fin) => {
  const d = dayjs(debut);
  const f = dayjs(fin);
  if (d.date() !== 1 || f.date() !== f.daysInMonth()) return null;
  return (f.year() - d.year()) * 12 + f.month() - d.month() + 1;
};

// Plage précédente (sens = -1) ou suivante (sens = 1), de même durée :
// des mois entiers se décalent d'autant de mois (février a 28 jours, mars 31),
// sinon la plage se décale de son nombre de jours.
export const decalerPlage = ({ debut, fin }, sens) => {
  const nbMois = moisEntiers(debut, fin);
  if (nbMois) {
    const d = dayjs(debut).add(sens * nbMois, 'month');
    return plage(iso(d), iso(d.add(nbMois - 1, 'month').endOf('month')));
  }
  const n = dayjs(fin).diff(dayjs(debut), 'day') + 1;
  return plage(iso(dayjs(debut).add(sens * n, 'day')), iso(dayjs(fin).add(sens * n, 'day')));
};

// Libellé lisible : « jeudi 26 novembre 2026 », « novembre 2026 », « 2026 »,
// « 4e trimestre 2026 », sinon « 03/11/2026 – 26/11/2026 ».
export const libellePlage = ({ debut, fin }) => {
  const d = dayjs(debut).locale('fr');
  const f = dayjs(fin).locale('fr');
  if (debut === fin) return d.format('dddd D MMMM YYYY');
  const nbMois = moisEntiers(debut, fin);
  if (nbMois === 1) return d.format('MMMM YYYY');
  if (nbMois === 12 && d.month() === 0) return d.format('YYYY');
  if (nbMois === 3 && d.month() % 3 === 0) return `${d.month() / 3 + 1}${d.month() === 0 ? 'er' : 'e'} trimestre ${d.year()}`;
  return `${d.format('DD/MM/YYYY')} – ${f.format('DD/MM/YYYY')}`;
};

export const estPlageFuture = ({ debut }) => dayjs(debut).isAfter(dayjs(), 'day');

// Libellé d'un point du graphique selon le découpage renvoyé par l'API
// (point.date : début du point pour les plages libres).
export const libellePoint = (decoupage, point, { debut, fin }) => {
  if (decoupage === 'heure') return `${point.index}h`;
  const d = dayjs(point.date).locale('fr');
  if (decoupage === 'mois') return dayjs(debut).year() === dayjs(fin).year() ? d.format('MMM') : d.format('MMM YY');
  return dayjs(debut).month() === dayjs(fin).month() && dayjs(debut).year() === dayjs(fin).year() ? d.format('D') : d.format('DD/MM');
};

// Durées au format hh:mm (utilitaire partagé avec les tickets).
export { formatDuree } from '../../utils/duree';
