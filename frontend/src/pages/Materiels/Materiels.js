// src/pages/Materiels/Materiels.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DataTable from 'react-data-table-component';
import { MySwal, swalButtons } from '../../utils/swal';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, updateMaterielStatut } from '../../services/api';
import { Button, Form, InputGroup, Spinner, Card, Alert, Tabs, Tab } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrash, FaFileExcel, FaSearch, FaSync, FaTimes, FaDesktop, FaFileImport, FaPlus, FaFileUpload, FaHistory, FaInbox, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaUserCircle, FaBatteryFull, FaTags, FaTrashRestore } from 'react-icons/fa';
/// --- Importations des Modales ---
import AddModal from './AddModal';
import DetailsModal from './DetailsModal';
import EditModal from './EditModal';
import AddMarque from './AddMarque';
import HistoriqueModal from './HistoriqueModal';
import EcransModal from './EcransModal';
import CorbeilleModal from './CorbeilleModal';
import SearchableSelect from '../../components/SearchableSelect/SearchableSelect';
import PageHeader from '../../components/PageHeader/PageHeader';
import ExcelImportPanel from '../../components/ExcelImportPanel/ExcelImportPanel';
import { paginationOptions } from '../../styles/dataTableTheme';
import { materielsTableStyles, statusConfig } from './materielsTableConfig';
import { toneClass } from '../../utils/tones';
import { useMaterielImportExport } from './useMaterielImportExport';

import './Materiels.css';

const DEFAULT_STATUS = { emoji: '❓', tone: 'neutral' };

// Onglets de filtre par état (ordre d'affichage)
const ETATS = ['Très Bon', 'Bon', 'Moyen', 'Mauvais', 'HS', 'Disponible', 'Stock', 'Sans poste'];

// 'Stock' : poste sans bénéficiaire (id_n null), y compris ceux mis en stock
// avant que la mise en stock ne pose etat_pc = 'Stock'.
// 'Sans poste' : utilisateur dont le PC est parti en stock (fiche vide),
// ou poste dont l'état a été passé à « Sans poste » via la modification.
const isSansPoste = (materiel) => Boolean(materiel.est_vide) || materiel.etat_pc === 'Sans poste';

const matchesEtat = (materiel, etat) => {
    if (!etat) return true;
    if (etat === 'Stock') return materiel.id_n == null;
    if (etat === 'Sans poste') return isSansPoste(materiel);
    return (materiel.etat_pc || '') === etat;
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
const [isEcransModalOpen, setIsEcransModalOpen] = useState(false);
const [isCorbeilleOpen, setIsCorbeilleOpen] = useState(false);
const [addMarqueKey] = useState(0);
const [isHistoriqueModalOpen, setIsHistoriqueModalOpen] = useState(false);
const [selectedMaterielForHistory, setSelectedMaterielForHistory] = useState(null);
const [successMessage, setSuccessMessage] = useState(null);
const [error] = useState(null);

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
        const response = await apiClient.delete(`/materiels_all/${materielId}`);
        fetchMateriels();

        MySwal.fire({
            icon: 'success', title: 'Supprimé !', text: response.data?.message || 'Suppression effectuée.', timer: 3000, showConfirmButton: false
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
    const ecranEnStock = row.code_ecran ? ` Son écran ${row.code_ecran} repartira en stock.` : '';
    MySwal.fire({
        title: 'Confirmer la suppression',
        text: isSansPoste(row)
            ? `Supprimer la fiche « Sans poste » de ${row.utilisateur} ? L'utilisateur disparaîtra de la liste et son matricule sera libéré.${ecranEnStock} L'historique est conservé.`
            : `Sortir de l'inventaire le PC en stock ${row.code_pc || ''} ? Il disparaîtra de la liste.${ecranEnStock} L'historique est conservé.`,
        icon: 'warning',
        showCancelButton: true, ...swalButtons('danger'), confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
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
        // Route dédiée : le PUT n'accepte plus est_actif (suivi par l'affectation).
        await updateMaterielStatut(row.id_materiels, newVal);
        await fetchMateriels();
    } catch (error) {
        console.error("Erreur lors de la mise à jour de est_actif:", error);
        setMateriels(prev => prev.map(m =>
            m.id_materiels === row.id_materiels ? { ...m, est_actif: currentEstActif, etat_pc: currentEtatPc } : m
        ));
        MySwal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Impossible de modifier le statut.',
            timer: 2000,
            showConfirmButton: false
        });
    }
}, [fetchMateriels]);

