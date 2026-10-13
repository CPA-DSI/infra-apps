import React, { useState, useEffect, useMemo } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import { getTicketById, fetchAllMaterielsIt } from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
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

    const statutConfig = ticket ? (STATUS_CONFIG[ticket.statut] || STATUS_CONFIG.NOUVEAU) : STATUS_CONFIG.NOUVEAU;
    const prioriteConfig = ticket ? (PRIORITY_CONFIG[ticket.priorite] || PRIORITY_CONFIG.MOYENNE) : PRIORITY_CONFIG.MOYENNE;
    const StatusIcon = statutConfig.icon;
    const PriorityIcon = prioriteConfig.icon;
    const hasFermeture = ticket && ticket.fermeture && Object.keys(ticket.fermeture).length > 0;

    return (
        <AppModal
            show={show}
            onClose={handleClose}
            closeOnBackdrop
            icon={<FaTicketAlt />}
            title={`Ticket #${ticket?.idTicket || ticketId}`}
            subtitle={ticket?.titre}
            contentClassName="tck-modal tck-modal--dark"
            footer={
                <button type="button" onClick={handleClose} className="add-modal-cancel-btn">
                    <FaTimes className="tck-btn-icon" aria-hidden="true" /> Fermer
                </button>
            }
        >
            {loading && (
                <div className="tck-loading-inline tck-loading-inline--lg">
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
                    <div className="tck-details-badges">
                        <span className="tck-status-badge" style={{ backgroundColor: statutConfig.bg, color: statutConfig.text, border: `1px solid ${statutConfig.border}` }}>
                            <StatusIcon size={12} className="tck-badge-icon" aria-hidden="true" /> {statutConfig.label}
                        </span>
                        <span className="tck-priority-badge" style={{ backgroundColor: prioriteConfig.color + '20', color: prioriteConfig.color, border: `1px solid ${prioriteConfig.color}40` }}>
                            <PriorityIcon size={12} className="tck-badge-icon" aria-hidden="true" /> {prioriteConfig.label}
                        </span>
                    </div>

                    <div className="tck-details-dates">
                        <span className="tck-discussion-subtitle">
                            <FaCalendarAlt size={11} className="tck-badge-icon" aria-hidden="true" /> Créé le {new Date(ticket.dateCreation).toLocaleDateString('fr-FR')}
                        </span>
                        {ticket.dateMaj && (
                            <span className="tck-discussion-subtitle">
                                <FaSyncAlt size={11} className="tck-badge-icon" aria-hidden="true" /> Maj: {new Date(ticket.dateMaj).toLocaleDateString('fr-FR')}
                            </span>
                        )}
                    </div>

                    <div className="tck-details-cards">
                        <div className="tck-info-card">
                            <div className="tck-info-icon" aria-hidden="true"><FaUser size={16} /></div>
                            <div className="tck-info-content">
                                <span className="tck-info-label">Demandeur</span>
                                <span className="tck-info-value">{ticket.nomDemandeurFormate || ticket.nomDemandeur || ticket.demandeur?.email_1 || 'Inconnu'}</span>
                            </div>
                        </div>

                        <div className="tck-info-card">
                            <div className="tck-info-icon" aria-hidden="true"><FaLaptop size={16} /></div>
                            <div className="tck-info-content">
                                <span className="tck-info-label">Matériel</span>
                                <span className="tck-info-value">{ticket.materiels?.nom_materiel || ticket.materiels?.caracteristiques || `ID: ${ticket.idMateriels}`}</span>
                            </div>
                        </div>

                        {ticket.assigneA && (
                            <div className="tck-info-card">
                                <div className="tck-info-icon" aria-hidden="true"><FaArrowRight size={16} /></div>
                                <div className="tck-info-content">
                                    <span className="tck-info-label">Assigné à</span>
                                    <span className="tck-info-value">{ticket.nomAssigneFormate || ticket.nomAssigne || ticket.assigneA?.email_1 || 'Non assigné'}</span>
                                </div>
                            </div>
                        )}

                        {hasFermeture && (
                            <div className="tck-info-card tck-info-card--success">
                                <div className="tck-info-icon" aria-hidden="true"><FaLock size={16} /></div>
                                <div className="tck-info-content">
                                    <span className="tck-info-label">Fermé le</span>
                                    <span className="tck-info-value">{new Date(ticket.fermeture.dateFermeture).toLocaleDateString('fr-FR')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {ticket.description && (
                        <div className="tck-info-card tck-info-card--block">
                            <div className="tck-info-card__head">
                                <div className="tck-info-icon" aria-hidden="true"><FaInfoCircle size={16} /></div>
                                <span className="tck-info-label">Description</span>
                            </div>
                            <p className="tck-info-text">{ticket.description}</p>
                        </div>
                    )}

                    {hasFermeture && ticket.fermeture.solution && (
                        <div className="tck-info-card tck-info-card--block tck-info-card--success">
                            <div className="tck-info-card__head">
                                <div className="tck-info-icon" aria-hidden="true"><FaCheckCircle size={16} /></div>
                                <span className="tck-info-label">Solution</span>
                            </div>
                            <p className="tck-info-text tck-info-text--strong">{ticket.fermeture.solution}</p>
                            {ticket.fermeture.motif && (
                                <p className="tck-info-note">
                                    <strong>Motif:</strong> {ticket.fermeture.motif}
                                </p>
                            )}
                            {ticket.fermeture.dureeResolution && (
                                <p className="tck-info-note tck-info-note--tight">
                                    <strong>Durée de résolution:</strong> {ticket.fermeture.dureeResolution} jours
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </AppModal>
    );
};

export default TicketDetailsModal;