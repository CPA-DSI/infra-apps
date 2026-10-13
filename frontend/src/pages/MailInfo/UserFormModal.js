import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    FaUser, FaEdit, FaQrcode, FaUsers, FaEnvelope, FaLock, FaTimes,
    FaShieldAlt, FaEnvelopeOpenText, FaPlus
} from 'react-icons/fa';
import { addUser, updateUser } from '../../services/api';
import { ROLES } from '../../config/api';
import AppModal from '../../components/AppModal/AppModal';
import '../../styles/DetailsSection.css';
import './MailModals.css';

function EmailSection({ title, subtitle, color, gradient, icon, index, emails, updateEmail, isDisabled, headerAction }) {
    const email = emails?.[index] || {};

    return (
        <div className="details-section mail-modal-section mail-modal-section--roomy" style={{ '--mail-section-accent': color }}>
            <div className="details-section-header" style={{
                background: gradient, border: `1px solid ${color}40`, boxShadow: `0 2px 8px ${color}40`
            }}>
                <div className="section-icon-wrapper mail-modal-section-icon" aria-hidden="true">
                    {icon}
                </div>
                <div className="d-flex flex-column">
                    <h3 className="details-section-title mail-modal-section-title">
                        {title}
                    </h3>
                    <span className="mail-modal-section-subtitle">
                        {subtitle}
                    </span>
                </div>
                <div className="mail-modal-section-actions">
                    <span className="section-badge">
                        {index === 0 ? 'Principal' : `Supplémentaire ${index}`}
                    </span>
                    {headerAction}
                </div>
            </div>

            <div className="add-modal-form-grid">
                <div className="add-modal-form-group">
                    <label className="add-modal-label">
                        <FaEnvelope className="mail-modal-accent-icon" aria-hidden="true" /> {index === 0 ? 'Email Principal' : `Email Supplémentaire ${index}`}
                    </label>
                    <input
                        type="text"
                        className="add-modal-input"
                        value={email?.email || ''}
                        onChange={e => updateEmail(index, 'email', e.target.value)}
                        disabled={isDisabled}
                        placeholder={index === 0 ? 'Entrez l\'email principal' : 'Entrez l\'email secondaire'}
                    />
                </div>
                <div className="add-modal-form-group">
                    <label className="add-modal-label">
                        <FaLock className="mail-modal-accent-icon" aria-hidden="true" /> Mot de passe compte
                    </label>
                    <input
                        type="text"
                        className="add-modal-input"
                        value={email?.password || ''}
                        onChange={e => updateEmail(index, 'password', e.target.value)}
                        disabled={isDisabled}
                        placeholder="Mot de passe compte"
                    />
                </div>
                <div className="add-modal-form-group">
                    <label className="add-modal-label">
                        <FaLock className="mail-modal-accent-icon" aria-hidden="true" /> Mot de passe messagerie
                    </label>
                    <input
                        type="text"
                        className="add-modal-input"
                        value={email?.pass_mail || ''}
                        onChange={e => updateEmail(index, 'pass_mail', e.target.value)}
                        disabled={isDisabled}
                        placeholder="Mot de passe messagerie"
                    />
                </div>
                <div className="add-modal-form-group d-flex align-items-end">
                    <label className="add-modal-label d-flex align-items-center gap-2 mail-modal-verified-toggle">
                        <input
                            type="checkbox"
                            checked={email?.is_verified || false}
                            onChange={e => updateEmail(index, 'is_verified', e.target.checked)}
                            disabled={isDisabled}
                        />
                        <span className={`mail-modal-verified-text ${email?.is_verified ? 'is-verified' : ''}`}>Vérifié</span>
                    </label>
                </div>
            </div>
        </div>
    );
}

