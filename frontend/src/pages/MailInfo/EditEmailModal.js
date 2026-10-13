import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaPlus, FaEdit, FaShieldAlt, FaCheck } from 'react-icons/fa';
import { addUserEmail, updateUserEmail } from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
import '../../styles/DetailsSection.css';
import './MailModals.css';

function EmailFormFields({ formData, handleChange, disabled, mode }) {
    return (
        <>
            <div className="add-modal-form-group">
                <label className="add-modal-label">
                    <FaEnvelope className="mail-modal-accent-icon" aria-hidden="true" /> Adresse Email
                </label>
                <input
                    type="email"
                    className="add-modal-input"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="exemple@domaine.com"
                    required
                    disabled={disabled}
                />
            </div>

            <div className="add-modal-form-group">
                <label className="add-modal-label">
                    <FaLock className="mail-modal-accent-icon" aria-hidden="true" /> Mot de passe compte
                </label>
                <input
                    type="text"
                    className="add-modal-input"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mot de passe du compte"
                    disabled={disabled}
                    autoComplete="off"
                />
            </div>

            <div className="add-modal-form-group">
                <label className="add-modal-label">
                    <FaLock className="mail-modal-accent-icon" aria-hidden="true" /> Mot de passe messagerie
                </label>
                <input
                    type="text"
                    className="add-modal-input"
                    name="pass_mail"
                    value={formData.pass_mail}
                    onChange={handleChange}
                    placeholder="Mot de passe messagerie"
                    disabled={disabled}
                />
            </div>

            <div className="add-modal-form-group">
                <label className="add-modal-label">
                    <FaShieldAlt className="mail-modal-accent-icon" aria-hidden="true" /> Options
                </label>
                <div className="mail-modal-options">
                    <label className="mail-modal-option">
                        <input
                            type="checkbox"
                            name="is_primary"
                            checked={formData.is_primary}
                            onChange={handleChange}
                            disabled={disabled}
                        />
                        <FaShieldAlt className="mail-modal-option-primary" aria-hidden="true" /> Email principal
                    </label>
                    <label className="mail-modal-option">
                        <input
                            type="checkbox"
                            name="is_verified"
                            checked={formData.is_verified}
                            onChange={handleChange}
                            disabled={disabled}
                        />
                        <FaCheck className="mail-modal-option-verified" aria-hidden="true" /> Vérifié
                    </label>
                </div>
            </div>
        </>
    );
}

function EditEmailModal({ show, handleClose, userData, emailData, onSaved }) {
    const isEdit = !!emailData;
    const [formData, setFormData] = useState({
        user_id: '',
        email: '',
        password: '',
        pass_mail: '',
        is_primary: false,
        is_verified: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (userData) {
            setFormData(prev => ({ ...prev, user_id: userData.id_user || '' }));
        }
        if (emailData) {
            setFormData({
                user_id: emailData.user_id || userData?.id_user || '',
                email: emailData.email || '',
                password: emailData.password_enc || '',
                pass_mail: emailData.pass_mail || '',
                is_primary: emailData.is_primary || false,
                is_verified: emailData.is_verified || false
            });
        } else {
            setFormData({
                user_id: userData?.id_user || '',
                email: '',
                password: '',
                pass_mail: '',
                is_primary: false,
                is_verified: false
            });
        }
        setError(null);
        setSuccess(false);
    }, [show, userData, emailData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (!formData.email || !formData.email.trim()) {
                throw new Error("L'adresse email est requise.");
            }

            const payload = {
                user_id: parseInt(formData.user_id),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                pass_mail: formData.pass_mail,
                is_primary: formData.is_primary,
                is_verified: formData.is_verified
            };

            if (isEdit && emailData?.id_uEmail) {
                await updateUserEmail(emailData.id_uEmail, payload);
            } else {
                await addUserEmail(payload);
            }

            setSuccess(true);
            setTimeout(() => {
                handleClose();
                if (onSaved) {
                    onSaved();
                }
            }, 1500);
        } catch (err) {
            const message = err.message || "Erreur lors de l'enregistrement de l'email.";
            setError(message);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: message,
                confirmButtonText: 'OK'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setFormData({
            user_id: userData?.id_user || '',
            email: '',
            password: '',
            pass_mail: '',
            is_primary: false,
            is_verified: false
        });
        setError(null);
        setSuccess(false);
        handleClose();
    };

    if (!show || !userData) return null;

    const footer = (
        <>
            <button type="button" onClick={handleCloseModal} className="add-modal-cancel-btn" disabled={loading}>
                Annuler
            </button>
            <button type="submit" className="add-modal-submit-btn" disabled={loading}>
                {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Enregistrement...</>
                ) : (
                    isEdit ? <><FaEdit aria-hidden="true" /> Enregistrer</> : <><FaPlus aria-hidden="true" /> Ajouter l'email</>
                )}
            </button>
        </>
    );

    return (
        <AppModal
            show={show}
            onClose={handleCloseModal}
            nested
            size="md"
            as="form"
            onSubmit={handleSubmit}
            contentClassName="mail-modal"
            headerBg={isEdit ? 'linear-gradient(135deg, var(--color-warning) 0%, #fbbf24 100%)' : undefined}
            icon={isEdit ? <FaEdit /> : <FaPlus />}
            title={isEdit ? 'Modifier un email' : 'Ajouter un email'}
            subtitle={userData.materiel?.utilisateur || 'cet utilisateur'}
            footer={footer}
        >
            {loading && (
                <div className="mail-modal-alert mail-modal-alert--loading" role="status">
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                    Traitement en cours...
                </div>
            )}
            {error && (
                <div className="mail-modal-alert mail-modal-alert--error" role="alert">
                    <FaShieldAlt aria-hidden="true" /> {error}
                </div>
            )}
            {success && (
                <div className="mail-modal-alert mail-modal-alert--success" role="status">
                    <FaCheck aria-hidden="true" /> {isEdit ? 'Modifié' : 'Ajouté'} avec succès !
                </div>
            )}

            <div className="details-section mail-modal-section mail-modal-section--roomy">
                <div className="details-section-header" style={isEdit ? {
                    background: 'linear-gradient(135deg, var(--color-warning), #fbbf24)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.2)'
                } : {
                    background: 'var(--gradient-primary)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.2)'
                }}>
                    <div className="section-icon-wrapper mail-modal-section-icon" aria-hidden="true">
                        <FaEnvelope />
                    </div>
                    <div className="d-flex flex-column">
                        <h3 className="details-section-title mail-modal-section-title">
                            {isEdit ? 'Modifier l\'email' : 'Nouvel email'}
                        </h3>
                        <span className="mail-modal-section-subtitle">
                            📧 {isEdit ? 'Mettez à jour les informations' : 'Ajoutez une nouvelle adresse email'}
                        </span>
                    </div>
                </div>

                <EmailFormFields
                    formData={formData}
                    handleChange={handleChange}
                    disabled={loading}
                    mode={isEdit ? 'edit' : 'add'}
                />
            </div>
        </AppModal>
    );
}

export default EditEmailModal;
