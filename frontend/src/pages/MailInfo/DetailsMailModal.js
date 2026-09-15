// DetailsMailModal.js
import React, { useState } from 'react';
import { FaUser, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaHashtag, FaShieldAlt, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaEnvelopeOpenText, FaTimes, FaChevronDown, FaChevronUp, FaPlus, FaEdit } from 'react-icons/fa';
import { ROLES } from '../../config/api';
import './Mail.css';
import '../Materiels/Materiels.css';
import EditEmailModal from './EditEmailModal';

const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const getEmails = (user) => {
    if (!user?.emails || !Array.isArray(user.emails)) return [];
    return user.emails;
};

const getPrimaryEmail = (user) => {
    const emails = getEmails(user);
    if (emails.length === 0) return null;
    return emails.find(e => e.is_primary) || emails[0];
};

const getOtherEmails = (user) => {
    const emails = getEmails(user);
    if (emails.length === 0) return [];
    const primary = getPrimaryEmail(user);
    return emails.filter(e => e !== primary);
};

const getVerifiedCount = (user) => {
    const emails = getEmails(user);
    return emails.filter(e => e.is_verified).length;
};

const roleLabels = Object.fromEntries(
    Object.entries(ROLES).map(([value, { label }]) => [value, label])
);

    const getMailPassword = (email) => {
        if (!email) return null;
        return email.pass_mail || null;
    };

    const getLoginPassword = (email) => {
        if (!email) return null;
        return email.password_enc || null;
    };

