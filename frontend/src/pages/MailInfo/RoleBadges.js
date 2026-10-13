import React, { useState } from 'react';
import { FaUser, FaShieldAlt, FaCrown, FaExclamationCircle, FaEdit } from 'react-icons/fa';
import { ROLES } from '../../config/api';
import { formatUserRole } from './mailInfoHelpers';
import './MailModals.css';

const BADGE_SIZES = ['small', 'normal', 'large'];

// COMPOSANT ROLEBADGE AMÉLIORÉ
export const RoleBadge = ({ role, showIcon = true, showTooltip = true, size = 'normal' }) => {
    const { label, bg, text, border, Icon, description, isUnknown } = formatUserRole(role);
    const sizeClass = BADGE_SIZES.includes(size) ? size : 'normal';

    return (
        <span
            className={`px-2 py-1 rounded-pill small fw-medium d-inline-flex align-items-center gap-1 mail-role-badge mail-role-badge--${sizeClass} ${isUnknown ? 'is-unknown' : ''}`}
            style={{ backgroundColor: bg, color: text, borderColor: border }}
            role="img"
            aria-label={description}
            title={showTooltip ? `${description} (${label})` : undefined}
        >
            {showIcon && <Icon className="mail-role-badge-icon" aria-hidden="true" />}
            <span>{label}</span>
            {isUnknown && (
                <FaExclamationCircle className="mail-role-badge-warn" aria-label="Rôle non défini" />
            )}
        </span>
    );
};

// NOUVEAU COMPOSANT POUR L'ÉDITION DIRECTE DU RÔLE
export const EditableRoleBadge = ({ row, onRoleChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState(row.role || 'USER');

    const handleRoleChange = async (newRole) => {
        setSelectedRole(newRole);
        setIsEditing(false);
        if (onRoleChange) {
            await onRoleChange(row, newRole);
        }
    };

    const roles = Object.entries(ROLES).map(([value, { label }]) => ({
        value,
        label,
        icon: value === 'USER' ? FaUser : value === 'IT_ADMIN' ? FaShieldAlt : FaCrown
    }));

    if (isEditing) {
        return (
            <select
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="form-select form-select-sm mail-role-select"
                aria-label="Rôle"
                autoFocus
                onBlur={() => setIsEditing(false)}
            >
                {roles.map(role => (
                    <option key={role.value} value={role.value}>
                        {role.label}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <div
            className="d-flex align-items-center gap-2 mail-role-editable"
            onClick={() => setIsEditing(true)}
            title="Cliquez pour modifier le rôle"
        >
            <RoleBadge role={selectedRole} size="normal" />
            <FaEdit className="mail-role-edit-icon" aria-hidden="true" />
        </div>
    );
};
