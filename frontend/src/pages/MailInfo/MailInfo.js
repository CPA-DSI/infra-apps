import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Button, Alert, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';

import { FaFileExcel, FaPlus, FaSearch, FaTimes, FaSync, FaEnvelope, FaFileImport, FaUsers, FaUpload, FaCheckCircle, FaFileUpload, FaInfoCircle } from 'react-icons/fa';
import { fetchUsers, fetchAllMaterielsByIdN, updateUser, updateUserStatus } from '../../services/api';
import { ROLE_PERMISSIONS, ROLES } from '../../config/api';
import DetailsMailModal from './DetailsMailModal';
import UserFormModal from './UserFormModal';
import {
    getPrimaryEmail, getSecondaryEmail, getPrimaryPassword, getSecondaryPassword,
    formatUserStatus, formatUserRole, getEmailCount, getVerifiedEmailCount,
    getTicketCounts,
} from './mailInfoHelpers';
import { EditableRoleBadge } from './RoleBadges';
import StatCard from './StatCard';
import ActionButtons from './ActionButtons';
import ExpandableEmailRow from './ExpandableEmailRow';
import SearchableSelect from './SearchableSelect';
import { STATS_CONFIG, PAGINATION_OPTIONS } from './mailInfoTableConfig';
import { useUserImportExport } from './useUserImportExport';

import './Mail.css';