// --- Fonctions de filtrage et recherche ---
// Tous les filtres sauf l'état : sert de base aux compteurs des onglets
const materielsHorsEtat = useMemo(() => {
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

        const equipeMatch = !filterEquipe || equipe === filterEquipe;
        const nomLocalMatch = !filterNomLocal || nom_local === filterNomLocal;
        const marqueMatch = !filterMarque || nom_marque === filterMarque;
        const estActifMatch = !filterEstActif || estActifLabel === filterEstActif;

        const datePc = materiel.date_pc ? new Date(materiel.date_pc) : null;
        const yearValue = datePc ? datePc.getFullYear() : null;
        const yearMatch = !filterYear ||
            (filterYear === 'none' ? !materiel.date_pc : yearValue === parseInt(filterYear, 10));

        const userMatch = userRole !== 'USER' || (id_n_string === userIdN);

        return searchMatch && equipeMatch && nomLocalMatch && marqueMatch && yearMatch && estActifMatch && userMatch;
    });
}, [materiels, searchTerm, filterEquipe, filterNomLocal, filterMarque, filterYear, filterEstActif, userRole, userIdN]);

const filteredMateriels = useMemo(
    () => materielsHorsEtat.filter(m => matchesEtat(m, filterEtat)),
    [materielsHorsEtat, filterEtat]
);

const etatCounts = useMemo(() => {
    const counts = {};
    ETATS.forEach(etat => { counts[etat] = materielsHorsEtat.filter(m => matchesEtat(m, etat)).length; });
    return counts;
}, [materielsHorsEtat]);

// --- Fonctions de rendu partagées (tableau + vue cartes) ---
const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('fr-FR');
}, []);

const renderStatus = useCallback((row) => {
        const currentConfig = statusConfig[row.etat_pc] || DEFAULT_STATUS;
        return (
            <span className={`mat-status-badge ${toneClass(currentConfig.tone)}`}>
                <span className="mat-status-emoji" aria-hidden="true">{currentConfig.emoji}</span>
                {row.etat_pc}
            </span>
        );
}, []);

const renderEstActif = useCallback((row) => {
        const val = row.est_actif;
        const isActive = val === true || val === 'true' || val === 'Oui' || val === 'oui';
        const label = isActive ? 'Actif' : 'Inactif';
        const stateClass = isActive ? 'is-active' : 'is-inactive';

        // PC en stock et fiches « Sans poste » : statut piloté par l'affectation.
        if (userRole === 'USER' || row.est_vide || row.id_n == null) {
            return (
                <span className={`mat-actif-badge ${stateClass}`} title={userRole === 'USER' ? undefined : "Statut piloté par l'affectation (« Réaffecter le PC »)"}>
                    <span className="mat-status-emoji" aria-hidden="true">{isActive ? '✅' : '❌'}</span>
                    {label}
                </span>
            );
        }

        return (
            <div
                className={`mat-actif-toggle ${stateClass}`}
                onClick={() => handleToggleEstActif(row)}
                title="Cliquer pour changer le statut"
            >
                <div className="mat-actif-toggle-knob" />
                <span className="mat-actif-toggle-label">{label}</span>
            </div>
        );
}, [userRole, handleToggleEstActif]);

const renderDocumentsCount = useCallback((row) => {
        const count = row.documents_count || 0;
        return (
            <span className={`mat-doc-count ${count > 0 ? 'has-docs' : ''}`}>
                {count}
            </span>
        );
}, []);

const renderMarque = useCallback((row) => {
        const imageUrl = row.url;
        if (imageUrl && imageUrl !== 'Non assigné') {
            return (
                <div className="mat-marque-logo">
                    <img
                        src={imageUrl}
                        alt={`Logo ${row.nom_marque || 'marque'}`}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/chemin/vers/image-par-defaut.png';
                        }}
                    />
                </div>
            );
        }
        return (
            <div className="mat-marque-fallback">
                {row.nom_marque || "Pas d'image"}
            </div>
        );
}, []);

