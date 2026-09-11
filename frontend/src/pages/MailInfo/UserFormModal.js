import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    FaUser, FaEdit, FaQrcode, FaUsers, FaEnvelope, FaLock, FaTimes,
    FaCheck, FaShieldAlt, FaEnvelopeOpenText, FaPlus
} from 'react-icons/fa';
import { addUser, updateUser } from '../../services/api';
import { ROLES } from '../../config/api';
import './Mail.css';
import '../Materiels/Materiels.css';

function EmailSection({ title, subtitle, color, gradient, icon, index, emails, updateEmail, isDisabled, headerAction }) {
    const email = emails?.[index] || {};
    const verifiedColor = email?.is_verified ? '#15803d' : '#b45309';

    return (
        <div className="details-section" style={{
            background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0',
            position: 'relative'
        }}>
            <div className="details-section-header" style={{
                background: gradient, border: `1px solid ${color}40`, borderRadius: '12px', padding: '10px 18px',
                marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '14px',
                boxShadow: `0 2px 8px ${color}40`
            }}>
                <div className="section-icon-wrapper" style={{
                    background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: '40px', height: '40px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white'
                }}>
                    {icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 className="details-section-title" style={{
                        color: 'white', fontSize: '0.95rem', fontWeight: '600', margin: 0, letterSpacing: '0.5px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                        {title}
                    </h3>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', fontWeight: '400' }}>
                        {subtitle}
                    </span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '2px 12px',
                        color: 'white', fontSize: '0.65rem', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase'
                    }}>
                        {index === 0 ? 'Principal' : `Supplémentaire ${index}`}
                    </span>
                    {headerAction}
                </div>
            </div>

            <div className="add-modal-form-grid">
                <div className="add-modal-form-group">
                    <label className="add-modal-label">
                        <FaEnvelope style={{ color }} /> {index === 0 ? 'Email Principal' : `Email Supplémentaire ${index}`}
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
                        <FaLock style={{ color }} /> Mot de passe compte
                    </label>
                    <input
                        type="text"
                        className="add-modal-input"
                        value={email?.password || email?.pass_mail || ''}
                        onChange={e => updateEmail(index, 'password', e.target.value)}
                        disabled={isDisabled}
                        placeholder="Mot de passe compte"
                    />
                </div>
                <div className="add-modal-form-group">
                    <label className="add-modal-label">
                        <FaLock style={{ color }} /> Mot de passe messagerie
                    </label>
                    <input
                        type="text"
                        className="add-modal-input"
                        value={email?.pass_mail || (email?.password && /^\$2[ab]?\$/.test(email?.password) ? email.password : '') || ''}
                        onChange={e => updateEmail(index, 'pass_mail', e.target.value)}
                        disabled={isDisabled}
                        placeholder="Mot de passe messagerie"
                    />
                </div>
                <div className="add-modal-form-group d-flex align-items-end">
                    <label className="add-modal-label d-flex align-items-center gap-2" style={{ cursor: 'pointer', marginBottom: '8px' }}>
                        <input
                            type="checkbox"
                            checked={email?.is_verified || false}
                            onChange={e => updateEmail(index, 'is_verified', e.target.checked)}
                            disabled={isDisabled}
                        />
                        <span style={{ color: verifiedColor, fontWeight: 600 }}>Vérifié</span>
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
                    password: '',
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
    }, [show, mode, userData]);

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

    const headerGradient = isEdit
        ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
                maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                <div className="add-modal-header" style={{
                    background: headerGradient, borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}>
                            {isEdit ? <FaEdit style={{ color: 'white' }} /> : <FaUser style={{ color: 'white' }} />}
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>
                                {isEdit ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
                            </h2>
                            <p className="add-modal-subtitle" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
                                {isEdit ? 'Modifiez les informations ci-dessous' : 'Remplissez les informations ci-dessous'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button type="button" onClick={handleClose} className="add-modal-close-btn" style={{
                            background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="add-modal-body">
                    {errorMessage && (
                        <div className="add-modal-error" style={{
                            marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <FaShieldAlt style={{ color: '#ef4444' }} />
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <div className="details-section-header" style={{
                                background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                                border: '1px solid rgba(79,70,229,0.2)', borderRadius: '12px', padding: '10px 18px',
                                marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '14px',
                                boxShadow: '0 2px 8px rgba(79,70,229,0.2)'
                            }}>
                                <div className="section-icon-wrapper" style={{
                                    background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: '40px', height: '40px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white'
                                }}>
                                    <FaUser />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 className="details-section-title" style={{
                                        color: 'white', fontSize: '0.95rem', fontWeight: '600', margin: 0, letterSpacing: '0.5px',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}>
                                        Informations Générales
                                    </h3>
                                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', fontWeight: '400' }}>
                                        👤 Matériel, rôle et statut
                                    </span>
                                </div>
                            </div>

                            <div className="add-modal-form-grid">
                                <div className="add-modal-form-group">
                                    <label className="add-modal-label">
                                        <FaQrcode /> Associer au Matériel (ID_N)
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
                                    <div className="form-text" style={{ color: '#6366f1', fontSize: '0.8rem', marginTop: '4px' }}>
                                        {isEdit ? 'Le matériel ne peut pas être modifié.' : 'Recherchez l\'identifiant correspondant à cet utilisateur.'}
                                    </div>
                                </div>
                                <div className="add-modal-form-group">
                                    <label className="add-modal-label">
                                        <FaUsers /> Rôle
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
                                    <div className="d-flex align-items-center gap-3" style={{ marginTop: '8px' }}>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} disabled={isDisabled} style={{ opacity: 0, width: 0, height: 0 }} />
                                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: form.is_active === false ? '#ef4444' : '#22c55e', transition: '0.3s', borderRadius: '26px' }}></span>
                                            <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: form.is_active === false ? '24px' : '4px', bottom: '3px', backgroundColor: 'white', transition: '0.3s', borderRadius: '50%' }}></span>
                                        </label>
                                        <span className="fw-medium" style={{ fontSize: '0.9rem', color: form.is_active === false ? '#ef4444' : '#22c55e' }}>
                                            {form.is_active === false ? 'Désactivé' : 'Actif'}
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
                                gradient={index === 0 ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)' : 'linear-gradient(135deg, #0EA5E9, #38BDF8)'}
                                icon={index === 0 ? <FaEnvelope /> : <FaEnvelopeOpenText />}
                                index={index}
                                emails={form.emails}
                                updateEmail={updateEmail}
                                isDisabled={isDisabled}
                                headerAction={
                                    <button
                                        type="button"
                                        onClick={() => removeEmail(index)}
                                        disabled={isDisabled || (form.emails || []).length <= 1}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            color: 'white',
                                            border: '1px solid rgba(255, 255, 255, 0.3)',
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: (isDisabled || (form.emails || []).length <= 1) ? 'not-allowed' : 'pointer',
                                            opacity: (isDisabled || (form.emails || []).length <= 1) ? 0.5 : 1,
                                            transition: 'all 0.2s ease'
                                        }}
                                        title="Supprimer cet email"
                                    >
                                        <FaTimes size={12} />
                                    </button>
                                }
                            />
                        ))}

                        {!isEdit && (
                            <button
                                type="button"
                                onClick={addEmail}
                                disabled={isDisabled}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    opacity: isDisabled ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    marginBottom: '20px',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                                }}
                            >
                                <FaPlus size={14} />
                                Ajouter un email
                            </button>
                        )}

                        <div className="add-modal-footer">
                            <button type="button" onClick={handleClose} className="add-modal-cancel-btn" disabled={submitting}>
                                Annuler
                            </button>
                            <button type="submit" className="add-modal-submit-btn" disabled={submitting}>
                                {submitting ? (
                                    <><span className="spinner-border spinner-border-sm me-2" />Enregistrement...</>
                                ) : (
                                    isEdit ? <><FaEdit /> Enregistrer les modifications</> : <><FaUser /> Ajouter l'utilisateur</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default UserFormModal;
