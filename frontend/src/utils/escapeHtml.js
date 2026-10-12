// Échappe une valeur avant de l'insérer dans du HTML brut (option `html` de
// SweetAlert2) : les données venant de la base ou d'un import Excel (nom
// d'utilisateur, de marque, de produit...) ne doivent jamais être interprétées
// comme du HTML (XSS stockée).
const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
