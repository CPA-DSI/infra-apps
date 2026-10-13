import './statusStyles.css';

// Statut -> libellé + classe de ton (couleurs définies dans statusStyles.css).
export const STATUS_STYLES = {
  NOUVEAU: { label: 'Nouveau', className: 'ud-tone--info' },
  EN_COURS: { label: 'En cours', className: 'ud-tone--warning' },
  RESOLU: { label: 'Résolu', className: 'ud-tone--success' },
  FERME: { label: 'Fermé', className: 'ud-tone--neutral' },
  Actif: { label: 'Actif', className: 'ud-tone--success' },
  'En maintenance': { label: 'En maintenance', className: 'ud-tone--warning' },
  Inactif: { label: 'Inactif', className: 'ud-tone--neutral' },
};

export const TICKET_STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME'];

const DEFAULT_TONE = 'ud-tone--neutral';

export const getStatusToneClass = (status) => {
  if (!status) return DEFAULT_TONE;
  return (STATUS_STYLES[status.toUpperCase()] || STATUS_STYLES[status])?.className || DEFAULT_TONE;
};
