// src/pages/Materiels/Materiels.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import { Button, Form, InputGroup, Spinner, Card, Alert } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrash, FaFileExcel, FaSearch, FaSync, FaTimes, FaDesktop, FaFileImport, FaPlus, FaUpload, FaCheckCircle, FaFileUpload, FaHistory, FaInfoCircle, FaInbox } from 'react-icons/fa';
import { MdOutlineAddCircleOutline } from 'react-icons/md';
/// --- Importations des Modales ---
import AddModal from './AddModal';
import DetailsModal from './DetailsModal';
import EditModal from './EditModal';
import AddMarque from './AddMarque';
import HistoriqueModal from './HistoriqueModal';

// Import styles from Materiels.css
import './Materiels.css';

const MySwal = withReactContent(Swal);

// ==========================================================
// --- Styles 2026 pour React-Data-Table-Component ---
// ==========================================================
const modernStyles = {
    table: {
        style: {
            backgroundColor: 'transparent',
            borderRadius: '16px',
        },
    },
    headRow: {
        style: {
            backgroundColor: '#f9fafb', border: 'none', minHeight: '52px', borderRadius: '12px 12px 0 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'sticky', top: 0, zIndex: 10
        },
    },
    headCells: {
        style: {
            fontSize: '0.75rem', fontWeight: '600', color: '#374151', letterSpacing: '0.02em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none'
        },
    },
    rows: {
        style: {
            fontSize: '0.85rem', fontWeight: '500', color: '#212529', minHeight: '52px', backgroundColor: '#ffffff', transition: 'all 0.2s ease', borderBottom: '1px solid #f3f4f6'
        },
        highlightOnHoverStyle: {
            backgroundColor: '#f5f3ff', color: '#5b21b6', cursor: 'pointer', transitionDuration: '0.2s'
        },
    },
    pagination: {
        style: {
            border: 'none', fontSize: '12px', color: '#6c757d', paddingTop: '16px', paddingBottom: '16px'
        },
    },
};

// --- Configuration de la pagination ---
const paginationOptions = {
    rowsPerPageText: 'Lignes par page :', rangeSeparatorText: 'sur', selectAllRowsItem: true, selectAllRowsItemText: 'Tout'
};