// Fiche « Sans poste » : pas de bouton Modifier (on lui attribue un PC via
// « Réaffecter le PC ») ; la supprimer libère le matricule.
// Supprimer : seulement les fiches « Sans poste » et les PC en stock ; un PC
// affecté passe d'abord par « Mettre en stock ».
const renderActions = useCallback((row) => (
        <div className="d-flex gap-1" role="group" aria-label="Actions">
            <button type="button" className="btn-icon btn-icon--info" onClick={() => handleView(row)} title="Voir détails" aria-label="Voir détails">
                <FaEye size={14} />
            </button>
            {userRole !== 'USER' && !isSansPoste(row) && (
            <button type="button" className="btn-icon btn-icon--warning" onClick={() => handleEdit(row)} title="Modifier" aria-label="Modifier">
                <FaEdit size={14} />
            </button>
            )}
            <button type="button" className="btn-icon btn-icon--primary" onClick={() => handleOpenHistoriqueModal(row)} title="Historique" aria-label="Historique">
                <FaHistory size={14} />
            </button>
            {userRole !== 'USER' && (isSansPoste(row) || row.id_n == null) && (
            <button type="button" className="btn-icon btn-icon--danger" onClick={() => confirmDelete(row)} title="Supprimer" aria-label="Supprimer">
                <FaTrash size={14} />
            </button>
            )}
        </div>
), [userRole, handleView, handleEdit, handleOpenHistoriqueModal, confirmDelete]);

// --- Colonnes du tableau ---
const columns = useMemo(() => [
    { name: 'N°', selector: row => row.id_n, sortable: true, width: '75px', grow: 1, cell: row => (
        row.id_n == null
            ? <span className="badge bg-secondary" title="Poste en stock">Stock</span>
            : row.id_n
    ) },
    { name: 'Utilisateur', selector: row => row.utilisateur, sortable: true, minWidth: '120px', grow: 1, cell: row => (
        <div>
            <div>{row.utilisateur}</div>
            {isSansPoste(row) ? (
                <small className="text-muted fst-italic" title="Utilisateur sans PC (PC mis en stock ou réaffecté)">Sans poste</small>
            ) : !row.id_ecran && (
                <small className="text-muted fst-italic" title="Aucun écran affecté à ce poste">Sans écran</small>
            )}
        </div>
    ) },
    { name: 'Équipe', selector: row => row.equipe, sortable: true, minWidth: '120px', grow: 1 },
    { name: 'Date PC', selector: row => row.date_pc, sortable: true, width: '110px', grow: 0, cell: row => formatDate(row.date_pc) },
    { name: 'Date Écran', selector: row => row.date_ecran, sortable: true, width: '110px', grow: 0, cell: row => formatDate(row.date_ecran) },
    { name: 'Marque', cell: renderMarque, ignoreRowClick: true, allowOverflow: true, button: true, sortable: true, width: '100px', grow: 0 },
    { name: 'Caractéristiques', selector: row => row.caracteristiques, minWidth: '300px', grow: 3 },
    { name: 'État', selector: row => row.etat_pc, sortable: true, grow: 1, center: true, cell: renderStatus },
    { name: 'Local(s)', selector: row => row.nom_local || 'Non attribué', sortable: true, minWidth: '90px', grow: 1 },
    { name: 'Status', selector: row => row.est_actif, sortable: true, minWidth: '160px', grow: 1, center: true, cell: renderEstActif, ignoreRowClick: true, allowOverflow: true, button: true },
    { name: 'Nb Doc.', selector: row => row.documents_count, sortable: true, minWidth: '80px', grow: 1, center: true, cell: renderDocumentsCount, ignoreRowClick: true, allowOverflow: true, button: true },
    { name: 'Actions', cell: renderActions, ignoreRowClick: true, allowOverflow: true, button: true, width: '130px', grow: 0, center: true },
], [formatDate, renderMarque, renderStatus, renderEstActif, renderDocumentsCount, renderActions]);

