// frontend/src/pages/Stock_info/Mouvements.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DataTable from 'react-data-table-component';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

// --- Importations Bootstrap et Icônes ---
import { Button, Spinner, Alert, Form, InputGroup, Card, ProgressBar } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrash, FaPlus, FaFileExcel, FaSearch, FaBoxOpen, FaSync, FaTimes, FaFilter, FaArrowUp, FaArrowDown, FaExchangeAlt, FaChartBar, FaUpload, FaCheckCircle, FaFileUpload, FaFileImport } from 'react-icons/fa';

/// --- Importations des Modales ---
import AddStockModal from './AddStockModal';
import DetailsStockModal from './DetailsStockModal';
import EditStockModal from './EditStockModal';

// Import styles from Mouvements.css
import './Mouvements.css';
import './HomeStock.css';

import { getMouvements, deleteMouvement, importMouvements } from '../../services/api';

// --- Styles CSS intégrés (style modern-header comme Materiels.js) ---
// Les styles ont été déplacés vers Mouvements.css

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
            fontSize: '0.75rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none',
        },
    },
    rows: {
        style: {
            fontSize: '13px', fontWeight: '500', color: '#334155', minHeight: '68px', paddingLeft: '16px', paddingRight: '16px', borderBottom: '1px solid #e2e8f0', transition: 'all 0.3s ease',
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

const NoDataComponent = () => (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>Aucun mouvement ne correspond aux critères</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>Réessayez avec d'autres filtres</p>
    </div>
);

// --- Composant ActionButtons mémoïsé ---
const ActionButtons = React.memo(({ row, handleView, handleEdit, handleDelete }) => (
    <div className="d-flex gap-2" role="group" aria-label="Actions">
        <Button variant="light" onClick={() => handleView(row)} title="Voir détails" className="shadow-sm border-0 p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }} >
            <FaEye size={14} className="text-info" />
        </Button>
        <Button variant="light" onClick={() => handleEdit(row)} title="Modifier" className="shadow-sm border-0 p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }} >
            <FaEdit size={14} className="text-warning" />
        </Button>
        <Button variant="light" onClick={() => handleDelete(row)} title="Supprimer" className="shadow-sm border-0 p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }} >
            <FaTrash size={14} className="text-danger" />
        </Button>
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

    const handleDetailsClick = (row) => {
        setSelectedItemId(row.id_mouvement);
        setShowDetailsModal(true);
    };

    const handleCloseDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedItemId(null);
    };

    const handleEditClick = (row) => {
        setSelectedItem(row);
        setShowEditModal(true);
    };
    const handleCloseEdit = () => {
        setShowEditModal(false);
        setSelectedItem(null);
    };
    
    // ✅ NOUVELLE GESTION DE LA SUPPRESSION AVEC SWEETALERT
    const handleDeleteClick = (row) => {
        // Récupération des informations
        const produit = row.produits?.nom_produit || row.nom_produit || 'Produit inconnu';
        const typeMouvement = row.type_mouvement === 'ENTREE' ? 'Entrée' :
                            row.type_mouvement === 'SORTIE' ? 'Sortie' :
                            row.type_mouvement === 'ENTREE_QUANTITE' ? 'Ajustement' : row.type_mouvement || 'Type inconnu';
        const dateFormatee = new Date(row.date_mouvement).toLocaleDateString('fr-FR');

        Swal.fire({
            title: 'Confirmation de suppression',
            html: `Supprimer définitivement ce mouvement ?<br><br>
                <strong>Produit :</strong> ${produit}<br>
                <strong>Type :</strong> ${typeMouvement}<br>
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
                    setError("Impossible de supprimer ce mouvement.");
                    setTimeout(() => setError(null), 4000);
                }
            }
        });
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
                setError(`Erreur du serveur: ${error.response.status} - ${error.response.data.message || 'Une erreur est survenue côté serveur.'}`);
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
        return {
            total: data.length,
            entree: data.filter(d => d.type_mouvement === 'ENTREE').length,
            sortie: data.filter(d => d.type_mouvement === 'SORTIE').length,
            ajustement: data.filter(d => d.type_mouvement === 'ENTREE_QUANTITE').length,
            autres: data.filter(d => !['ENTREE', 'SORTIE', 'ENTREE_QUANTITE'].includes(d.type_mouvement)).length,
        };
    }, [data]);

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

            const matchType = !filterType || item.type_mouvement === filterType;

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

    // Ouvrir/fermer la section d'import
    const toggleImportSection = useCallback(() => {
        if (!showImportSection) {
            resetImportState();
        }
        setShowImportSection(prev => !prev);
    }, [showImportSection]);

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
    }, []);

    // Gestion du clic sur "parcourir"
    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

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
    }, []);

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

    // Annuler l'import en cours
    const cancelImport = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#1F2937' }}>
                            {date.toLocaleDateString('fr-FR')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>
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
                    'ENTREE': { bg: '#C6F6D5', text: '#2F855A', icon: '▲', label: 'Entrée' },
                    'SORTIE': { bg: '#FED7D7', text: '#C53030', icon: '▼', label: 'Sortie' },
                    'ENTREE_QUANTITE': { bg: '#E9D8FD', text: '#6B46C1', icon: '●', label: 'Ajustement' },
                };
                const config = typeConfig[row.type_mouvement] || { bg: '#BEE3F8', text: '#2B6CB0', icon: '◆', label: row.type_mouvement };

                return (
                    <span style={{
                        backgroundColor: config.bg, color: config.text, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                        <span>{config.icon}</span>
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
                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '500', color: '#1F2937' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '500', color: '#1F2937' }}>
                        {row.nom_utilisateur || 'N/A'}
                    </span>
                    {row.materiels?.equipe && (
                        <small style={{ color: '#6B7280', fontSize: '11px' }}>
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
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px' }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                            }}
                        />
                    );
                }
                return (
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
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
                <span style={{ fontSize: '12px', color: '#475569' }}>
                    {row.localSource?.nom_local || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Destination',
            selector: row => row.localDestination?.nom_local || 'N/A',
            sortable: true, width: '140px',
            cell: row => (
                <span style={{ fontSize: '12px', color: '#475569' }}>
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
    ], []);

    return (
        <div className="container-fluid py-2 px-2 mouvements-container">
            {/* En-tête - Style modern-header comme Materiels.js */}
            <div 
                className="d-flex justify-content-between align-items-center mb-4 p-2 p-md-3 rounded-3 modern-header" 
            >
                <div className="d-flex align-items-center gap-3">
                    <div className="icon-circle">
                        <FaBoxOpen className="text-white" style={{ fontSize: '1.25rem' }} />
                    </div>
                    <div>
                        <h1>Mouvements de Stock</h1>
                        <p>Surveillez les entrées et sorties de votre parc informatique.</p>
                    </div>
                </div>
                
                <div className="d-flex gap-2">
    {/* Bouton Rafraîchir - style circulaire */}
    <Button 
        className="border-0 rounded-circle shadow-sm header-refresh-btn" 
        onClick={fetchAllMouvements}
        title="Rafraîchir"
    >
        <FaSync />
    </Button>
    
    {/* Bouton Importer - style rounded-pill vert émeraude */}
    <Button 
        className={`header-import-btn shadow-sm ${showImportSection ? 'active' : ''}`}
        onClick={toggleImportSection}
        disabled={isImporting}
        style={{
            background: showImportSection 
                ? 'linear-gradient(120deg, #059669, #10b981) !important' 
                : 'linear-gradient(120deg, #059669, #10b981) !important',
            borderRadius: '40px !important', padding: '8px 24px !important', fontWeight: '700 !important', color: 'white !important', fontSize: '0.9rem', border: 'none !important', transition: 'all 0.3s ease !important', display: 'inline-flex !important', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.3px', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)'
        }}
        onMouseEnter={(e) => {
            if (!isImporting) {
                e.target.style.transform = 'scale(1.02) translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(5, 150, 105, 0.4)';
                e.target.style.background = 'linear-gradient(120deg, #047857, #059669)';
            }
        }}
        onMouseLeave={(e) => {
            if (!isImporting) {
                e.target.style.transform = 'scale(1) translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(5, 150, 105, 0.3)';
                e.target.style.background = showImportSection 
                    ? 'linear-gradient(120deg, #047857, #059669)' 
                    : 'linear-gradient(120deg, #059669, #10b981)';
            }
        }}
    >
        {isImporting ? (
            <Spinner animation="border" size="sm" style={{ color: 'white' }} />
        ) : (
            <FaFileImport size={15} />
        )}
        <span className="ms-2">{isImporting ? 'Import...' : 'Importer'}</span>
    </Button>
    
    {/* Bouton Exporter - style rounded-pill orange ambré */}
    <Button 
        className="header-export-btn shadow-sm" 
        onClick={handleExportExcel}
        style={{
           background: 'linear-gradient(120deg, #ea580c, #f97316) !important', borderRadius: '40px !important', padding: '8px 24px !important', fontWeight: '700 !important', color: 'white !important', fontSize: '0.9rem', border: 'none !important', transition: 'all 0.3s ease !important', display: 'inline-flex !important', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.3px', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)'
        }}
        onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.02) translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.4)';
            e.target.style.background = 'linear-gradient(120deg, #c2410c, #ea580c)';
        }}
        onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1) translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(234, 88, 12, 0.3)';
            e.target.style.background = 'linear-gradient(120deg, #ea580c, #f97316)';
        }}
    >
        <FaFileExcel size={15} />
        <span className="ms-2">Exporter</span>
    </Button>
    
    {/* Bouton Nouveau - style rounded-pill bleu cyan */}
    <Button 
        className="header-add-btn shadow-md" 
        onClick={handleAddClick}
        style={{
           background: 'linear-gradient(120deg, #2563eb, #06b6d4) !important', borderRadius: '40px !important', padding: '8px 24px !important', fontWeight: '700 !important', color: 'white !important', fontSize: '0.9rem', border: 'none !important', transition: 'all 0.3s ease !important', display: 'inline-flex !important', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.3px', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
        }}
        onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.02) translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)';
            e.target.style.background = 'linear-gradient(120deg, #1d4ed8, #0891b2)';
        }}
        onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1) translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.3)';
            e.target.style.background = 'linear-gradient(120deg, #2563eb, #06b6d4)';
        }}
    >
        <FaPlus size={18} />
        <span className="ms-2">Nouveau</span>
    </Button>
</div>
            </div>

            {/* SECTION D'IMPORT INTÉGRÉE */}
            {showImportSection && (
                <div className="import-section mb-4 p-4 rounded-3" style={{ 
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', animation: 'slideDown 0.3s ease-out'
                }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0" style={{ color: '#1F2937' }}>
                            <FaFileImport className="me-2" style={{ color: '#667eea' }} />
                            Importer des mouvements
                        </h6>
                        <button 
                            className="btn btn-sm btn-outline-secondary rounded-circle border-0"
                            onClick={toggleImportSection}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            disabled={isImporting}
                        >
                            <FaTimes />
                        </button>
                    </div>

                    {!importSuccess ? (
                        <>
                            {/* Zone de drop */}
                            <div 
                                className={`import-drop-zone ${isDragging ? 'dragover' : ''}`}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${isDragging ? '#667eea' : '#dee2e6'}`, borderRadius: '16px', padding: '2rem', textAlign: 'center', transition: 'all 0.3s ease', cursor: importFile ? 'default' : 'pointer', backgroundColor: isDragging ? '#f0f1ff' : importFile ? '#f0fdf4' : '#fafbfc', position: 'relative'
                                }}
                            >
                                <input
                                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} disabled={isImporting}
                                />

                                {importFile ? (
                                    <div className="d-flex align-items-center justify-content-center gap-4">
                                        <div style={{ fontSize: '2.5rem', color: '#217346' }}>
                                            <FaFileExcel />
                                        </div>
                                        <div className="text-start">
                                            <div className="fw-semibold" style={{ color: '#1F2937' }}>{importFile.name}</div>
                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                {(importFile.size / 1024).toFixed(1)} Ko
                                            </div>
                                        </div>
                                        <button 
                                            className="btn btn-sm btn-outline-danger rounded-circle border-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFile();
                                            }}
                                            disabled={isImporting}
                                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '2.5rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                                            <FaFileUpload />
                                        </div>
                                        <div style={{ fontWeight: '500', color: '#1F2937' }}>
                                            Glissez-déposez votre fichier Excel ici
                                        </div>
                                        <div style={{ color: '#6B7280', fontSize: '0.9rem' }}>
                                            ou cliquez pour parcourir
                                        </div>
                                        <div style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                            Formats acceptés : <span className="fw-medium">.xlsx, .xls</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Aperçu du fichier */}
                            {importPreview.length > 0 && !isImporting && (
                                <div className="mt-3 p-3 rounded-3" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="mb-0" style={{ fontSize: '0.9rem' }}>
                                            <FaSearch className="me-2" style={{ color: '#667eea' }} />
                                            Aperçu des données ({importData.length} lignes)
                                        </h6>
                                    </div>
                                    <div className="table-responsive" style={{ maxHeight: '200px', overflow: 'auto' }}>
                                        <table className="table table-sm table-bordered table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    {Object.keys(importPreview[0] || {}).map((key, index) => (
                                                        <th key={index} style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importPreview.map((row, rowIndex) => (
                                                    <tr key={rowIndex}>
                                                        {Object.values(row).map((value, cellIndex) => (
                                                            <td key={cellIndex} style={{ fontSize: '0.7rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                        height: '10px', 
                                        borderRadius: '10px', 
                                        backgroundColor: '#f3f4f6',
                                        overflow: 'hidden',
                                        position: 'relative'
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

                            {/* Message d'erreur */}
                            {importError && (
                                <Alert variant="danger" className="mt-3 mb-0" style={{ borderRadius: '12px' }}>
                                    <FaTimes className="me-2" />
                                    {importError}
                                </Alert>
                            )}

                            {/* Boutons d'action */}
                            {!isImporting && !importSuccess && (
                                <div className="d-flex justify-content-end gap-2 mt-3">
                                    <button 
                                        className="btn btn-outline-secondary rounded-pill px-4"
                                        onClick={toggleImportSection}
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        className="btn rounded-pill px-4"
                                        onClick={handleImportSubmit}
                                        disabled={!importFile}
                                        style={{
                                            background: !importFile ? '#e5e7eb' : 'linear-gradient(135deg, #667eea, #764ba2)',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: '600',
                                            transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (importFile) {
                                                e.target.style.transform = 'translateY(-2px)';
                                                e.target.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.25)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'none';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    >
                                        <FaUpload className="me-2" />
                                        Importer
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Succès de l'importation */
                        <div className="text-center py-4">
                            <div style={{ fontSize: '3.5rem', color: '#38a169', animation: 'scaleIn 0.5s ease' }}>
                                <FaCheckCircle />
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1F2937', marginTop: '1rem' }}>
                                Importation réussie !
                            </div>
                            <div style={{ color: '#6B7280' }}>
                                Les mouvements ont été importés avec succès.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Carte principale */}
            <div className="border-0 shadow-lg mouvements-card">
                <div className="p-4 p-lg-5">

                    {/* Messages d'état */}
                    {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                    {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

                    {/* Statistiques Dashboard */}
                    <div className="row mb-3 g-2">
                        <div className="col-6 col-md-3 col-lg-2">
                            <div className="p-2 rounded-2 text-center" style={{ backgroundColor: '#e3f2fd', borderLeft: '3px solid #2196f3' }}>
                                <FaChartBar style={{ fontSize: '1.4rem', color: '#2196f3', marginBottom: '6px' }} />
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1565c0' }}>{stats.total}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64b5f6' }}>Total</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <div className="p-2 rounded-2 text-center" style={{ backgroundColor: '#C6F6D5', borderLeft: '3px solid #38a169' }}>
                                <FaArrowUp style={{ fontSize: '1.4rem', color: '#38a169', marginBottom: '6px' }} />
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2F855A' }}>{stats.entree}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#68d391' }}>Entrées</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <div className="p-2 rounded-2 text-center" style={{ backgroundColor: '#FED7D7', borderLeft: '3px solid #e53e3e' }}>
                                <FaArrowDown style={{ fontSize: '1.4rem', color: '#e53e3e', marginBottom: '6px' }} />
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#C53030' }}>{stats.sortie}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#fc8181' }}>Sorties</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <div className="p-2 rounded-2 text-center" style={{ backgroundColor: '#E9D8FD', borderLeft: '3px solid #805ad5' }}>
                                <FaExchangeAlt style={{ fontSize: '1.4rem', color: '#805ad5', marginBottom: '6px' }} />
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#6B46C1' }}>{stats.ajustement}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#b794f4' }}>Ajustements</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <div className="p-2 rounded-2 text-center" style={{ backgroundColor: '#BEE3F8', borderLeft: '3px solid #3182ce' }}>
                                <FaBoxOpen style={{ fontSize: '1.4rem', color: '#3182ce', marginBottom: '6px' }} />
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2B6CB0' }}>{stats.autres}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#63b3ed' }}>Autres</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barre de recherche et filtres */}
                    <div className="row mb-4 g-3">
                        <div className="col-md-6 col-lg-4">
                            <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: '#6c757d', marginRight: '8px' }}><FaSearch /></span>
                                <input
                                    type="text"
                                    placeholder="Rechercher par matériel, utilisateur, date..."
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                    style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px' }}
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
                        <div className="col-md-6 col-lg-4">
                            <Button
                                className="w-100 rounded-pill border-0"
                                style={{
                                    background: showAdvancedFilters ? '#667eea' : '#e9ecef', color: showAdvancedFilters ? 'white' : '#495057', fontWeight: '500', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s ease'
                                }}
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            >
                                <FaFilter size={14} />
                                Filtres avancés
                            </Button>
                        </div>
                        <div className="col-md-6 col-lg-4">
                            <Button
                                className="w-100 rounded-pill border-0 reset-btn"
                                onClick={clearFilters}
                            >
                                <FaTimes size={14} style={{ marginRight: '6px' }} />
                                Réinitialiser
                            </Button>
                        </div>
                    </div>

                    {/* Filtres avancés */}
                    {showAdvancedFilters && (
                        <div className="row mb-4 g-3 p-3 rounded-3 advanced-filters">
                            <div className="col-md-4">
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '6px', display: 'block' }}>Type de mouvement</label>
                                <select
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                    className="form-select border-0 rounded-2"
                                    style={{ backgroundColor: '#fff', fontSize: '0.9rem' }}
                                >
                                    <option value="">Tous les types</option>
                                    <option value="ENTREE">Entrée</option>
                                    <option value="SORTIE">Sortie</option>
                                    <option value="ENTREE_QUANTITE">Ajustement</option>
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '6px', display: 'block' }}>Du :</label>
                                <input
                                    type="date"
                                    value={filterDateRange.start}
                                    onChange={e => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                                    className="form-control border-0 rounded-2"
                                    style={{ backgroundColor: '#fff', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div className="col-md-4">
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '6px', display: 'block' }}>À :</label>
                                <input
                                    type="date"
                                    value={filterDateRange.end}
                                    onChange={e => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                                    className="form-control border-0 rounded-2"
                                    style={{ backgroundColor: '#fff', fontSize: '0.9rem' }}
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
                                    <div className="spinner-grow text-primary" role="status" style={{ width: '3rem', height: '3rem', marginRight: '8px' }}></div>
                                    <p className="text-muted mt-3">Chargement des données...</p>
                                </div>
                            }
                            customStyles={modernStyles}
                            noDataComponent={<NoDataComponent />}
                            paginationComponentOptions={{
                                rowsPerPageText: 'Lignes par page :', rangeSeparatorText: 'sur', selectAllRowsItem: true, selectAllRowsItemText: 'Tout'
                            }}
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