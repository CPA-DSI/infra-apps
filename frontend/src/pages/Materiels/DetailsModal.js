// src/pages/Materiels/DetailsModal.js

import React, { useState } from 'react';
import { FaLaptopCode, FaBarcode, FaDesktop, FaMapMarkerAlt, FaUser, FaCode, FaKeyboard, FaLock, FaCheckCircle, FaTimesCircle, FaInfoCircle, FaVideo, FaNetworkWired, FaUsb, FaKeyboard as FaKeyboardIcon, FaBatteryFull, FaMicrochip, FaCommentAlt, FaQrcode, FaBuilding, FaDoorOpen, FaHeart, FaUserCircle, FaTerminal, FaPlug, FaShieldAlt, FaHdd, FaTimes, FaCalendarAlt, FaUserFriends, FaCogs, FaKey, FaLocationArrow, FaToggleOn, FaPowerOff, FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdMonitor, MdComputer, MdSecurity, MdComment, MdDevices } from 'react-icons/md';
import './Materiels.css';

function PasswordField({ label, value, name, visible, onToggle, toggleKey }) {
    return (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon">
                {name === 'mdp_pc' ? <FaKey /> : <FaShieldAlt />}
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    <span style={{ fontFamily: 'monospace', letterSpacing: '1px', flex: 1 }}>
                        {value ? (visible ? value : '••••••••') : 'N/A'}
                    </span>
                    {value && (
                        <button
                            type="button"
                            onClick={() => onToggle(toggleKey)}
                            title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            style={{
                                padding: 0, margin: 0, color: '#94a3b8', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', flexShrink: 0
                            }}
                        >
                            {visible ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    )}
                </span>
            </div>
        </div>
    );
}

const DetailsModal = ({ isOpen, onClose, data }) => {
    const [visiblePasswords, setVisiblePasswords] = useState({});

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
                <div className="add-modal-info-icon">
                    {getIcon(name)}
                </div>
                <div className="add-modal-info-content">
                    <span className="add-modal-info-label">{label}</span>
                    <span className={`add-modal-info-value ${value === true || value === 'Oui' ? 'add-modal-info-value-oui' : value === false || value === 'Non' ? 'add-modal-info-value-non' : ''}`}>
                        {displayValue === 'Oui' && <><FaCheckCircle style={{ fontSize: '0.9rem' }} /> Oui</>}
                        {displayValue === 'Non' && <><FaTimesCircle style={{ fontSize: '0.9rem' }} /> Non</>}
                        {displayValue !== 'Oui' && displayValue !== 'Non' && (displayValue || 'N/A')}
                        {name === 'est_actif' && displayValue === 'Oui' && <FaPowerOff className="est-actif-icon" style={{ fontSize: '0.85rem', marginLeft: '6px' }} />}
                        {name === 'est_actif' && displayValue === 'Non' && <FaPowerOff className="est-actif-icon est-actif-icon-off" style={{ fontSize: '0.85rem', marginLeft: '6px' }} />}
                    </span>
                </div>
            </div>
        );
    };

    // Configuration des sections avec icônes et couleurs
    const sections = [
        {
            id: 'user',
            title: 'Informations Utilisateur',
            icon: <FaUserCircle />,
            color: '#4F46E5',
            gradient: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            bg: 'rgba(79, 70, 229, 0.08)',
            border: 'rgba(79, 70, 229, 0.2)'
        },
        {
            id: 'material',
            title: 'Matériel & Écran',
            icon: <MdComputer />,
            color: '#0EA5E9',
            gradient: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
            bg: 'rgba(14, 165, 233, 0.08)',
            border: 'rgba(14, 165, 233, 0.2)'
        },
        {
            id: 'connectics',
            title: 'Connectiques',
            icon: <FaPlug />,
            color: '#8B5CF6',
            gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
            bg: 'rgba(139, 92, 246, 0.08)',
            border: 'rgba(139, 92, 246, 0.2)'
        },
        {
            id: 'security',
            title: 'Sécurité & salle',
            icon: <MdSecurity />,
            color: '#F59E0B',
            gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            bg: 'rgba(245, 158, 11, 0.08)',
            border: 'rgba(245, 158, 11, 0.2)'
        },
        {
            id: 'status',
            title: 'État & Commentaire',
            icon: <MdComment />,
            color: '#10B981',
            gradient: 'linear-gradient(135deg, #10B981, #34D399)',
            bg: 'rgba(16, 185, 129, 0.08)',
            border: 'rgba(16, 185, 129, 0.2)'
        }
    ];

    const SectionHeader = ({ section }) => (
        <div className="details-section-header" style={{ 
           background: section.gradient, border: `1px solid ${section.border}`, borderRadius: '12px', padding: '10px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: `0 2px 8px ${section.border}`
        }}>
            <div className="section-icon-wrapper" style={{
                background: 'rgba(255, 255, 255, 0.25)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white'
            }}>
                {section.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 className="details-section-title" style={{
                    color: 'white', fontSize: '0.95rem', fontWeight: '600', margin: 0, letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                    {section.title}
                </h3>
                <span style={{
                    color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', fontWeight: '400'
                }}>
                    {section.id === 'user' ? '👤 Informations personnelles' : 
                     section.id === 'material' ? '💻 Détails techniques' :
                     section.id === 'connectics' ? '🔌 Périphériques connectés' :
                     section.id === 'security' ? '🔒 Accès et salle' :
                     '📊 État et remarques'}
                </span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
                <span style={{
                    background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '2px 12px', color: 'white', fontSize: '0.65rem', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase'
                }}>
                    {section.id}
                </span>
            </div>
        </div>
    );

    return (
        <>
            <div className="add-modal-overlay">
                <div className="add-modal-content add-modal-details-content" style={{
                    maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                }}>
                    {/* Header amélioré */}
                    <div className="add-modal-header" style={{
                        background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="add-modal-icon-wrapper" style={{
                                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                                boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
                            }}>
                                <FaLaptopCode style={{ color: 'white' }} />
                            </div>
                            <div>
                                <h2 className="add-modal-title" style={{ color: 'white' }}>
                                    Détails du Matériel
                                </h2>
                                <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    Information complète sur l'équipement
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {data.code_pc && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)', padding: '4px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.15)'
                                }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>Code</span>
                                    <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '600', marginLeft: '6px' }}>
                                        {data.code_pc}
                                    </span>
                                </div>
                            )}
                            {data.url && (
                                <img 
                                    src={data.url} 
                                    alt="Matériel" 
                                    className="add-modal-image-header"
                                    onClick={() => window.open(data.url, '_blank')}
                                    style={{
                                        width: '50px', height: '50px', objectFit: 'cover', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.2)', cursor: 'pointer'
                                    }}
                                />
                            )}
                            <button onClick={onClose} className="add-modal-close-btn" type="button" style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.15)'
                            }}>
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                    
                    <div className="add-modal-body" style={{
                        padding: '24px', background: '#F8FAFC'
                    }}>
                        {/* Section 1: Utilisateur */}
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[0]} />
                            <div className="add-modal-form-grid" style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                            }}>
                                <InfoCard label="Utilisateur" value={data.utilisateur} name="utilisateur" />
                                <InfoCard label="N° Matricule" value={data.id_n} name="id_n" />
                                <InfoCard label="Équipe" value={data.equipe} name="equipe" />
                            </div>
                        </div>

                        {/* Section 2: Matériel et Écran */}
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[1]} />
                            <div className="add-modal-form-grid" style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                            }}>
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
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[2]} />
                            <div className="add-modal-form-grid connectiques-grid" style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px'
                            }}>
                                <InfoCard label="HDMI" value={data.hdmi} name="hdmi" />
                                <InfoCard label="LAN" value={data.lan} name="lan" />
                                <InfoCard label="USB" value={data.usb} name="usb" />
                                <InfoCard label="Clavier Externe" value={data.clavier} name="clavier" />
                            </div>
                        </div>

                        {/* Section 4: Sécurité et salle */}
                        <div className="details-section" style={{
                           background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[3]} />
                            <div className="add-modal-form-grid" style={{
                               display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                            }}>
                                <PasswordField label="Mot de passe local" value={data.mdp_pc} name="mdp_pc" visible={visiblePasswords.mdp_pc || false} onToggle={togglePassword} toggleKey="mdp_pc" />
                                <PasswordField label="Mot de passe Admin" value={data.mdp_admin} name="mdp_admin" visible={visiblePasswords.mdp_admin || false} onToggle={togglePassword} toggleKey="mdp_admin" />
                                <InfoCard label="salle" value={data.salle} name="salle" />
                                <InfoCard label="Local" value={data.nom_local} name="id_local" />
                            </div>
                        </div>

                        {/* Section 5: État et Commentaire */}
                        <div className="details-section" style={{
                           background: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[4]} />
                            <div className="add-modal-form-grid" style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                            }}>
                                <InfoCard label="État Batterie" value={data.etat_batterie} name="etat_batterie" />
                                <InfoCard label="Caractéristiques" value={data.caracteristiques || 'N/A'} name="caracteristiques" />
                            </div>
                            <div className="add-modal-form-grid" style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px'
                            }}>
                                <InfoCard label="Commentaire" value={data.commentaire || 'Aucun commentaire'} name="commentaire" />
                                <InfoCard label="Statut" value={data.est_actif} name="est_actif" />
                            </div>
                        </div>
                    </div>

                    <div className="add-modal-footer" style={{
                        background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px'
                    }}>
                        <button onClick={onClose} className="add-modal-cancel-btn" style={{
                            background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', transition: 'all 0.2s ease'
                        }}>
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DetailsModal;