import {
  FaReceipt, FaFileContract, FaShieldAlt, FaBook, FaProjectDiagram,
  FaCertificate, FaTruck, FaClipboardCheck, FaFile,
} from 'react-icons/fa';

// --- Catégories de documents (alignées sur l'enum Prisma DocumentCategory) ---
// Les couleurs sont portées par la tonalité (styles/tones.css).
export const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',                tone: 'success', icon: FaReceipt },
  CONTRAT_MAINTENANCE: { label: 'Contrat de maintenance', tone: 'orange',  icon: FaFileContract },
  GARANTIE:            { label: 'Garantie',               tone: 'primary', icon: FaShieldAlt },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',       tone: 'cyan',    icon: FaBook },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',          tone: 'lime',    icon: FaProjectDiagram },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',     tone: 'pink',    icon: FaCertificate },
  BON_LIVRAISON:       { label: 'Bon de livraison',       tone: 'warning', icon: FaTruck },
  RAPPORT_AUDIT:       { label: "Rapport d'audit",        tone: 'rose',    icon: FaClipboardCheck },
  AUTRE:               { label: 'Autre',                  tone: 'neutral', icon: FaFile },
};

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_CONFIG).map(value => ({
  value,
  label: CATEGORY_CONFIG[value].label,
  icon: CATEGORY_CONFIG[value].icon,
}));
