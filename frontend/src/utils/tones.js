// Tonalités partagées : les couleurs vivent dans styles/tones.css,
// le JS ne manipule que le nom de la tonalité.

export const TONES = [
  'primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral',
  'sky', 'cyan', 'orange', 'lime', 'pink', 'rose',
];

/** Classe CSS d'une tonalité (repli sur neutral). */
export const toneClass = (tone) => `tone--${TONES.includes(tone) ? tone : 'neutral'}`;