// --- Configuration des états pour l'affichage ---
const statusConfig = {
    'Très Bon':   { emoji: '✅', color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
    'Bon':        { emoji: '👍', color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe' },
    'Moyen':      { emoji: '⚠️', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
    'Mauvais':    { emoji: '❗', color: '#9f1239', bg: '#fee2e2', border: '#fecaca' },
    'Disponible': { emoji: '📦', color: '#4d7c0f', bg: '#ecfdf5', border: '#a7f3d0' },
    'HS':         { emoji: '❌', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' }
};

// ==========================================================
// --- Composant Select filtre recherche ---
// ==========================================================
// Select avec recherche intégrée, conserve exactement le même style visuel
// que les Form.Select existants (rounded-pill, border-0, shadow-sm, 38px).
const SearchableSelect = ({ value, onChange, options, placeholder, style }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedOptions = options.map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
    );

    const filteredOptions = normalizedOptions.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase())
    );

    const selectedOption = normalizedOptions.find(o => o.value === value);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                onClick={() => { setOpen(!open); setQuery(''); }}
                className="rounded-pill border-0 shadow-sm"
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <span style={{
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '0.65rem', opacity: 0.5 }}>▼</span>
            </div>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 1000,
                    overflow: 'hidden',
                }}>
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher..."
                        style={{
                            width: '100%',
                            border: 'none',
                            borderBottom: '1px solid #e5e7eb',
                            padding: '10px 14px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            backgroundColor: '#fff',
                        }}
                    />
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        <div
                            onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                            style={{
                                padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                                color: '#6b7280', backgroundColor: !value ? '#e0e7ff' : '#fff',
                            }}
                        >
                            {placeholder}
                        </div>
                        {filteredOptions.map(o => (
                            <div
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                                style={{
                                    padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                                    backgroundColor: value === o.value ? '#e0e7ff' : '#fff',
                                    color: value === o.value ? '#4338ca' : '#374151',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = value === o.value ? '#e0e7ff' : '#f3f4f6'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = value === o.value ? '#e0e7ff' : '#fff'; }}
                            >
                                {o.label}
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div style={{ padding: '9px 14px', fontSize: '0.85rem', color: '#9ca3af' }}>
                                Aucun résultat
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================================
// --- Composant principal Materiels ---
// ==========================================================
function Materiels() {
const { user } = useAuth();
const userRole = user?.role || '';
const userIdN = user?.id_n ? String(user.id_n) : '';
// --- États ---
const [materiels, setMateriels] = useState([]);
const [loading, setLoading] = useState(false);
const [searchTerm, setSearchTerm] = useState('');
const [filterEtat, setFilterEtat] = useState('');
const [filterEquipe, setFilterEquipe] = useState('');
const [filterNomLocal, setFilterNomLocal] = useState('');
const [filterMarque, setFilterMarque] = useState('');
const [filterYear, setFilterYear] = useState('');
const [filterEstActif, setFilterEstActif] = useState('');
const [selectedMateriel, setSelectedMateriel] = useState(null);
const [modalType, setModalType] = useState(null);
const [isAddModalOpen, setIsAddModalOpen] = useState(false);
const [isAddMarqueOpen, setIsAddMarqueOpen] = useState(false);
const [addMarqueKey] = useState(0);
const [isHistoriqueModalOpen, setIsHistoriqueModalOpen] = useState(false);
const [selectedMaterielForHistory, setSelectedMaterielForHistory] = useState(null);
const [successMessage, setSuccessMessage] = useState(null);
const [error] = useState(null);

// --- États pour l'import intégré ---
const [showImportSection, setShowImportSection] = useState(false);
const [importFile, setImportFile] = useState(null);
const [importProgress, setImportProgress] = useState(0);
const [isImporting, setIsImporting] = useState(false);
const [importSuccess, setImportSuccess] = useState(false);
const [importSuccessStats, setImportSuccessStats] = useState(null);
const [importError, setImportError] = useState(null);
const [importPreview, setImportPreview] = useState([]);
const [importData, setImportData] = useState([]);
const [isDragging, setIsDragging] = useState(false);
const fileInputRef = useRef(null);

// --- Fonctions de récupération des données ---
const fetchMateriels = useCallback(async () => {
    setLoading(true);
    try {
        const response = await apiClient.get('/materiels_all');
        setMateriels(response.data);
    } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        MySwal.fire({
            icon: 'error', title: 'Erreur', text: error.response?.data?.error || 'Erreur lors de la récupération des données matériels.'
        });
    }
    setLoading(false);
}, []);

// --- Fonctions de cycle de vie ---
useEffect(() => {
    fetchMateriels();
}, [fetchMateriels]);

// --- Fonctions de gestion des modales ---
const handleOpenAddModal = useCallback(() => setIsAddModalOpen(true), []);
const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    fetchMateriels();
}, [fetchMateriels]);

const handleOpenAddMarque = useCallback(() => {
    setIsAddMarqueOpen(true);
}, []);

const handleCloseAddMarque = useCallback(() => {
    setIsAddMarqueOpen(false);
    fetchMateriels();
}, [fetchMateriels]);

const handleResetFilters = useCallback(() => {
    setSearchTerm(''); setFilterEtat(''); setFilterEquipe(''); setFilterNomLocal(''); setFilterMarque(''); setFilterYear(''); setFilterEstActif('');
}, []);

const handleMaterialAdded = useCallback(() => {
    console.log("Callback reçu dans Materiels.js: Un nouveau matériel a été ajouté.");
    fetchMateriels();
    setIsAddModalOpen(false);
    setSuccessMessage("Matériel ajouté avec succès !");
    setTimeout(() => setSuccessMessage(null), 3000);
}, [fetchMateriels]);

const handleView = useCallback((row) => {
    setSelectedMateriel(row);
    setModalType('details');
}, []);

const handleEdit = useCallback((row) => {
    setSelectedMateriel(row);
    setModalType('edit');
}, []);

// ✅ Fonction pour ouvrir le modal d'historique - utilise id_materiels
const handleOpenHistoriqueModal = useCallback((row) => {
    setSelectedMaterielForHistory(row);
    setIsHistoriqueModalOpen(true);
}, []);

// ✅ Fonction pour fermer le modal d'historique
const handleCloseHistoriqueModal = useCallback(() => {
    setIsHistoriqueModalOpen(false);
    setSelectedMaterielForHistory(null);
}, []);

const handleDeleteConfirm = useCallback(async (row) => {
    const materielId = row.id_materiels;

    try {
        await apiClient.delete(`/materiels_all/${materielId}`);
        fetchMateriels();

        MySwal.fire({
            icon: 'success', title: 'Supprimé !', text: 'Le matériel a été supprimé avec succès.', timer: 3000, showConfirmButton: false
        });

    } catch (error) {
        console.error("Erreur de suppression:", error);
        const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la suppression.';
        MySwal.fire({
            icon: 'error',
            title: 'Erreur',
            text: `Échec de la suppression: ${errorMessage}`
        });
    }
}, [fetchMateriels]);

const confirmDelete = useCallback((row) => {
    MySwal.fire({
        title: 'Confirmer la suppression', text: `Êtes-vous sûr de vouloir supprimer définitivement le matériel ${row.code_pc} ? Cette action est irréversible.`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
    }).then((result) => {
        if (result.isConfirmed) {
            handleDeleteConfirm(row);
        }
    });
}, [handleDeleteConfirm]);

const closeModal = useCallback(() => {
    setSelectedMateriel(null); setModalType(null); fetchMateriels();
}, [fetchMateriels]);

const handleToggleEstActif = useCallback(async (row) => {
    const currentEstActif = row.est_actif;
    const currentEtatPc = row.etat_pc;
    const isCurrentlyActive = currentEstActif === true || currentEstActif === 'true' || currentEstActif === 'Oui' || currentEstActif === 'oui';
    const newVal = !isCurrentlyActive;

    setMateriels(prev => prev.map(m =>
        m.id_materiels === row.id_materiels ? {
            ...m,
            est_actif: newVal,
            etat_pc: newVal ? 'Bon' : 'Disponible'
        } : m
    ));

    try {
        const { utilisateur, ...safeUpdateData } = row;
        const updateData = { ...safeUpdateData, est_actif: newVal };
        updateData.etat_pc = newVal ? 'Bon' : 'Disponible';
        delete updateData.id_materiels;
        delete updateData.id_n;
        delete updateData.equipe;
        delete updateData.date_pc;
        delete updateData.date_ecran;
        delete updateData.caracteristiques;
        delete updateData.code_pc;
        delete updateData.ecran;
        delete updateData.code_ecran;
        delete updateData.hdmi;
        delete updateData.clavier;
        delete updateData.lan;
        delete updateData.usb;
        delete updateData.salle;
        delete updateData.mdp_pc;
        delete updateData.mdp_admin;
        delete updateData.etat_batterie;
        delete updateData.commentaire;
        delete updateData.id_marque;
        delete updateData.id_local;
        delete updateData.date_modification;
        delete updateData.url;
        delete updateData.marque;
        delete updateData.local;
        delete updateData.user;
        delete updateData.nom_marque;
        delete updateData.nom_local;
        await apiClient.put(`/materiels_all/${row.id_materiels}`, updateData);
        await fetchMateriels();
    } catch (error) {
        console.error("Erreur lors de la mise à jour de est_actif:", error);
        setMateriels(prev => prev.map(m =>
            m.id_materiels === row.id_materiels ? { ...m, est_actif: currentEstActif, etat_pc: currentEtatPc } : m
        ));
        MySwal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de modifier le statut.',
            timer: 2000,
            showConfirmButton: false
        });
    }
}, [fetchMateriels]);

// --- Fonctions de filtrage et recherche ---
const filteredMateriels = useMemo(() => {
    return materiels.filter(materiel => {
        const lowerCaseSearch = searchTerm.toLowerCase();

        const id_n_string = materiel.id_n ? String(materiel.id_n) : ''; 
        const equipe = materiel.equipe || ''; 
        const utilisateur = materiel.utilisateur || ''; 
        const codePc = materiel.code_pc || ''; 
        const salle = materiel.salle || ''; 
        const nom_local = materiel.nom_local || ''; 
        const caracteristiques = materiel.caracteristiques || ''; 
        const etat_pc = materiel.etat_pc || ''; 
        const nom_marque = materiel.nom_marque || '';
        const est_actif = materiel.est_actif !== undefined ? String(materiel.est_actif) : '';
        const isActive = materiel.est_actif === true || materiel.est_actif === 'true' || materiel.est_actif === 'Oui' || materiel.est_actif === 'oui';
        const estActifLabel = isActive ? 'Actif' : 'Inactif';

        const searchMatch = 
            id_n_string.toLowerCase().includes(lowerCaseSearch) || equipe.toLowerCase().includes(lowerCaseSearch) || utilisateur.toLowerCase().includes(lowerCaseSearch) || codePc.toLowerCase().includes(lowerCaseSearch) || salle.toLowerCase().includes(lowerCaseSearch) || nom_local.toLowerCase().includes(lowerCaseSearch) || caracteristiques.toLowerCase().includes(lowerCaseSearch) || etat_pc.toLowerCase().includes(lowerCaseSearch) || nom_marque.toLowerCase().includes(lowerCaseSearch) || est_actif.toLowerCase().includes(lowerCaseSearch);

        const etatMatch = !filterEtat || etat_pc === filterEtat;
        const equipeMatch = !filterEquipe || equipe === filterEquipe;
        const nomLocalMatch = !filterNomLocal || nom_local === filterNomLocal;
        const marqueMatch = !filterMarque || nom_marque === filterMarque;
        const estActifMatch = !filterEstActif || estActifLabel === filterEstActif;

        const datePc = materiel.date_pc ? new Date(materiel.date_pc) : null;
        const yearValue = datePc ? datePc.getFullYear() : null;
        const yearMatch = !filterYear ||
            (filterYear === 'none' ? !materiel.date_pc : yearValue === parseInt(filterYear, 10));

        const userMatch = userRole !== 'USER' || (id_n_string === userIdN);

        return searchMatch && etatMatch && equipeMatch && nomLocalMatch && marqueMatch && yearMatch && estActifMatch && userMatch;
    });
}, [materiels, searchTerm, filterEtat, filterEquipe, filterNomLocal, filterMarque, filterYear, filterEstActif, userRole, userIdN]);

