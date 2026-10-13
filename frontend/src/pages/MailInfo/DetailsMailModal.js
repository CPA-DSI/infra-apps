// DetailsMailModal.js
import React, { useState } from 'react';
import { FaUser, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaHashtag, FaShieldAlt, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaEnvelopeOpenText, FaChevronDown, FaChevronUp, FaPlus, FaEdit } from 'react-icons/fa';
import { ROLES } from '../../config/api';
import AppModal from '../../components/AppModal/AppModal';
import '../../styles/DetailsSection.css';
import './MailModals.css';
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
    const toggleLabel = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
    return (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon" aria-hidden="true">
                <FaLock />
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    <span className="mail-modal-password">
                        {visible ? value : '••••••••'}
                    </span>
                    <button
                        type="button"
                        className="mail-modal-password-toggle"
                        onClick={() => onToggle(toggleKey)}
                        title={toggleLabel}
                        aria-label={toggleLabel}
                    >
                        {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                    </button>
                    {badge && (
                        <span className={`badge rounded-pill mail-modal-badge ${badge.className || ''}`}>
                            {badge.text}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}

const PASSWORD_BADGE = { text: 'password', className: 'mail-modal-badge--success' };
const PASS_MAIL_BADGE = { text: 'pass_mail', className: 'mail-modal-badge--info' };

function InfoCard({ icon: Icon, label, value, badge }) {
    return (
        <div className="add-modal-info-card">
            <div className="add-modal-info-icon" aria-hidden="true">
                <Icon />
            </div>
            <div className="add-modal-info-content">
                <span className="add-modal-info-label">{label}</span>
                <span className="add-modal-info-value">
                    {value || 'N/A'}
                    {badge && (
                        <span className={`badge rounded-pill mail-modal-badge ${badge.className || ''}`}>
                            {badge.text}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}

const SECTIONS = {
    user: {
        id: 'user',
        title: 'Informations Utilisateur',
        subtitle: '👤 Informations personnelles',
        icon: <FaUser />,
        style: { background: 'var(--gradient-primary-dark)', border: '1px solid rgba(79, 70, 229, 0.2)', boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)' }
    },
    account: {
        id: 'account',
        title: 'Compte Email',
        subtitle: '📧 Détails du compte',
        icon: <FaEnvelope />,
        style: { background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', border: '1px solid rgba(14, 165, 233, 0.2)', boxShadow: '0 2px 8px rgba(14, 165, 233, 0.2)' }
    },
    emails: {
        id: 'emails',
        title: 'Emails Configurés',
        subtitle: '📬 Adresses email',
        icon: <FaEnvelope />,
        style: { background: 'linear-gradient(135deg, var(--color-secondary), #A78BFA)', border: '1px solid rgba(139, 92, 246, 0.2)', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.2)' }
    },
    security: {
        id: 'security',
        title: 'Sécurité & Mots de passe',
        subtitle: '🔒 Accès et mots de passe',
        icon: <FaLock />,
        style: { background: 'linear-gradient(135deg, var(--color-warning), #FBBF24)', border: '1px solid rgba(245, 158, 11, 0.2)', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)' }
    }
};

function SectionHeader({ section }) {
    return (
        <div className="details-section-header" style={section.style}>
            <div className="section-icon-wrapper mail-modal-section-icon" aria-hidden="true">
                {section.icon}
            </div>
            <div className="d-flex flex-column">
                <h3 className="details-section-title mail-modal-section-title">
                    {section.title}
                </h3>
                <span className="mail-modal-section-subtitle">
                    {section.subtitle}
                </span>
            </div>
            <div className="ms-auto">
                <span className="section-badge">
                    {section.id}
                </span>
            </div>
        </div>
    );
}

function VerifiedPill({ verified }) {
    return (
        <span className={`mail-modal-pill ${verified ? 'mail-modal-pill--verified' : 'mail-modal-pill--unverified'}`}>
            {verified ? '✓ VÉRIFIÉ' : 'NON VÉRIFIÉ'}
        </span>
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
    const otherEmailsWithPasswords = otherEmails.filter(e => getMailPassword(e) || getLoginPassword(e));

    const footer = (
        <>
            <button type="button" onClick={() => setShowAddEmailModal(true)} className="add-modal-submit-btn mail-modal-btn-success">
                <FaPlus aria-hidden="true" /> Ajouter un email
            </button>
            <button type="button" onClick={handleClose} className="add-modal-cancel-btn mail-modal-btn-close">
                Fermer
            </button>
        </>
    );

    return (
        <>
            <AppModal
                show={show}
                onClose={handleClose}
                contentClassName="mail-modal mail-modal--details add-modal-details-content large-modal"
                headerBg="linear-gradient(135deg, var(--color-text-main), var(--color-text-strong))"
                icon={<FaEnvelopeOpenText />}
                title="Détails Email"
                subtitle={`Matricule n° ${mailData.id_n ?? 'N/A'}`}
                footer={footer}
            >
                <div className="details-section mail-modal-section">
                    <SectionHeader section={SECTIONS.user} />
                    <div className="mail-modal-info-grid">
                        <InfoCard icon={FaUser} label="Utilisateur" value={mailData.materiel?.utilisateur} />
                        <InfoCard icon={FaUsers} label="Équipe" value={mailData.materiel?.equipe} />
                        <InfoCard icon={FaMapMarkerAlt} label="Local" value={mailData.materiel?.local?.nom_local} />
                        <InfoCard icon={FaMapMarkerAlt} label="Salle" value={mailData.materiel?.salle} />
                        <InfoCard icon={FaCalendarAlt} label="Date de création" value={formatDate(mailData.createdAt)} />
                    </div>
                </div>

                <div className="details-section mail-modal-section">
                    <SectionHeader section={SECTIONS.account} />
                    <div className="mail-modal-info-grid">
                        <InfoCard icon={FaHashtag} label="ID Utilisateur" value={mailData.id_user} />
                        <InfoCard
                            icon={FaShieldAlt}
                            label="Rôle"
                            value={roleLabels[mailData.role] || mailData.role}
                            badge={{
                                text: mailData.is_active ? 'Actif' : 'Désactivé',
                                className: mailData.is_active ? 'bg-success' : 'bg-danger'
                            }}
                        />
                        <InfoCard
                            icon={FaEnvelope}
                            label="Total Emails"
                            value={`${emails.length} email${emails.length > 1 ? 's' : ''}`}
                            badge={{
                                text: `${verifiedCount} vérifié${verifiedCount > 1 ? 's' : ''}`,
                                className: 'mail-modal-badge--info'
                            }}
                        />
                    </div>
                </div>

                {emails.length > 0 && (
                    <div className="details-section mail-modal-section">
                        <SectionHeader section={SECTIONS.emails} />
                        {primaryEmail && (
                            <div className="mail-modal-primary-email">
                                <div className="mail-modal-email-line">
                                    <FaEnvelope className="mail-modal-email-icon" aria-hidden="true" />
                                    <span className="mail-modal-email-address">
                                        {primaryEmail.email}
                                    </span>
                                    <span className="mail-modal-pill mail-modal-pill--primary">PRINCIPAL</span>
                                    <VerifiedPill verified={primaryEmail.is_verified} />
                                </div>
                            </div>
                        )}
                        {otherEmails.length > 0 && (
                            <div className="mail-modal-collapse">
                                <button
                                    type="button"
                                    className="mail-modal-collapse-toggle"
                                    onClick={() => setExpandedEmails(prev => !prev)}
                                    aria-expanded={expandedEmails}
                                >
                                    <span>Autres adresses ({otherEmails.length})</span>
                                    {expandedEmails
                                        ? <FaChevronUp className="mail-modal-collapse-chevron" aria-hidden="true" />
                                        : <FaChevronDown className="mail-modal-collapse-chevron" aria-hidden="true" />}
                                </button>
                                {expandedEmails && (
                                    <div className="mail-modal-collapse-body">
                                        {otherEmails.map((email, idx) => (
                                            <div key={email.id_uEmail || idx} className="mail-modal-collapse-row">
                                                <FaEnvelope className="mail-modal-collapse-row-icon" aria-hidden="true" />
                                                <span className="mail-modal-email-address mail-modal-email-address--secondary">
                                                    {email.email}
                                                </span>
                                                <VerifiedPill verified={email.is_verified} />
                                                <button
                                                    type="button"
                                                    className="btn-icon btn-icon--primary"
                                                    onClick={() => { setEditingEmail(email); setShowAddEmailModal(true); }}
                                                    title="Modifier cet email"
                                                    aria-label="Modifier cet email"
                                                >
                                                    <FaEdit size={14} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(getMailPassword(primaryEmail) || getLoginPassword(primaryEmail) || otherEmailsWithPasswords.length > 0) && (
                    <div className="details-section mail-modal-section">
                        <SectionHeader section={SECTIONS.security} />
                        <div className="mail-modal-stack">
                            {primaryEmail && getLoginPassword(primaryEmail) && (
                                <PasswordField
                                    label="Mot de passe de Connexion"
                                    value={getLoginPassword(primaryEmail)}
                                    visible={visiblePasswords['primary-password_enc'] || false}
                                    onToggle={togglePassword}
                                    toggleKey="primary-password_enc"
                                    badge={PASSWORD_BADGE}
                                />
                            )}
                            {primaryEmail && getMailPassword(primaryEmail) && (
                                <PasswordField
                                    label="Mot de passe Principal Mail"
                                    value={getMailPassword(primaryEmail)}
                                    visible={visiblePasswords['primary-pass_mail'] || false}
                                    onToggle={togglePassword}
                                    toggleKey="primary-pass_mail"
                                    badge={PASS_MAIL_BADGE}
                                />
                            )}
                            {otherEmailsWithPasswords.length > 0 && (
                                <div className="mail-modal-collapse">
                                    <button
                                        type="button"
                                        className="mail-modal-collapse-toggle"
                                        onClick={() => setExpandedPasswords(prev => !prev)}
                                        aria-expanded={expandedPasswords}
                                    >
                                        <span>Mots de passe secondaires ({otherEmailsWithPasswords.length})</span>
                                        {expandedPasswords
                                            ? <FaChevronUp className="mail-modal-collapse-chevron" aria-hidden="true" />
                                            : <FaChevronDown className="mail-modal-collapse-chevron" aria-hidden="true" />}
                                    </button>
                                    {expandedPasswords && (
                                        <div className="mail-modal-collapse-body mail-modal-stack">
                                            {otherEmails.map((email, index) => (
                                                <div key={email.id_uEmail || index} className="mail-modal-stack">
                                                    {getLoginPassword(email) && (
                                                        <PasswordField
                                                            label={`Mot de passe de Connexion ${index + 1}`}
                                                            value={getLoginPassword(email)}
                                                            visible={visiblePasswords[`secondary-${index}-password_enc`] || false}
                                                            onToggle={togglePassword}
                                                            toggleKey={`secondary-${index}-password_enc`}
                                                            badge={PASSWORD_BADGE}
                                                        />
                                                    )}
                                                    {getMailPassword(email) && (
                                                        <PasswordField
                                                            label={`Mot de passe Secondaire Mail ${index + 1}`}
                                                            value={getMailPassword(email)}
                                                            visible={visiblePasswords[`secondary-${index}-pass_mail`] || false}
                                                            onToggle={togglePassword}
                                                            toggleKey={`secondary-${index}-pass_mail`}
                                                            badge={PASS_MAIL_BADGE}
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
            </AppModal>

            <EditEmailModal
                show={showAddEmailModal}
                handleClose={() => { setShowAddEmailModal(false); setEditingEmail(null); }}
                userData={mailData}
                emailData={editingEmail}
                onSaved={handleEmailAdded}
            />
        </>
    );
}

export default DetailsMailModal;
