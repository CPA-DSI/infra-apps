// src/pages/Materiels/AddMarque.js - Version avec suppression améliorée et notifications locales

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import DataTable from 'react-data-table-component';
import { Form, Spinner, Row, Col, Alert } from 'react-bootstrap';
import { FaPlus, FaTimes, FaImage, FaTrash, FaEdit, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { fetchAMarques, createMarque, updateMarque, deleteMarque } from '../../services/api';
import './AddMarque.css';

const MySwal = withReactContent(Swal);

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
            <div style={{ 
                width: '60px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb'
            }}>
                <FaImage style={{ color: '#9ca3af', fontSize: '24px' }} />
            </div>
        );
    }
    
    if (isLoading) {
        return (
            <div style={{ 
                width: '60px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb'
            }}>
                <Spinner animation="border" size="sm" />
            </div>
        );
    }
    
    if (imgError) {
        return (
            <div style={{ 
                width: '60px', height: '60px', backgroundColor: '#fee2e2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca'
            }}>
                <FaImage style={{ color: '#ef4444', fontSize: '24px' }} />
            </div>
        );
    }
    
    return (
        <img
            src={url}
            alt={`Logo ${nomMarque}`}
            style={{ 
                width: '60px', height: '60px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '6px', backgroundColor: '#ffffff'
            }}
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

    const backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
    const textColor = type === 'success' ? '#155724' : '#721c24';
    const icon = type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />;

    return (
        <div style={{
            position: 'fixed', bottom: '20px', right: '20px', backgroundColor: backgroundColor,
            borderLeft: `4px solid ${type === 'success' ? '#28a745' : '#dc3545'}`,
            borderRadius: '8px', padding: '12px 20px', marginBottom: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '12px', animation: 'slideInRight 0.3s ease-out',
            color: textColor, fontSize: '14px', fontWeight: '500'
        }}>
            <span style={{ fontSize: '18px' }}>{icon}</span>
            <span>{message}</span>
            {undoAction && onUndo && (
                <button
                    onClick={onUndo}
                    style={{
                        background: type === 'success' ? '#155724' : '#721c24',
                        border: 'none', color: 'white', cursor: 'pointer', marginLeft: '10px', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                    }}
                >
                  Annuler
                </button>
            )}
            <button
                onClick={onClose}
                style={{
                    background: 'none', border: 'none', color: textColor, cursor: 'pointer', marginLeft: '10px', fontSize: '16px', opacity: 0.7
                }}
            >
                <FaTimes size={12} />
            </button>
        </div>
    );
};

