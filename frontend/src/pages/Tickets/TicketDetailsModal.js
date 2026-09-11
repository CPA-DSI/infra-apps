import React, { useState, useEffect, useMemo } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import { getTicketById, fetchAllMaterielsIt } from '../../services/api';
import './Tickets.css';
import {
    FaTicketAlt, FaCalendarAlt, FaUser, FaLaptop,
    FaArrowRight, FaTimes, FaInfoCircle, FaClock, FaCheckCircle,
    FaArchive, FaLock, FaExclamationTriangle, FaStar, FaStarHalfAlt, FaSyncAlt, FaFlag
} from 'react-icons/fa';

const STATUS_CONFIG = {
    NOUVEAU: { label: 'Nouveau', bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', icon: FaInfoCircle },
    EN_COURS: { label: 'En cours', bg: '#fed7aa', text: '#92400e', border: '#fbbf24', icon: FaClock },
    CLOS: { label: 'Clos', bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', icon: FaCheckCircle },
    EN_ATTENTE: { label: 'En attente', bg: '#e5e7eb', text: '#374151', border: '#9ca3af', icon: FaArchive },
    RESOLU: { label: 'Résolu', bg: '#c6f6d5', text: '#2f855a', border: '#9ae6b4', icon: FaCheckCircle },
    FERME: { label: 'Fermé', bg: '#edf2f7', text: '#4a5568', border: '#cbd5e0', icon: FaArchive },
};

const PRIORITY_CONFIG = {
    HAUTE: { label: 'Haute', color: '#e53e3e', icon: FaFlag },
    URGENTE: { label: 'Urgente', color: '#c53030', icon: FaExclamationTriangle },
    MOYENNE: { label: 'Moyenne', color: '#d69e2e', icon: FaStarHalfAlt },
    BASSE: { label: 'Basse', color: '#718096', icon: FaStar },
};

const TicketDetailsModal = ({ show, handleClose, ticketId }) => {
    const [materiels, setMateriels] = useState([]);
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fonction pour récupérer la liste des matériels
    const getMateriels = async () => {
        try {
            const data = await fetchAllMaterielsIt();
            setMateriels(data);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        getMateriels();
    }, []);

    useMemo(() => {
        const map = new Map();
        materiels.forEach(item => {
            map.set(item.id_n, item);
        });
        return map;
    }, [materiels]);

    const fetchTicketData = async (id) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getTicketById(id);
            const mappedData = {
                ...data,
                id_n: data.idTicket,
            };
            setTicket(mappedData);
        } catch (err) {
            setError("Erreur lors de la récupération du ticket.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (show && ticketId) {
            fetchTicketData(ticketId);
        }
    }, [show, ticketId]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        if (show) {
            document.addEventListener('keydown', handleEsc);
            return () => document.removeEventListener('keydown', handleEsc);
        }
    }, [show, handleClose]);

    const statutConfig = ticket ? (STATUS_CONFIG[ticket.statut] || STATUS_CONFIG.NOUVEAU) : STATUS_CONFIG.NOUVEAU;
    const prioriteConfig = ticket ? (PRIORITY_CONFIG[ticket.priorite] || PRIORITY_CONFIG.MOYENNE) : PRIORITY_CONFIG.MOYENNE;
    const StatusIcon = statutConfig.icon;
    const PriorityIcon = prioriteConfig.icon;
    const hasFermeture = ticket && ticket.fermeture && Object.keys(ticket.fermeture).length > 0;

    return (
        show && (
            <div className="add-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
                <div className="add-modal-content" style={{
                    maxWidth: '900px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                }}>
                    <div className="add-modal-header" style={{
                        background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="add-modal-icon-wrapper" style={{
                                background: 'linear-gradient(135deg, #10B981, #059669)',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                            }}>
                                <FaTicketAlt style={{ color: 'white' }} />
                            </div>
                            <div>
                                <h2 className="add-modal-title" style={{ color: 'white' }}>
                                    Ticket #{ticket?.idTicket || ticketId}
                                </h2>
                                <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {ticket?.titre}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="add-modal-close-btn" type="button" style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <FaTimes />
                        </button>
                    </div>

                    <div className="add-modal-body" style={{ padding: '24px', background: '#F8FAFC' }}>
                        {loading && (
                            <div className="loading-spinner" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', padding: '20px 0' }}>
                                <Spinner animation="border" size="sm" />
                                <span>Chargement des détails...</span>
                            </div>
                        )}

                        {error && (
                            <Alert variant="danger" className="mb-3">
                                {error}
                            </Alert>
                        )}

                        {!loading && !error && ticket && (
                            <>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                    <span className="status-badge" style={{ backgroundColor: statutConfig.bg, color: statutConfig.text, border: `1px solid ${statutConfig.border}` }}>
                                        <StatusIcon size={12} style={{ marginRight: 4 }} /> {statutConfig.label}
                                    </span>
                                    <span className="priority-badge" style={{ backgroundColor: prioriteConfig.color + '20', color: prioriteConfig.color, border: `1px solid ${prioriteConfig.color}40` }}>
                                        <PriorityIcon size={12} style={{ marginRight: 4 }} /> {prioriteConfig.label}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                                    <span className="discussion-subtitle" style={{ marginLeft: 0 }}>
                                        <FaCalendarAlt size={11} style={{ marginRight: 4 }} /> Créé le {new Date(ticket.dateCreation).toLocaleDateString('fr-FR')}
                                    </span>
                                    {ticket.dateMaj && (
                                        <span className="discussion-subtitle" style={{ marginLeft: 0 }}>
                                            <FaSyncAlt size={11} style={{ marginRight: 4 }} /> Maj: {new Date(ticket.dateMaj).toLocaleDateString('fr-FR')}
                                        </span>
                                    )}
                                </div>

                                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div className="add-modal-info-card">
                                        <div className="add-modal-info-icon"><FaUser size={16} /></div>
                                        <div className="add-modal-info-content">
                                            <span className="add-modal-info-label">Demandeur</span>
                                            <span className="add-modal-info-value">{ticket.nomDemandeurFormate || ticket.nomDemandeur || ticket.demandeur?.email_1 || 'Inconnu'}</span>
                                        </div>
                                    </div>

                                    <div className="add-modal-info-card">
                                        <div className="add-modal-info-icon"><FaLaptop size={16} /></div>
                                        <div className="add-modal-info-content">
                                            <span className="add-modal-info-label">Matériel</span>
                                            <span className="add-modal-info-value">{ticket.materiels?.nom_materiel || ticket.materiels?.caracteristiques || `ID: ${ticket.idMateriels}`}</span>
                                        </div>
                                    </div>

                                    {ticket.assigneA && (
                                        <div className="add-modal-info-card">
                                            <div className="add-modal-info-icon"><FaArrowRight size={16} /></div>
                                            <div className="add-modal-info-content">
                                                <span className="add-modal-info-label">Assigné à</span>
                                                <span className="add-modal-info-value">{ticket.nomAssigneFormate || ticket.nomAssigne || ticket.assigneA?.email_1 || 'Non assigné'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {hasFermeture && (
                                        <div className="add-modal-info-card" style={{ borderLeft: '4px solid #10b981' }}>
                                            <div className="add-modal-info-icon" style={{ color: '#10b981' }}><FaLock size={16} /></div>
                                            <div className="add-modal-info-content">
                                                <span className="add-modal-info-label">Fermé le</span>
                                                <span className="add-modal-info-value">{new Date(ticket.fermeture.dateFermeture).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {ticket.description && (
                                    <div className="add-modal-info-card" style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                            <div className="add-modal-info-icon"><FaInfoCircle size={16} /></div>
                                            <span className="add-modal-info-label" style={{ margin: 0 }}>Description</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                                    </div>
                                )}

                                {hasFermeture && ticket.fermeture.solution && (
                                    <div className="add-modal-info-card" style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 8, borderLeft: '4px solid #10b981' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                            <div className="add-modal-info-icon" style={{ color: '#10b981' }}><FaCheckCircle size={16} /></div>
                                            <span className="add-modal-info-label" style={{ margin: 0, color: '#10b981' }}>Solution</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.fermeture.solution}</p>
                                        {ticket.fermeture.motif && (
                                            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                                                <strong>Motif:</strong> {ticket.fermeture.motif}
                                            </p>
                                        )}
                                        {ticket.fermeture.dureeResolution && (
                                            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                                                <strong>Durée de résolution:</strong> {ticket.fermeture.dureeResolution} jours
                                            </p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="add-modal-footer" style={{
                        background: '#F1F5F9',
                        borderTop: '1px solid #E2E8F0',
                        padding: '16px 24px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <button type="button" onClick={handleClose} className="add-modal-cancel-btn" style={{
                            background: 'white',
                            color: '#1E293B',
                            border: '1px solid #CBD5E1',
                            padding: '10px 28px',
                            borderRadius: '12px',
                            fontWeight: '500',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}>
                            <FaTimes style={{ marginRight: 6 }} /> Fermer
                        </button>
                    </div>
                </div>
            </div>
        )
    );
};

export default TicketDetailsModal;