const UsersManager = () => {

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

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchUsers();
            setUsers(data);
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMaterielsList = async () => {
        try {
            const data = await fetchAllMaterielsByIdN();
            setAllMateriels(data);
        } catch (error) {
            console.error('Erreur chargement matériels:', error.message);
        }
    };

    useEffect(() => {
        loadData();
        loadMaterielsList();
    }, [loadData]);

    const handleRefresh = async () => {
        setLoading(true);
        await loadData();
        await loadMaterielsList();
    };

    const {
        showImportSection,
        importFile,
        importProgress,
        isImporting,
        importSuccess,
        importSuccessStats,
        importError,
        importPreview,
        importData,
        importWarnings,
        importErrors,
        isDragging,
        fileInputRef,
        toggleImportSection,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileSelect,
        handleRemoveFile,
        handleImportSubmit,
    } = useUserImportExport({ onImported: handleRefresh });

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

    const handleStatusUpdate = useCallback(async (user, isActive) => {
        try {
            await updateUserStatus(user.id_user, isActive);
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
    }, [loadData]);

    const handleToggleStatus = useCallback((user, newStatus) => {
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
    }, [handleStatusUpdate]);

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
    const handleRoleUpdate = useCallback(async (user, newRole) => {
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
    }, [loadData]);

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
                <ActionButtons row={row} handleView={openDetails} handleEdit={openEdit} handleToggleStatus={handleToggleStatus} />
            ),
            ignoreRowClick: true, 
            button: true, 
            width: '120px', 
            center: true
        }
    ], [columnWidths, handleRoleUpdate, handleToggleStatus]);

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

                    <button className={`btn-pill btn-pill-success shadow-sm ${showImportSection ? 'active' : ''}`} onClick={toggleImportSection} disabled={isImporting} title="Importer des données" >
                        {isImporting ? <Spinner animation="border" size="sm" style={{ color: 'white' }} /> : <FaFileImport size={13} />}
                        <span>{isImporting ? 'Import...' : 'Importer'}</span>
                    </button>

                    <button className="btn-pill btn-pill-warning shadow-sm" onClick={exportToExcel} title="Exporter les données" >
                        <FaFileExcel size={13} />
                        <span>Exporter</span>
                    </button>

                    <button className="btn-pill btn-pill-primary shadow-sm" onClick={() => { setUserModalData(null); setUserModalMode('add'); setShowUserModal(true); }} title="Ajouter un nouvel utilisateur" >
                        <FaPlus size={14} />
                        <span>Ajouter</span>
                    </button>
                </div>
            </div>

            {showImportSection && (
                <div className="import-section mb-4 rounded-3" style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden'
                }}>
                    <div className="d-flex justify-content-between align-items-center p-4 pb-3">
                        <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: '#1F2937', fontSize: '1rem' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                            }}>
                                <FaFileImport size={14} />
                            </div>
                            Importer des utilisateurs
                        </h6>
                        <button
                            className="btn btn-sm rounded-circle border-0"
                            onClick={toggleImportSection}
                            style={{
                                width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: '#9ca3af'
                            }}
                            disabled={isImporting}
                            title="Fermer"
                        >
                            <FaTimes size={14} />
                        </button>
                    </div>

                    {!importSuccess ? (
                        <>
                            <div
                                className={`import-drop-zone mx-4 mb-3 ${isDragging ? 'dragover' : ''} ${importFile ? 'has-file' : ''}`}
                                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} disabled={isImporting}
                                />

                                {importFile ? (
                                    <div className="d-flex align-items-center justify-content-center gap-4">
                                        <div className="import-file-icon" style={{
                                            fontSize: '2.5rem', color: '#217346', filter: 'drop-shadow(0 2px 4px rgba(33, 115, 70, 0.15))'
                                        }}>
                                            <FaFileExcel />
                                        </div>
                                        <div className="text-start flex-grow-1">
                                            <div className="fw-semibold" style={{ color: '#1F2937', fontSize: '0.95rem' }}>{importFile.name}</div>
                                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                {(importFile.size / 1024).toFixed(1)} Ko
                                            </div>
                                            <div className="text-success mt-1" style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                                                <FaCheckCircle className="me-1" size={12} /> Fichier prêt à importer
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-sm rounded-circle border-0 import-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFile();
                                            }}
                                            disabled={isImporting}
                                            style={{
                                                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: '#ef4444', backgroundColor: '#fef2f2'
                                            }}
                                        >
                                            <FaTimes size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="import-drop-icon">
                                            <FaFileUpload />
                                        </div>
                                        <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                                            Glissez-déposez votre fichier Excel ici
                                        </div>
                                        <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                            ou <span className="import-browse-link">parcourez vos fichiers</span>
                                        </div>
                                        <div style={{
                                            color: '#6b7280', fontSize: '0.8rem', backgroundColor: '#f3f4f6', display: 'inline-block', padding: '4px 14px', borderRadius: '20px'
                                        }}>
                                            Formats acceptés : <span className="fw-semibold" style={{ color: '#667eea' }}>.xlsx, .xls</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {importPreview.length > 0 && !isImporting && (
                                <div className="mx-4 mb-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
                                            <FaSearch className="me-2" style={{ color: '#667eea', fontSize: '0.75rem' }} />
                                            Aperçu des données
                                        </h6>
                                        <span className="badge" style={{
                                            backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '0.75rem', padding: '4px 12px', borderRadius: '20px', fontWeight: '500'
                                        }}>
                                            {importData.length} lignes au total
                                        </span>
                                    </div>
                                    <div className="table-responsive table-scroll-preview" style={{ maxHeight: '250px', overflow: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                        <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.75rem' }}>
                                            <thead className="table-light" style={{
                                                position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 10
                                            }}>
                                                <tr>
                                                    {Object.keys(importPreview[0] || {}).map((key, index) => (
                                                        <th key={index} style={{
                                                            fontSize: '0.7rem', whiteSpace: 'nowrap', fontWeight: '600', color: '#374151', padding: '10px 12px', borderBottom: '2px solid #e5e7eb'
                                                        }}>
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importPreview.map((row, rowIndex) => (
                                                    <tr key={rowIndex}>
                                                        {Object.values(row).map((value, cellIndex) => (
                                                            <td key={cellIndex} style={{
                                                                fontSize: '0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '8px 12px', color: '#4b5563'
                                                            }}>
                                                                {String(value || '')}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <small className="text-muted mt-2 d-block" style={{ fontSize: '0.75rem' }}>
                                        <FaInfoCircle className="me-1" style={{ fontSize: '0.7rem' }} />
                                        Aperçu des 5 premières lignes
                                    </small>
                                </div>
                            )}

                            {importWarnings.length > 0 && !isImporting && (
                                <div className="mx-4 mb-3" style={{
                                    borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem 1rem', fontSize: '0.8rem'
                                }}>
                                    <div className="d-flex align-items-center gap-2 fw-semibold mb-1">
                                        <FaInfoCircle style={{ fontSize: '0.85rem' }} />
                                        <span>{importWarnings.length} doublon(s) détecté(s) dans le fichier</span>
                                    </div>
                                    <ul className="mb-0 ps-4" style={{ fontSize: '0.78rem' }}>
                                        {importWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                                    </ul>
                                    <div className="mt-1" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                                        Ces lignes seront ignorées lors de l'import.
                                    </div>
                                </div>
                            )}

                            {isImporting && (
                                <div className="mx-4 mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <Spinner animation="border" size="sm" style={{ color: '#667eea' }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                                {importProgress < 25 ? 'Analyse du fichier Excel...' :
                                                 importProgress < 70 ? 'Envoi des données au serveur...' :
                                                 importProgress < 100 ? 'Traitement des données...' :
                                                 'Importation terminée !'}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontWeight: '600',
                                            color: importProgress === 100 ? '#10b981' : '#667eea',
                                            fontSize: '0.9rem'
                                        }}>
                                            {importProgress}%
                                        </span>
                                    </div>
                                    <div className="progress-container" style={{
                                        height: '10px', borderRadius: '10px', backgroundColor: '#f3f4f6', overflow: 'hidden', position: 'relative'
                                    }}>
                                        <div
                                            className="progress-bar-fill"
                                            style={{
                                                height: '100%',
                                                borderRadius: '10px',
                                                background: importProgress === 100
                                                    ? 'linear-gradient(90deg, #10b981, #059669)'
                                                    : 'linear-gradient(90deg, #667eea, #764ba2)',
                                                width: `${importProgress}%`,
                                                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {importError && (
                                <div className="mx-4 mb-3">
                                    <div style={{
                                        borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', fontSize: '0.85rem'
                                    }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <FaTimes style={{ fontSize: '0.9rem' }} />
                                            <span>{importError}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isImporting && !importSuccess && (
                                <div className="d-flex justify-content-end gap-2 p-4 pt-0">
                                    <button
                                        className="btn rounded-pill px-4"
                                        onClick={toggleImportSection}
                                        disabled={isImporting}
                                        style={{
                                           transition: 'all 0.2s ease', border: '1px solid #d1d5db', color: '#374151', backgroundColor: 'white', fontSize: '0.85rem', fontWeight: '500',
                                            opacity: isImporting ? 0.6 : 1
                                        }}
                                    >
                                        <FaTimes className="me-2" size={12} />
                                        Annuler
                                    </button>
                                    <button
                                        className="btn rounded-pill px-4"
                                        onClick={handleImportSubmit}
                                        disabled={!importFile || isImporting}
                                        style={{
                                            background: !importFile || isImporting ? '#d1d5db' : '#10b981', color: 'white', border: 'none', fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.3s ease',
                                            opacity: !importFile || isImporting ? 0.6 : 1,
                                            cursor: !importFile || isImporting ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isImporting ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                Import en cours...
                                            </>
                                        ) : (
                                            <>
                                                <FaUpload className="me-2" size={12} />
                                                Importer
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-5">
                            <div style={{
                                fontSize: '3.5rem', color: '#10b981', marginBottom: '1rem'
                            }}>
                                <FaCheckCircle />
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1F2937', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                                {importSuccessStats && (importSuccessStats.success || 0) > 0 ? 'Importation réussie !' : 'Import terminé'}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                                {importSuccessStats ? (
                                    <div className="d-flex flex-column gap-2 mt-3">
                                        {(importSuccessStats.success || 0) > 0 && (
                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <FaCheckCircle style={{ color: '#10b981', fontSize: '0.8rem' }} />
                                                </div>
                                                <span style={{ fontWeight: '500', color: '#065f46', fontSize: '0.9rem' }}>
                                                    {importSuccessStats.success} utilisateur(s) importé(s)
                                                </span>
                                            </div>
                                        )}
                                        {(importSuccessStats.failed || 0) > 0 && (
                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <FaTimes style={{ color: '#f59e0b', fontSize: '0.8rem' }} />
                                                </div>
                                                <span style={{ fontWeight: '500', color: '#92400e', fontSize: '0.9rem' }}>
                                                    {importSuccessStats.failed} échec(s)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '10px 20px', backgroundColor: '#d1fae5', borderRadius: '10px', display: 'inline-block', marginTop: '0.5rem', color: '#065f46', fontSize: '0.9rem'
                                    }}>
                                        Les utilisateurs ont été importés avec succès.
                                    </div>
                                )}
                            </div>

                            {importErrors.length > 0 && (
                                <div className="mx-4 mt-4 text-start" style={{
                                    borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem 1rem', maxHeight: '220px', overflowY: 'auto'
                                }}>
                                    <div className="fw-semibold mb-2" style={{ color: '#991b1b', fontSize: '0.85rem' }}>
                                        Détail des lignes ignorées :
                                    </div>
                                    <ul className="mb-0 ps-3" style={{ fontSize: '0.78rem', color: '#991b1b' }}>
                                        {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                                    </ul>
                                </div>
                            )}

                            {importSuccessStats && (importSuccessStats.failed || 0) > 0 && (
                                <div className="text-center mt-4">
                                    <button
                                        className="btn rounded-pill px-4"
                                        onClick={toggleImportSection}
                                        style={{ border: '1px solid #d1d5db', color: '#374151', backgroundColor: 'white', fontSize: '0.85rem', fontWeight: '500' }}
                                    >
                                        Fermer
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

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