// ==========================================================
// --- COMPOSANT PRINCIPAL AddMarque ---
// ==========================================================
const AddMarque = ({ onClose, onMarqueAdded }) => {
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
                console.log('🔄 Annulation suppression réussie');
                
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
        console.log('🔄 Début chargement des marques...');
        setMarquesLoading(true);
        setApiError(null);
        
        try {
            const data = await fetchAMarques();

            console.log('📦 Données brutes:', data);

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
            
            console.log('✅ Données nettoyées:', cleanedData);
            console.log(`✅ ${cleanedData.length} marques chargées`);
            
            setMarques(cleanedData);
            
            if (cleanedData.length === 0) {
                console.log('ℹ️ Aucune marque trouvée dans la base');
            }
            
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

             console.log('📤 Envoi POST:', { nom_marque: nomMarque, url });

             const response = await createMarque(nomMarque, url);
             console.log('✅ Réponse:', response);

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
        console.log('✏️ Édition:', marque);
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

             const response = await updateMarque(editingMarque.id_marque, nomMarque, url);
             console.log('✏️ Mise à jour réussie:', response);

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
    // Configuration personnalisée avec z-index plus élevé
    const result = await MySwal.fire({
        title: 'Confirmation de suppression',
        html: `
            <div style="text-align: left;">
                <p>Voulez-vous vraiment supprimer la marque <strong>"${marque.nom_marque}"</strong> ?</p>
                ${marque.url ? '<p class="text-muted small mt-2">⚠️ La suppression du logo sera également définitive.</p>' : ''}
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Oui, supprimer définitivement',
        cancelButtonText: 'Annuler',
        reverseButtons: true,
        customClass: {
            container: 'swal2-container-custom',
            popup: 'swal2-popup-custom'
        },
        didOpen: () => {
            // Appliquer les styles après l'ouverture
            const containers = document.querySelectorAll('.swal2-container');
            containers.forEach(container => {
                container.style.zIndex = '10000';
                container.style.position = 'fixed';
            });
            
            const popup = document.querySelector('.swal2-popup');
            if (popup) {
                popup.style.zIndex = '10001';
            }
        }
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
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>
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
                    <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={(e) => handleEdit(row, e)}
                            style={{
                                background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Modifier la marque"
                        >
                            <FaEdit size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            style={{
                                background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Supprimer la marque"
                        >
                            <FaTrash size={16} />
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
                width: '100px',
                center: true
            }
        ];
    }, [handleEdit, handleDelete]);

    // Ajout des styles d'animation CSS
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes fadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }
            
            .delete-pending {
                animation: fadeOut 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <div 
            className="add-modal-overlay" 
            onClick={(e) => {
                if (e.target === e.currentTarget && onClose) {
                    onClose();
                }
            }}
        >
            <form 
                onSubmit={editingMarque ? handleUpdate : handleSubmit} 
                className="add-modal-content" 
                style={{ width: '1100px', maxWidth: '95%', margin: '0 auto', maxHeight: '90vh', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="add-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper"> 
                            {editingMarque ? <FaEdit /> : <FaPlus />}
                        </div>
                        <div>
                            <h2 className="add-modal-title">
                                {editingMarque ? 'Modifier la marque' : 'Ajout d\'une nouvelle Marque'}
                            </h2>
                            <p className="add-modal-subtitle">
                                {editingMarque ? 'Modifiez les informations ci-dessous' : 'Remplissez les informations ci-dessous'}
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="add-modal-close-btn" type="button"> 
                            <FaTimes /> 
                        </button>
                    )}
                </div>
                
<div className="add-modal-body">
                      {error && <Alert variant="danger" className="mb-3" style={{ borderRadius: '12px' }}>{error}</Alert>}
                      {successMessage && <Alert variant="success" className="mb-3" style={{ borderRadius: '12px' }}>{successMessage}</Alert>}
                      
                      {apiError && (
                          <Alert variant="danger" className="mt-3 mb-0" style={{ borderRadius: '12px' }}>
                              <FaTimes className="me-2" />
                              {apiError}
                          </Alert>
                      )}
                    
                    <Row className="g-4">
                        <Col md={6}>
                            <div className="mb-3">
                                <label className="form-label fw-medium">
                                    Nom de la marque <span className="text-danger">*</span>
                                </label>
                                <Form.Control 
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
                                <label className="form-label fw-medium">
                                    URL du logo
                                </label>
                                <Form.Control 
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
                                    <label className="form-label fw-medium">📸 Aperçu du logo :</label>
                                    <div style={{ 
                                        padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '10px', textAlign: 'center'
                                    }}>
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
                                <label className="form-label fw-medium">
                                    📋 Marques existantes ({marques.length})
                                </label>
                            </div>
                            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
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
                                                <FaImage size={40} style={{ opacity: 0.3 }} />
                                                <p className="mt-2">Aucune marque trouvée</p>
                                                <small>Cliquez sur "Ajouter" pour créer une nouvelle marque</small>
                                            </div>
                                        }
                                    />
                                )}
                            </div>
                        </Col>
                    </Row>
                </div>
                
                <div className="add-modal-footer">
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
                </div>
            </form>
            
            {/* Notification locale */}
            {localNotification.show && (
                <LocalNotification
                    message={localNotification.message}
                    type={localNotification.type}
                    onClose={hideLocalNotification}
                    undoAction={localNotification.undoAction}
                    onUndo={handleUndoDelete}
                />
            )}
        </div>
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