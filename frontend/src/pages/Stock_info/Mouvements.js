// frontend/src/pages/Stock_info/Mouvements.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

// --- Importations Bootstrap et Icônes ---
import { Spinner, Alert } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrash, FaPlus, FaFileExcel, FaSearch, FaBoxOpen, FaSync, FaTimes, FaFilter, FaArrowUp, FaArrowDown, FaExchangeAlt, FaChartBar, FaUpload, FaCheckCircle, FaFileUpload, FaFileImport } from 'react-icons/fa';

/// --- Importations des Modales ---
import AddStockModal from './AddStockModal';
import DetailsStockModal from './DetailsStockModal';
import EditStockModal from './EditStockModal';

// Import styles from Mouvements.css
import './Mouvements.css';

import { getMouvements, deleteMouvement, importMouvements } from '../../services/api';
import { escapeHtml } from '../../utils/escapeHtml';
import PageHeader from '../../components/PageHeader/PageHeader';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';

// Tableau : thème partagé, seules les hauteurs de ligne diffèrent
const tableCustomStyles = tableStyles({
    rows: { style: { fontSize: '13px', minHeight: '68px' } },
});

const NoDataComponent = () => (
    <div className="mvt-no-data">
        <div className="mvt-no-data__icon" aria-hidden="true">🔍</div>
        <p className="mvt-no-data__title">Aucun mouvement ne correspond aux critères</p>
        <p className="mvt-no-data__hint">Réessayez avec d'autres filtres</p>
    </div>
);

// --- Filtre spécial pour les types de mouvement hors ENTREE/SORTIE/ENTREE_QUANTITE ---
const AUTRES_TYPE_FILTER = '__AUTRES__';

