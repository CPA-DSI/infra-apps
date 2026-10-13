// src/pages/Materiels/HistoriqueModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { FaHistory, FaUser, FaDesktop, FaTimes, FaPlus, FaSave } from 'react-icons/fa';
import DataTable from 'react-data-table-component';
import { getHistoriqueMaterielByMaterielId, createHistoriqueMateriel, fetchMateriels } from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import './MaterielsModals.css';

// En-têtes un peu plus grands et espacés que le thème par défaut.
const HISTORIQUE_TABLE_STYLES = tableStyles({
    headCells: { style: { fontSize: '0.8rem', letterSpacing: '0.05em' } },
});

const formatDate = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const HistoriqueModal = ({ isOpen, onClose, materielId, materielData, onHistoriqueUpdated }) => {
    const [historique, setHistorique] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        ancienne_valeur: '',
        nouvelle_valeur: '',
        nom_utilisateur: '',
        id_materiel_dsi: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [materiels, setMateriels] = useState([]);
    const [materielsLoading, setMaterielsLoading] = useState(false);

    const fetchHistorique = useCallback(async () => {
        if (!materielId) return;

        setLoading(true);
        setError(null);
        try {
            const data = await getHistoriqueMaterielByMaterielId(materielId);
            setHistorique(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erreur lors du chargement de l\'historique:', err);
            setError('Impossible de charger l\'historique.');
        } finally {
            setLoading(false);
        }
    }, [materielId]);

    useEffect(() => {
        if (isOpen && materielId) {
            fetchHistorique();
        }
    }, [isOpen, materielId, fetchHistorique]);

    useEffect(() => {
        if (!isOpen) {
            setHistorique([]);
            setLoading(false);
            setError(null);
            setShowAddForm(false);
            resetForm();
        }
    }, [isOpen]);

    useEffect(() => {
        if (materielData?.utilisateur && materielData?.equipe === 'Informatique DSI') {
            setFormData(prev => ({
                ...prev,
                nom_utilisateur: prev.nom_utilisateur || `${materielData.id_n || 'N/A'} - ${materielData.utilisateur}${materielData.equipe ? ` (${materielData.equipe})` : ''}`
            }));
        }
    }, [materielData]);

    useEffect(() => {
        const loadMateriels = async () => {
            setMaterielsLoading(true);
            try {
                const data = await fetchMateriels();
                setMateriels(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Erreur lors du chargement des matériels:', err);
            } finally {
                setMaterielsLoading(false);
            }
        };
        loadMateriels();
    }, []);

    const resetForm = () => {
        setFormData({
            ancienne_valeur: '',
            nouvelle_valeur: '',
            nom_utilisateur: '',
            id_materiel_dsi: ''
        });
        setFormErrors({});
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.nouvelle_valeur?.trim()) {
            errors.nouvelle_valeur = 'La nouvelle valeur est requise';
        }
        if (!formData.nom_utilisateur?.trim()) {
            errors.nom_utilisateur = 'Le nom de l\'utilisateur est requis';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const filteredMateriels = materiels.filter(m => 
        m.equipe === 'Informatique DSI' || (m.utilisateur && m.utilisateur.includes('DSI'))
    );

    const materielOptions = filteredMateriels.map(m => ({
        value: m.id_n,
        label: `${m.id_n} - ${m.utilisateur || 'Utilisateur Inconnu'}${m.equipe ? ` (${m.equipe})` : ''}`
    }));

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'id_materiel_dsi') {
            const selectedMaterial = materiels.find(m => String(m.id_n) === String(value));
            if (selectedMaterial) {
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    nom_utilisateur: `${selectedMaterial.id_n || 'N/A'} - ${selectedMaterial.utilisateur || 'Inconnu'}${selectedMaterial.equipe ? ` (${selectedMaterial.equipe})` : ''}`
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    [name]: value
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
        
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Utilisation de votre fonction API existante
            const payload = {
                materiel_id: materielId,
                id_materiels: materielId,
                ancienne_valeur: formData.ancienne_valeur || null,
                nouvelle_valeur: formData.nouvelle_valeur,
                nom_utilisateur: formData.nom_utilisateur
            };

            await createHistoriqueMateriel(payload);
            
            // Reset form and refresh data
            resetForm();
            setShowAddForm(false);
            await fetchHistorique();
            
            // Notify parent component if callback exists
            if (onHistoriqueUpdated) {
                onHistoriqueUpdated();
            }
        } catch (err) {
            console.error('Erreur lors de l\'ajout de l\'historique:', err);
            setError('Impossible d\'ajouter l\'entrée d\'historique. Veuillez réessayer.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const columns = [
        {
            name: 'Date',
            selector: row => row.date_modification,
            sortable: true,
            width: '160px',
            cell: row => formatDate(row.date_modification),
        },
        {
            name: 'Ancien état',
            selector: row => row.ancienne_valeur || '',
            width: '250px',
            cell: row => <span className="mat-histo-old">{row.ancienne_valeur || '—'}</span>,
        },
        {
            name: 'Nouvelle état',
            selector: row => row.nouvelle_valeur || '',
            width: '250px',
            cell: row => <span className="mat-histo-new">{row.nouvelle_valeur || '—'}</span>,
        },
        {
            name: 'Auteur',
            selector: row => row.nom_utilisateur || 'Système',
            width: '250px',
            cell: row => (
                <div className="mat-histo-author">
                    <FaUser aria-hidden="true" />
                    <span>{row.nom_utilisateur || 'Système'}</span>
                </div>
            ),
        },
    ];

    const titre = `Historique du Matériel ${materielData?.id_n ? `N°${materielData.id_n}` : ''}`;

    const header = (
        <div className="add-modal-header">
            <div className="d-flex align-items-center gap-3">
                <div className="add-modal-icon-wrapper" aria-hidden="true">
                    <FaHistory />
                </div>
                <div>
                    <h2 className="add-modal-title">{titre}</h2>
                    <p className="add-modal-subtitle">
                        {materielData?.code_pc || 'Équipement'} • {materielData?.equipe || ''}
                    </p>
                </div>
            </div>
            <div className="mat-modal-header-actions">
                {!showAddForm && (
                    <button onClick={() => setShowAddForm(true)} className="mat-histo-add-btn" type="button">
                        <FaPlus aria-hidden="true" /> Ajouter
                    </button>
                )}
                <button onClick={onClose} className="add-modal-close-btn" type="button" aria-label="Fermer">
                    <FaTimes />
                </button>
            </div>
        </div>
    );

    return (
        <AppModal
            show={isOpen}
            onClose={onClose}
            header={header}
            ariaLabel={titre}
            contentClassName="mat-modal mat-modal--histo mat-histo-modal"
            footer={
                <button onClick={onClose} className="add-modal-cancel-btn" type="button">
                    Fermer
                </button>
            }
        >
            {/* Infos matériel */}
            {materielData && (
                <div className="mat-info-band mat-histo-info">
                    <div className="mat-histo-info-user">
                        <FaDesktop aria-hidden="true" />
                        <span>{materielData.utilisateur || 'Utilisateur inconnu'}</span>
                    </div>
                    <div className="mat-histo-info-sep" aria-hidden="true"></div>
                    <span>ID Biostar: <strong>{materielData.id_n || 'N/A'}</strong></span>
                    <div className="mat-histo-info-sep" aria-hidden="true"></div>
                    <span>Équipe: <strong>{materielData.equipe || 'N/A'}</strong></span>
                    <div className="mat-histo-info-sep" aria-hidden="true"></div>
                    <span>Code: <strong>{materielData.code_pc || 'N/A'}</strong></span>
                </div>
            )}

            {/* Formulaire d'ajout */}
            {showAddForm && (
                <div className="mat-histo-form-card">
                    <div className="mat-histo-form-head">
                        <h4 className="mat-histo-form-title">
                            <FaPlus aria-hidden="true" />
                            Ajouter une entrée d'historique
                        </h4>
                        <button
                            type="button"
                            className="btn-icon"
                            aria-label="Fermer le formulaire"
                            onClick={() => {
                                setShowAddForm(false);
                                resetForm();
                            }}
                        >
                            <FaTimes />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mat-histo-form-grid">
                            <div className="mat-histo-row">
                                <label className="mat-histo-label" htmlFor="histo-dsi">
                                    Informatique DSI<span className="mat-histo-optional">(optionnel)</span>
                                </label>
                                <select
                                    id="histo-dsi"
                                    name="id_materiel_dsi"
                                    value={formData.id_materiel_dsi || ''}
                                    onChange={handleInputChange}
                                    disabled={materielsLoading}
                                    className="mat-histo-select"
                                >
                                    <option value="">Sélectionnez une option</option>
                                    {materielOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    name="nom_utilisateur"
                                    value={formData.nom_utilisateur}
                                    readOnly
                                    placeholder="Nom de la personne ayant effectué la modification"
                                    aria-label="Auteur de la modification"
                                    className={`mat-histo-input ${formErrors.nom_utilisateur ? 'is-invalid' : ''}`}
                                />
                            </div>

                            <div className="mat-histo-row">
                                <label className="mat-histo-label" htmlFor="histo-ancienne">
                                    Ancien état <span className="mat-histo-optional">(optionnel)</span>
                                </label>
                                <div className="mat-histo-field">
                                    <textarea
                                        id="histo-ancienne"
                                        name="ancienne_valeur"
                                        value={formData.ancienne_valeur}
                                        onChange={handleInputChange}
                                        placeholder="Ancien état du matériel"
                                        rows={3}
                                        className={`mat-histo-input ${formErrors.ancienne_valeur ? 'is-invalid' : ''}`}
                                    />
                                    {formErrors.ancienne_valeur && (
                                        <span className="mat-histo-field-error">{formErrors.ancienne_valeur}</span>
                                    )}
                                </div>
                            </div>

                            <div className="mat-histo-row">
                                <label className="mat-histo-label" htmlFor="histo-nouvelle">
                                    Nouvel état <span className="mat-danger-text">*</span>
                                </label>
                                <div className="mat-histo-field">
                                    <textarea
                                        id="histo-nouvelle"
                                        name="nouvelle_valeur"
                                        value={formData.nouvelle_valeur}
                                        onChange={handleInputChange}
                                        placeholder="Nouvel état du matériel"
                                        rows={3}
                                        className={`mat-histo-input ${formErrors.nouvelle_valeur ? 'is-invalid' : ''}`}
                                    />
                                    {formErrors.nouvelle_valeur && (
                                        <span className="mat-histo-field-error">{formErrors.nouvelle_valeur}</span>
                                    )}
                                </div>
                            </div>

                            <div className="mat-histo-submit-row">
                                <button type="submit" disabled={submitting} className="add-modal-submit-btn">
                                    <FaSave aria-hidden="true" /> Sauvegarder
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Erreur */}
            {error && (
                <div className="mat-histo-error" role="alert">
                    <FaTimes aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary mat-histo-spinner" role="status">
                        <span className="visually-hidden">Chargement...</span>
                    </div>
                    <p className="text-muted mt-3">Chargement de l'historique...</p>
                </div>
            ) : historique.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mat-histo-empty-icon" aria-hidden="true">📭</div>
                    <h5 className="mat-histo-empty-title">Aucun historique disponible</h5>
                    <p className="mat-histo-empty-text">
                        Aucune modification n'a été enregistrée pour ce matériel.
                    </p>
                </div>
            ) : (
                <div className="mat-histo-table-card">
                    <DataTable
                        columns={columns}
                        data={historique}
                        pagination
                        paginationPerPage={10}
                        paginationRowsPerPageOptions={[5, 10, 20]}
                        paginationComponentOptions={paginationOptions}
                        highlightOnHover
                        pointerOnHover
                        responsive
                        customStyles={HISTORIQUE_TABLE_STYLES}
                    />
                    <div className="mat-histo-count">
                        {historique.length} modification{historique.length > 1 ? 's' : ''} enregistrée{historique.length > 1 ? 's' : ''}
                    </div>
                </div>
            )}
        </AppModal>
    );
};

export default HistoriqueModal;