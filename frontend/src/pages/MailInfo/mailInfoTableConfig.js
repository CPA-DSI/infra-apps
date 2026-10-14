import { FaUsers, FaUser, FaUserShield, FaCrown, FaCheckCircle, FaShieldAlt, FaClock } from 'react-icons/fa';

// Couleur de chaque carte : tonalité (styles/tones.css), déclinée en CSS
// sur fond sombre (cf. .mail-stat-tile dans MailModals.css).
export const STATS_CONFIG = [
    {
        key: 'total', icon: FaUsers, label: 'Total', tone: 'info',
        tooltip: 'Nombre total d\'utilisateurs'
    },
    {
        key: 'users', icon: FaUser, label: 'Utilisateur', tone: 'success',
        tooltip: 'Utilisateurs standards'
    },
    {
        key: 'admins', icon: FaUserShield, label: 'Admin DSI', tone: 'warning',
        tooltip: 'Nombre d\'administrateurs'
    },
    {
        key: 'direction', icon: FaCrown, label: 'Direction', tone: 'secondary',
        tooltip: 'Membres de la direction'
    },
    {
        key: 'actifs', icon: FaCheckCircle, label: 'Actifs', tone: 'success',
        tooltip: 'Utilisateurs actifs'
    },
    {
        key: 'inactifs', icon: FaUser, label: 'Désactivés', tone: 'danger',
        tooltip: 'Utilisateurs désactivés'
    },
    {
        key: 'avecEmail2', icon: FaShieldAlt, label: 'Double email', tone: 'pink',
        tooltip: 'Utilisateurs avec email secondaire'
    },
    {
        key: 'tickets', icon: FaClock, label: 'Tickets', tone: 'cyan',
        tooltip: 'Nombre total de tickets'
    }
];
