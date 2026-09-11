// src/pages/Materiels/HistoriqueModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { FaHistory, FaUser, FaDesktop, FaTimes, FaPlus, FaSave } from 'react-icons/fa';
import DataTable from 'react-data-table-component';
import { getHistoriqueMaterielByMaterielId, createHistoriqueMateriel, fetchMateriels } from '../../services/api';
import './Materiels.css';

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
            cell: row => (
                <span style={{
                    color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', textDecoration: 'line-through', opacity: 0.8
                }}>
                    {row.ancienne_valeur || '—'}
                </span>
            ),
        },
        {
            name: 'Nouvelle état',
            selector: row => row.nouvelle_valeur || '',
            width: '250px',
            cell: row => (
                <span style={{
                    color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500'
                }}>
                    {row.nouvelle_valeur || '—'}
                </span>
            ),
        },
        {
            name: 'Auteur',
            selector: row => row.nom_utilisateur || 'Système',
            width: '250px',
            cell: row => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaUser style={{ fontSize: '0.8rem', color: '#94a3b8' }} />
                    <span style={{ fontSize: '0.85rem' }}>
                        {row.nom_utilisateur || 'Système'}
                    </span>
                </div>
            ),
        },
    ];

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
               maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', background: 'white',
            }}>
                {/* Header */}
                <div className="add-modal-header" style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{
                            background: 'rgba(255, 255, 255, 0.2)', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <FaHistory style={{ color: 'white', fontSize: '1.4rem' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ 
                                color: 'white', fontSize: '1.4rem', fontWeight: '700', margin: 0
                            }}>
                                Historique du Matériel {materielData?.id_n ? `N°${materielData.id_n}` : ''}
                            </h2>
                            <p className="add-modal-subtitle" style={{ 
                                color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0', fontSize: '0.9rem'
                            }}>
                                {materielData?.code_pc || 'Équipement'} • {materielData?.equipe || ''}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {!showAddForm && (
                            <button 
                                onClick={() => setShowAddForm(true)} 
                                className="add-modal-add-btn" 
                                type="button" 
                                style={{
                                    background: 'white', color: '#6366f1', border: '1px solid rgba(255,255,255,0.4)', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = '#fef2f2';
                                    e.target.style.color = '#4f46e5';
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 6px 18px rgba(99, 102, 241, 0.35)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'white';
                                    e.target.style.color = '#6366f1';
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                }}
                                onMouseDown={(e) => {
                                    e.target.style.transform = 'translateY(0) scale(0.97)';
                                }}
                                onMouseUp={(e) => {
                                    e.target.style.transform = 'translateY(-1px) scale(1)';
                                }}
                            >
                                <FaPlus /> Ajouter
                            </button>
                        )}
                        <button 
                            onClick={onClose} 
                            className="add-modal-close-btn" 
                            type="button" 
                            style={{
                                background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', padding: '10px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="add-modal-body" style={{
                    padding: '24px 28px', background: '#F8FAFC'
                }}>
                    {/* Infos matériel */}
                    {materielData && (
                        <div style={{
                           background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaDesktop style={{ color: '#3B82F6', fontSize: '1.1rem' }} />
                                <span style={{ color: '#1E40AF', fontWeight: '600', fontSize: '0.9rem' }}>
                                    {materielData.utilisateur || 'Utilisateur inconnu'}
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#BFDBFE' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                                    ID Biostar: <strong>{materielData.id_n || 'N/A'}</strong>
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#BFDBFE' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                                    Équipe: <strong>{materielData.equipe || 'N/A'}</strong>
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#BFDBFE' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                                    Code: <strong>{materielData.code_pc || 'N/A'}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Formulaire d'ajout */}
                    {showAddForm && (
                        <div style={{
                            background: 'white', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', border: '2px solid #6366f1', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)'
                        }}>
                            <div style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'
                            }}>
                                <h4 style={{ 
                                    color: '#1E293B', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <FaPlus style={{ color: '#6366f1', fontSize: '1.1rem' }} />
                                    Ajouter une entrée d'historique
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        resetForm();
                                    }}
                                    style={{
                                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', padding: '4px'
                                    }}
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <label style={{ 
                                            fontSize: '0.85rem', fontWeight: '500', color: '#475569', whiteSpace: 'nowrap', minWidth: '180px'
                                        }}>
                                            Informatique DSI<span style={{ color: '#94a3b8', fontWeight: '400' }}>(optionnel)</span>
                                        </label>
                                        <select
                                            name="id_materiel_dsi"
                                            value={formData.id_materiel_dsi || ''}
                                            onChange={handleInputChange}
                                            disabled={materielsLoading}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: 'white', outline: 'none', transition: 'border-color 0.2s'
                                            }}
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
                                            style={{
                                                width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${formErrors.nom_utilisateur ? '#ef4444' : '#d1d5db'}`, fontSize: '0.95rem', transition: 'all 0.2s ease', outline: 'none', backgroundColor: '#f9fafb', cursor: 'default'
                                            }}
                                        />
                                    </div>
                                    

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <label style={{ 
                                            fontSize: '0.85rem', fontWeight: '500', color: '#475569', whiteSpace: 'nowrap', minWidth: '180px'
                                        }}>
                                            Ancien état <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optionnel)</span>
                                        </label>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="text"
                                                name="ancienne_valeur"
                                                value={formData.ancienne_valeur}
                                                onChange={handleInputChange}
                                                placeholder="Ancien état du matériel"
                                                style={{
                                                    width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${formErrors.ancienne_valeur ? '#ef4444' : '#d1d5db'}`, fontSize: '0.95rem', transition: 'all 0.2s ease', outline: 'none'
                                                }}
                                            />
                                            {formErrors.ancienne_valeur && (
                                                <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                                    {formErrors.ancienne_valeur}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <label style={{ 
                                            fontSize: '0.85rem', fontWeight: '500', color: '#475569', whiteSpace: 'nowrap', minWidth: '180px'
                                        }}>
                                             Nouvel état <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="text"
                                                name="nouvelle_valeur"
                                                value={formData.nouvelle_valeur}
                                                onChange={handleInputChange}
                                                placeholder="Nouvel état du matériel"
                                                style={{
                                                    width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${formErrors.nouvelle_valeur ? '#ef4444' : '#d1d5db'}`, fontSize: '0.95rem', transition: 'all 0.2s ease', outline: 'none'
                                                }}
                                            />
                                            {formErrors.nouvelle_valeur && (
                                                <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                                    {formErrors.nouvelle_valeur}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            style={{
                                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <FaSave /> Sauvegarder
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div style={{
                           background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626'
                        }}>
                            <FaTimes style={{ fontSize: '1.2rem', flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Loading */}
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                <span className="visually-hidden">Chargement...</span>
                            </div>
                            <p className="text-muted mt-3" style={{ color: '#6B7280' }}>Chargement de l'historique...</p>
                        </div>
                    ) : historique.length === 0 ? (
                        <div className="text-center py-5">
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
                            <h5 style={{ color: '#374151', fontWeight: '600' }}>Aucun historique disponible</h5>
                            <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>
                                Aucune modification n'a été enregistrée pour ce matériel.
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            background: 'white', borderRadius: '16px', padding: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <DataTable
                                columns={columns}
                                data={historique}
                                pagination
                                paginationPerPage={10}
                                paginationRowsPerPageOptions={[5, 10, 20]}
                                paginationComponentOptions={{
                                    rowsPerPageText: 'Lignes par page',
                                    rangeSeparatorText: 'sur',
                                }}
                                highlightOnHover
                                pointerOnHover
                                responsive
                                customStyles={{
                                    table: { style: { borderRadius: '12px' } },
                                    headRow: { 
                                        style: { 
                                            backgroundColor: '#f8fafc', borderRadius: '12px', borderBottom: '2px solid #E2E8F0'
                                        } 
                                    },
                                    headCells: {
                                        style: {
                                            fontWeight: '600', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em'
                                        }
                                    },
                                    rows: {
                                        style: {
                                            minHeight: '52px',
                                            borderBottom: '1px solid #f1f5f9'
                                        }
                                    }
                                }}
                            />
                            <div style={{
                                padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', textAlign: 'right'
                            }}>
                                {historique.length} modification{historique.length > 1 ? 's' : ''} enregistrée{historique.length > 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="add-modal-footer" style={{
                    background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderRadius: '0 0 20px 20px'
                }}>
                    <button 
                        onClick={onClose} 
                        className="add-modal-cancel-btn" 
                        type="button" 
                        style={{
                            background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 32px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#f8fafc';
                            e.target.style.borderColor = '#94a3b8';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'white';
                            e.target.style.borderColor = '#CBD5E1';
                        }}
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistoriqueModal;