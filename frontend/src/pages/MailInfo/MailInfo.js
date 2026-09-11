import React, { useEffect, useState, useMemo, useRef } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Button, Alert } from 'react-bootstrap';
import Swal from 'sweetalert2';

import { FaFileExcel, FaPlus, FaTrash, FaEdit, FaSearch, FaTimes, FaSync, FaEye, FaEnvelope, FaUser, FaUsers, FaLayerGroup, FaShieldAlt, FaUserShield, FaCalendarAlt, FaClock, FaCrown, FaExclamationCircle, FaCheckCircle, FaTimesCircle, FaBan, FaFileImport } from 'react-icons/fa';
import { fetchUsers, fetchAllMaterielsByIdN, updateUser } from '../../services/api';
import { ROLE_PERMISSIONS, ROLES } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import DetailsMailModal from './DetailsMailModal';
import UserFormModal from './UserFormModal';

import './Mail.css';

const ROLE_CONFIG = {
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

const STATUS_CONFIG = {
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
const getPrimaryEmail = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    return primary.email || '';
};

const getSecondaryEmail = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    const secondary = user.emails.find(e => e !== primary);
    return secondary ? (secondary.email || '') : '';
};

const getPrimaryPassword = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    return primary.pass_mail || primary.password || '';
};

const getSecondaryPassword = (user) => {
    if (!user?.emails || user.emails.length === 0) return '';
    const primary = user.emails.find(e => e.is_primary) || user.emails[0];
    const secondary = user.emails.find(e => e !== primary);
    return secondary ? (secondary.pass_mail || secondary.password || '') : '';
};

const formatUserStatus = (isActive) => {
    const statusKey = isActive !== false ? 'active' : 'inactive';
    return STATUS_CONFIG[statusKey];
};