function UserFormModal({ show, handleClose, mode, userData, availableMateriels, onSaved }) {
    const [form, setForm] = useState({
        id_user: null,
        id_n: '',
        role: 'USER',
        is_active: true,
        emails: [
            { email: '', pass_mail: '', password: '', is_primary: true, is_verified: false },
            { email: '', pass_mail: '', password: '', is_primary: false, is_verified: false }
        ],
        materiel: { utilisateur: '', equipe: '' }
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [isDisabled, setIsDisabled] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isEdit = mode === 'edit';

    useEffect(() => {
        if (isEdit && userData) {
            const normalizedEmails = Array.isArray(userData.emails) ? userData.emails : [];
            const emails = normalizedEmails.length > 0
                ? normalizedEmails.map(e => ({
                    email: e.email || '',
                    pass_mail: e.pass_mail || '',
                    password: e.password_enc || '',
                    is_primary: e.is_primary || false,
                    is_verified: e.is_verified || false
                }))
                : [
                    { email: '', pass_mail: '', password: '', is_primary: true, is_verified: false },
                    { email: '', pass_mail: '', password: '', is_primary: false, is_verified: false }
                ];
            setForm({
                id_user: userData.id_user || null,
                id_n: userData.id_n || '',
                role: userData.role || 'USER',
                is_active: userData.is_active !== false,
                emails,
                materiel: userData.materiel || { utilisateur: '', equipe: '' }
            });
            setIsDisabled(false);
        } else if (!isEdit) {
            resetForm();
        }
    }, [show, mode, userData, isEdit]);

    const resetForm = () => {
        setForm({
            id_user: null,
            id_n: '',
            role: 'USER',
            is_active: true,
            emails: [
                { email: '', pass_mail: '', password: '', is_primary: true, is_verified: false },
                { email: '', pass_mail: '', password: '', is_primary: false, is_verified: false }
            ],
            materiel: { utilisateur: '', equipe: '' }
        });
        setErrorMessage('');
        setIsDisabled(false);
    };

    const handleSelectMateriel = (e) => {
        const selectedValue = e.target.value;
        if (!selectedValue) {
            setForm(prev => ({ ...prev, id_n: '', materiel: null }));
            setErrorMessage('');
            setIsDisabled(false);
            return;
        }
        const selectedId = parseInt(selectedValue);
        setForm(prev => ({ ...prev, id_n: selectedId }));
        setErrorMessage('');
        setIsDisabled(false);
    };

    const updateEmail = (index, field, value) => {
        setForm(prev => {
            const newEmails = [...(prev.emails || [])];
            if (!newEmails[index]) {
                newEmails[index] = { is_primary: index === 0, is_verified: false };
            }
            newEmails[index] = { ...newEmails[index], [field]: value };
            return { ...prev, emails: newEmails };
        });
    };

    const addEmail = () => {
        setForm(prev => ({
            ...prev,
            emails: [...prev.emails, { email: '', pass_mail: '', password: '', is_primary: false, is_verified: false }]
        }));
    };

    const removeEmail = (index) => {
        setForm(prev => {
            if (prev.emails.length <= 1) return prev;
            const newEmails = prev.emails.filter((_, i) => i !== index);
            if (newEmails.length > 0 && !newEmails.some(e => e.is_primary)) {
                newEmails[0].is_primary = true;
            }
            return { ...prev, emails: newEmails };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage('');

        try {
            const { materiel, ...dataToSend } = form;
            const emails = (form.emails || []).filter(e => e.email && e.email.trim());

            if (emails.length === 0) {
                throw new Error('Veuillez ajouter au moins un email.');
            }

            const primaryEmail = emails.find(e => e.is_primary) || emails[0];

            if (isEdit) {
                const payload = {
                    id_user: form.id_user,
                    id_n: Number(form.id_n),
                    role: form.role,
                    is_active: form.is_active,
                    emails: emails.map(e => ({
                        email: e.email.trim(),
                        pass_mail: e.pass_mail || '',
                        password: e.password || '',
                        is_primary: e.is_primary,
                        is_verified: e.is_verified
                    }))
                };

                if (primaryEmail?.password && primaryEmail.password.trim() !== '' && !primaryEmail.password.trim().startsWith('$2b$')) {
                    payload.password_1 = primaryEmail.password.trim();
                }

                await updateUser(form.id_user, payload);

                Swal.fire({
                    icon: 'success',
                    title: 'Modification réussie !',
                    text: 'Les informations de l\'utilisateur ont été mises à jour.',
                    timer: 3000, showConfirmButton: false, toast: true, position: 'top-end'
                });
            } else {
                const cleanData = {
                    ...dataToSend,
                    id_n: Number(dataToSend.id_n),
                    emails: emails.map(e => ({
                        email: e.email.trim(),
                        pass_mail: e.pass_mail || '',
                        password: e.password || ''
                    }))
                };

                if (!cleanData.id_n || isNaN(cleanData.id_n)) {
                    throw new Error('Veuillez sélectionner un matériel valide');
                }

                await addUser(cleanData);

                Swal.fire({
                    icon: 'success',
                    title: 'Ajout réussi !',
                    text: 'L\'utilisateur a été ajouté avec succès.',
                    timer: 3000, showConfirmButton: false, toast: true, position: 'top-end'
                });
            }

            if (onSaved) onSaved();
            handleClose();
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message || 'Une erreur est survenue.');
            Swal.fire({
                icon: 'error',
                title: isEdit ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout',
                text: error.message || 'Une erreur est survenue.',
                confirmButtonText: 'OK'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!show) return null;

    const isInactive = form.is_active === false;
    const emailCount = (form.emails || []).length;

    const footer = (
        <>
            <button type="button" onClick={handleClose} className="add-modal-cancel-btn" disabled={submitting}>
                Annuler
            </button>
            <button type="submit" className="add-modal-submit-btn" disabled={submitting}>
                {submitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Enregistrement...</>
                ) : (
                    isEdit ? <><FaEdit aria-hidden="true" /> Enregistrer les modifications</> : <><FaUser aria-hidden="true" /> Ajouter l'utilisateur</>
                )}
            </button>
        </>
    );

    return (
        <AppModal
            show={show}
            onClose={handleClose}
            as="form"
            onSubmit={handleSubmit}
            contentClassName="mail-modal mail-modal--wide"
            headerBg={isEdit ? 'linear-gradient(135deg, var(--color-warning) 0%, #fbbf24 100%)' : undefined}
            icon={isEdit ? <FaEdit /> : <FaUser />}
            title={isEdit ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
            subtitle={isEdit ? 'Modifiez les informations ci-dessous' : 'Remplissez les informations ci-dessous'}
            footer={footer}
        >
            {errorMessage && (
                <div className="add-modal-error mail-modal-alert mail-modal-alert--error" role="alert">
                    <FaShieldAlt aria-hidden="true" />
                    {errorMessage}
                </div>
            )}

            <div className="details-section mail-modal-section mail-modal-section--roomy">
                <div className="details-section-header" style={{
                    background: 'var(--gradient-primary-dark)',
                    border: '1px solid rgba(79,70,229,0.2)',
                    boxShadow: '0 2px 8px rgba(79,70,229,0.2)'
                }}>
                    <div className="section-icon-wrapper mail-modal-section-icon" aria-hidden="true">
                        <FaUser />
                    </div>
                    <div className="d-flex flex-column">
                        <h3 className="details-section-title mail-modal-section-title">
                            Informations Générales
                        </h3>
                        <span className="mail-modal-section-subtitle">
                            👤 Matériel, rôle et statut
                        </span>
                    </div>
                </div>

                <div className="add-modal-form-grid">
                    <div className="add-modal-form-group">
                        <label className="add-modal-label">
                            <FaQrcode aria-hidden="true" /> Associer au Matériel (ID_N)
                        </label>
                        <select
                            className="add-modal-select"
                            value={form.id_n || ''}
                            onChange={handleSelectMateriel}
                            required
                            disabled={!isEdit ? false : true}
                        >
                            <option value="">Sélectionner...</option>
                            {availableMateriels.map(m => (
                                <option key={m.id_n} value={m.id_n}>
                                    N° {m.id_n} - {m.utilisateur || 'Sans nom'}
                                </option>
                            ))}
                        </select>
                        <div className="form-text mail-modal-hint">
                            {isEdit ? 'Le matériel ne peut pas être modifié.' : 'Recherchez l\'identifiant correspondant à cet utilisateur.'}
                        </div>
                    </div>
                    <div className="add-modal-form-group">
                        <label className="add-modal-label">
                            <FaUsers aria-hidden="true" /> Rôle
                        </label>
                        <select
                            className="add-modal-select"
                            value={form.role || 'USER'}
                            onChange={e => setForm({ ...form, role: e.target.value })}
                            disabled={isDisabled}
                        >
                            {Object.entries(ROLES).map(([value, { label }]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="add-modal-form-group">
                        <label className="add-modal-label">Statut</label>
                        <div className="d-flex align-items-center gap-3 mt-2">
                            <label className={`mail-modal-switch ${isInactive ? 'is-off' : ''}`}>
                                <input type="checkbox" checked={!isInactive} onChange={e => setForm({ ...form, is_active: e.target.checked })} disabled={isDisabled} aria-label="Compte actif" />
                                <span className="mail-modal-switch-track"></span>
                                <span className="mail-modal-switch-knob"></span>
                            </label>
                            <span className={`mail-modal-status-text fw-medium ${isInactive ? 'is-off' : ''}`}>
                                {isInactive ? 'Désactivé' : 'Actif'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {(form.emails || []).map((email, index) => (
                <EmailSection
                    key={index}
                    title={index === 0 ? 'Email Principal' : `Email Supplémentaire ${index}`}
                    subtitle={index === 0 ? 'Compte email principal de l\'utilisateur' : 'Compte email supplémentaire'}
                    color={index === 0 ? '#8B5CF6' : '#0EA5E9'}
                    gradient={index === 0 ? 'linear-gradient(135deg, var(--color-secondary), #A78BFA)' : 'linear-gradient(135deg, #0EA5E9, #38BDF8)'}
                    icon={index === 0 ? <FaEnvelope /> : <FaEnvelopeOpenText />}
                    index={index}
                    emails={form.emails}
                    updateEmail={updateEmail}
                    isDisabled={isDisabled}
                    headerAction={
                        <button
                            type="button"
                            className="mail-modal-section-remove"
                            onClick={() => removeEmail(index)}
                            disabled={isDisabled || emailCount <= 1}
                            title="Supprimer cet email"
                            aria-label="Supprimer cet email"
                        >
                            <FaTimes size={12} aria-hidden="true" />
                        </button>
                    }
                />
            ))}

            {!isEdit && (
                <button
                    type="button"
                    className="mail-modal-add-email"
                    onClick={addEmail}
                    disabled={isDisabled}
                >
                    <FaPlus size={14} aria-hidden="true" />
                    Ajouter un email
                </button>
            )}
        </AppModal>
    );
}

export default UserFormModal;
