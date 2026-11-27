// Durées (interventions, fermeture de ticket) : stockées en minutes côté API,
// saisies et affichées au format hh:mm.

// 75 -> "01:15", 2730 -> "45:30" (les heures peuvent dépasser 24).
export const formatDuree = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Saisie -> minutes. Accepte "1:30", "01:30", "1h30", "2h".
// Renvoie null pour une saisie vide, NaN pour une saisie invalide.
export const parseDuree = (saisie) => {
  const texte = String(saisie ?? '').trim();
  if (!texte) return null;
  const m = texte.match(/^(\d{1,3})(?::|h|H)([0-5]\d)?$/) || texte.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!m || (texte.includes(':') && m[2] === undefined)) return NaN;
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
};

// Valeur de champ à partir des minutes de l'API (vide si non renseignée).
export const dureeVersSaisie = (minutes) => (minutes == null || minutes === '' ? '' : formatDuree(minutes));

export const MESSAGE_DUREE_INVALIDE = 'La durée doit être au format hh:mm (ex. 01:30).';