const formatUserRole = (role) => {
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

const getEmailCount = (user) => {
    return user?.emails?.length || 0;
};

const getVerifiedEmailCount = (user) => {
    if (!user?.emails) return 0;
    return user.emails.filter(e => e.is_verified).length;
};

const getTicketCounts = (user) => {
    const created = user?.tickets_crees?.length || 0;
    const assigned = user?.tickets_assignes?.length || 0;
    const closed = user?.tickets_fermes?.length || 0;
    const total = created + assigned + closed;
    return { created, assigned, closed, total };
};

const getCommentCount = (user) => {
    return user?.commentaires?.length || 0;
};

// COMPOSANT ROLEBADGE AMÉLIORÉ
const RoleBadge = ({ role, showIcon = true, showTooltip = true, size = 'normal' }) => {
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
const EditableRoleBadge = ({ row, onRoleChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState(row.role || 'USER');
    const { label, bg, text, border, Icon, description } = formatUserRole(selectedRole);

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

const STATS_CONFIG = [
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

const StatCard = React.memo(({ icon: Icon, value, label, colorScheme, tooltip }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="stat-card" role="group" aria-label={label} title={tooltip}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(160deg, ${colorScheme.bg} 0%, #0f172a 100%)`,
                borderLeft: `4px solid ${colorScheme.accent}`,
                borderTop: `1px solid ${colorScheme.border}`,
                borderRight: `1px solid ${colorScheme.border}`,
                borderBottom: `1px solid ${colorScheme.border}`,
                borderRadius: '14px',
                transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: isHovered
                    ? `0 10px 28px ${colorScheme.accent}30, 0 0 0 1px ${colorScheme.accent}40`
                    : '0 2px 8px rgba(0,0,0,0.25)',
                minWidth: '120px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <Icon
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    right: '-10px',
                    bottom: '-16px',
                    fontSize: '4.5rem',
                    color: colorScheme.accent,
                    opacity: isHovered ? 0.1 : 0.05,
                    transform: isHovered ? 'scale(1.1) rotate(-6deg)' : 'scale(1)',
                    transition: 'all 0.4s ease',
                    pointerEvents: 'none'
                }}
            />
            <div className="d-flex align-items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
                <div
                    className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                    style={{
                        backgroundColor: colorScheme.iconBg,
                        width: '42px',
                        height: '42px',
                        boxShadow: `inset 0 0 0 1px ${colorScheme.accent}30`,
                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <Icon style={{ fontSize: '1.1rem', color: colorScheme.accent }} />
                </div>
                <div>
                    <div
                        className="fw-bold"
                        style={{
                            fontSize: '1.4rem',
                            color: colorScheme.text,
                            lineHeight: 1.15,
                            letterSpacing: '-0.3px',
                            fontVariantNumeric: 'tabular-nums',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
                    </div>
                    <div
                        className="fw-semibold text-uppercase"
                        style={{
                            fontSize: '0.68rem',
                            color: colorScheme.muted,
                            letterSpacing: '0.6px'
                        }}
                    >
                        {label}
                    </div>
                </div>
            </div>
        </div>
    );
});

const ActionButtons = React.memo(({ row, handleView, handleEdit, handleToggleStatus, isDirection }) => {
    const isActive = row.is_active !== false;
    return (
        <div className="d-flex gap-2" role="group" aria-label="Actions">
            <Button variant="light" onClick={() => handleView(row)} title="Voir les détails" className="shadow-sm border-0 p-2 rounded-circle" >
                <FaEye size={12} className="text-info" />
            </Button>
            {!isDirection && (
                <Button variant="light" onClick={() => handleEdit(row)} title="Modifier" className="shadow-sm border-0 p-2 rounded-circle" >
                    <FaEdit size={12} className="text-warning" />
                </Button>
            )}
            <Button variant="light" onClick={() => handleToggleStatus(row, !isActive)} title={isActive ? 'Désactiver' : 'Activer'} className="shadow-sm border-0 p-2 rounded-circle" >
                {isActive ? <FaBan size={12} className="text-warning" /> : <FaCheckCircle size={12} className="text-success" />}
            </Button>
        </div>
    );
});

const ExpandableEmailRow = ({ data: user }) => {
    const emails = user?.emails || [];
    const primary = emails.find(e => e.is_primary) || emails[0];
    const otherEmails = emails.filter(e => e !== primary);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            Swal.fire({
                icon: 'success',
                title: 'Copié !',
                text: 'L\'adresse email a été copiée.',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }).catch(err => console.error('Erreur de copie:', err));
    };

    return (
        <div style={{
            padding: '20px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px'
            }}>
                <FaEnvelope style={{ color: '#6366f1', fontSize: '0.85rem' }} />
                <span style={{
                    fontWeight: '700', color: '#374151', fontSize: '0.9rem', letterSpacing: '0.3px'
                }}>
                    Toutes les adresses email ({emails.length})
                </span>
            </div>

            <div className="row g-3">
                {primary && (
                    <div className="col-md-6">
                        <div className="email-cell email-primary" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(primary.email || '')} title="Cliquez pour copier">
                            <span style={{ fontWeight: '600' }}>{primary.email || 'N/A'}</span>
                            <span className="email-badge-primary">PRINCIPAL</span>
                            {primary.is_verified ? (
                                <span className="email-badge-verified">✓ Vérifié</span>
                            ) : (
                                <span className="email-badge-unverified">Non vérifié</span>
                            )}
                        </div>
                    </div>
                )}

                {otherEmails.map((email, idx) => (
                    <div key={email.id_uEmail || idx} className="col-md-6">
                        <div className="email-cell email-secondary" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(email.email || '')} title="Cliquez pour copier">
                            <span>{email.email || 'N/A'}</span>
                            <span className="email-badge-secondary">SECONDAIRE {idx + 1}</span>
                            {email.is_verified ? (
                                <span className="email-badge-verified">✓ Vérifié</span>
                            ) : (
                                <span className="email-badge-unverified">Non vérifié</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PAGINATION_OPTIONS = {
    rowsPerPageText: 'Lignes par page :',
    rangeSeparatorText: 'sur',
    selectAllRowsItem: true,
    selectAllRowsItemText: 'Tout'
};

// COMPOSANT SELECT RECHERCHABLE (visuel identique à un form-select)
const SearchableSelect = ({ value, onChange, options, allLabel, styleClass = 'form-select rounded-pill border-0 shadow-sm', style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                className={styleClass}
                style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setIsOpen(!isOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
            >
                <span style={{ color: value ? 'inherit' : '#6c757d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || allLabel}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#6c757d', marginLeft: '8px', flexShrink: 0 }}>▼</span>
            </div>
            {isOpen && (
                <div
                    style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
                        marginTop: '4px', backgroundColor: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '260px', overflowY: 'auto'
                    }}
                >
                    <div style={{ padding: '8px' }}>
                        <div className="bg-light rounded-pill px-3 py-2 border-0" style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#6c757d', marginRight: '8px' }}><FaSearch /></span>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Rechercher..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px' }}
                            />
                            {search && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>
                    </div>
                    <div
                        onClick={() => { onChange(''); setSearch(''); setIsOpen(false); }}
                        style={{
                            padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem', color: '#6c757d',
                            backgroundColor: value === '' ? '#eef2ff' : 'transparent'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = value === '' ? '#eef2ff' : 'transparent'; }}
                    >
                        {allLabel}
                    </div>
                    {filteredOptions.map(opt => (
                        <div
                            key={opt}
                            onClick={() => { onChange(opt); setSearch(''); setIsOpen(false); }}
                            style={{
                                padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                backgroundColor: opt === value ? '#eef2ff' : 'transparent', color: '#4f46e5', fontWeight: opt === value ? 600 : 400
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = opt === value ? '#eef2ff' : 'transparent'; }}
                        >
                            {opt}
                        </div>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div style={{ padding: '9px 14px', fontSize: '0.85rem', color: '#adb5bd' }}>Aucun résultat</div>
                    )}
                </div>
            )}
        </div>
    );
};

const UsersManager = () => {

    const { user } = useAuth();
    const userRole = user?.role?.toUpperCase();
    const isDirection = userRole === 'DIRECTION';

    const [users, setUsers] = useState([]);
    const [allMateriels, setAllMateriels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState('');
    const [filterEquipe, setFilterEquipe] = useState('');
    const [filterLocal, setFilterLocal] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [currentMailData, setCurrentMailData] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [userModalMode, setUserModalMode] = useState('add');
    const [userModalData, setUserModalData] = useState(null);

    const [copyToast, setCopyToast] = useState({ show: false, message: '' });
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyToast({ show: true, message: `${label} copié !` });
            setTimeout(() => setCopyToast({ show: false, message: '' }), 2000);
        }).catch(err => {
            console.error('Erreur de copie:', err);
        });
    };

    useEffect(() => {
        loadData();
        loadMaterielsList();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchUsers();
            setUsers(data);
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadMaterielsList = async () => {
        try {
            const data = await fetchAllMaterielsByIdN();
            setAllMateriels(data);
        } catch (error) {
            console.error('Erreur chargement matériels:', error.message);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        await loadData();
        await loadMaterielsList();
    };

    const handleResetFilters = () => {
        setFilterText('');
        setFilterEquipe('');
        setFilterLocal('');
        setFilterRole('');
        setFilterStatus('');
    };

    const filteredUsers = useMemo(() => {
        const searchText = filterText.toLowerCase();
        return users.filter(user => {
            const utilisateur = (user.materiel?.utilisateur || '').toLowerCase();
            const equipe = user.materiel?.equipe || '';
            const equipeLower = equipe.toLowerCase();
            const local = user.materiel?.local?.nom_local || '';
            const localLower = local.toLowerCase();
            const idN = user.materiel?.id_n?.toString().toLowerCase() || '';
            const email1 = getPrimaryEmail(user);
            const email2 = getSecondaryEmail(user);
            const role = user.role?.toLowerCase() || '';
            const searchMatch = utilisateur.includes(searchText) || equipeLower.includes(searchText) || localLower.includes(searchText) || idN.includes(searchText) || email1.includes(searchText) || email2.includes(searchText) || role.includes(searchText);
            const equipeMatch = !filterEquipe || equipe === filterEquipe;
            const localMatch = !filterLocal || local === filterLocal;
            const roleMatch = !filterRole || user.role === filterRole;
            const statusMatch = !filterStatus || formatUserStatus(user.is_active).label === filterStatus;
            
            return searchMatch && equipeMatch && localMatch && roleMatch && statusMatch;
        });
    }, [filterText, filterEquipe, filterLocal, filterRole, filterStatus, users]);

    const stats = useMemo(() => {
        const equipes = [...new Set(users.map(u => u.materiel?.equipe).filter(Boolean))];
        const userCount = users.filter(u => u.role === 'USER').length;
        const adminCount = users.filter(u => u.role === 'IT_ADMIN').length;
        const directionCount = users.filter(u => u.role === 'DIRECTION').length;
        const unknownRoleCount = users.filter(u => !u.role || !Object.keys(ROLE_PERMISSIONS).includes(u.role)).length;
        const actifsCount = users.filter(u => u.is_active !== false).length;
        const inactifsCount = users.filter(u => u.is_active === false).length;

        if (process.env.NODE_ENV !== 'production' && actifsCount + inactifsCount !== users.length) {
            console.warn(`Incohérence stats: actifs (${actifsCount}) + inactifs (${inactifsCount}) !== total (${users.length})`);
        }
        const totalTickets = users.reduce((sum, u) => {
            const counts = getTicketCounts(u);
            return sum + counts.total;
        }, 0);
        
        return {
            total: users.length,
            actifs: actifsCount,
            inactifs: inactifsCount,
            avecEmail2: users.filter(u => getSecondaryEmail(u) && getSecondaryEmail(u).trim() !== '').length,
            equipes: equipes.length,
            admins: adminCount,
            users: userCount,
            direction: directionCount,
            unknownRoles: unknownRoleCount,
            tickets: totalTickets,
            filtres: filteredUsers.length,
            roleDetails: {
                USER: { count: userCount, percentage: users.length ? Math.round((userCount / users.length) * 100) : 0 },
                IT_ADMIN: { count: adminCount, percentage: users.length ? Math.round((adminCount / users.length) * 100) : 0 },
                DIRECTION: { count: directionCount, percentage: users.length ? Math.round((directionCount / users.length) * 100) : 0 }
            }
        };
    }, [users, filteredUsers]);

    const availableMateriels = useMemo(() => {
        const usedIds = new Set(users.map(u => u.materiel?.id_n || u.id_n).filter(Boolean));
        return allMateriels.filter(m => !usedIds.has(m.id_n));
    }, [users, allMateriels]);

    const modernStyles = {
        table: {
            style: {
                backgroundColor: 'transparent', borderRadius: '20px', overflow: 'hidden',
            },
        },
        headRow: {
            style: {
               backgroundColor: '#f0f4f8', border: 'none', minHeight: '56px', borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e2e8f0', fontWeight: 700,
            },
        },
        headCells: {
            style: {
                fontSize: '0.7rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', paddingLeft: '12px', paddingRight: '12px', paddingTop: '14px', paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none',
            },
        },
        rows: {
            style: {
                fontSize: '12px', fontWeight: '500', color: '#334155', minHeight: '56px', paddingLeft: '12px', paddingRight: '12px', borderBottom: '1px solid #e2e8f0', transition: 'all 0.3s ease',
                '&:hover': {
                    backgroundColor: '#f8fafc',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                },
            },
            highlightOnHoverStyle: {
                backgroundColor: '#f0f8ff', color: '#0056b3', cursor: 'pointer', transitionDuration: '0.2s',
            },
        },
        pagination: {
            style: {
                border: 'none', fontSize: '13px', color: '#6c757d', paddingTop: '20px', backgroundColor: 'transparent',
            },
            pageButtonsStyle: {
                borderRadius: '4px', height: '32px', cursor: 'pointer', transition: 'all 0.3s',
                '&:hover:not(:disabled)': {
                    backgroundColor: '#667eea',
                    color: 'white',
                },
                '&:disabled': {
                    cursor: 'unset',
                    opacity: 0.5,
                },
            },
        },
        noData: {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
            },
        },
    };

    const exportToExcel = () => {
        const dataToExport = users.map(u => ({
            'N°': u.id_n,
            'Utilisateur': u.materiel?.utilisateur || 'N/A',
            'Équipe': u.materiel?.equipe || 'N/A',
            'Site': u.materiel?.local?.nom_local || 'N/A',
            'Rôle': formatUserRole(u.role).label,
            'Statut': formatUserStatus(u.is_active).label,
            'Email Principal': getPrimaryEmail(u),
            'Mot de passe 1': getPrimaryPassword(u),
            'Email Secondaire': getSecondaryEmail(u),
            'Mot de passe 2': getSecondaryPassword(u),
            'Nb Emails': getEmailCount(u),
            'Emails Vérifiés': getVerifiedEmailCount(u),
            'Tickets Créés': getTicketCounts(u).created,
            'Tickets Assignés': getTicketCounts(u).assigned,
            'Tickets Fermés': getTicketCounts(u).closed,
            'Commentaires': getCommentCount(u),
            'Créé le': u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '-',
            'Modifié le': u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('fr-FR') : '-',
            "Date d'export": new Date().toLocaleDateString('fr-FR')
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
                if (worksheet[cellAddress]) {
                    worksheet[cellAddress].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: 'F0F0F0' } }
                    };
                }
            }
            worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: range.e.c, r: 0 } }) };
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Utilisateurs');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

        const now = new Date();
        const filename = `export_utilisateurs_${now.toISOString().split('T')[0]}.xlsx`;
        saveAs(blob, filename);
    };

    const handleToggleStatus = async (user, newStatus) => {
        const actionLabel = newStatus ? 'activer' : 'désactiver';
        const actionColor = newStatus ? '#22c55e' : '#dc3545';
        
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            html: `Cette action va <strong>${actionLabel}</strong> le compte de <strong>${user.materiel?.utilisateur || 'cet utilisateur'}</strong>.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: actionColor,
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Oui, ${actionLabel}`,
            cancelButtonText: 'Annuler',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                handleStatusUpdate(user, newStatus);
            }
        });
    };

    const openDisable = (user) => {
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            html: `Cette action va <strong>désactiver</strong> le compte de <strong>${user.materiel?.utilisateur || 'cet utilisateur'}</strong>. Il ne pourra plus se connecter.`,
            icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', confirmButtonText: 'Oui, désactiver', cancelButtonText: 'Annuler', reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                handleStatusUpdate(user, false);
            }
        });
    };

    const openEdit = (user) => {
        setUserModalData(user);
        setUserModalMode('edit');
        setShowUserModal(true);
    };

    const openDetails = (user) => {
        setCurrentMailData(user);
        setShowDetailsModal(true);
    };

    const closeDetails = () => {
        setShowDetailsModal(false);
        setCurrentMailData(null);
    };

    const handleEmailAddedFromDetails = () => {
        loadData();
    };

    const calculateColumnWidth = (data, selector, options = {}) => {
        const { minWidth = 80, maxWidth = 400, extraPadding = 20, charWidth = 8 } = options;
        
        if (!data || data.length === 0) return minWidth;
        
        let maxLength = 0;
        data.forEach(row => {
            const value = selector(row);
            if (value) {
                const strValue = String(value);
                if (strValue.length > maxLength) {
                    maxLength = strValue.length;
                }
            }
        });
        
        const estimatedWidth = maxLength * charWidth + extraPadding;
        
        return Math.max(minWidth, Math.min(maxWidth, estimatedWidth));
    };

    const columnWidths = useMemo(() => {
        if (!users || users.length === 0) {
            return {
                id_n: { width: '65px' },
                utilisateur: { minWidth: '140px', maxWidth: '200px' },
                equipe: { minWidth: '150px', maxWidth: '220px' },
                site: { minWidth: '150px', maxWidth: '220px' },
                email_1: { minWidth: '180px', maxWidth: '350px' },
                pass_mail_1: { minWidth: '100px', maxWidth: '180px' },
                email_2: { minWidth: '180px', maxWidth: '350px' },
                pass_mail_2: { minWidth: '100px', maxWidth: '180px' },
                statut: { width: '110px' },
                emails: { width: '110px' },
                tickets: { width: '130px' },
                createdAt: { width: '110px' },
                updatedAt: { width: '110px' }
            };
        }

        return {
            id_n: {
                width: calculateColumnWidth(users, row => row.id_n, { minWidth: 50, maxWidth: 80, extraPadding: 15 }) + 'px'
            },
            utilisateur: {
                minWidth: calculateColumnWidth(users, row => row.materiel?.utilisateur || '', { minWidth: 100, maxWidth: 200, extraPadding: 30 }) + 'px',
                maxWidth: '250px'
            },
            equipe: {
                minWidth: calculateColumnWidth(users, row => row.materiel?.equipe || '', { minWidth: 100, maxWidth: 200, extraPadding: 30 }) + 'px',
                maxWidth: '280px'
            },
            site: {
                minWidth: calculateColumnWidth(users, row => row.materiel?.local?.nom_local || '', { minWidth: 100, maxWidth: 200, extraPadding: 30 }) + 'px',
                maxWidth: '280px'
            },
            email_1: {
                minWidth: calculateColumnWidth(users, row => getPrimaryEmail(row), { minWidth: 150, maxWidth: 300, extraPadding: 40 }) + 'px',
                maxWidth: '400px'
            },
            pass_mail_1: {
                minWidth: calculateColumnWidth(users, row => getPrimaryPassword(row), { minWidth: 80, maxWidth: 150, extraPadding: 20 }) + 'px',
                maxWidth: '200px'
            },
            email_2: {
                minWidth: calculateColumnWidth(users, row => getSecondaryEmail(row), { minWidth: 150, maxWidth: 300, extraPadding: 40 }) + 'px',
                maxWidth: '400px'
            },
            pass_mail_2: {
                minWidth: calculateColumnWidth(users, row => getSecondaryPassword(row), { minWidth: 80, maxWidth: 150, extraPadding: 20 }) + 'px',
                maxWidth: '200px'
            },
            statut: { width: '110px' },
            nbEmails: { width: '110px' },
            emails: { width: '110px' },
            tickets: { width: '130px' },
            createdAt: { width: '110px' },
            updatedAt: { width: '110px' }
        };
    }, [users]);

    // Fonction pour mettre à jour le rôle directement depuis le tableau
    const handleRoleUpdate = async (user, newRole) => {
        try {
            const payload = {
                role: newRole,
                emails: (user.emails || []).map((e, idx) => ({
                    email: e.email || '',
                    pass_mail: e.pass_mail || '',
                    password: e.password || '',
                    is_primary: idx === 0 ? true : (e.is_primary ?? false),
                    is_verified: e.is_verified ?? false
                }))
            };

            const primaryEmail = payload.emails[0];
            if (primaryEmail?.password && primaryEmail.password.trim() !== '' && !primaryEmail.password.trim().startsWith('$2b$')) {
                payload.password_1 = primaryEmail.password.trim();
            }

            await updateUser(user.id_user, payload);
            await loadData();

            Swal.fire({
                icon: 'success',
                title: 'Rôle mis à jour !',
                text: `Le rôle a été changé en ${formatUserRole(newRole).label}`,
                timer: 2000, showConfirmButton: false, toast: true, position: 'top-end'
            });
            setSuccessMessage(`Le rôle a été changé en ${formatUserRole(newRole).label}`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error('Erreur lors du changement de rôle:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Impossible de modifier le rôle. Veuillez réessayer.',
                confirmButtonText: 'OK'
            });
            setError('Impossible de modifier le rôle. Veuillez réessayer.');
            setTimeout(() => setError(null), 5000);
        }
    };

    const handleStatusUpdate = async (user, isActive) => {
        try {
            const payload = {
                is_active: isActive,
                emails: (user.emails || []).map((e, idx) => ({
                    email: e.email || '',
                    pass_mail: e.pass_mail || '',
                    password: e.password || '',
                    is_primary: idx === 0 ? true : (e.is_primary ?? false),
                    is_verified: e.is_verified ?? false
                }))
            };

            const primaryEmail = payload.emails[0];
            if (primaryEmail?.password && primaryEmail.password.trim() !== '' && !primaryEmail.password.trim().startsWith('$2b$')) {
                payload.password_1 = primaryEmail.password.trim();
            }

            await updateUser(user.id_user, payload);
            await loadData();

            Swal.fire({
                icon: 'success',
                title: 'Statut mis à jour !',
                text: isActive ? 'Le compte a été activé.' : 'Le compte a été désactivé.',
                timer: 2000, showConfirmButton: false, toast: true, position: 'top-end'
            });
            setSuccessMessage(isActive ? 'Le compte a été activé.' : 'Le compte a été désactivé.');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error('Erreur lors du changement de statut:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Impossible de modifier le statut. Veuillez réessayer.',
                confirmButtonText: 'OK'
            });
            setError('Impossible de modifier le statut. Veuillez réessayer.');
            setTimeout(() => setError(null), 5000);
        }
    };

    const columns = useMemo(() => [
        { 
            name: 'N°', 
            selector: row => row.id_n, 
            sortable: true, grow: 1, width: '100px', center: true
        },
        {
            name: 'Utilisateur', 
            selector: row => row.materiel?.utilisateur || 'Aucun', 
            sortable: true, 
            minWidth: columnWidths.utilisateur.minWidth,
            maxWidth: columnWidths.utilisateur.maxWidth,
            grow: 1,
            wrap: true,
            cell: row => (
                <span className="fw-medium" style={{ color: '#3b82f6', fontSize: '0.8rem' }}>
                    {row.materiel?.utilisateur || 'N/A'}
                </span>
            ),
        },
        { 
            name: 'Équipe', 
            selector: row => row.materiel?.equipe || 'N/A', 
            sortable: true, 
            minWidth: columnWidths.equipe.minWidth,
            maxWidth: columnWidths.equipe.maxWidth,
            grow: 1,
            wrap: true,
            cell: row => {
                const equipe = row.materiel?.equipe || 'N/A';
                if (equipe === 'N/A') {
                    return <span className="text-muted small">N/A</span>;
                }
                return (
                    <span 
                        className="badge rounded-pill fw-medium" 
                        style={{ 
                            backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', fontSize: '0.75rem', padding: '5px 12px', letterSpacing: '0.3px'
                        }}
                    >
                        {equipe}
                    </span>
                );
            }
        },
        {
            name: 'Site',
            selector: row => row.materiel?.local?.nom_local || 'N/A',
            sortable: true,
            minWidth: columnWidths.site.minWidth,
            maxWidth: columnWidths.site.maxWidth,
            grow: 1,
            wrap: true,
            cell: row => {
                const site = row.materiel?.local?.nom_local || 'N/A';
                if (site === 'N/A') {
                    return <span className="text-muted small">N/A</span>;
                }
                return (
                    <span 
                        className="badge rounded-pill fw-medium" 
                        style={{ 
                           backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', fontSize: '0.75rem', padding: '5px 12px', letterSpacing: '0.3px'
                        }}
                    >
                        {site}
                    </span>
                );
            }
        },
        {
            name: 'Rôle', 
            selector: row => row.role, 
            sortable: true, 
            width: '160px',
            center: true,
            cell: row => (
                <EditableRoleBadge 
                    row={row} 
                    onRoleChange={handleRoleUpdate}
                />
            )
        },
        {
            name: 'Statut',
            selector: row => formatUserStatus(row.is_active).label,
            sortable: true,
            width: '120px',
            center: true,
            cell: row => {
                const { label, bg, text, border, Icon } = formatUserStatus(row.is_active);
                return (
                    <span
                        className="badge rounded-pill d-inline-flex align-items-center gap-1"
                        style={{
                            backgroundColor: bg, color: text, border: `1px solid ${border}`, fontSize: '0.75rem', padding: '4px 12px', gap: '6px', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'default', letterSpacing: '0.3px', fontWeight: 600
                        }}
                    >
                        <Icon style={{ fontSize: '0.6rem' }} aria-hidden="true" />
                        <span>{label}</span>
                    </span>
                );
            }
        },
        
        {
            name: 'Email Principal',
            selector: row => getPrimaryEmail(row),
            sortable: true,
            minWidth: columnWidths.email_1.minWidth,
            maxWidth: columnWidths.email_1.maxWidth,
            grow: 3,
            wrap: true,
            expandableRows: true,
            expandableRowComponent: ({ data }) => <ExpandableEmailRow data={data} />,
            expandableRowSelector: row => (row.emails?.length || 0) > 1,
            expandableRowExpanded: (row) => false,
            cell: row => {
                const primary = row.emails?.find(e => e.is_primary) || row.emails?.[0];
                const isVerified = primary?.is_verified;
                const emailCount = row.emails?.length || 0;

                return (
                    <div
                        className="email-cell email-primary cursor-pointer"
                        onClick={() => copyToClipboard(getPrimaryEmail(row), 'Email principal')}
                        title={emailCount > 1 ? 'Cliquez pour copier l\'email principal. Développez pour voir tous les emails.' : 'Cliquez pour copier'}
                    >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPrimaryEmail(row)}</span>
                        {isVerified ? (
                            <span className="email-badge-verified">✓ Vérifié</span>
                        ) : (
                            primary && <span className="email-badge-unverified">Non vérifié</span>
                        )}
                        {emailCount > 1 && (
                            <FaUsers
                                size={10}
                                style={{
                                    marginLeft: '6px',
                                    color: '#6366f1',
                                    opacity: 0.7,
                                    flexShrink: 0
                                }}
                                title={`${emailCount} email(s) au total. Développez pour voir tous les emails.`}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            name: 'Nb Emails',
            center: true,
            width: '110px',
            sortable: true,
            cell: row => {
                const count = row.emails?.length || 0;
                const verified = row.emails?.filter(e => e.is_verified).length || 0;
                const hasMultiple = count > 1;

                return (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: hasMultiple ? '#6366f1' : '#f1f5f9',
                            color: hasMultiple ? 'white' : '#64748b',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease',
                            cursor: hasMultiple ? 'pointer' : 'default'
                        }}>
                            <FaEnvelope size={9} />
                            {count}
                        </div>
                        {count > 0 && (
                            <div style={{
                                fontSize: '0.65rem',
                                color: verified > 0 ? '#15803d' : '#b45309',
                                marginTop: '3px',
                                fontWeight: '500'
                            }}>
                                ✓{verified}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            name: 'Modifié le',
            selector: row => row.updatedAt,
            sortable: true,
            width: columnWidths.updatedAt.width,
            center: true,
            cell: row => (
                <span className="text-muted small">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('fr-FR') : '-'}
                </span>
            )
        },
        {
            name: 'Actions',
            cell: row => (
                <ActionButtons row={row} handleView={openDetails} handleEdit={openEdit} handleToggleStatus={handleToggleStatus} isDirection={isDirection} />
            ),
            ignoreRowClick: true, 
            button: true, 
            width: '120px', 
            center: true
        }
    ], [columnWidths]);

    return (
        <div className="container-fluid py-2 px-2 page-mail" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>

            <div 
                className="d-flex justify-content-between align-items-center mb-4 p-2 p-md-3 rounded-3" 
                style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 6px 24px rgba(102, 126, 234, 0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', minHeight: '80px'
                }}
            >
            <div className="d-flex align-items-center gap-2">
                    <div 
                        className="d-flex align-items-center justify-content-center flex-shrink-0" 
                            style={{
                                background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', width: '45px', height: '45px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)', transition: 'all 0.3s ease', cursor: 'pointer'
                            }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.transform = 'rotate(-15deg) scale(1.08)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 255, 255, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <FaEnvelope className="text-white" style={{ fontSize: '1.2rem' }} />
                    </div>
                    <div>
                        <h1 className="h5 fw-bold text-white mb-1" style={{ letterSpacing: '0.3px', fontSize: '1.35rem' }}>
                            Gestion des Utilisateurs
                        </h1>
                        <p className="text-white mb-0" style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: '300' }}>
                            Administrez les accès et rôles de vos collaborateurs
                        </p>
                    </div>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn-pill btn-pill-ghost btn-refresh" onClick={handleRefresh} disabled={loading} title="Actualiser" >
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </button>

                    {!isDirection && (
                        <button className="btn-pill btn-pill-success shadow-sm" onClick={() => {}} title="Importer des données" >
                            <FaFileImport size={13} />
                            <span>Importer</span>
                        </button>
                    )}

                    <button className="btn-pill btn-pill-warning shadow-sm" onClick={exportToExcel} title="Exporter les données" >
                        <FaFileExcel size={13} />
                        <span>Exporter</span>
                    </button>

                    {!isDirection && (
                        <button className="btn-pill btn-pill-primary shadow-sm" onClick={() => { setUserModalData(null); setUserModalMode('add'); setShowUserModal(true); }} title="Ajouter un nouvel utilisateur" >
                            <FaPlus size={14} />
                            <span>Ajouter</span>
                        </button>
                    )}
                </div>
            </div>

            {copyToast.show && (
                <div 
                    className="position-fixed bottom-0 end-0 m-4 p-3 bg-success text-white rounded shadow"
                    style={{ zIndex: 9999, animation: 'fadeIn 0.3s ease' }}
                >
                    ✓ {copyToast.message}
                </div>
            )}

            <div className="border-0 shadow-lg" style={{ borderRadius: '25px', fontFamily: "'Inter', sans-serif" }}>
                <div className="p-4 p-lg-5">

                    {error && <Alert variant="danger" className="mb-3" style={{ borderRadius: '12px' }}>{error}</Alert>}
                    {successMessage && <Alert variant="success" className="mb-3" style={{ borderRadius: '12px' }}>{successMessage}</Alert>}

                    <div className="row mb-4 g-3">
                        {STATS_CONFIG.map((config, index) => (
                            <div 
                                className="col-6 col-lg-3" 
                                key={config.key}
                                style={{
                                    animation: 'fadeInUp 0.5s ease forwards', opacity: 0, animationDelay: `${index * 0.1}s`
                                }}
                            >
                                <StatCard icon={config.icon} value={stats[config.key]} label={config.label} colorScheme={config.colorScheme} tooltip={config.tooltip} />
                            </div>
                        ))}
                    </div>

                    <div className="row mb-4 g-3">
                        <div className="col-md-3 col-lg-3">
                            <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: '#6c757d', marginRight: '8px' }}><FaSearch /></span>
                                <input
                                    type="text" placeholder="Rechercher un collaborateur..." value={filterText} onChange={e => setFilterText(e.target.value)}
                                    style={{
                                        flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px'
                                    }}
                                />
                                {filterText && (
                                    <button
                                        onClick={() => setFilterText('')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}
                                    >
                                        <FaTimes />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="col-md-3 col-lg-3">
                            <SearchableSelect
                                value={filterEquipe}
                                onChange={setFilterEquipe}
                                options={[...new Set(users.map(u => u.materiel?.equipe).filter(Boolean))]}
                                allLabel="Toutes les équipes"
                                style={{ backgroundColor: '#f8f9fa', fontSize: '0.9rem' }}
                            />
                        </div>

                        <div className="col-md-2 col-lg-2">
                            <select
                                value={filterLocal}
                                onChange={(e) => setFilterLocal(e.target.value)}
                                className="form-select rounded-pill border-0 shadow-sm"
                                style={{ backgroundColor: '#f8f9fa', fontSize: '0.9rem' }}
                            >
                                <option value="">Tous les sites</option>
                                {[...new Set(users.map(u => u.materiel?.local?.nom_local).filter(Boolean))].map(local => (
                                    <option key={local} value={local}>{local}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2 col-lg-2">
                            <select
                                value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="form-select rounded-pill border-0 shadow-sm" style={{ backgroundColor: '#f8f9fa', fontSize: '0.9rem' }}
                            >
                                <option value="">Tous les rôles</option>
                                {Object.entries(ROLES).map(([value, { label }]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2 col-lg-2">
                            <select
                                value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select rounded-pill border-0 shadow-sm" style={{ backgroundColor: '#f8f9fa', fontSize: '0.9rem' }}
                            >
                                <option value="">Tous les statuts</option>
                                <option value="Actif">Actif</option>
                                <option value="Désactivé">Désactivé</option>
                            </select>
                        </div>

                        <div className="col-md-auto">
                            <div className="d-flex gap-2 align-items-center">
                                {(filterText || filterEquipe || filterLocal || filterRole || filterStatus) && (
                                    <Button
                                        className="rounded-pill border-0"
                                        style={{
                                            background: '#f8f9fa', color: '#495057', fontWeight: '500', padding: '10px 18px', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                        onClick={handleResetFilters}
                                    >
                                        <FaTimes size={12} />
                                        Réinitialiser
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <DataTable
                            columns={columns}
                            data={filteredUsers}
                            pagination
                            paginationComponentOptions={PAGINATION_OPTIONS}
                            highlightOnHover
                            pointerOnHover
                            responsive
                            customStyles={modernStyles}
                            progressPending={loading}
                            progressComponent={
                                <div className="p-5 text-center">
                                    <div className="spinner-grow text-primary" role="status" style={{ width: '3rem', height: '3rem', marginRight: '8px' }}></div>
                                    <p className="text-muted mt-3">Chargement des données...</p>
                                </div>
                            }
                            noDataComponent={
                                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>Aucun utilisateur ne correspond aux critères</p>
                                    <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>Réessayez avec d'autres filtres</p>
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>

            {showUserModal && (
                <UserFormModal
                    show={showUserModal}
                    mode={userModalMode}
                    userData={userModalData}
                    availableMateriels={availableMateriels}
                    onSaved={handleRefresh}
                    handleClose={() => setShowUserModal(false)}
                />
            )}

            <DetailsMailModal show={showDetailsModal} handleClose={closeDetails} mailData={currentMailData} onEmailAdded={handleEmailAddedFromDetails} />

        </div>
    );
};

export default UsersManager;