// --- Carte matériel (vue en cartes, rôle USER) ---
const renderMaterielCard = useCallback((row) => (
    <div key={row.id_materiels} className="materiel-card">
        <div className="materiel-card-top">
            {renderMarque(row)}
            <div className="materiel-card-title">
                <div className="materiel-card-code">{row.code_pc || `Matériel #${row.id_n}`}</div>
                {row.caracteristiques && (
                    <div className="materiel-card-sub" title={row.caracteristiques}>{row.caracteristiques}</div>
                )}
            </div>
            {renderStatus(row)}
        </div>

        <div className="materiel-card-info">
            {row.utilisateur && (
                <div className="materiel-card-info-item">
                    <FaUserCircle />
                    <span>{row.utilisateur}</span>
                </div>
            )}
            <div className="materiel-card-info-item">
                <FaUsers />
                <span>{row.equipe || 'Aucune équipe'}</span>
            </div>
            <div className="materiel-card-info-item">
                <FaMapMarkerAlt />
                <span>{row.nom_local || 'Non attribué'}{row.salle ? ` • Salle ${row.salle}` : ''}</span>
            </div>
            {row.date_pc && (
                <div className="materiel-card-info-item">
                    <FaCalendarAlt />
                    <span>Acquis le {formatDate(row.date_pc)}</span>
                </div>
            )}
            {row.etat_batterie && (
                <div className="materiel-card-info-item">
                    <FaBatteryFull />
                    <span>Batterie : {row.etat_batterie}</span>
                </div>
            )}
            <div className="materiel-card-info-item">
                <FaFileUpload />
                <span>Documents</span>
                {renderDocumentsCount(row)}
            </div>
        </div>

        <div className="materiel-card-footer">
            {renderEstActif(row)}
            {renderActions(row)}
        </div>
    </div>
), [renderMarque, renderStatus, renderEstActif, renderDocumentsCount, renderActions, formatDate]);

// --- Import/Export Excel ---
const importExport = useMaterielImportExport({ materiels, filteredMateriels, filterNomLocal, fetchMateriels, setFilterMarque });
const { showImportSection, isImporting, toggleImportSection, handleExportExcel, handleExportByLocal } = importExport;

const hasActiveFilters = Boolean(searchTerm || filterEtat || filterEquipe || filterNomLocal || filterMarque || filterYear || filterEstActif);
const filterClass = (value) => `filter-pill ${value ? 'is-active' : ''}`;