// --- Composant StatCard mémoïsé ---
const StatCard = React.memo(({ icon: Icon, value, label, qty, variant, isActive, isEmpty, onClick }) => (
    <div
        className={`mvt-stat-card mvt-stat--${variant}${isActive ? ' is-active' : ''}${isEmpty ? ' is-empty' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-pressed={isActive}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        }}
    >
        <Icon className="mvt-stat-icon" aria-hidden="true" />
        <div className="mvt-stat-row">
            <div className="mvt-stat-value">{value}</div>
            <div className="mvt-stat-label">{label}</div>
        </div>
        <div className="mvt-stat-qty">
            {qty} {qty === 1 ? 'unité' : 'unités'} au total
        </div>
    </div>
));

// --- Composant ActionButtons mémoïsé ---
const ActionButtons = React.memo(({ row, handleView, handleEdit, handleDelete }) => (
    <div className="d-flex gap-2" role="group" aria-label="Actions">
        <button type="button" className="btn-icon btn-icon--info" onClick={() => handleView(row)} title="Voir détails" aria-label="Voir détails">
            <FaEye size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon btn-icon--warning" onClick={() => handleEdit(row)} title="Modifier" aria-label="Modifier">
            <FaEdit size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon btn-icon--danger" onClick={() => handleDelete(row)} title="Supprimer" aria-label="Supprimer">
            <FaTrash size={14} aria-hidden="true" />
        </button>
    </div>
));


const Mouvements = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    // Rapport du dernier import (doublons ignorés / lignes en erreur)
    const [importReport, setImportReport] = useState(null);
    
    // --- États pour l'import intégré ---
    const [showImportSection, setShowImportSection] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importProgress, setImportProgress] = useState(0);
    const [isImporting, setIsImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [importError, setImportError] = useState(null);
    const [importPreview, setImportPreview] = useState([]);
    const [importData, setImportData] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // --- Fonctions ---
    const handleAddClick = () => setShowAddModal(true);
    const handleCloseAdd = () => setShowAddModal(false);

    const handleCloseDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedItemId(null);
    };

    const handleCloseEdit = () => {
        setShowEditModal(false);
        setSelectedItem(null);
    };

    const fetchAllMouvements = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getMouvements(); 

            if (!Array.isArray(result.mouvements)) {
                throw new Error('Format de données inattendu (mouvements manquant ou n\'est pas un tableau).');
            }

            setData(result.mouvements);

        } catch (error) {
            console.error("Erreur lors du fetching avec Axios:", error.message);

            if (error.response) {
                setError(`Erreur du serveur: ${error.response.status} - ${error.response.data.error || error.response.data.message || 'Une erreur est survenue côté serveur.'}`);
            } else if (error.request) {
                setError("Problème de connexion au serveur. Vérifiez que l'API est lancée et les paramètres CORS.");
            } else {
                setError(`Erreur lors du traitement de la requête: ${error.message}`);
            }

        } finally {
            setLoading(false); 
        }
    }, []);

    useEffect(() => {
        fetchAllMouvements();
    }, [fetchAllMouvements]);

    const handleDetailsClick = useCallback((row) => {
        setSelectedItemId(row.id_mouvement);
        setShowDetailsModal(true);
    }, []);

    const handleEditClick = useCallback((row) => {
        setSelectedItem(row);
        setShowEditModal(true);
    }, []);

    // ✅ NOUVELLE GESTION DE LA SUPPRESSION AVEC SWEETALERT
    const handleDeleteClick = useCallback((row) => {
        // Récupération des informations
        const produit = row.produits?.nom_produit || row.nom_produit || 'Produit inconnu';
        const typeMouvement = row.type_mouvement === 'ENTREE' ? 'Entrée' :
                            row.type_mouvement === 'SORTIE' ? 'Sortie' :
                            row.type_mouvement === 'ENTREE_QUANTITE' ? 'Ajustement' : row.type_mouvement || 'Type inconnu';
        const dateFormatee = new Date(row.date_mouvement).toLocaleDateString('fr-FR');

        Swal.fire({
            title: 'Confirmation de suppression',
            html: `Supprimer définitivement ce mouvement ?<br><br>
                <strong>Produit :</strong> ${escapeHtml(produit)}<br>
                <strong>Type :</strong> ${escapeHtml(typeMouvement)}<br>
                <strong>Date :</strong> ${dateFormatee}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, supprimer !',
            cancelButtonText: 'Annuler'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteMouvement(row.id_mouvement);
                    setSuccessMessage("Mouvement supprimé avec succès !");
                    fetchAllMouvements();
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (err) {
                    console.error("Erreur suppression :", err);
                    setError(`Impossible de supprimer ce mouvement. ${err.message || ''}`);
                    setTimeout(() => setError(null), 4000);
                }
            }
        });
    }, [fetchAllMouvements]);

    // --- Fonctions de gestion de succès après les opérations CUD ---
    const handleAddSuccess = () => {
        setShowAddModal(false);
        fetchAllMouvements();
        setSuccessMessage("Mouvement de stock ajouté avec succès !");
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleSuccessUpdate = () => {
        fetchAllMouvements();
        setShowEditModal(false);
        setSelectedItem(null);
        setSuccessMessage("Mouvement de stock mis à jour avec succès !");
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // --- Réinitialiser les filtres ---
    const clearFilters = () => {
        setFilterText(''); setFilterType(''); setFilterDateRange({ start: '', end: '' });
    };

    // --- Statistiques des mouvements ---
    const stats = useMemo(() => {
        const sommeQuantites = (items) => items.reduce((sum, d) => sum + (Number(d.quantite) || 0), 0);

        const entrees = data.filter(d => d.type_mouvement === 'ENTREE');
        const sorties = data.filter(d => d.type_mouvement === 'SORTIE');
        const ajustements = data.filter(d => d.type_mouvement === 'ENTREE_QUANTITE');
        const autres = data.filter(d => !['ENTREE', 'SORTIE', 'ENTREE_QUANTITE'].includes(d.type_mouvement));

        return {
            total: data.length,
            entree: entrees.length,
            sortie: sorties.length,
            ajustement: ajustements.length,
            autres: autres.length,
            totalQte: sommeQuantites(data),
            entreeQte: sommeQuantites(entrees),
            sortieQte: sommeQuantites(sorties),
            ajustementQte: sommeQuantites(ajustements),
            autresQte: sommeQuantites(autres),
        };
    }, [data]);

    // --- Configuration des cartes de statistiques (cliquables pour filtrer) ---
    const statsConfig = useMemo(() => [
        { key: 'total', label: 'Total', value: stats.total, qty: stats.totalQte, icon: FaChartBar, variant: 'total', filterValue: '' },
        { key: 'entree', label: 'Entrées', value: stats.entree, qty: stats.entreeQte, icon: FaArrowUp, variant: 'entree', filterValue: 'ENTREE' },
        { key: 'sortie', label: 'Sorties', value: stats.sortie, qty: stats.sortieQte, icon: FaArrowDown, variant: 'sortie', filterValue: 'SORTIE' },
        { key: 'ajustement', label: 'Ajustements', value: stats.ajustement, qty: stats.ajustementQte, icon: FaExchangeAlt, variant: 'ajustement', filterValue: 'ENTREE_QUANTITE' },
        { key: 'autres', label: 'Autres', value: stats.autres, qty: stats.autresQte, icon: FaBoxOpen, variant: 'autres', filterValue: AUTRES_TYPE_FILTER },
    ], [stats]);

    const handleStatCardClick = useCallback((filterValue) => {
        setFilterType(current => (current === filterValue ? '' : filterValue));
    }, []);

    // --- Données filtrées ---
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const lowerCaseSearch = filterText.toLowerCase();
            const date_mouvement = item.date_mouvement ? new Date(item.date_mouvement).toLocaleDateString().toLowerCase() : '';
            const nom_produit = item.produits?.nom_produit || item.nom_produit || '';
            const nom_utilisateur = item.nom_utilisateur || '';
            const equipe = item.materiels?.equipe || item.equipe || '';
            const type_mouvement = item.type_mouvement || '';
            const local_source = item.localSource?.nom_local || item.nom_local_source || '';
            const local_destination = item.localDestination?.nom_local || item.nom_local_destination || '';

            const matchSearch = (
                date_mouvement.includes(lowerCaseSearch) || nom_produit.toLowerCase().includes(lowerCaseSearch) || nom_utilisateur.toLowerCase().includes(lowerCaseSearch) || equipe.toLowerCase().includes(lowerCaseSearch) || type_mouvement.toLowerCase().includes(lowerCaseSearch) || local_source.toLowerCase().includes(lowerCaseSearch) || local_destination.toLowerCase().includes(lowerCaseSearch)
            );

            const matchType = !filterType || (
                filterType === AUTRES_TYPE_FILTER
                    ? !['ENTREE', 'SORTIE', 'ENTREE_QUANTITE'].includes(item.type_mouvement)
                    : item.type_mouvement === filterType
            );

            let matchDate = true;
            if (filterDateRange.start) {
                const itemDate = new Date(item.date_mouvement);
                matchDate = itemDate >= new Date(filterDateRange.start);
            }
            if (filterDateRange.end) {
                const itemDate = new Date(item.date_mouvement);
                matchDate = matchDate && itemDate <= new Date(filterDateRange.end);
            }

            return matchSearch && matchType && matchDate;
        });
    }, [data, filterText, filterType, filterDateRange]);


    const handleExportExcel = () => {
        if (filteredData.length === 0) {
            setError("Aucune donnée à exporter pour les critères sélectionnés.");
            return;
        }

        // Map each row to display column values (same order as the header)
        const rows = filteredData.map(item => {
            const formatDate = (d) => {
                if (!d) return 'N/A';
                const date = new Date(d);
                if (isNaN(date.getTime())) return String(d);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            };
            const formatType = (t) => {
                switch (t) {
                    case 'ENTREE': return 'Entrée';
                    case 'SORTIE': return 'Sortie';
                    case 'ENTREE_QUANTITE': return 'Ajustement';
                    default: return t || 'N/A';
                }
            };

            return [
                item.id_mouvement ?? 'N/A',
                formatDate(item.date_mouvement),
                formatType(item.type_mouvement),
                item.quantite ?? 'N/A',
                item.produits?.nom_produit || item.nom_produit || 'N/A',
                item.nom_utilisateur || 'N/A',
                item.materiels?.equipe || item.equipe || 'N/A',
                item.localSource?.nom_local || item.nom_local_source || 'N/A',
                item.localDestination?.nom_local || item.nom_local_destination || 'N/A',
                item.commentaire || 'N/A',
            ];
        });

        const header = [
            ["ID Mouvement", "Date", "Type", "Quantité", "Produit", "Utilisateur", "Équipe", "Local Source", "Local Destination", "Commentaire"],
        ];

        // Merge header + data rows then build the sheet in one pass
        const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MouvementsDeStock");
        XLSX.writeFile(wb, `mouvements_de_stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // ==========================================================
    // --- FONCTIONS D'IMPORT INTÉGRÉ ---
    // ==========================================================

    // Réinitialiser l'état d'import
    const resetImportState = useCallback(() => {
        setImportFile(null);
        setImportProgress(0);
        setIsImporting(false);
        setImportSuccess(false);
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

                // Afficher un aperçu des 5 premières lignes
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

// Fonction d'import améliorée avec gestion de progression réelle
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
    setImportSuccess(false);

    const formData = new FormData();
    formData.append('file', importFile);

    // Déclarer progressInterval ici pour qu'il soit accessible dans tout le bloc
    let progressInterval = null;

    try {
        // Annuler l'import précédent si existant
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Simulation de progression avec gestion SSE
        progressInterval = setInterval(() => {
            setImportProgress(prev => {
                if (prev >= 95) {
                    clearInterval(progressInterval);
                    return 95;
                }
                return prev + 5;
            });
        }, 200);

        // Appel à l'API avec le signal d'annulation
        const response = await importMouvements(formData, signal);
        
        // Nettoyer l'intervalle
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        
        // Vérifier la réponse de l'API
        if (response && response.success) {
            setImportProgress(100);
            setImportSuccess(true);
            
            // Message de succès avec détails
            const successMsg = response.message || 
                `${response.imported || 0} mouvements importés sur ${response.total || importData.length}`;
            setSuccessMessage(successMsg);

            // Doublons ignorés et lignes en erreur : rapport détaillé conservé jusqu'à fermeture
            const nbDoublons = response.doublons || 0;
            const nbErreurs = response.errors || 0;
            if (nbDoublons > 0 || nbErreurs > 0 || (response.errorDetails && response.errorDetails.length > 0)) {
                setImportReport({
                    doublons: nbDoublons,
                    errors: nbErreurs,
                    details: [...(response.errorDetails || []), ...(response.doublonDetails || [])],
                });
            } else {
                setImportReport(null);
            }
            
            // Rafraîchir les données après un court délai
            setTimeout(async () => {
                try {
                    await fetchAllMouvements();
                } catch (refreshError) {
                    console.error('Erreur lors du rafraîchissement:', refreshError);
                }
                
                // Fermer la section d'import après un délai
                setTimeout(() => {
                    setShowImportSection(false);
                    resetImportState();
                    setTimeout(() => setSuccessMessage(null), 3000);
                }, 1500);
            }, 500);
            
        } else {
            // Gérer le cas où la réponse est un succès mais avec des erreurs partielles
            if (response && response.imported > 0 && response.errors > 0) {
                const partialMsg = `⚠️ ${response.imported} mouvements importés, ${response.errors} erreurs.`;
                setImportError(partialMsg);
                setImportProgress(100);
                setImportSuccess(true);
                
                // Afficher les détails des erreurs
                if (response.errorDetails && response.errorDetails.length > 0) {
                    console.error('Détails des erreurs:', response.errorDetails);
                }
                
                // Rafraîchir les données
                setTimeout(async () => {
                    await fetchAllMouvements();
                    setTimeout(() => {
                        setShowImportSection(false);
                        resetImportState();
                    }, 2000);
                }, 1000);
            } else {
                throw new Error(response?.message || 'Erreur lors de l\'importation');
            }
        }
        
    } catch (error) {
        // Nettoyer l'intervalle en cas d'erreur
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        
        // Gestion spécifique des différents types d'erreurs
        if (error.name === 'AbortError' || error.message === 'Importation annulée') {
            setImportError('Import annulé par l\'utilisateur.');
            setImportProgress(0);
        } else if (error.response) {
            // Erreur de réponse du serveur
            const serverError = error.response.data?.message || error.response.data?.error || error.message;
            setImportError(`Erreur serveur: ${serverError}`);
            setImportProgress(0);
        } else if (error.request) {
            // Pas de réponse du serveur
            setImportError('Impossible de contacter le serveur. Vérifiez votre connexion.');
            setImportProgress(0);
        } else {
            // Autres erreurs
            console.error('Erreur lors de l\'importation:', error);
            setImportError(error.message || 'Une erreur est survenue lors de l\'importation.');
            setImportProgress(0);
        }
        
        // Ne pas réinitialiser complètement pour permettre à l'utilisateur de réessayer
        setIsImporting(false);
        abortControllerRef.current = null;
        
        // Afficher un message d'erreur dans l'interface
        setError(`Import échoué: ${error.message || 'Erreur inconnue'}`);
        setTimeout(() => setError(null), 5000);
        
    } finally {
        // Nettoyer l'intervalle si encore présent
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        
        // S'assurer que l'état d'importation est réinitialisé en cas de succès
        if (!importError && importSuccess) {
            // L'état sera réinitialisé par le timeout de succès
        } else {
            setIsImporting(false);
            abortControllerRef.current = null;
        }
    }
}, [importFile, importData, fetchAllMouvements, resetImportState, importError, importSuccess]);

    // --- DÉFINITION DES COLONNES ---
    const columns = useMemo(() => [
        {
            name: 'Date', selector: row => row.date_mouvement,
            sortable: true, width: '130px',
            cell: row => {
                const date = row.date_mouvement ? new Date(row.date_mouvement) : null;
                if (!date) return 'N/A';

                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                let ageText = '';
                if (diffDays === 0) ageText = 'Aujourd\'hui';
                else if (diffDays === 1) ageText = 'Hier';
                else if (diffDays < 7) ageText = `${diffDays}j`;
                else if (diffDays < 30) ageText = `${Math.floor(diffDays / 7)}sem`;
                else ageText = `${Math.floor(diffDays / 30)}mois`;

                return (
                    <div className="mvt-cell-stack mvt-cell-stack--gap">
                        <span className="mvt-cell-date">
                            {date.toLocaleDateString('fr-FR')}
                        </span>
                        <span className="mvt-cell-age">
                            {ageText}
                        </span>
                    </div>
                );
            },
        },
        {
            name: 'Type', selector: row => row.type_mouvement, sortable: true, width: '150px',
            cell: (row) => {
                const typeConfig = {
                    'ENTREE': { variant: 'entree', icon: '▲', label: 'Entrée' },
                    'SORTIE': { variant: 'sortie', icon: '▼', label: 'Sortie' },
                    'ENTREE_QUANTITE': { variant: 'ajustement', icon: '●', label: 'Ajustement' },
                };
                const config = typeConfig[row.type_mouvement] || { variant: 'autre', icon: '◆', label: row.type_mouvement };

                return (
                    <span className={`mvt-type-badge mvt-type-badge--${config.variant}`}>
                        <span aria-hidden="true">{config.icon}</span>
                        {config.label}
                    </span>
                );
            },
        },
        {
            name: 'Qté(s)',
            selector: row => row.quantite || 'N/A',
            sortable: true,
            width: '120px',
            cell: row => (
                <span className="mvt-cell-qty">
                    {row.quantite ?? 'N/A'}
                </span>
            ),
        },
        {
            name: 'Produit(s)',
            selector: row => row.produits?.nom_produit || 'N/A',
            sortable: true,
            grow: 3,
            cell: row => (
                <div className="mvt-cell-stack">
                    <span className="mvt-cell-strong">
                        {row.produits?.nom_produit || 'N/A'}
                    </span>
                </div>
            ),
        },
        {
            name: 'Utilisateur',
            selector: row => row.nom_utilisateur || 'N/A',
            sortable: true,
            grow: 2,
            cell: row => (
                <div className="mvt-cell-stack">
                    <span className="mvt-cell-strong">
                        {row.nom_utilisateur || 'N/A'}
                    </span>
                    {row.materiels?.equipe && (
                        <small className="mvt-cell-sub">
                            Équipe : {row.materiels.equipe}
                        </small>
                    )}
                </div>
            ),
        },
        {
            name: 'Marque',
            selector: row => row.materiels?.marque?.nom_marque || row.nom_marque || 'N/A',
            sortable: true,
            width: '120px',
            cell: (row) => {
                const imageUrl = row.materiels?.marque?.url;
                const nomMarque = row.materiels?.marque?.nom_marque || row.nom_marque;
                if (imageUrl && typeof imageUrl === 'string') {
                    return (
                        <img
                            src={imageUrl}
                            alt={`Aperçu matériel ${nomMarque || ''}`}
                            className="mvt-marque-img"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                            }}
                        />
                    );
                }
                return (
                    <span className="mvt-cell-small">
                        {nomMarque || 'N/A'}
                    </span>
                );
            },
            ignoreRowClick: true, allowOverflow: true,
        },
        {
            name: 'Source',
            selector: row => row.localSource?.nom_local || 'N/A',
            sortable: true, width: '140px',
            cell: row => (
                <span className="mvt-cell-local">
                    {row.localSource?.nom_local || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Destination',
            selector: row => row.localDestination?.nom_local || 'N/A',
            sortable: true, width: '140px',
            cell: row => (
                <span className="mvt-cell-local">
                    {row.localDestination?.nom_local || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Actions',
            cell: row => (
                <ActionButtons
                    row={row} handleView={handleDetailsClick} handleEdit={handleEditClick} handleDelete={handleDeleteClick}
                />
            ),
            ignoreRowClick: true, allowOverflow: true, button: true, width: '120px',
        },
    ], [handleDetailsClick, handleEditClick, handleDeleteClick]);

    return (
        <div className="container-fluid py-2 px-2 mvt-page">
            <PageHeader
                icon={<FaBoxOpen />}
                title="Mouvements de Stock"
                subtitle="Surveillez les entrées et sorties de votre parc informatique."
                actions={
                    <>
                        <button
                            type="button"
                            className="btn-pill btn-pill-ghost btn-refresh"
                            onClick={fetchAllMouvements}
                            title="Rafraîchir"
                            aria-label="Rafraîchir"
                        >
                            <FaSync aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className={`btn-pill btn-pill-success ${showImportSection ? 'active' : ''}`}
                            onClick={toggleImportSection}
                            disabled={isImporting}
                            aria-expanded={showImportSection}
                        >
                            {isImporting ? (
                                <Spinner animation="border" size="sm" aria-hidden="true" />
                            ) : (
                                <FaFileImport size={15} aria-hidden="true" />
                            )}
                            <span>{isImporting ? 'Import...' : 'Importer'}</span>
                        </button>
                        <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcel}>
                            <FaFileExcel size={15} aria-hidden="true" />
                            <span>Exporter</span>
                        </button>
                        <button type="button" className="btn-pill btn-pill-primary" onClick={handleAddClick}>
                            <FaPlus size={15} aria-hidden="true" />
                            <span>Nouveau</span>
                        </button>
                    </>
                }
            />

            {/* SECTION D'IMPORT INTÉGRÉE */}
            {showImportSection && (
                <div className="mvt-import-section">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0 mvt-import-title">
                            <FaFileImport className="me-2 mvt-import-accent" aria-hidden="true" />
                            Importer des mouvements
                        </h6>
                        <button
                            type="button"
                            className="btn-icon"
                            onClick={toggleImportSection}
                            disabled={isImporting}
                            aria-label="Fermer l'import"
                        >
                            <FaTimes aria-hidden="true" />
                        </button>
                    </div>

                    {!importSuccess ? (
                        <>
                            {/* Zone de drop */}
                            <div
                                className={`mvt-import-drop-zone ${isDragging ? 'dragover' : ''} ${importFile ? 'has-file' : ''}`}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="d-none" disabled={isImporting}
                                />

                                {importFile ? (
                                    <div className="d-flex align-items-center justify-content-center gap-4">
                                        <div className="mvt-import-icon mvt-import-icon--excel" aria-hidden="true">
                                            <FaFileExcel />
                                        </div>
                                        <div className="text-start">
                                            <div className="fw-semibold mvt-import-text">{importFile.name}</div>
                                            <div className="text-muted mvt-import-filesize">
                                                {(importFile.size / 1024).toFixed(1)} Ko
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-icon btn-icon--danger"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFile();
                                            }}
                                            disabled={isImporting}
                                            aria-label="Retirer le fichier"
                                        >
                                            <FaTimes aria-hidden="true" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mvt-import-icon" aria-hidden="true">
                                            <FaFileUpload />
                                        </div>
                                        <div className="mvt-import-text">
                                            Glissez-déposez votre fichier Excel ici
                                        </div>
                                        <div className="mvt-import-subtext">
                                            ou cliquez pour parcourir
                                        </div>
                                        <div className="mvt-import-formats">
                                            Formats acceptés : <span className="fw-medium">.xlsx, .xls</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Aperçu du fichier */}
                            {importPreview.length > 0 && !isImporting && (
                                <div className="mt-3 p-3 rounded-3 mvt-import-preview">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="mb-0">
                                            <FaSearch className="me-2 mvt-import-accent" aria-hidden="true" />
                                            Aperçu des données ({importData.length} lignes)
                                        </h6>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-bordered table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    {Object.keys(importPreview[0] || {}).map((key, index) => (
                                                        <th key={index}>
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importPreview.map((row, rowIndex) => (
                                                    <tr key={rowIndex}>
                                                        {Object.values(row).map((value, cellIndex) => (
                                                            <td key={cellIndex}>
                                                                {String(value || '')}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <small className="text-muted">Aperçu des 5 premières lignes</small>
                                </div>
                            )}

                            {isImporting && (
                                <div className="mx-4 mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <Spinner animation="border" size="sm" className="mvt-import-accent" />
                                            <span className="mvt-import-status">
                                                {importProgress < 25 ? 'Analyse du fichier Excel...' :
                                                 importProgress < 70 ? 'Envoi des données au serveur...' :
                                                 importProgress < 100 ? 'Traitement des données...' :
                                                 'Importation terminée !'}
                                            </span>
                                        </div>
                                        <span className={`mvt-import-percent ${importProgress === 100 ? 'is-done' : ''}`}>
                                            {importProgress}%
                                        </span>
                                    </div>
                                    <div className="mvt-progress">
                                        <div
                                            className={`mvt-progress__fill ${importProgress === 100 ? 'is-done' : ''}`}
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Message d'erreur */}
                            {importError && (
                                <Alert variant="danger" className="mt-3 mb-0 mvt-import-error">
                                    <FaTimes className="me-2" aria-hidden="true" />
                                    {importError}
                                </Alert>
                            )}

                            {/* Boutons d'action */}
                            {!isImporting && !importSuccess && (
                                <div className="d-flex justify-content-end gap-2 mt-3 mvt-import-actions">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill px-4"
                                        onClick={toggleImportSection}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-pill btn-pill-success"
                                        onClick={handleImportSubmit}
                                        disabled={!importFile}
                                    >
                                        <FaUpload aria-hidden="true" />
                                        Importer
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Succès de l'importation */
                        <div className="text-center py-4">
                            <div className="mvt-import-success-icon" aria-hidden="true">
                                <FaCheckCircle />
                            </div>
                            <div className="mvt-import-success-text">
                                Importation réussie !
                            </div>
                            <div className="mvt-import-success-subtext">
                                Les mouvements ont été importés avec succès.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Carte principale */}
            <div className="mvt-card">
                <div className="p-4 p-lg-5">

                    {/* Messages d'état */}
                    {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                    {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}
                    {importReport && (
                        <Alert variant="warning" className="mb-3" dismissible onClose={() => setImportReport(null)}>
                            <div className="fw-semibold mb-1">
                                Rapport d'import : {importReport.doublons} doublon(s) ignoré(s) (déjà présents en base), {importReport.errors} ligne(s) en erreur
                            </div>
                            {importReport.details.length > 0 && (
                                <ul className="mb-0 small mvt-import-report">
                                    {importReport.details.slice(0, 50).map((detail, idx) => (
                                        <li key={idx}>{detail}</li>
                                    ))}
                                    {importReport.details.length > 50 && (
                                        <li>… et {importReport.details.length - 50} autre(s)</li>
                                    )}
                                </ul>
                            )}
                        </Alert>
                    )}

                    {/* Statistiques Dashboard - cliquables pour filtrer la table par type */}
                    <div className="row mb-3 g-2">
                        {statsConfig.map(cfg => (
                            <div className="col-6 col-md-3 col-lg-2" key={cfg.key}>
                                <StatCard
                                    icon={cfg.icon}
                                    value={cfg.value}
                                    label={cfg.label}
                                    qty={cfg.qty}
                                    variant={cfg.variant}
                                    isActive={filterType === cfg.filterValue}
                                    isEmpty={cfg.value === 0}
                                    onClick={() => handleStatCardClick(cfg.filterValue)}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Barre de recherche et filtres */}
                    <div className="row mb-4 g-3">
                        <div className="col-md-6 col-lg-4">
                            <div className="mvt-search">
                                <FaSearch aria-hidden="true" />
                                <input
                                    type="text"
                                    placeholder="Rechercher par matériel, utilisateur, date..."
                                    aria-label="Rechercher un mouvement"
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                />
                                {filterText && (
                                    <button
                                        type="button"
                                        className="mvt-search-clear"
                                        onClick={() => setFilterText('')}
                                        aria-label="Effacer la recherche"
                                    >
                                        <FaTimes aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-4">
                            <button
                                type="button"
                                className={`mvt-filter-btn ${showAdvancedFilters ? 'is-active' : ''}`}
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                aria-expanded={showAdvancedFilters}
                            >
                                <FaFilter size={14} aria-hidden="true" />
                                Filtres avancés
                            </button>
                        </div>
                        <div className="col-md-6 col-lg-4">
                            <button
                                type="button"
                                className="mvt-filter-btn"
                                onClick={clearFilters}
                            >
                                <FaTimes size={14} aria-hidden="true" />
                                Réinitialiser
                            </button>
                        </div>
                    </div>

                    {/* Filtres avancés */}
                    {showAdvancedFilters && (
                        <div className="row mb-4 g-3 mvt-advanced-filters">
                            <div className="col-md-4">
                                <label htmlFor="mvt-filter-type">Type de mouvement</label>
                                <select
                                    id="mvt-filter-type"
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="">Tous les types</option>
                                    <option value="ENTREE">Entrée</option>
                                    <option value="SORTIE">Sortie</option>
                                    <option value="ENTREE_QUANTITE">Ajustement</option>
                                    <option value={AUTRES_TYPE_FILTER}>Autres</option>
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="mvt-filter-start">Du :</label>
                                <input
                                    id="mvt-filter-start"
                                    type="date"
                                    value={filterDateRange.start}
                                    onChange={e => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                                    className="form-control"
                                />
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="mvt-filter-end">À :</label>
                                <input
                                    id="mvt-filter-end"
                                    type="date"
                                    value={filterDateRange.end}
                                    onChange={e => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                                    className="form-control"
                                />
                            </div>
                        </div>
                    )}

                    {/* DataTable */}
                    <div className="table-responsive">
                        <DataTable
                            columns={columns}
                            data={filteredData}
                            pagination
                            paginationPerPage={10}
                            paginationRowsPerPageOptions={[10, 20, 50]}
                            highlightOnHover
                            pointerOnHover
                            responsive
                            progressPending={loading}
                            progressComponent={
                                <div className="p-5 text-center">
                                    <div className="spinner-grow text-primary mvt-loading-spinner" role="status"></div>
                                    <p className="text-muted mt-3">Chargement des données...</p>
                                </div>
                            }
                            customStyles={tableCustomStyles}
                            noDataComponent={<NoDataComponent />}
                            paginationComponentOptions={paginationOptions}
                            persistTableHead
                        />
                    </div>
                </div>
            </div>

           {/* Modals avec clés uniques pour éviter les conflits */}
            {showDetailsModal && (
                <DetailsStockModal 
                    key="details-modal" show={showDetailsModal} handleClose={handleCloseDetailsModal} selectedItemId={selectedItemId}
                />
            )}

            {showEditModal && (
                <EditStockModal 
                    key="edit-modal" show={showEditModal} onClose={handleCloseEdit} item={selectedItem} onSuccess={handleSuccessUpdate}
                />
            )}

            {showAddModal && (
                <AddStockModal 
                   key="add-modal" show={showAddModal} onClose={handleCloseAdd} onSuccess={handleAddSuccess}
                />
            )}
            
        </div>
    );
};

export default Mouvements;