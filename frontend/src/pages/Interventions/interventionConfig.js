import dayjs from 'dayjs';
import 'dayjs/locale/fr';

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
