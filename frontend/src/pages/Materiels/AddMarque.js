// src/pages/Materiels/AddMarque.js - Version avec suppression améliorée et notifications locales

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MySwal, swalButtons } from '../../utils/swal';
import DataTable from 'react-data-table-component';
import { Form, Spinner, Row, Col, Alert } from 'react-bootstrap';
import { FaPlus, FaTimes, FaImage, FaTrash, FaEdit, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { fetchAMarques, createMarque, updateMarque, deleteMarque } from '../../services/api';
import { escapeHtml } from '../../utils/escapeHtml';
import AppModal from '../../components/AppModal/AppModal';
import './MaterielsModals.css';

// ==========================================================
// --- COMPOSANT LOGO SIMPLIFIÉ ---
// ==========================================================
const LogoDisplay = React.memo(({ url, nomMarque }) => {
    const [imgError, setImgError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        setImgError(false);
        setIsLoading(true);
        
        if (!url || url === 'null' || url === 'undefined' || url === '') {
            setIsLoading(false);
            setImgError(true);
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            setIsLoading(false);
            setImgError(false);
        };
        img.onerror = () => {
            setIsLoading(false);
            setImgError(true);
            console.warn(`❌ Échec chargement image: ${url}`);
        };
        img.src = url;
        
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [url]);
    
    if (!url || url === 'null' || url === 'undefined' || url === '') {
        return (
            <div className="mat-marque-logo">
                <FaImage aria-hidden="true" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mat-marque-logo">
                <Spinner animation="border" size="sm" />
            </div>
        );
    }

    if (imgError) {
        return (
            <div className="mat-marque-logo is-error">
                <FaImage aria-hidden="true" />
            </div>
        );
    }

    return (
        <img
            src={url}
            alt={`Logo ${nomMarque}`}
            className="mat-marque-logo"
            loading="lazy"
        />
    );
});

// ==========================================================
// --- COMPOSANT DE NOTIFICATION LOCALE ---
// ==========================================================
const LocalNotification = ({ message, type, onClose, undoAction, onUndo }) => {
    useEffect(() => {
        if (message && !undoAction) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose, undoAction]);

    if (!message) return null;

    const icon = type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />;

    return (
        <div className={`mat-local-notif ${type === 'success' ? 'is-success' : ''}`} role="status">
            <span className="mat-local-notif-icon" aria-hidden="true">{icon}</span>
            <span>{message}</span>
            {undoAction && onUndo && (
                <button type="button" onClick={onUndo} className="mat-local-notif-undo">
                  Annuler
                </button>
            )}
            <button type="button" onClick={onClose} className="mat-local-notif-close" aria-label="Fermer la notification">
                <FaTimes size={12} />
            </button>
        </div>
    );
};

// ==========================================================
// --- COMPOSANT PRINCIPAL AddMarque ---
// ==========================================================
// show : Materiels.js garde la modale montée en permanence et la masque ;
// par défaut (show absent) elle est affichée.
const AddMarque = ({ show = true, onClose, onMarqueAdded }) => {
    const [formData, setFormData] = useState({
        nom_marque: '',
        url: ''
    });
const [loading, setLoading] = useState(false);
     const [error, setError] = useState('');
     const [successMessage, setSuccessMessage] = useState(null);
     const [marques, setMarques] = useState([]);
    const [marquesLoading, setMarquesLoading] = useState(true);
    const [editingMarque, setEditingMarque] = useState(null);
    const [apiError, setApiError] = useState(null);
    const [deletePending, setDeletePending] = useState(null);
    
    // État pour la notification locale
    const [localNotification, setLocalNotification] = useState({ 
        show: false, 
        message: '', 
        type: 'success',
        undoAction: null,
        deletedItem: null
    });

    // Fonction pour afficher une notification locale
    const showLocalNotification = (message, type = 'success', undoAction = null, deletedItem = null) => {
        setLocalNotification({ 
            show: true, message, type, undoAction, deletedItem
        });
    };

    // Fermer la notification locale
    const hideLocalNotification = () => {
        setLocalNotification({ 
            show: false, message: '', type: 'success', undoAction: null, deletedItem: null
        });
        setDeletePending(null);
    };

    // Annuler la suppression
    const handleUndoDelete = async () => {
        if (deletePending && deletePending.marque) {
            try {
                // Réinsérer la marque supprimée
                await createMarque(deletePending.marque.nom_marque, deletePending.marque.url);

                showLocalNotification(`↩️ "${deletePending.marque.nom_marque}" a été restauré`, 'success');
                await fetchMarques();
                
                if (typeof onMarqueAdded === 'function') {
                    onMarqueAdded();
                }
            } catch (err) {
                console.error('❌ Erreur lors de l\'annulation:', err);
                showLocalNotification('❌ Impossible de restaurer la marque', 'error');
            } finally {
                setDeletePending(null);
                hideLocalNotification();
            }
        }
    };

    // Fetch des marques existantes
    const fetchMarques = useCallback(async () => {
        setMarquesLoading(true);
        setApiError(null);

        try {
            const data = await fetchAMarques();

            if (!data) {
                throw new Error('Aucune donnée reçue du serveur');
            }

            let marquesData = Array.isArray(data) ? data : [];

            const cleanedData = marquesData.map(marque => ({
                id_marque: marque.id_marque,
                nom_marque: marque.nom_marque || 'Sans nom',
                url: (marque.url && marque.url !== 'null' && marque.url !== 'undefined' && marque.url !== '') ? marque.url : null,
                date_modification: marque.date_modification
            }));
            
            setMarques(cleanedData);

        } catch (err) {
            console.error('❌ Erreur détaillée:', err);
            setApiError(err.message);
            setMarques([]);
        } finally {
            setMarquesLoading(false);
        }
    }, []);

    // Chargement initial
    useEffect(() => {
        fetchMarques();
    }, [fetchMarques]);

    const showNotification = (message, type = 'success') => {
        MySwal.fire({
            icon: type,
            title: type === 'success' ? 'Succès' : 'Erreur',
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    };

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError('');
    }, [error]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!formData.nom_marque.trim()) {
            setError('Le nom de la marque est requis.');
            return;
        }

        setLoading(true);
        setError('');

try {
             const nomMarque = formData.nom_marque.trim();
             const url = formData.url && formData.url.trim() !== '' ? formData.url.trim() : null;

             await createMarque(nomMarque, url);

             setSuccessMessage('Marque ajoutée avec succès !');
             setTimeout(() => setSuccessMessage(null), 3000);
             
             showLocalNotification(`✅ "${formData.nom_marque}" a été ajouté avec succès !`, 'success');
             await fetchMarques();
             
             setFormData({ nom_marque: '', url: '' });
             
             if (typeof onMarqueAdded === 'function') {
                 onMarqueAdded();
             }
             if (onClose) {
                 onClose();
             }
         } catch (err) {
            console.error('❌ Erreur POST:', err);
            const errorMessage = err.message || 'Erreur lors de l\'ajout de la marque.';
            setError(errorMessage);
            showNotification(`Erreur: ${errorMessage}`, 'error');
            showLocalNotification(`❌ Erreur: ${errorMessage}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [formData, onClose, onMarqueAdded, fetchMarques]);

    const handleEdit = useCallback((marque, event) => {
        if (event) event.stopPropagation();
        setEditingMarque(marque);
        setFormData({
            nom_marque: marque.nom_marque,
            url: marque.url || ''
        });
    }, []);

    const handleUpdate = useCallback(async (e) => {
        e.preventDefault();
        if (!formData.nom_marque.trim()) {
            setError('Le nom de la marque est requis.');
            return;
        }

        setLoading(true);
        setError('');

try {
             const nomMarque = formData.nom_marque.trim();
             const url = formData.url && formData.url.trim() !== '' ? formData.url.trim() : null;

             await updateMarque(editingMarque.id_marque, nomMarque, url);

             setSuccessMessage('Marque modifiée avec succès !');
             setTimeout(() => setSuccessMessage(null), 3000);
             
             showLocalNotification(`✅ "${editingMarque.nom_marque}" a été modifié avec succès !`, 'success');
             
             await fetchMarques();
             setEditingMarque(null);
             setFormData({ nom_marque: '', url: '' });
         } catch (err) {
            console.error('❌ Erreur PUT:', err);
            const errorMessage = err.message || 'Erreur lors de la modification.';
            setError(errorMessage);
            showNotification(`Erreur: ${errorMessage}`, 'error');
            showLocalNotification(`❌ Erreur: ${errorMessage}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [formData, editingMarque, fetchMarques]);

    const handleDelete = useCallback(async (marque) => {
    const result = await MySwal.fire({
        title: 'Confirmation de suppression',
        html: `
            <div style="text-align: left;">
                <p>Voulez-vous vraiment supprimer la marque <strong>"${escapeHtml(marque.nom_marque)}"</strong> ?</p>
                ${marque.url ? '<p class="text-muted small mt-2">⚠️ La suppression du logo sera également définitive.</p>' : ''}
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        ...swalButtons('danger'),
        confirmButtonText: 'Oui, supprimer définitivement',
        cancelButtonText: 'Annuler',
        reverseButtons: true,
    });

    if (result.isConfirmed || result.isDenied) {
        const isUndoable = result.isDenied;
        
        setLoading(true);
        
        try {
            await deleteMarque(marque.id_marque);

            if (isUndoable) {
                showLocalNotification(
                    `🗑️ "${marque.nom_marque}" a été supprimé (annulation possible 5s)`, 
                    'success',
                    true,
                    marque
                );
                setDeletePending({ 
                    marque, 
                    timeout: setTimeout(() => {
                        setDeletePending(null);
                        showLocalNotification(`✅ "${marque.nom_marque}" a été définitivement supprimé`, 'success');
                    }, 5000) 
                });
            } else {
                showNotification('Marque supprimée avec succès !', 'success');
                showLocalNotification(`🗑️ "${marque.nom_marque}" a été définitivement supprimé`, 'success');
            }
            
            await fetchMarques();
            
            if (typeof onMarqueAdded === 'function') {
                onMarqueAdded();
            }
        } catch (err) {
            console.error('❌ Erreur DELETE:', err);
            const errorMessage = err.message || 'Erreur lors de la suppression';
            showNotification(`Erreur: ${errorMessage}`, 'error');
            showLocalNotification(`❌ ${errorMessage}`, 'error');
        } finally {
            setLoading(false);
        }
    }
}, [fetchMarques, onMarqueAdded]);

    // Nettoyer le timeout si le composant est démonté
    useEffect(() => {
        return () => {
            if (deletePending && deletePending.timeout) {
                clearTimeout(deletePending.timeout);
            }
        };
    }, [deletePending]);

    const columns = useMemo(() => {
        return [
            { 
                name: 'Marque', 
                selector: row => row.nom_marque, 
                sortable: true, 
                grow: 2,
                cell: row => (
                    <span className="mat-marque-name">
                        {row.nom_marque}
                    </span>
                )
            },
            { 
                name: 'Logo', 
                cell: row => <LogoDisplay url={row.url} nomMarque={row.nom_marque} />,
                ignoreRowClick: true,
                width: '100px',
                center: true
            },
            {
                name: 'Actions',
                cell: row => (
                    <div className="mat-marque-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="btn-icon btn-icon--info"
                            onClick={(e) => handleEdit(row, e)}
                            title="Modifier la marque"
                            aria-label={`Modifier la marque ${row.nom_marque}`}
                        >
                            <FaEdit size={14} />
                        </button>
                        <button
                            type="button"
                            className="btn-icon btn-icon--danger"
                            onClick={() => handleDelete(row)}
                            title="Supprimer la marque"
                            aria-label={`Supprimer la marque ${row.nom_marque}`}
                        >
                            <FaTrash size={14} />
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
                width: '100px',
                center: true
            }
        ];
    }, [handleEdit, handleDelete]);

    return (
        <AppModal
            show={show}
            onClose={onClose}
            closeOnBackdrop
            as="form"
            onSubmit={editingMarque ? handleUpdate : handleSubmit}
            title={editingMarque ? 'Modifier la marque' : 'Ajout d\'une nouvelle Marque'}
            subtitle={editingMarque ? 'Modifiez les informations ci-dessous' : 'Remplissez les informations ci-dessous'}
            icon={editingMarque ? <FaEdit /> : <FaPlus />}
            contentClassName="mat-marque-modal"
            footer={
                <>
                    {onClose && (
                        <button type="button" onClick={onClose} className="btn btn-outline-secondary" disabled={loading}>
                            Annuler
                        </button>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                {editingMarque ? 'Modification...' : 'Ajout...'}
                            </>
                        ) : (
                            <>
                                {editingMarque ? <FaEdit className="me-2" /> : <FaPlus className="me-2" />}
                                {editingMarque ? 'Modifier la marque' : 'Ajouter la marque'}
                            </>
                        )}
                    </button>
                </>
            }
        >
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

            {apiError && (
                <Alert variant="danger" className="mt-3 mb-0">
                    <FaTimes className="me-2" />
                    {apiError}
                </Alert>
            )}

            <Row className="g-4">
                <Col md={6}>
                    <div className="mb-3">
                        <label className="form-label fw-medium" htmlFor="marque-nom">
                            Nom de la marque <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                            id="marque-nom"
                            name="nom_marque"
                            type="text"
                            value={formData.nom_marque}
                            onChange={handleChange}
                            placeholder="Ex: HP, Dell, Asus..."
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label fw-medium" htmlFor="marque-url">
                            URL du logo
                        </label>
                        <Form.Control
                            id="marque-url"
                            name="url"
                            type="text"
                            value={formData.url}
                            onChange={handleChange}
                            placeholder="https://example.com/logo.png"
                            disabled={loading}
                        />
                        <small className="text-muted d-block mt-1">
                            📌 Entrez l'URL complète de l'image du logo (PNG, JPG, SVG, WEBP)
                        </small>
                        <small className="text-muted d-block mt-1">
                            💡 Exemple: https://images.seeklogo.com/logo-png/6/1/hp-logo-png_seeklogo-68357.png
                        </small>
                    </div>

                    {formData.url && isValidUrl(formData.url) && (
                        <div className="mb-3">
                            <span className="form-label fw-medium d-block">📸 Aperçu du logo :</span>
                            <div className="mat-marque-preview">
                                <LogoDisplay url={formData.url} nomMarque={formData.nom_marque || 'Aperçu'} />
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="d-flex justify-content-center mt-3">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Chargement...</span>
                            </Spinner>
                        </div>
                    )}

                    {editingMarque && (
                        <div className="mt-3 d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setEditingMarque(null);
                                    setFormData({ nom_marque: '', url: '' });
                                }}
                            >
                                Annuler la modification
                            </button>
                        </div>
                    )}
                </Col>

                <Col md={6}>
                    <div className="mb-3">
                        <span className="form-label fw-medium d-block">
                            📋 Marques existantes ({marques.length})
                        </span>
                    </div>
                    <div className="mat-marque-list">
                        {marquesLoading ? (
                            <div className="text-center p-4">
                                <Spinner animation="border" role="status">
                                    <span className="visually-hidden">Chargement...</span>
                                </Spinner>
                                <p className="mt-2 text-muted">Chargement des marques...</p>
                            </div>
                        ) : (
                            <DataTable
                                columns={columns}
                                data={marques}
                                pagination
                                paginationPerPage={7}
                                paginationRowsPerPageOptions={[7, 14, 28]}
                                highlightOnHover
                                pointerOnHover
                                responsive
                                noDataComponent={
                                    <div className="p-4 text-center text-muted">
                                        <FaImage size={40} className="mat-marque-empty-icon" aria-hidden="true" />
                                        <p className="mt-2">Aucune marque trouvée</p>
                                        <small>Cliquez sur "Ajouter" pour créer une nouvelle marque</small>
                                    </div>
                                }
                            />
                        )}
                    </div>
                </Col>
            </Row>

            {/* Notification locale (position fixe) */}
            {localNotification.show && (
                <LocalNotification
                    message={localNotification.message}
                    type={localNotification.type}
                    onClose={hideLocalNotification}
                    undoAction={localNotification.undoAction}
                    onUndo={handleUndoDelete}
                />
            )}
        </AppModal>
    );
};

// Fonction utilitaire
function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export default AddMarque;