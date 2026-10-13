// src/pages/Materiels/DetailsModal.js

import React, { useState, useEffect } from 'react';
import { FaExchangeAlt, FaHistory, FaLaptopCode, FaBarcode, FaDesktop, FaCheckCircle, FaTimesCircle, FaVideo, FaNetworkWired, FaUsb, FaKeyboard as FaKeyboardIcon, FaBatteryFull, FaMicrochip, FaCommentAlt, FaQrcode, FaBuilding, FaHeart, FaUserCircle, FaTerminal, FaPlug, FaShieldAlt, FaHdd, FaTimes, FaCalendarAlt, FaUserFriends, FaKey, FaLocationArrow, FaToggleOn, FaPowerOff, FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdMonitor, MdComputer, MdSecurity, MdComment } from 'react-icons/md';
import { fetchAffectationsMateriel } from '../../services/api';
import AffectationModal from './AffectationModal';
import AppModal from '../../components/AppModal/AppModal';
import '../../styles/DetailsSection.css';
import './MaterielsModals.css';

const formatDateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

// Historique des affectations du poste (PC et écrans passés par ce poste).
function AffectationsHistorique({ idMateriels }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchAffectationsMateriel(idMateriels)
            .then(data => { if (!cancelled) { setRows(data); setError(null); } })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [idMateriels]);

    if (loading) return <div className="mat-muted-text">Chargement...</div>;
    if (error) return <div className="mat-error-text">{error}</div>;
    if (rows.length === 0) return <div className="mat-muted-text">Aucune affectation enregistrée.</div>;

    return (
        <div className="mat-table-scroll">
            <table className="mat-table mat-table--compact">
                <thead>
                    <tr>
                        <th>Équipement</th>
                        <th>Bénéficiaire</th>
                        <th>Du</th>
                        <th>Au</th>
                        <th>Motif</th>
                        <th>État remise</th>
                        <th>Par</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(a => (
                        <tr key={a.id_affectation}>
                            <td>
                                {a.type_affectation === 'PC'
                                    ? <span><FaLaptopCode className="mat-icon-pc" aria-hidden="true" />PC</span>
                                    : <span><FaDesktop className="mat-icon-ecran" aria-hidden="true" />Écran {a.ecran?.code_ecran}</span>}
                            </td>
                            <td>{a.id_n ? `${a.id_n} - ${a.nom_utilisateur}` : (a.nom_utilisateur || 'Stock')}</td>
                            <td>{formatDateFr(a.date_debut)}</td>
                            <td>
                                {a.date_fin ? formatDateFr(a.date_fin) : (
                                    <span className="mat-badge-encours">En cours</span>
                                )}
                            </td>
                            <td>{a.motif || '—'}</td>
                            <td>{a.etat_remise || '—'}</td>
                            <td>{a.nom_affecte_par || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PasswordField({ label, value, name, visible, onToggle, toggleKey }) {
    return (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon" aria-hidden="true">
                {name === 'mdp_pc' ? <FaKey /> : <FaShieldAlt />}
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    <span className="mat-password-value">
                        {value ? (visible ? value : '••••••••') : 'N/A'}
                    </span>
                    {value && (
                        <button
                            type="button"
                            className="mat-password-toggle"
                            onClick={() => onToggle(toggleKey)}
                            title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            aria-label={visible ? `Masquer : ${label}` : `Afficher : ${label}`}
                        >
                            {visible ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    )}
                </span>
            </div>
        </div>
    );
}

const DetailsModal = ({ isOpen, onClose, data, canManage = false }) => {
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [affectationMode, setAffectationMode] = useState(null); // 'pc' | 'ecran' | null

    const togglePassword = (key) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (!isOpen || !data) return null;

    const getIcon = (name) => {
        switch(name) {
            case 'id_n': return <FaQrcode />;
            case 'id_marque': return <FaLaptopCode />;
            case 'est_actif': return <FaToggleOn />;
            case 'ecran': return <FaDesktop />;
            case 'equipe': return <FaUserFriends />;
            case 'date_pc': return <FaCalendarAlt />;
            case 'date_ecran': return <MdMonitor />;
            case 'salle': return <FaLocationArrow />;
            case 'id_local': return <FaBuilding />;
            case 'etat_pc': return <FaHeart />;
            case 'utilisateur': return <FaUserCircle />;
            case 'code_pc': return <FaTerminal />;
            case 'code_ecran': return <FaBarcode />;
            case 'hdmi': return <FaVideo />;
            case 'lan': return <FaNetworkWired />;
            case 'usb': return <FaUsb />;
            case 'clavier': return <FaKeyboardIcon />;
            case 'mdp_pc': return <FaKey />;
            case 'mdp_admin': return <FaShieldAlt />;
            case 'etat_batterie': return <FaBatteryFull />;
            case 'caracteristiques': return <FaMicrochip />;
            case 'commentaire': return <FaCommentAlt />;
            default: return <FaHdd />;
        }
    };

    const InfoCard = ({ label, value, name }) => {
        let displayValue = value;

        if (name === 'hdmi' || name === 'lan' || name === 'usb' || name === 'clavier' || name === 'est_actif') {
            displayValue = value ? 'Oui' : 'Non';
        }

        return (
            <div className="add-modal-info-card">
                <div className="add-modal-info-icon" aria-hidden="true">
                    {getIcon(name)}
                </div>
                <div className="add-modal-info-content">
                    <span className="add-modal-info-label">{label}</span>
                    <span className={`add-modal-info-value ${value === true || value === 'Oui' ? 'add-modal-info-value-oui' : value === false || value === 'Non' ? 'add-modal-info-value-non' : ''}`}>
                        {displayValue === 'Oui' && <><FaCheckCircle className="mat-yesno-icon" aria-hidden="true" /> Oui</>}
                        {displayValue === 'Non' && <><FaTimesCircle className="mat-yesno-icon" aria-hidden="true" /> Non</>}
                        {displayValue !== 'Oui' && displayValue !== 'Non' && (displayValue || 'N/A')}
                        {name === 'est_actif' && displayValue === 'Oui' && <FaPowerOff className="est-actif-icon" aria-hidden="true" />}
                        {name === 'est_actif' && displayValue === 'Non' && <FaPowerOff className="est-actif-icon est-actif-icon-off" aria-hidden="true" />}
                    </span>
                </div>
            </div>
        );
    };

    // Configuration des sections : icône, sous-titre et couleurs de l'en-tête
    const sections = [
        {
            id: 'user',
            title: 'Informations Utilisateur',
            subtitle: '👤 Informations personnelles',
            icon: <FaUserCircle />,
            gradient: 'var(--gradient-primary-dark)',
            border: 'rgba(79, 70, 229, 0.2)'
        },
        {
            id: 'material',
            title: 'Matériel & Écran',
            subtitle: '💻 Détails techniques',
            icon: <MdComputer />,
            gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            border: 'rgba(14, 165, 233, 0.2)'
        },
        {
            id: 'connectics',
            title: 'Connectiques',
            subtitle: '🔌 Périphériques connectés',
            icon: <FaPlug />,
            gradient: 'linear-gradient(135deg, var(--color-secondary), #a78bfa)',
            border: 'rgba(139, 92, 246, 0.2)'
        },
        {
            id: 'security',
            title: 'Sécurité & salle',
            subtitle: '🔒 Accès et salle',
            icon: <MdSecurity />,
            gradient: 'linear-gradient(135deg, var(--color-warning), #fbbf24)',
            border: 'rgba(245, 158, 11, 0.2)'
        },
        {
            id: 'status',
            title: 'État & Commentaire',
            subtitle: '📊 État et remarques',
            icon: <MdComment />,
            gradient: 'linear-gradient(135deg, var(--color-success), #34d399)',
            border: 'rgba(16, 185, 129, 0.2)'
        }
    ];

    const SectionHeader = ({ section }) => (
        <div className="details-section-header" style={{
            background: section.gradient, border: `1px solid ${section.border}`, boxShadow: `0 2px 8px ${section.border}`
        }}>
            <div className="section-icon-wrapper" aria-hidden="true">
                {section.icon}
            </div>
            <div className="d-flex flex-column">
                <h3 className="details-section-title">{section.title}</h3>
                <span className="mat-details-section-subtitle">{section.subtitle}</span>
            </div>
            <div className="ms-auto">
                <span className="section-badge">{section.id}</span>
            </div>
        </div>
    );

    const header = (
        <div className="add-modal-header">
            <div className="d-flex align-items-center gap-3">
                <div className="add-modal-icon-wrapper" aria-hidden="true">
                    <FaLaptopCode />
                </div>
                <div>
                    <h2 className="add-modal-title">Détails du Matériel</h2>
                    <p className="add-modal-subtitle">Information complète sur l'équipement</p>
                </div>
            </div>
            <div className="mat-modal-header-actions">
                {data.code_pc && (
                    <div className="mat-modal-code-badge">
                        <span className="mat-modal-code-badge-label">Code</span>
                        <span className="mat-modal-code-badge-value">{data.code_pc}</span>
                    </div>
                )}
                {data.url && (
                    <img
                        src={data.url}
                        alt="Matériel"
                        className="add-modal-image-header"
                        onClick={() => window.open(data.url, '_blank')}
                    />
                )}
                <button onClick={onClose} className="add-modal-close-btn" type="button" aria-label="Fermer">
                    <FaTimes />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <AppModal
                show={isOpen}
                onClose={onClose}
                header={header}
                ariaLabel="Détails du Matériel"
                contentClassName="mat-modal mat-modal--details add-modal-details-content mat-details-modal"
                footer={
                    <>
                        {canManage && (
                            <>
                                {/* Un poste vide n'a pas de PC à réaffecter */}
                                {!data.est_vide && (
                                    <button type="button" onClick={() => setAffectationMode('pc')} className="add-modal-submit-btn mat-btn-reaffecter">
                                        <FaExchangeAlt aria-hidden="true" /> Réaffecter le PC
                                    </button>
                                )}
                                <button type="button" onClick={() => setAffectationMode('ecran')} className="add-modal-submit-btn mat-btn-ecran">
                                    <FaDesktop aria-hidden="true" /> {data.id_ecran ? "Déplacer l'écran" : 'Installer un écran'}
                                </button>
                            </>
                        )}
                        <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                            Fermer
                        </button>
                    </>
                }
            >
                {/* Section 1: Utilisateur */}
                <div className="details-section mat-details-section">
                    <SectionHeader section={sections[0]} />
                    <div className="add-modal-form-grid mat-info-grid">
                        <InfoCard label="Utilisateur" value={data.utilisateur} name="utilisateur" />
                        <InfoCard label="N° Matricule" value={data.id_n} name="id_n" />
                        <InfoCard label="Équipe" value={data.equipe} name="equipe" />
                    </div>
                </div>

                {/* Section 2: Matériel et Écran */}
                <div className="details-section mat-details-section">
                    <SectionHeader section={sections[1]} />
                    <div className="add-modal-form-grid mat-info-grid">
                        <InfoCard label="Marque Laptop" value={data.nom_marque} name="id_marque" />
                        <InfoCard label="Code PC" value={data.code_pc} name="code_pc" />
                        <InfoCard label="Date PC" value={data.date_pc ? new Date(data.date_pc).toLocaleDateString('fr-FR') : 'N/A'} name="date_pc" />
                        <InfoCard label="État PC" value={data.etat_pc} name="etat_pc" />
                        <InfoCard label="Marque Écran" value={data.ecran} name="ecran" />
                        <InfoCard label="Code Écran" value={data.code_ecran} name="code_ecran" />
                        <InfoCard label="Date Écran" value={data.date_ecran ? new Date(data.date_ecran).toLocaleDateString('fr-FR') : 'N/A'} name="date_ecran" />
                    </div>
                </div>

                {/* Section 3: Connectiques */}
                <div className="details-section mat-details-section">
                    <SectionHeader section={sections[2]} />
                    <div className="add-modal-form-grid connectiques-grid">
                        <InfoCard label="HDMI" value={data.hdmi} name="hdmi" />
                        <InfoCard label="LAN" value={data.lan} name="lan" />
                        <InfoCard label="USB" value={data.usb} name="usb" />
                        <InfoCard label="Clavier Externe" value={data.clavier} name="clavier" />
                    </div>
                </div>

                {/* Section 4: Sécurité et salle */}
                <div className="details-section mat-details-section">
                    <SectionHeader section={sections[3]} />
                    <div className="add-modal-form-grid mat-info-grid">
                        <PasswordField label="Mot de passe local" value={data.mdp_pc} name="mdp_pc" visible={visiblePasswords.mdp_pc || false} onToggle={togglePassword} toggleKey="mdp_pc" />
                        <PasswordField label="Mot de passe Admin" value={data.mdp_admin} name="mdp_admin" visible={visiblePasswords.mdp_admin || false} onToggle={togglePassword} toggleKey="mdp_admin" />
                        <InfoCard label="salle" value={data.salle} name="salle" />
                        <InfoCard label="Local" value={data.nom_local} name="id_local" />
                    </div>
                </div>

                {/* Section 5: État et Commentaire */}
                <div className="details-section mat-details-section">
                    <SectionHeader section={sections[4]} />
                    <div className="add-modal-form-grid mat-info-grid">
                        <InfoCard label="État Batterie" value={data.etat_batterie} name="etat_batterie" />
                        <InfoCard label="Caractéristiques" value={data.caracteristiques || 'N/A'} name="caracteristiques" />
                    </div>
                    <div className="add-modal-form-grid mat-info-grid">
                        <InfoCard label="Commentaire" value={data.commentaire || 'Aucun commentaire'} name="commentaire" />
                        <InfoCard label="Statut" value={data.est_actif} name="est_actif" />
                    </div>
                </div>

                {/* Section 6: Historique des affectations */}
                {canManage && (
                    <div className="details-section mat-details-section">
                        <div className="details-section-header mat-details-section-header--teal">
                            <div className="section-icon-wrapper" aria-hidden="true">
                                <FaHistory />
                            </div>
                            <h3 className="details-section-title">
                                Historique des affectations
                            </h3>
                        </div>
                        <AffectationsHistorique idMateriels={data.id_materiels} />
                    </div>
                )}
            </AppModal>
            {affectationMode && (
                <AffectationModal
                    mode={affectationMode}
                    materiel={data}
                    onClose={() => setAffectationMode(null)}
                    onDone={() => {
                        setAffectationMode(null);
                        // Les données du poste ont changé : on ferme, ce qui recharge la liste.
                        onClose();
                    }}
                />
            )}
        </>
    );
};

export default DetailsModal;