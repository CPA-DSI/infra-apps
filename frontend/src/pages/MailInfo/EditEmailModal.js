import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaPlus, FaEdit, FaTimes, FaShieldAlt, FaCheck } from 'react-icons/fa';
import { apiClient } from '../../services/api';

function EmailFormFields({ formData, handleChange, disabled, mode }) {
    return (
        <>
            <div className="add-modal-form-group">
                <label className="add-modal-label">
                    <FaEnvelope style={{ color: '#6366f1' }} /> Adresse Email
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
                    <FaLock style={{ color: '#6366f1' }} /> Mot de passe compte
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
                    <FaLock style={{ color: '#6366f1' }} /> Mot de passe messagerie
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
                    <FaShieldAlt style={{ color: '#6366f1' }} /> Options
                </label>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}>
                        <input
                            type="checkbox"
                            name="is_primary"
                            checked={formData.is_primary}
                            onChange={handleChange}
                            disabled={disabled}
                            style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                        <FaShieldAlt style={{ color: '#8B5CF6' }} /> Email principal
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}>
                        <input
                            type="checkbox"
                            name="is_verified"
                            checked={formData.is_verified}
                            onChange={handleChange}
                            disabled={disabled}
                            style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                        <FaCheck style={{ color: '#22c55e' }} /> Vérifié
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
                password: emailData.password || '',
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
                await apiClient.put(`/user-emails/${emailData.id_uEmail}`, payload);
            } else {
                await apiClient.post('/user-emails', payload);
            }

            setSuccess(true);
            setTimeout(() => {
                handleClose();
                if (onSaved) {
                    onSaved();
                }
            }, 1500);
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement de l'email.";
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

    const headerGradient = isEdit
        ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
                maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px',
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
                            {isEdit ? <FaEdit style={{ color: 'white' }} /> : <FaPlus style={{ color: 'white' }} />}
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>
                                {isEdit ? 'Modifier un email' : 'Ajouter un email'}
                            </h2>
                            <p className="add-modal-subtitle" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
                                {userData.materiel?.utilisateur || 'cet utilisateur'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={handleCloseModal} className="add-modal-close-btn" style={{
                        background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
                    }}>
                        <FaTimes />
                    </button>
                </div>

                <div className="add-modal-body">
                    {loading && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1' }}>
                            <span className="spinner-border spinner-border-sm" />
                            Traitement en cours...
                        </div>
                    )}
                    {error && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                            <FaShieldAlt /> {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34,197,94,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}>
                            <FaCheck /> {isEdit ? 'Modifié' : 'Ajouté'} avec succès !
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="details-section" style={{
                            background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0'
                        }}>
                            <div className="details-section-header" style={{
                                background: isEdit ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: `1px solid ${isEdit ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
                                borderRadius: '12px', padding: '10px 18px', marginBottom: '18px',
                                display: 'flex', alignItems: 'center', gap: '14px',
                                boxShadow: `0 2px 8px ${isEdit ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`
                            }}>
                                <div className="section-icon-wrapper" style={{
                                    background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: '40px', height: '40px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white'
                                }}>
                                    <FaEnvelope />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 className="details-section-title" style={{
                                        color: 'white', fontSize: '0.95rem', fontWeight: '600', margin: 0, letterSpacing: '0.5px',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}>
                                        {isEdit ? 'Modifier l\'email' : 'Nouvel email'}
                                    </h3>
                                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', fontWeight: '400' }}>
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

                        <div className="add-modal-footer">
                            <button type="button" onClick={handleCloseModal} className="add-modal-cancel-btn" disabled={loading}>
                                Annuler
                            </button>
                            <button type="submit" className="add-modal-submit-btn" disabled={loading}>
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm me-2" />Enregistrement...</>
                                ) : (
                                    isEdit ? <><FaEdit /> Enregistrer</> : <><FaPlus /> Ajouter l'email</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default EditEmailModal;