function PasswordField({ label, value, visible, onToggle, toggleKey, badge }) {
    if (!value) return null;
    return (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon">
                <FaLock />
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    <span style={{ fontFamily: 'monospace', letterSpacing: '1px', flex: 1 }}>
                        {visible ? value : '••••••••'}
                    </span>
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
                    {badge && (
                        <span className={`badge rounded-pill ${badge.className || ''}`} style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            ...badge.style
                        }}>
                            {badge.text}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}

function DetailsMailModal({ show, handleClose, mailData, onEmailAdded }) {
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [expandedEmails, setExpandedEmails] = useState(false);
    const [expandedPasswords, setExpandedPasswords] = useState(false);
    const [showAddEmailModal, setShowAddEmailModal] = useState(false);
    const [editingEmail, setEditingEmail] = useState(null);

    const togglePassword = (key) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleEmailAdded = () => {
        if (onEmailAdded) {
            onEmailAdded();
        }
        setShowAddEmailModal(false);
        setEditingEmail(null);
    };

    if (!show || !mailData) return null;

    const emails = getEmails(mailData);
    const primaryEmail = getPrimaryEmail(mailData);
    const otherEmails = getOtherEmails(mailData);
    const verifiedCount = getVerifiedCount(mailData);

    const InfoCard = ({ icon: Icon, label, value, badge }) => (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon">
                <Icon />
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    {value || 'N/A'}
                    {badge && (
                        <span className={`badge rounded-pill ${badge.className || ''}`} style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            ...badge.style
                        }}>
                            {badge.text}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );

    const sections = [
        {
            id: 'user',
            title: 'Informations Utilisateur',
            icon: <FaUser />,
            color: '#4F46E5',
            gradient: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            bg: 'rgba(79, 70, 229, 0.08)',
            border: 'rgba(79, 70, 229, 0.2)'
        },
        {
            id: 'account',
            title: 'Compte Email',
            icon: <FaEnvelope />,
            color: '#0EA5E9',
            gradient: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
            bg: 'rgba(14, 165, 233, 0.08)',
            border: 'rgba(14, 165, 233, 0.2)'
        },
        {
            id: 'emails',
            title: 'Emails Configurés',
            icon: <FaEnvelope />,
            color: '#8B5CF6',
            gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
            bg: 'rgba(139, 92, 246, 0.08)',
            border: 'rgba(139, 92, 246, 0.2)'
        },
        {
            id: 'security',
            title: 'Sécurité & Mots de passe',
            icon: <FaLock />,
            color: '#F59E0B',
            gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            bg: 'rgba(245, 158, 11, 0.08)',
            border: 'rgba(245, 158, 11, 0.2)'
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
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.7rem',
                    fontWeight: '400'
                }}>
                    {section.id === 'user' ? '👤 Informations personnelles' :
                        section.id === 'account' ? '📧 Détails du compte' :
                            section.id === 'emails' ? '📬 Adresses email' :
                                '🔒 Accès et mots de passe'}
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
        <div className="add-modal-overlay">
            <div className="add-modal-content add-modal-details-content large-modal" style={{
                maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                <div className="add-modal-header" style={{
                    background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{
                            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
                        }}>
                            <FaEnvelopeOpenText style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>
                                Détails Email
                            </h2>
                            <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Matricule n° {mailData.id_n ?? 'N/A'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button onClick={handleClose} className="add-modal-close-btn" type="button" style={{
                           background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="add-modal-body" style={{
                    padding: '24px', background: '#F8FAFC'
                }}>
                    <div className="details-section" style={{
                        background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                    }}>
                        <SectionHeader section={sections[0]} />
                        <div className="add-modal-form-grid" style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                        }}>
                            <InfoCard icon={FaUser} label="Utilisateur" value={mailData.materiel?.utilisateur} />
                            <InfoCard icon={FaUsers} label="Équipe" value={mailData.materiel?.equipe} />
                            <InfoCard icon={FaMapMarkerAlt} label="Local" value={mailData.materiel?.local?.nom_local} />
                            <InfoCard icon={FaMapMarkerAlt} label="Salle" value={mailData.materiel?.salle} />
                            <InfoCard icon={FaCalendarAlt} label="Date de création" value={formatDate(mailData.createdAt)} />
                        </div>
                    </div>

                    <div className="details-section" style={{
                       background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                    }}>
                        <SectionHeader section={sections[1]} />
                        <div className="add-modal-form-grid" style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
                        }}>
                            <InfoCard icon={FaHashtag} label="ID Utilisateur" value={mailData.id_user} />
                            <InfoCard
                                icon={FaShieldAlt}
                                label="Rôle"
                                value={roleLabels[mailData.role] || mailData.role}
                                badge={{
                                    text: mailData.is_active ? 'Actif' : 'Désactivé',
                                    className: mailData.is_active ? 'bg-success' : 'bg-danger',
                                    style: {
                                        backgroundColor: mailData.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: mailData.is_active ? '#ffffff' : '#ffffff'
                                    }
                                }}
                            />
                            <InfoCard
                                icon={FaEnvelope}
                                label="Total Emails"
                                value={`${emails.length} email${emails.length > 1 ? 's' : ''}`}
                                badge={{
                                    text: `${verifiedCount} vérifié${verifiedCount > 1 ? 's' : ''}`,
                                    style: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#1e40af' }
                                }}
                            />
                        </div>
                    </div>

                    {emails.length > 0 && (
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[2]} />
                            {primaryEmail && (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.06))',
                                    border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '16px 20px',
                                    marginBottom: otherEmails.length > 0 ? '16px' : 0
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <FaEnvelope style={{ color: '#7c3aed', flexShrink: 0 }} />
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', flex: 1, minWidth: '200px' }}>
                                            {primaryEmail.email}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '50px', fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#7c3aed', letterSpacing: '0.3px' }}>PRINCIPAL</span>
                                        <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '50px', fontWeight: 600, backgroundColor: primaryEmail.is_verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: primaryEmail.is_verified ? '#15803d' : '#dc2626' }}>
                                            {primaryEmail.is_verified ? '✓ VÉRIFIÉ' : 'NON VÉRIFIÉ'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {otherEmails.length > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedEmails(prev => !prev)}
                                        style={{
                                            width: '100%', padding: '12px 20px', background: '#f8fafc', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#475569',
                                            fontSize: '0.85rem', fontWeight: 600, transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <span>Autres adresses ({otherEmails.length})</span>
                                        {expandedEmails ? <FaChevronUp style={{ fontSize: '0.8rem' }} /> : <FaChevronDown style={{ fontSize: '0.8rem' }} />}
                                    </button>
                                    {expandedEmails && (
                                        <div style={{ animation: 'expandRowFadeIn 0.3s ease forwards' }}>
                                            {otherEmails.map((email, idx) => (
                                                <div key={email.id_uEmail || idx} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px',
                                                    borderTop: '1px solid #f1f5f9', transition: 'background 0.15s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <FaEnvelope style={{ color: '#6366f1', fontSize: '0.85rem', flexShrink: 0 }} />
                                                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#1e293b', minWidth: '200px' }}>
                                                        {email.email}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '50px', fontWeight: 600, backgroundColor: email.is_verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: email.is_verified ? '#15803d' : '#dc2626' }}>
                                                        {email.is_verified ? '✓ VÉRIFIÉ' : 'NON VÉRIFIÉ'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingEmail(email); setShowAddEmailModal(true); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: '4px', borderRadius: '6px', transition: 'all 0.2s' }}
                                                        title="Modifier cet email"
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                    >
                                                        <FaEdit size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(getMailPassword(primaryEmail) || getLoginPassword(primaryEmail) || otherEmails.some(e => getMailPassword(e) || getLoginPassword(e))) && (
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <SectionHeader section={sections[3]} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {primaryEmail && getLoginPassword(primaryEmail) && (
                                    <PasswordField
                                        label="Mot de passe de Connexion"
                                        value={getLoginPassword(primaryEmail)}
                                        visible={visiblePasswords['primary-password_enc'] || false}
                                        onToggle={togglePassword}
                                        toggleKey="primary-password_enc"
                                        badge={{
                                            text: 'password',
                                            style: { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#15803d' }
                                        }}
                                    />
                                )}
                                {primaryEmail && getMailPassword(primaryEmail) && (
                                    <PasswordField
                                        label="Mot de passe Principal Mail"
                                        value={getMailPassword(primaryEmail)}
                                        visible={visiblePasswords['primary-pass_mail'] || false}
                                        onToggle={togglePassword}
                                        toggleKey="primary-pass_mail"
                                        badge={{
                                            text: 'pass_mail',
                                            style: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#1e40af' }
                                        }}
                                    />
                                )}
                                {otherEmails.some(e => getMailPassword(e) || getLoginPassword(e)) && (
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedPasswords(prev => !prev)}
                                            style={{
                                                width: '100%', padding: '12px 20px', background: '#f8fafc', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#475569',
                                                fontSize: '0.85rem', fontWeight: 600, transition: 'background 0.15s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                        >
                                            <span>Mots de passe secondaires ({otherEmails.filter(e => getMailPassword(e) || getLoginPassword(e)).length})</span>
                                            {expandedPasswords ? <FaChevronUp style={{ fontSize: '0.8rem' }} /> : <FaChevronDown style={{ fontSize: '0.8rem' }} />}
                                        </button>
                                        {expandedPasswords && (
                                            <div style={{ animation: 'expandRowFadeIn 0.3s ease forwards', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
                                                {otherEmails.map((email, index) => (
                                                    <div key={email.id_uEmail || index} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        {getLoginPassword(email) && (
                                                            <PasswordField
                                                                label={`Mot de passe de Connexion ${index + 1}`}
                                                                value={getLoginPassword(email)}
                                                                visible={visiblePasswords[`secondary-${index}-password_enc`] || false}
                                                                onToggle={togglePassword}
                                                                toggleKey={`secondary-${index}-password_enc`}
                                                                badge={{
                                                                    text: 'password',
                                                                    style: { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#15803d' }
                                                                }}
                                                            />
                                                        )}
                                                        {getMailPassword(email) && (
                                                            <PasswordField
                                                                label={`Mot de passe Secondaire Mail ${index + 1}`}
                                                                value={getMailPassword(email)}
                                                                visible={visiblePasswords[`secondary-${index}-pass_mail`] || false}
                                                                onToggle={togglePassword}
                                                                toggleKey={`secondary-${index}-pass_mail`}
                                                                badge={{
                                                                    text: 'pass_mail',
                                                                    style: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#1e40af' }
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="add-modal-footer" style={{
                    background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px'
                }}>
                    <button onClick={() => setShowAddEmailModal(true)} className="add-modal-submit-btn" style={{ backgroundColor: '#22c55e', marginRight: '8px' }}>
                        <FaPlus /> Ajouter un email
                    </button>
                    <button onClick={handleClose} className="add-modal-cancel-btn" style={{
                        background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', transition: 'all 0.2s ease'
                    }}>
                        Fermer
                    </button>
                </div>

                <EditEmailModal
                    show={showAddEmailModal}
                    handleClose={() => { setShowAddEmailModal(false); setEditingEmail(null); }}
                    userData={mailData}
                    emailData={editingEmail}
                    onSaved={handleEmailAdded}
                />
            </div>
        </div>
    );
}

export default DetailsMailModal;