// --- Colonnes du tableau ---
const columns = useMemo(() => {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const dateObj = new Date(dateString);
        return dateObj.toLocaleDateString('fr-FR');
    };

    const renderStatus = (row) => {
        const currentConfig = statusConfig[row.etat_pc] || { emoji: '❓', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
        return (
            <span style={{ 
                backgroundColor: currentConfig.bg, color: currentConfig.color, border: `1px solid ${currentConfig.border}`, padding: "4px 12px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: "600", display: "inline-flex", alignItems: "center", textTransform: "capitalize", gap: "6px", transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <span style={{ fontSize: '0.8rem' }}>{currentConfig.emoji}</span>
                {row.etat_pc}
            </span>
        );
    };

    const renderEstActif = (row) => {
        const val = row.est_actif;
        const isActive = val === true || val === 'true' || val === 'Oui' || val === 'oui';
        const label = isActive ? 'Actif' : 'Inactif';
        const color = isActive ? '#065f46' : '#991b1b';
        const bg = isActive ? '#d1fae5' : '#fee2e2';
        const border = isActive ? '#10b981' : '#ef4444';
        
        if (userRole === 'USER') {
            return (
                <span style={{ 
                    backgroundColor: bg, color: color, border: `1px solid ${border}`, padding: "4px 12px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px"
                }}>
                    <span style={{ fontSize: '0.8rem' }}>{isActive ? '✅' : '❌'}</span>
                    {label}
                </span>
            );
        }
        
        return (
            <div
                onClick={() => handleToggleEstActif(row)}
                style={{
                    position: 'relative',
                    width: '60px',
                    height: '26px',
                    borderRadius: '13px',
                    backgroundColor: bg,
                    border: `2px solid ${border}`,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    userSelect: 'none',
                }}
                title="Cliquer pour changer le statut"
            >
                <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: border,
                    transform: isActive ? 'translateX(34px)' : 'translateX(0)',
                    transition: 'transform 0.25s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
                <span style={{
                    position: 'absolute',
                    fontSize: '0.6rem',
                    fontWeight: '700',
                    color: color,
                    left: isActive ? '8px' : 'auto',
                    right: isActive ? 'auto' : '6px',
                }}>
                    {label}
                </span>
            </div>
        );
    };

    const renderDocumentsCount = (row) => {
        const count = row.documents_count || 0;
        const bgColor = count > 0 ? '#eef2ff' : '#f9fafb';
        const textColor = count > 0 ? '#4338ca' : '#9ca3af';
        const borderColor = count > 0 ? '#c7d2fe' : '#e5e7eb';
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                padding: '3px 10px',
                borderRadius: '20px',
                backgroundColor: bgColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                fontSize: '0.75rem',
                fontWeight: '600',
            }}>
                {count}
            </span>
        );
    };

    const renderMarque = (row) => {
        const imageUrl = row.url;
        if (imageUrl && imageUrl !== 'Non assigné') {
            return (
                <div style={{ 
                    width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'all 0.2s ease'
                }}>
                    <img
                        src={imageUrl}
                        alt={`Logo ${row.nom_marque || 'marque'}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/chemin/vers/image-par-defaut.png';
                        }}
                    />
                </div>
            );
        }
        return (
            <div style={{ 
                padding: '6px 12px', backgroundColor: '#f3f4f6', borderRadius: '8px', fontSize: '0.8rem', color: '#6b7280', fontWeight: '500'
            }}>
                {row.nom_marque || 'Pas d\'image'}
            </div>
        );
    };

    const renderActions = (row) => (
        <div className="d-flex gap-1" role="group" aria-label="Actions">
            <Button 
                variant="light" 
                className="shadow-sm border-0 p-2 rounded-circle" 
                onClick={() => handleView(row)} 
                title="Voir détails"
                style={{ 
                    transition: 'all 0.2s ease', width: '32px', height: '32px'
                }}
            >
                <FaEye size={14} className="text-info" />
            </Button>
            {(userRole !== 'USER' && userRole !== 'DIRECTION') && (
            <Button 
                variant="light" 
                className="shadow-sm border-0 p-2 rounded-circle" 
                onClick={() => handleEdit(row)} 
                title="Modifier"
                style={{ 
                    transition: 'all 0.2s ease', width: '32px', height: '32px'
                }}
            >
                <FaEdit size={14} className="text-warning" />
            </Button>
            )}
            {/* ✅ Bouton Historique - passe l'objet complet avec id_materiels */}
            <Button 
                variant="light" 
                className="shadow-sm border-0 p-2 rounded-circle" 
                onClick={() => handleOpenHistoriqueModal(row)} 
                title="Historique"
                style={{ 
                    transition: 'all 0.2s ease', width: '32px', height: '32px'
                }}
            >
                <FaHistory size={14} className="text-primary" />
            </Button>
            {(userRole !== 'USER' && userRole !== 'DIRECTION') && (
            <Button 
                variant="light" 
                className="shadow-sm border-0 p-2 rounded-circle" 
                onClick={() => confirmDelete(row)} 
                title="Supprimer"
                style={{ 
                    transition: 'all 0.2s ease', width: '32px', height: '32px'
                }}
            >
                <FaTrash size={14} className="text-danger" />
            </Button>
            )}
        </div>
    );

    return [
        { name: 'N°', selector: row => row.id_n, sortable: true, width: '60px', grow: 1 },
        { name: 'Utilisateur', selector: row => row.utilisateur, sortable: true, minWidth: '120px', grow: 1 },
        { name: 'Équipe', selector: row => row.equipe, sortable: true, minWidth: '120px', grow: 1 },
        { name: 'Date PC', selector: row => row.date_pc, sortable: true, width: '110px', grow: 0, cell: row => formatDate(row.date_pc) },
        { name: 'Date Écran', selector: row => row.date_ecran, sortable: true, width: '110px', grow: 0, cell: row => formatDate(row.date_ecran) },
        { name: 'Marque', cell: renderMarque, ignoreRowClick: true, allowOverflow: true, button: true, sortable: true, width: '100px', grow: 0 },
        { name: 'Caractéristiques', selector: row => row.caracteristiques, minWidth: '300px', grow: 3 },
        { name: 'État', selector: row => row.etat_pc, sortable: true, grow: 1, center: true, cell: renderStatus },
        { name: 'Local(s)', selector: row => row.nom_local || 'Non attribué', sortable: true, minWidth: '90px', grow: 1 },
        { name: 'Est Actif', selector: row => row.est_actif, sortable: true, minWidth: '100px', grow: 1, center: true, cell: renderEstActif, ignoreRowClick: true, allowOverflow: true, button: true },
        { name: 'Nb Doc.', selector: row => row.documents_count, sortable: true, minWidth: '90px', grow: 1, center: true, cell: renderDocumentsCount, ignoreRowClick: true, allowOverflow: true, button: true },
        { name: 'Actions', cell: renderActions, ignoreRowClick: true, allowOverflow: true, button: true, width: '130px', grow: 0, center: true },
    ];
}, [handleView, handleEdit, handleOpenHistoriqueModal, confirmDelete, handleToggleEstActif, userRole]);

// --- FONCTIONS D'IMPORT EXCEL ---
const normalizeCell = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'non assigné') return null;
        return trimmed;
    }
    return val;
};

// parseExcelFile avec date_ecran
const parseExcelFile = useCallback(async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error('Fichier Excel invalide (aucune feuille trouvée).');

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error('Aucune donnée trouvée dans le fichier Excel.');
    }

    const getByKeys = (obj, keys) => {
        for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== '') return obj[k];
        }
        return undefined;
    };

    const parseBool = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;
        if (typeof n === 'boolean') return n;
        const s = String(n).trim().toLowerCase();
        if (['true', '1', 'oui', 'y', 'yes'].includes(s)) return true;
        if (['false', '0', 'non', 'n', 'no'].includes(s)) return false;
        return null;
    };

    const parseIntOrNull = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;
        const num = typeof n === 'number' ? n : parseInt(String(n), 10);
        return Number.isFinite(num) ? num : null;
    };

    const excelSerialToDate = (serial) => {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const msPerDay = 24 * 60 * 60 * 1000;
        return new Date(excelEpoch.getTime() + (serial * msPerDay));
    };

    const parseDateOrNull = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;

        if (n instanceof Date && !isNaN(n.getTime())) {
            return n;
        }

        // Filet de sécurité : numéro de série Excel brut (cellule non reconnue
        // comme date par SheetJS malgré cellDates: true, ex. format de cellule
        // atypique dans le fichier source).
        if (typeof n === 'number' && n > 1 && n < 100000) {
            const date = excelSerialToDate(n);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        const s = String(n).trim();
        if (!s) return null;

        // Format DD/MM/YYYY
        const dateMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const year = parseInt(dateMatch[3], 10);
            
            const date = new Date(year, month, day);
            if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
                return date;
            }
        }
        
        // Format YYYY-MM-DD
        const dateMatch2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (dateMatch2) {
            const year = parseInt(dateMatch2[1], 10);
            const month = parseInt(dateMatch2[2], 10) - 1;
            const day = parseInt(dateMatch2[3], 10);
            
            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                return date;
            }
        }
        
        // Format MM/DD/YYYY (américain)
        const dateMatch3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch3) {
            const part1 = parseInt(dateMatch3[1], 10);
            const part2 = parseInt(dateMatch3[2], 10);
            const year = parseInt(dateMatch3[3], 10);
            
            if (part1 > 12) {
                const date = new Date(year, part2 - 1, part1);
                if (date.getDate() === part1 && date.getMonth() === part2 - 1 && date.getFullYear() === year) {
                    return date;
                }
            } else {
                const date = new Date(year, part1 - 1, part2);
                if (date.getDate() === part2 && date.getMonth() === part1 - 1 && date.getFullYear() === year) {
                    return date;
                }
            }
        }
        
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        
        console.warn(`Format de date non supporté: ${s}`);
        return null;
    };

    const items = rawRows.map((r, idx) => {
        const utilisateur = normalizeCell(getByKeys(r, [
            'Utilisateur', 'utilisateur', 'USER', 'Nom Utilisateur', 
            'Nom', 'nom', 'NOM', 'Full Name', 'full_name'
        ]));
        
        const id_n = parseIntOrNull(getByKeys(r, [
            'N° Matricule', 'id_n', 'ID N', 'Matricule', 
            'N°', 'Numero', 'numero', 'ID'
        ]));
        
        const equipe = normalizeCell(getByKeys(r, [
            'Équipe', 'equipe', 'Equipe', 'TEAM', 'team', 
            'Service', 'service', 'Département', 'departement'
        ]));
        
        // Date PC
        const date_pc = parseDateOrNull(getByKeys(r, [
            'Date PC', 'date_pc', 'Date', 'date', 
            'DATE_PC', 'Date PC'
        ]));
        
        // Date Écran
        const date_ecran = parseDateOrNull(getByKeys(r, [
            'Date Écran', 'date_ecran', 'DATE_ECRAN', 
            'Date Ecran', 'date ecran', 'Date moniteur',
            'Date Monitor', 'date_monitor', 'Date Ecran'
        ]));
        
        const caracteristiques = normalizeCell(getByKeys(r, [
            'Caractéristiques', 'caracteristiques', 'Caracteristiques',
            'Config', 'config', 'Configuration', 'Specs', 'specs'
        ]));
        
        const code_pc = normalizeCell(getByKeys(r, [
            'Code PC', 'code_pc', 'CODE_PC', 'PC Code', 
            'Code', 'code', 'Asset Tag', 'asset_tag'
        ]));
        
        const ecran = normalizeCell(getByKeys(r, [
            'Marque Écran', 'ecran', 'Ecran', 'Moniteur', 'moniteur',
            'Screen', 'screen', 'Display', 'display'
        ]));
        
        const code_ecran = normalizeCell(getByKeys(r, [
            'Code Écran', 'code_ecran', 'CODE_ECRAN', 
            'Code Ecran', 'Screen Code', 'screen_code'
        ]));
        
        const hdmi = parseBool(getByKeys(r, ['HDMI', 'hdmi']));
        const clavier = parseBool(getByKeys(r, ['Clavier', 'clavier']));
        const lan = parseBool(getByKeys(r, ['LAN', 'lan']));
        const usb = parseBool(getByKeys(r, ['USB', 'usb']));
        
        const etat_pc = normalizeCell(getByKeys(r, [
            'État PC', 'etat_pc', 'Etat PC', 'Etat', 
            'Status', 'status', 'État', 'etat'
        ]));
        
        const salle = normalizeCell(getByKeys(r, [
            'Salle', 'salle', 'Salle PC','Emplacement', 'emplacement'
        ]));
        
        const mdp_pc = normalizeCell(getByKeys(r, [
            'Password_Local', 'mdp_pc', 'Password Local',
            'Mot de passe local', 'password_local'
        ]));
        
        const mdp_admin = normalizeCell(getByKeys(r, [
            'Password_Admin', 'mdp_admin', 'Password Admin',
            'Mot de passe admin', 'password_admin'
        ]));
        
        const etat_batterie = normalizeCell(getByKeys(r, [
            'Etat de la batterie', 'etat_batterie', 'Batterie',
            'Battery', 'battery', 'État batterie'
        ]));
        
        const commentaire = normalizeCell(getByKeys(r, [
            'Commentaire', 'commentaire', 'Notes', 'notes',
            'Remarque', 'remarque', 'Observations', 'observations'
        ]));
        
        const id_local = normalizeCell(getByKeys(r, [
            'id_local', 'Id_local', 'ID_LOCAL', 'Local_id', 'local_id',
            'ID Local', 'ID local', 'local ID', 'Site', 'site', 'SITE', 'Local', 'local', 'LOCAL'
        ]));

        // Logs de débogage
        if (utilisateur && id_n) {
            console.log(`📝 Utilisateur trouvé: ${utilisateur} (ID: ${id_n}) - Équipe: ${equipe || 'Non spécifiée'}`);
        }

        return {
            utilisateur, id_n, equipe, date_pc, date_ecran, caracteristiques, code_pc, ecran, code_ecran, hdmi, clavier, lan, usb, etat_pc, salle, mdp_pc, mdp_admin, etat_batterie, commentaire, id_local
        };
    });

    console.log(`📊 ${items.length} lignes parsées`);

    return items;
}, []);

// --- FONCTIONS POUR L'IMPORT INTÉGRÉ ---

// Réinitialiser l'état d'import
const resetImportState = useCallback(() => {
    setImportFile(null);
    setImportProgress(0);
    setIsImporting(false);
    setImportSuccess(false);
    setImportSuccessStats(null);
    setImportError(null);
    setImportPreview([]);
    setImportData([]);
    setIsDragging(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
}, []);

// Ouvrir/fermer la section d'import
const toggleImportSection = useCallback(() => {
    if (!showImportSection) {
        resetImportState();
    }
    setShowImportSection(prev => !prev);
}, [showImportSection, resetImportState]);

// Gestion du drag & drop
const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
}, []);

const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
}, []);

const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
}, []);

// Prévisualiser le fichier
const previewFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            const excelDateToJSDate = (excelDate) => {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const msPerDay = 24 * 60 * 60 * 1000;
                return new Date(excelEpoch.getTime() + (excelDate * msPerDay));
            };

            jsonData.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = row[key];
                    if (typeof val === 'number' && key.toLowerCase().includes('date')) {
                        const date = excelDateToJSDate(val);
                        if (!isNaN(date.getTime())) {
                            row[key] = date.toLocaleDateString('fr-FR');
                        }
                    }
                });
            });

            setImportPreview(jsonData.slice(0, 5));
            setImportData(jsonData);
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier:', error);
            setImportError('Erreur lors de la lecture du fichier. Vérifiez le format.');
        }
    };
    reader.readAsArrayBuffer(file);
}, []);

const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
        const selectedFile = droppedFiles[0];
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();

        if (validExtensions.includes(`.${fileExt}`)) {
            setImportFile(selectedFile);
            setImportError(null);
            previewFile(selectedFile);
        } else {
            setImportError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
        }
    }
}, [previewFile]);

// Gestion de la sélection de fichier
const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();

        if (validExtensions.includes(`.${fileExt}`)) {
            setImportFile(selectedFile);
            setImportError(null);
            previewFile(selectedFile);
        } else {
            setImportError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
            e.target.value = '';
        }
    }
}, [previewFile]);

// Supprimer le fichier sélectionné
const handleRemoveFile = useCallback(() => {
    setImportFile(null);
    setImportPreview([]);
    setImportData([]);
    setImportError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
}, []);

// --- FONCTION D'IMPORT COMPLÈTE ---
const handleImportSubmit = useCallback(async () => {
    if (!importFile) {
        setImportError('Veuillez sélectionner un fichier à importer.');
        return;
    }

    if (!importData || importData.length === 0) {
        setImportError('Aucune donnée valide à importer.');
        return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);

    try {
        setImportProgress(10);

        const items = await parseExcelFile(importFile);
        
        if (!items || items.length === 0) {
            throw new Error('Aucune donnée valide à importer');
        }

        setImportProgress(30);

        const updateProgress = (percent) => {
            setImportProgress(Math.min(percent, 95));
        };

        const response = await apiClient.post('/import', { items }, {
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const uploaded = progressEvent.loaded;
                    const total = progressEvent.total;
                    const uploadPercent = Math.round((uploaded / total) * 100);
                    const overall = 30 + Math.round(uploadPercent * 0.4);
                    updateProgress(overall);
                }
            }
        });

        setImportProgress(100);
        setImportSuccess(true);
        const stats = response.data.stats || {};
        setImportSuccessStats(stats);
        
        fetchMateriels();
        setFilterMarque('');

        const successCount = stats.success || 0;
        const failCount = stats.failed || 0;
        const warningCount = stats.warnings || 0;
        
        let title = 'Import terminé !';
        let successText = `${successCount} matériel(s) importé(s) avec succès.`;
        
        if (successCount === 0 && failCount === 0) {
            title = 'Import terminé';
            successText = 'L\'import a été traité. Vérifiez votre fichier.';
        } else if (failCount > 0) {
            successText += `\n${failCount} échec(s).`;
        }
        if (warningCount > 0) {
            successText += `\n${warningCount} avertissement(s).`;
        }
        
        await MySwal.fire({
            icon: successCount > 0 ? 'success' : 'warning',
            title,
            text: successText,
            confirmButtonText: 'OK'
        });

        setShowImportSection(false);
        resetImportState();

    } catch (error) {
        console.error('Erreur import Excel:', error);
        
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de l\'import.';
        setImportError(errorMessage);
        
        await MySwal.fire({
            icon: 'error', title: 'Échec de l\'import', text: errorMessage, confirmButtonText: 'OK'
        });
        
    } finally {
        setIsImporting(false);
    }
}, [importFile, importData, parseExcelFile, fetchMateriels, resetImportState]);

// Fonction d'exportation Excel principale
const handleExportExcel = useCallback(() => {
      const dataToExport = filteredMateriels.map(item => ({
           "Site": item.nom_local,
           "Utilisateur": item.utilisateur, 
           "N° Matricule": item.id_n, 
           "Équipe": item.equipe,
           "Date PC": item.date_pc ? new Date(item.date_pc).toLocaleDateString('fr-FR') : 'N/A',
           "Date Écran": item.date_ecran ? new Date(item.date_ecran).toLocaleDateString('fr-FR') : 'N/A',
           "Caractéristiques": item.caracteristiques,
           "Code PC": item.code_pc, 
           "Marque Écran": item.ecran, 
           "Code Écran": item.code_ecran, 
           "HDMI": item.hdmi ? 'Oui' : 'Non', 
           "Clavier": item.clavier ? 'Oui' : 'Non', 
           "LAN": item.lan ? 'Oui' : 'Non', 
           "USB": item.usb ? 'Oui' : 'Non', 
           "État PC": item.etat_pc, 
           "salle": item.salle, 
           "Password_Local": item.mdp_pc, 
           "Password_Admin": item.mdp_admin, 
           "Etat de la batterie": item.etat_batterie, 
           "Commentaire": item.commentaire,
           "Est Actif": item.est_actif,
     }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
        if (!worksheet[cellAddress]) continue;
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = { 
            font: { bold: true, color: { rgb: "FFFFFF" } }, 
            fill: { fgColor: { rgb: "4F46E5" } } 
        };
    }

    const colWidths = [
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 },
    ];
    worksheet['!cols'] = colWidths;

    const filterRange = { s: { c: 0, r: 0 }, e: { c: range.e.c, r: 0 } };
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(filterRange) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Materiels");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    const formattedTime = `${hours}h${minutes}m${seconds}s`;
    const filename = `inventaire_materiels_${formattedDate}_${formattedTime}.xlsx`;

    saveAs(blob, filename);
}, [filteredMateriels]);

// --- Fonction d'exportation Excel par nom_local ---
const handleExportByLocal = useCallback(() => {
    if (!filterNomLocal) return;

    const dataToExport = materiels
        .filter(item => item.nom_local === filterNomLocal)
        .map(item => ({
            "Site": item.nom_local,
            "Utilisateur": item.utilisateur, 
            "N° Matricule": item.id_n, 
            "Équipe": item.equipe,
            "Date PC": item.date_pc ? new Date(item.date_pc).toLocaleDateString('fr-FR') : 'N/A',
            "Date Écran": item.date_ecran ? new Date(item.date_ecran).toLocaleDateString('fr-FR') : 'N/A',
            "Caractéristiques": item.caracteristiques,
            "Code PC": item.code_pc, 
            "Marque Écran": item.ecran, 
            "Code Écran": item.code_ecran, 
            "HDMI": item.hdmi ? 'Oui' : 'Non', 
            "Clavier": item.clavier ? 'Oui' : 'Non', 
            "LAN": item.lan ? 'Oui' : 'Non', 
            "USB": item.usb ? 'Oui' : 'Non', 
            "État PC": item.etat_pc, 
            "Salle": item.salle, 
            "Password_Local": item.mdp_pc, 
            "Password_Admin": item.mdp_admin, 
            "Etat de la batterie": item.etat_batterie, 
            "Commentaire": item.commentaire,
            "Est Actif": item.est_actif,
        }));

    if (dataToExport.length === 0) {
        MySwal.fire({ 
            icon: 'info', 
            title: 'Aucune donnée', 
            text: `Aucun matériel trouvé pour le local "${filterNomLocal}".` 
        });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
        if (!worksheet[cellAddress]) continue;
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = { 
            font: { bold: true, color: { rgb: "FFFFFF" } }, 
            fill: { fgColor: { rgb: "4F46E5" } } 
        };
    }

    const colWidths = [
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 },
    ];
    worksheet['!cols'] = colWidths;
    
    const filterRange = { s: { c: 0, r: 0 }, e: { c: range.e.c, r: 0 } };
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(filterRange) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Materiels");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    const formattedTime = `${hours}h${minutes}m${seconds}s`;
    const safeName = filterNomLocal.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `inventaire_materiels_${safeName}_${formattedDate}_${formattedTime}.xlsx`;

    saveAs(blob, filename);
}, [materiels, filterNomLocal]);

// --- Rendu du JSX ---
return (
    <div className="container-fluid py-2 px-2 page-materiels" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        {/* Header Section */}
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded-3" style={{ 
           background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', boxShadow: '0 1px 3px rgba(124, 58, 237, 0.15)', borderRadius: '16px', position: 'relative', overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)', pointerEvents: 'none'
            }} />
            
            <div className="d-flex align-items-center gap-3 position-relative">
                <div className="d-flex align-items-center justify-content-center flex-shrink-0" style={{ 
                    background: 'rgba(255, 255, 255, 0.15)', width: '44px', height: '44px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.15)'
                }}>
                    <FaDesktop className="text-white" style={{ fontSize: '1.25rem' }} />
                </div>
                <div>
                    <h1 className="h5 fw-bold text-white mb-0">{userRole === 'USER' ? 'Mon matériel' : 'Parc Informatique'}</h1>
                    <p className="text-white mb-0" style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                        {userRole === 'USER' ? 'Consultez votre équipement et son état' : 'Gérez et suivez vos matériels en temps réel'}
                    </p>
                </div>
            </div>
            
            <div className="d-flex gap-2 position-relative">
                <Button 
                    className="btn-pill btn-pill-ghost btn-refresh" 
                    onClick={fetchMateriels} 
                    title="Rafraîchir les données"
                >
                    <FaSync />
                </Button>
                
                {(userRole !== 'USER' && userRole !== 'DIRECTION') && (
                <Button 
                    className={`btn-pill btn-pill-success ${showImportSection ? 'active' : ''}`} 
                    onClick={toggleImportSection} 
                    disabled={isImporting}
                    style={{ borderRadius: '9999px' }}
                >
                    {isImporting ? (
                        <Spinner animation="border" size="sm" style={{ color: 'white' }} />
                    ) : (
                        <FaFileImport size={14} />
                    )}
                    <span className="ms-2">{isImporting ? 'Import...' : 'Importer'}</span>
                </Button>
                )}
                
                {!filterNomLocal && (
                    <Button 
                        className="btn-pill btn-pill-warning" 
                        onClick={handleExportExcel}
                        title="Exporter tous les matériels"
                        style={{ borderRadius: '9999px' }}
                    >
                        <FaFileExcel size={14} />
                        <span className="ms-2">Exporter</span>
                    </Button>
                )}
                
                {filterNomLocal && (
                    <Button 
                        className="btn-pill btn-pill-warning" 
                        onClick={handleExportByLocal} 
                        title={`Exporter le local "${filterNomLocal}"`}
                        style={{ borderRadius: '9999px' }}
                    >
                        <FaFileExcel size={14} />
                        <span className="ms-2">Exporter ce local</span>
                    </Button>
                )}
                
                {(userRole !== 'USER' && userRole !== 'DIRECTION') && (
                <Button 
                    className="btn-pill btn-pill-primary" 
                    onClick={handleOpenAddModal}
                    title="Ajouter un nouveau matériel"
                    style={{ borderRadius: '9999px' }}
                >
                    <FaPlus size={14} />
                    <span className="ms-2">Nouveau</span>
                </Button>
                )}
                
                {(userRole !== 'USER' && userRole !== 'DIRECTION') && (
                <Button 
                    className="btn-pill btn-pill-secondary" 
                    onClick={handleOpenAddMarque}
                    title="Ajouter une nouvelle marque"
                    style={{ borderRadius: '9999px' }}
                >
                    <MdOutlineAddCircleOutline size={17} />
                    <span className="ms-2">Marque</span>
                </Button>
                )}
            </div>
        </div>

        {/* SECTION D'IMPORT INTÉGRÉE */}
        {showImportSection && (
            <div className="import-section mb-4 rounded-3" style={{ 
                background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', animation: 'slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div className="d-flex justify-content-between align-items-center p-4 pb-3">
                    <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: '#1F2937', fontSize: '1rem' }}>
                        <div style={{ 
                           width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}>
                            <FaFileImport size={14} />
                        </div>
                        Importer des matériels
                    </h6>
                    <button 
                        className="btn btn-sm rounded-circle border-0"
                        onClick={toggleImportSection}
                        style={{ 
                            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
                            color: '#9ca3af'
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
                                        Formats acceptés : <span className="fw-semibold" style={{ color: '#7c3aed' }}>.xlsx, .xls</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {importPreview.length > 0 && !isImporting && (
                            <div className="mx-4 mb-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
                                        <FaSearch className="me-2" style={{ color: '#6366f1', fontSize: '0.75rem' }} />
                                        Aperçu des données
                                    </h6>
                                    <span className="badge" style={{ 
                                        backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '0.75rem', padding: '4px 12px', borderRadius: '20px', fontWeight: '500'
                                    }}>
                                        {importData.length} lignes au total
                                    </span>
                                </div>
                                <div className="table-responsive" style={{ maxHeight: '250px', overflow: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
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
                                                <tr key={rowIndex} style={{ 
                                                    transition: 'background-color 0.15s ease',
                                                }}>
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

                        {isImporting && (
                            <div className="mx-4 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <Spinner animation="border" size="sm" style={{ color: '#7c3aed' }} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                            {importProgress < 25 ? 'Analyse du fichier Excel...' : 
                                             importProgress < 70 ? 'Envoi des données au serveur...' : 
                                             importProgress < 100 ? 'Traitement des données...' : 
                                             'Importation terminée !'}
                                        </span>
                                    </div>
                                    <span style={{ 
                                        fontWeight: '600', 
                                        color: importProgress === 100 ? '#10b981' : '#7c3aed',
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
                                                : 'linear-gradient(90deg, #7c3aed, #6366f1)',
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
                                                {importSuccessStats.success} matériel(s) importé(s)
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
                                    {(importSuccessStats.warnings || 0) > 0 && (
                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                            <div style={{ 
                                                width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <FaInfoCircle style={{ color: '#6b7280', fontSize: '0.8rem' }} />
                                            </div>
                                            <span style={{ fontWeight: '500', color: '#4b5563', fontSize: '0.9rem' }}>
                                                {importSuccessStats.warnings} avertissement(s)
                                            </span>
                                        </div>
                                    )}
                                    {(importSuccessStats.success || 0) === 0 && (importSuccessStats.failed || 0) === 0 && (
                                        <div style={{ 
                                            padding: '10px 20px', backgroundColor: '#fef3c7', borderRadius: '10px', display: 'inline-block', marginTop: '0.5rem', color: '#92400e', fontSize: '0.9rem'
                                        }}>
                                            L'import a été traité. Vérifiez votre fichier Excel.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ 
                                    padding: '10px 20px', backgroundColor: '#d1fae5', borderRadius: '10px', display: 'inline-block', marginTop: '0.5rem', color: '#065f46', fontSize: '0.9rem'
                                }}>
                                    Les matériels ont été importés avec succès.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Carte principale */}
        <Card className="border-0" style={{ borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Card.Body className="p-4 p-lg-5">
                {/* Messages d'état */}
                {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

                {/* Filtres */}
                <div className="row mb-3 g-3">
                    <div className="col-md-3 col-lg-3">
                        <InputGroup className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{ transition: 'all 0.2s ease' }}>
                            <InputGroup.Text className="bg-transparent border-0">
                                <FaSearch className="text-muted" />
                            </InputGroup.Text>
                            <Form.Control 
                                className="bg-transparent border-0 shadow-none p-0" 
                                placeholder="Rechercher..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                style={{ fontSize: '0.85rem' }}
                            />
                            {searchTerm && (
                                <Button variant="link" className="text-muted p-0 ms-2" onClick={() => setSearchTerm('')} style={{ fontSize: '0.85rem' }}>
                                    <FaTimes />
                                </Button>
                            )}
                        </InputGroup>
                    </div>

                    <div className="col-md-1 col-lg-1">
                        <Form.Select 
                            value={filterEtat} 
                            onChange={(e) => setFilterEtat(e.target.value)} 
                            className="rounded-pill border-0 shadow-sm" 
                            style={{ 
                                backgroundColor: filterEtat ? '#e0e7ff' : '#f8f9fa', 
                                height: '38px', 
                                fontSize: '0.85rem',
                                color: filterEtat ? '#4338ca' : '#374151',
                                fontWeight: filterEtat ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <option value="">Etats</option>
                            <option value="Très Bon">Très Bon</option>
                            <option value="Bon">Bon</option>
                            <option value="Moyen">Moyen</option>
                            <option value="Mauvais">Mauvais</option>
                            <option value="HS">HS</option>
                            <option value="Disponible">Disponible</option>
                        </Form.Select>
                    </div>

                    <div className="col-md-2 col-lg-2">
                        <SearchableSelect
                            value={filterEquipe}
                            onChange={setFilterEquipe}
                            placeholder="Equipes"
                            options={[...new Set(materiels.map(m => m.equipe).filter(Boolean))]}
                            style={{
                                backgroundColor: filterEquipe ? '#e0e7ff' : '#f8f9fa',
                                height: '38px',
                                fontSize: '0.85rem',
                                color: filterEquipe ? '#4338ca' : '#374151',
                                fontWeight: filterEquipe ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        />
                    </div>

                    <div className="col-md-1 col-lg-1">
                        <Form.Select 
                            value={filterNomLocal} 
                            onChange={(e) => setFilterNomLocal(e.target.value)} 
                            className="rounded-pill border-0 shadow-sm" 
                            style={{ 
                                backgroundColor: filterNomLocal ? '#e0e7ff' : '#f8f9fa', 
                                height: '38px', 
                                fontSize: '0.85rem',
                                color: filterNomLocal ? '#4338ca' : '#374151',
                                fontWeight: filterNomLocal ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <option value="">Locaux</option>
                            {[...new Set(materiels.map(m => m.nom_local).filter(Boolean))].map(nom_local => (
                                <option key={nom_local} value={nom_local}>{nom_local}</option>
                            ))}
                        </Form.Select>
                    </div>

                    <div className="col-md-1 col-lg-1">
                        <SearchableSelect
                            value={filterYear}
                            onChange={setFilterYear}
                            placeholder="Années"
                            options={[
                                ...[...new Set(materiels.map(m => m.date_pc ? new Date(m.date_pc).getFullYear() : null).filter(y => y !== null))].sort((a, b) => b - a).map(year => ({ value: String(year), label: String(year) }))
                            ]}
                            style={{
                                backgroundColor: filterYear ? '#e0e7ff' : '#f8f9fa',
                                height: '38px',
                                fontSize: '0.85rem',
                                color: filterYear ? '#4338ca' : '#374151',
                                fontWeight: filterYear ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        />
                    </div>

                    <div className="col-md-1 col-lg-1">
                        <SearchableSelect
                            value={filterMarque}
                            onChange={setFilterMarque}
                            placeholder="Marques"
                            options={[...new Set(materiels.map(m => m.nom_marque).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
                            style={{
                                backgroundColor: filterMarque ? '#e0e7ff' : '#f8f9fa',
                                height: '38px',
                                fontSize: '0.85rem',
                                color: filterMarque ? '#4338ca' : '#374151',
                                fontWeight: filterMarque ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        />
                    </div>

                    <div className="col-md-1 col-lg-1">
                        <Form.Select 
                            value={filterEstActif} 
                            onChange={(e) => setFilterEstActif(e.target.value)} 
                            className="rounded-pill border-0 shadow-sm" 
                            style={{ 
                                backgroundColor: filterEstActif ? '#e0e7ff' : '#f8f9fa', 
                                height: '38px', 
                                fontSize: '0.85rem',
                                color: filterEstActif ? '#4338ca' : '#374151',
                                fontWeight: filterEstActif ? '600' : '400',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <option value="">Status</option>
                            <option value="Actif">Actif</option>
                            <option value="Inactif">Inactif</option>
                        </Form.Select>
                    </div>

                    <div className="col-md-auto">
                        <div className="d-flex gap-2 align-items-center">
                            <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{ 
                                backgroundColor: (searchTerm || filterEtat || filterEquipe || filterNomLocal || filterMarque || filterYear || filterEstActif) ? '#fef3c7' : '#f8f9fa',
                                transition: 'all 0.2s ease'
                            }}>
                                <small className="text-muted">
                                    <strong style={{ 
                                        color: (searchTerm || filterEtat || filterEquipe || filterNomLocal || filterMarque || filterYear || filterEstActif) ? '#92400e' : '#374151'
                                    }}>
                                        {filteredMateriels.length}
                                    </strong> {' '}résultat{filteredMateriels.length > 1 ? 's' : ''}
                                </small>
                            </div>
                            {(searchTerm || filterEtat || filterEquipe || filterNomLocal || filterMarque || filterYear || filterEstActif) && (
                                <Button 
                                    variant="outline-warning" 
                                    size="sm" 
                                    className="border-0 rounded-pill" 
                                    onClick={handleResetFilters}
                                    style={{ 
                                        backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '600', fontSize: '0.8rem', transition: 'all 0.2s ease'
                                    }}
                                >
                                    <FaTimes size={14} className="me-1"/>
                                    Réinitialiser
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tableau */}
                {loading ? (
                    <div className="table-responsive">
                        <DataTable
                            columns={columns}
                            data={[]}
                            pagination={false}
                            highlightOnHover={false}
                            pointerOnHover={false}
                            responsive
                            progressPending
                            progressComponent={
                                <div className="p-5 text-center">
                                    <div className="d-flex flex-column align-items-center gap-3">
                                        <Spinner animation="grow" variant="primary" size="sm" />
                                        <span className="text-muted" style={{ fontSize: '0.9rem' }}>Chargement des données...</span>
                                    </div>
                                </div>
                            }
                            customStyles={modernStyles}
                        />
                    </div>
                ) : filteredMateriels.length === 0 ? (
                    <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: '0.85rem', minWidth: '100%' }}>
                            <thead>
                                <tr>
                                    {columns.map((col, i) => (
                                        <th key={i} style={{ 
                                            fontSize: '0.75rem', fontWeight: '600', color: '#374151', 
                                            paddingLeft: '16px', paddingRight: '16px', paddingTop: '14px', 
                                            paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', 
                                            backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', 
                                            whiteSpace: 'nowrap', userSelect: 'none'
                                        }}>
                                            {col.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={columns.length} className="text-center py-5">
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#6366f1' }}>
                                            <FaInbox />
                                        </div>
                                        <div style={{ color: '#6c757d', fontSize: '0.95rem', fontWeight: '500' }}>
                                            Aucun matériel trouvé
                                        </div>
                                        <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            {searchTerm || filterEtat || filterEquipe || filterNomLocal || filterMarque || filterYear || filterEstActif 
                                                ? 'Essayez de modifier vos filtres de recherche' 
                                                : 'Commencez par ajouter un matériel'}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <DataTable
                            columns={columns}
                            data={filteredMateriels}
                            pagination
                            paginationComponentOptions={paginationOptions}
                            highlightOnHover
                            pointerOnHover
                            responsive
                            customStyles={modernStyles}
                        />
                    </div>
                )}
            </Card.Body>
        </Card>

        {/* ✅ Modales - Utilisation de id_materiels pour l'historique */}
        {isAddModalOpen && <AddModal onClose={handleCloseAddModal} onMaterialAdded={handleMaterialAdded} />}
        {modalType === 'details' && selectedMateriel && <DetailsModal isOpen={true} onClose={closeModal} data={selectedMateriel} />}
        {modalType === 'edit' && selectedMateriel && <EditModal isOpen={true} onClose={closeModal} data={selectedMateriel} />}
        
        {/* ✅ MODAL HISTORIQUE CORRIGÉ - Utilise id_materiels */}
        {isHistoriqueModalOpen && selectedMaterielForHistory && (
            <HistoriqueModal
                isOpen={isHistoriqueModalOpen}
                onClose={handleCloseHistoriqueModal}
                // ✅ CRUCIAL : Utiliser id_materiels (l'ID primaire) au lieu de id_n
                materielId={selectedMaterielForHistory.id_materiels}
                materielData={selectedMaterielForHistory}
            />
        )}
        
        <div style={{ display: isAddMarqueOpen ? 'block' : 'none' }}>
            <AddMarque 
                key={addMarqueKey}
                onClose={handleCloseAddMarque} 
                onMarqueAdded={fetchMateriels}
            />
        </div>
    </div>
);
}

export default Materiels;