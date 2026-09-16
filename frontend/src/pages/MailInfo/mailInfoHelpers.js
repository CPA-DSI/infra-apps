import { FaUser, FaShieldAlt, FaCrown, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

export const ROLE_CONFIG = {
    USER: {
        label : 'Utilisateur', bg : '#dcfce7', text : '#16a34a', border: '#86efac',
        Icon: FaUser,
        description: 'Utilisateur standard avec accès de base'
    },
    IT_ADMIN: {
        label : 'Admin IT', bg : '#fee2e2', text : '#dc2626', border: '#fca5a5',
        Icon  : FaShieldAlt,
        description: 'Administrateur du Service Informatique'
    },
    DIRECTION: {
        label: 'Direction', bg: '#f3e8ff', text: '#7c3aed', border: '#c4b5fd',
        Icon: FaCrown,
        description: 'Membre de la direction'
    }
};

export const STATUS_CONFIG = {
    active: {
        label: 'Actif',
        bg: '#dcfce7',
        text: '#16a34a',
        border: '#86efac',
        Icon: FaCheckCircle,
        description: 'Compte utilisateur actif'
    },
    inactive: {
        label: 'Désactivé',
        bg: '#fee2e2',
        text: '#dc2626',
        border: '#fca5a5',
        Icon: FaTimesCircle,
        description: 'Compte utilisateur désactivé'
    }
};

// --- Helpers pour extraire les emails depuis user.emails (relation UserEmail[]) ---
export const getPrimaryEmail = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    return primary.email || '';
};

export const getSecondaryEmail = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    const secondary = user.emails.find(e => e !== primary);
    return secondary ? (secondary.email || '') : '';
};

export const getPrimaryPassword = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    return primary.pass_mail || primary.password_enc || '';
};

export const getSecondaryPassword = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    const secondary = user.emails.find(e => e !== primary);
    return secondary ? (secondary.pass_mail || secondary.password_enc || '') : '';
};

export const formatUserStatus = (isActive) => {
    const statusKey = isActive !== false ? 'active' : 'inactive';
    return STATUS_CONFIG[statusKey];
};

export const formatUserRole = (role) => {
    const defaultRole = {
        label: 'Utilisateur', bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db',
        Icon: FaUser,
        description: 'Rôle non défini, accès standard',
        isUnknown: true
    };

    if (!role || typeof role !== 'string') {
        return defaultRole;
    }

    const normalizedRole = role.toUpperCase().trim();
    const config = ROLE_CONFIG[normalizedRole];

    if (config) {
        return {
            ...config,
            isUnknown: false
        };
    }

    console.warn(`Rôle inconnu détecté: ${role}. Utilisation de la configuration par défaut.`);
    return {
        ...defaultRole,
        label: role,
        description: `Rôle inconnu: ${role}`,
        isUnknown: true
    };
};

export const getEmailCount = (user) => {
    return user?.emails?.length || 0;
};

export const getVerifiedEmailCount = (user) => {
    if (!user?.emails) return 0;
    return user.emails.filter(e => e.is_verified).length;
};

export const getTicketCounts = (user) => {
    const created = user?.tickets_crees?.length || 0;
    const assigned = user?.tickets_assignes?.length || 0;
    const closed = user?.tickets_fermes?.length || 0;
    const total = created + assigned + closed;
    return { created, assigned, closed, total };
};

export const getCommentCount = (user) => {
    return user?.commentaires?.length || 0;
};
