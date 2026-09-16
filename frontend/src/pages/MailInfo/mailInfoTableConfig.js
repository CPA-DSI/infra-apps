import { FaUsers, FaUser, FaUserShield, FaCrown, FaCheckCircle, FaShieldAlt, FaClock } from 'react-icons/fa';

export const STATS_CONFIG = [
    {
        key: 'total', icon: FaUsers, label: 'Total',
        colorScheme: { bg: '#1e293b', accent: '#3b82f6', text: '#60a5fa', muted: '#93c5fd', border: '#1e3a5f', iconBg: 'rgba(59,130,246,0.15)' },
        tooltip: 'Nombre total d\'utilisateurs'
    },
    {
        key: 'users', icon: FaUser, label: 'Utilisateur',
        colorScheme: { bg: '#1e293b', accent: '#22c55e', text: '#4ade80', muted: '#86efac', border: '#14532d', iconBg: 'rgba(34,197,94,0.15)' },
        tooltip: 'Utilisateurs standards'
    },
    {
        key: 'admins', icon: FaUserShield, label: 'Admin DSI',
        colorScheme: { bg: '#1e293b', accent: '#f59e0b', text: '#fbbf24', muted: '#fcd34d', border: '#78350f', iconBg: 'rgba(245,158,11,0.15)' },
        tooltip: 'Nombre d\'administrateurs'
    },
    {
        key: 'direction', icon: FaCrown, label: 'Direction',
        colorScheme: { bg: '#1e293b', accent: '#8b5cf6', text: '#a78bfa', muted: '#c4b5fd', border: '#4c1d95', iconBg: 'rgba(139,92,246,0.15)' },
        tooltip: 'Membres de la direction'
    },
    {
        key: 'actifs', icon: FaCheckCircle, label: 'Actifs',
        colorScheme: { bg: '#1e293b', accent: '#22c55e', text: '#4ade80', muted: '#86efac', border: '#14532d', iconBg: 'rgba(34,197,94,0.15)' },
        tooltip: 'Utilisateurs actifs'
    },
    {
        key: 'inactifs', icon: FaUser, label: 'Désactivés',
        colorScheme: { bg: '#1e293b', accent: '#ef4444', text: '#f87171', muted: '#fca5a5', border: '#7f1d1d', iconBg: 'rgba(239,68,68,0.15)' },
        tooltip: 'Utilisateurs désactivés'
    },
    {
        key: 'avecEmail2', icon: FaShieldAlt, label: 'Double email',
        colorScheme: { bg: '#1e293b', accent: '#a855f7', text: '#c084fc', muted: '#d8b4fe', border: '#581c87', iconBg: 'rgba(168,85,247,0.15)' },
        tooltip: 'Utilisateurs avec email secondaire'
    },
    {
        key: 'tickets', icon: FaClock, label: 'Tickets',
        colorScheme: { bg: '#1e293b', accent: '#06b6d4', text: '#22d3ee', muted: '#67e8f9', border: '#164e63', iconBg: 'rgba(6,182,212,0.15)' },
        tooltip: 'Nombre total de tickets'
    }
];

export const PAGINATION_OPTIONS = {
    rowsPerPageText: 'Lignes par page :',
    rangeSeparatorText: 'sur',
    selectAllRowsItem: true,
    selectAllRowsItemText: 'Tout'
};
