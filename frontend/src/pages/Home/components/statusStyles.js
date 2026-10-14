
// Statut -> libellé + classe de ton (couleurs définies dans styles/tones.css).
export const STATUS_STYLES = {
  NOUVEAU: { label: 'Nouveau', className: 'tone--info' },
  EN_COURS: { label: 'En cours', className: 'tone--warning' },
  RESOLU: { label: 'Résolu', className: 'tone--success' },
  FERME: { label: 'Fermé', className: 'tone--neutral' },
  Actif: { label: 'Actif', className: 'tone--success' },
  'En maintenance': { label: 'En maintenance', className: 'tone--warning' },
  Inactif: { label: 'Inactif', className: 'tone--neutral' },
};

export const TICKET_STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME'];

const DEFAULT_TONE = 'tone--neutral';

export const getStatusToneClass = (status) => {
  if (!status) return DEFAULT_TONE;
  return (STATUS_STYLES[status.toUpperCase()] || STATUS_STYLES[status])?.className || DEFAULT_TONE;
};