// --- Rendu du JSX ---
return (
    <div className="container-fluid py-2 px-2 page-materiels">
        <PageHeader
            icon={<FaDesktop />}
            title={userRole === 'USER' ? 'Mon matériel' : 'Parc Informatique'}
            subtitle={userRole === 'USER' ? 'Consultez votre équipement et son état' : 'Gérez et suivez vos matériels en temps réel'}
            actions={
                <>
                    <Button className="btn-refresh" onClick={fetchMateriels} title="Rafraîchir les données" aria-label="Rafraîchir les données">
                        <FaSync />
                    </Button>

                    {(userRole !== 'USER') && (
                    <Button
                        className={`btn-pill btn-pill-success ${showImportSection ? 'active' : ''}`}
                        onClick={toggleImportSection}
                        disabled={isImporting}
                    >
                        {isImporting ? (
                            <Spinner animation="border" size="sm" />
                        ) : (
                            <FaFileImport size={14} />
                        )}
                        <span className="ms-2">{isImporting ? 'Import...' : 'Importer'}</span>
                    </Button>
                    )}

                    {!filterNomLocal && (
                        <Button className="btn-pill btn-pill-warning" onClick={handleExportExcel} title="Exporter tous les matériels">
                            <FaFileExcel size={14} />
                            <span className="ms-2">Exporter</span>
                        </Button>
                    )}

                    {filterNomLocal && (
                        <Button className="btn-pill btn-pill-warning" onClick={handleExportByLocal} title={`Exporter le local "${filterNomLocal}"`}>
                            <FaFileExcel size={14} />
                            <span className="ms-2">Exporter ce local</span>
                        </Button>
                    )}

                    {(userRole !== 'USER') && (
                    <Button className="btn-pill btn-pill-primary" onClick={handleOpenAddModal} title="Ajouter un nouveau poste (PC, utilisateur, écran)">
                        <FaPlus size={14} />
                        <span className="ms-2">Nouveau poste</span>
                    </Button>
                    )}

                    {(userRole !== 'USER') && (
                    <Button className="btn-pill btn-pill-secondary" onClick={handleOpenAddMarque} title="Gérer les marques de PC (ajout, modification, suppression)">
                        <FaTags size={14} />
                        <span className="ms-2">Marques PC</span>
                    </Button>
                    )}

                    {(userRole !== 'USER') && (
                    <Button className="btn-pill btn-pill-info" onClick={() => setIsEcransModalOpen(true)} title="Liste des écrans et ajout en stock">
                        <FaDesktop size={14} />
                        <span className="ms-2">Écrans</span>
                    </Button>
                    )}

                    {(userRole !== 'USER') && (
                    <Button className="btn-pill btn-pill-danger" onClick={() => setIsCorbeilleOpen(true)} title="Fiches supprimées ; restauration des PC sortis de l'inventaire">
                        <FaTrashRestore size={14} />
                        <span className="ms-2">Corbeille</span>
                    </Button>
                    )}
                </>
            }
        />

        {/* Import Excel */}
        {showImportSection && (
            <ExcelImportPanel
                {...importExport}
                title="Importer des matériels"
                successLabel="matériel(s) importé(s)"
                successFallback="Les matériels ont été importés avec succès."
                emptyResultMessage="L'import a été traité. Vérifiez votre fichier Excel."
            />
        )}

        {/* Carte principale */}
        <Card className="border-0 mat-main-card">
            <Card.Body className="p-4 p-lg-5">
                {/* Messages d'état */}
                {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

                {/* Filtres */}
                <div className="row mb-3 g-3">
                    {userRole !== 'USER' && (
                    <div className="col-12">
                        <Tabs
                            activeKey={filterEtat || 'all'}
                            onSelect={(key) => setFilterEtat(key === 'all' ? '' : key)}
                            className="materiel-etat-tabs mb-0"
                            fill
                        >
                            <Tab eventKey="all" title={<span className="d-inline-flex align-items-center gap-2"><FaDesktop size={12} aria-hidden="true" />Tous ({materielsHorsEtat.length})</span>} />
                            {ETATS.map(etat => (
                                <Tab key={etat} eventKey={etat} title={<span className="d-inline-flex align-items-center gap-2"><span aria-hidden="true">{statusConfig[etat].emoji}</span>{etat} ({etatCounts[etat]})</span>} />
                            ))}
                        </Tabs>
                    </div>
                    )}
                    <div className="col-12 col-lg-3">
                        <InputGroup className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm">
                            <InputGroup.Text className="bg-transparent border-0">
                                <FaSearch className="text-muted" aria-hidden="true" />
                            </InputGroup.Text>
                            <Form.Control
                                className="bg-transparent border-0 shadow-none p-0 mat-search-input"
                                placeholder="Rechercher..."
                                aria-label="Rechercher un matériel"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <Button variant="link" className="text-muted p-0 ms-2 mat-search-input" onClick={() => setSearchTerm('')} aria-label="Effacer la recherche">
                                    <FaTimes />
                                </Button>
                            )}
                        </InputGroup>
                    </div>

                    {userRole !== 'USER' && (
                    <>
                    <div className="col-6 col-md-4 col-lg">
                        <SearchableSelect
                            value={filterEquipe}
                            onChange={setFilterEquipe}
                            placeholder="Equipes"
                            options={[...new Set(materiels.map(m => m.equipe).filter(Boolean))]}
                            styleClass={filterClass(filterEquipe)}
                        />
                    </div>

                    <div className="col-6 col-md-4 col-lg">
                        <Form.Select
                            value={filterNomLocal}
                            onChange={(e) => setFilterNomLocal(e.target.value)}
                            className={filterClass(filterNomLocal)}
                            aria-label="Filtrer par local"
                        >
                            <option value="">Locaux</option>
                            {[...new Set(materiels.map(m => m.nom_local).filter(Boolean))].map(nom_local => (
                                <option key={nom_local} value={nom_local}>{nom_local}</option>
                            ))}
                        </Form.Select>
                    </div>

                    <div className="col-6 col-md-4 col-lg">
                        <SearchableSelect
                            value={filterYear}
                            onChange={setFilterYear}
                            placeholder="Années"
                            options={[
                                ...[...new Set(materiels.map(m => m.date_pc ? new Date(m.date_pc).getFullYear() : null).filter(y => y !== null))].sort((a, b) => b - a).map(year => ({ value: String(year), label: String(year) }))
                            ]}
                            styleClass={filterClass(filterYear)}
                        />
                    </div>

                    <div className="col-6 col-md-4 col-lg">
                        <SearchableSelect
                            value={filterMarque}
                            onChange={setFilterMarque}
                            placeholder="Marques"
                            options={[...new Set(materiels.map(m => m.nom_marque).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
                            styleClass={filterClass(filterMarque)}
                        />
                    </div>

                    <div className="col-6 col-md-4 col-lg">
                        <Form.Select
                            value={filterEstActif}
                            onChange={(e) => setFilterEstActif(e.target.value)}
                            className={filterClass(filterEstActif)}
                            aria-label="Filtrer par statut"
                        >
                            <option value="">Status</option>
                            <option value="Actif">Actif</option>
                            <option value="Inactif">Inactif</option>
                        </Form.Select>
                    </div>
                    </>
                    )}

                    <div className="col-auto">
                        <div className="d-flex gap-2 align-items-center">
                            <div className={`mat-results-pill ${hasActiveFilters ? 'is-filtered' : ''}`}>
                                <small>
                                    <strong>{filteredMateriels.length}</strong> {' '}résultat{filteredMateriels.length > 1 ? 's' : ''}
                                </small>
                            </div>
                            {hasActiveFilters && (
                                <button type="button" className="mat-reset-btn" onClick={handleResetFilters}>
                                    <FaTimes size={14} className="me-1" aria-hidden="true" />
                                    Réinitialiser
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tableau */}
                {loading ? (
                    userRole === 'USER' ? (
                        <div className="p-5 text-center">
                            <div className="d-flex flex-column align-items-center gap-3">
                                <Spinner animation="grow" variant="primary" size="sm" />
                                <span className="mat-loading-text">Chargement des données...</span>
                            </div>
                        </div>
                    ) : (
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
                                            <span className="mat-loading-text">Chargement des données...</span>
                                        </div>
                                    </div>
                                }
                                customStyles={materielsTableStyles}
                            />
                        </div>
                    )
                ) : filteredMateriels.length === 0 ? (
                    userRole === 'USER' ? (
                        <div className="text-center py-5">
                            <div className="mat-empty-icon" aria-hidden="true">
                                <FaInbox />
                            </div>
                            <div className="mat-empty-title">
                                Aucun matériel trouvé
                            </div>
                            <div className="mat-empty-hint">
                                {searchTerm ? 'Essayez de modifier votre recherche' : 'Aucun matériel ne vous est attribué pour le moment'}
                            </div>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-sm mat-empty-table">
                                <thead>
                                    <tr>
                                        {columns.map((col, i) => (
                                            <th key={i}>{col.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={columns.length} className="text-center py-5">
                                            <div className="mat-empty-icon" aria-hidden="true">
                                                <FaInbox />
                                            </div>
                                            <div className="mat-empty-title">
                                                Aucun matériel trouvé
                                            </div>
                                            <div className="mat-empty-hint">
                                                {hasActiveFilters
                                                    ? 'Essayez de modifier vos filtres de recherche'
                                                    : 'Commencez par ajouter un matériel'}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )
                ) : userRole === 'USER' ? (
                    <div className="materiel-card-grid">
                        {filteredMateriels.map(renderMaterielCard)}
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
                            customStyles={materielsTableStyles}
                        />
                    </div>
                )}
            </Card.Body>
        </Card>

        {/* ✅ Modales - Utilisation de id_materiels pour l'historique */}
        {isAddModalOpen && <AddModal onClose={handleCloseAddModal} onMaterialAdded={handleMaterialAdded} />}
        {modalType === 'details' && selectedMateriel && <DetailsModal isOpen={true} onClose={closeModal} data={selectedMateriel} canManage={userRole !== 'USER'} />}
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
        
        {isEcransModalOpen && <EcransModal onClose={() => setIsEcransModalOpen(false)} />}
        {isCorbeilleOpen && <CorbeilleModal onClose={() => setIsCorbeilleOpen(false)} onRestored={fetchMateriels} />}

        <div className={isAddMarqueOpen ? undefined : 'd-none'}>
            <AddMarque
                key={addMarqueKey}
                show={isAddMarqueOpen}
                onClose={handleCloseAddMarque}
                onMarqueAdded={fetchMateriels}
            />
        </div>
    </div>
);
}

export default Materiels;