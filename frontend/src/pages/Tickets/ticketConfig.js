import {
  FaInfoCircle, FaClock, FaCheckCircle, FaArchive,
  FaFlag, FaExclamationTriangle, FaStarHalfAlt, FaStar,
} from 'react-icons/fa';

// Statuts et priorités des tickets : libellé, icône et tonalité
// (les couleurs sont portées par styles/tones.css).
export const STATUS_CONFIG = {
  NOUVEAU:    { label: 'Nouveau',    tone: 'info',    icon: FaInfoCircle },
  EN_COURS:   { label: 'En cours',   tone: 'warning', icon: FaClock },
  RESOLU:     { label: 'Résolu',     tone: 'success', icon: FaCheckCircle },
  FERME:      { label: 'Fermé',      tone: 'neutral', icon: FaArchive },
  // Anciens statuts, encore affichables dans le détail d'un ticket
  CLOS:       { label: 'Clos',       tone: 'success', icon: FaCheckCircle },
  EN_ATTENTE: { label: 'En attente', tone: 'neutral', icon: FaArchive },
};

/** Statuts actifs (filtres, statistiques). */
export const TICKET_STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME'];

export const PRIORITY_CONFIG = {
  HAUTE:   { label: 'Haute',   tone: 'orange',  icon: FaFlag },
  URGENTE: { label: 'Urgente', tone: 'danger',  icon: FaExclamationTriangle },
  MOYENNE: { label: 'Moyenne', tone: 'warning', icon: FaStarHalfAlt },
  BASSE:   { label: 'Basse',   tone: 'neutral', icon: FaStar },
};
