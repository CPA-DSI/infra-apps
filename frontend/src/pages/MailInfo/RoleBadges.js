import React, { useState } from 'react';
import { FaUser, FaShieldAlt, FaCrown, FaExclamationCircle, FaEdit } from 'react-icons/fa';
import { ROLES } from '../../config/api';
import { formatUserRole } from './mailInfoHelpers';

// COMPOSANT ROLEBADGE AMÉLIORÉ
export const RoleBadge = ({ role, showIcon = true, showTooltip = true, size = 'normal' }) => {
    const { label, bg, text, border, Icon, description, isUnknown } = formatUserRole(role);

    const sizeStyles = {
        small: { fontSize: '0.65rem', padding: '2px 8px', gap: '3px' },
        normal: { fontSize: '0.75rem', padding: '4px 12px', gap: '6px' },
        large: { fontSize: '0.85rem', padding: '6px 16px', gap: '8px' }
    };

    const currentSize = sizeStyles[size] || sizeStyles.normal;

    return (
        <span
            className={`px-2 py-1 rounded-pill small fw-medium d-inline-flex align-items-center gap-1 role-badge ${isUnknown ? 'role-unknown' : ''}`}
            style={{
                backgroundColor: bg, color: text, fontSize: currentSize.fontSize, border: `1px solid ${border}`, padding: currentSize.padding, gap: currentSize.gap, transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'default', letterSpacing: '0.3px', fontWeight: 600
            }}
            role="img"
            aria-label={description}
            title={showTooltip ? `${description} (${label})` : undefined}
        >
             {showIcon && <Icon style={{ fontSize: '0.6rem' }} aria-hidden="true" />}
            <span>{label}</span>
            {isUnknown && (
                    <FaExclamationCircle
                        style={{ fontSize: '0.5rem', marginLeft: '2px' }}
                    aria-label="Rôle non défini"
                />
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
                className="form-select form-select-sm role-edit-select"
                style={{
                    width: '140px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '20px', border: '2px solid #6366f1', backgroundColor: '#f8fafc', padding: '4px 8px', cursor: 'pointer', outline: 'none', boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
                }}
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
            className="d-flex align-items-center gap-2 cursor-pointer"
            onClick={() => setIsEditing(true)}
            style={{
                transition: 'all 0.2s ease', padding: '2px 4px', borderRadius: '8px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Cliquez pour modifier le rôle"
        >
            <RoleBadge role={selectedRole} size="normal" />
            <FaEdit
                style={{
                    fontSize: '0.5rem', color: '#94a3b8', opacity: 0.5, transition: 'all 0.2s ease'
                }}
                className="role-edit-icon"
            />
        </div>
    );
};
