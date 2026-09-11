import React, { useState } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { FaEnvelope, FaPlus, FaTimes, FaUser, FaLock, FaEnvelopeOpenText, FaShieldAlt, FaCheck } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { apiClient } from '../../services/api';
import './Mail.css';

function AddEmailModal({ show, handleClose, userData, onEmailAdded }) {
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

    React.useEffect(() => {
        if (userData) {
            setFormData(prev => ({
                ...prev,
                user_id: userData.id_user || ''
            }));
        }
    }, [userData]);

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

            const response = await apiClient.post('/user-emails', payload);
            setSuccess(true);
            setTimeout(() => {
                handleClose();
                if (onEmailAdded) {
                    onEmailAdded(response.data);
                }
            }, 1500);
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Erreur lors de l'ajout de l'email.";
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

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
                maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                <div className="add-modal-header" style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{
                            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
                        }}>
                            <FaEnvelopeOpenText style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>
                                Ajouter un email
                            </h2>
                            <p className="add-modal-subtitle" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
                                {userData.materiel?.utilisateur || 'cet utilisateur'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleCloseModal} className="add-modal-close-btn" type="button" style={{
                        background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
                    }}>
                        <FaTimes />
                    </button>
                </div>

                <div className="add-modal-body">
                    {loading && <Alert variant="info" className="d-flex align-items-center"><Spinner animation="border" size="sm" className="me-2" /> Ajout en cours...</Alert>}
                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">Email ajouté avec succès !</Alert>}

                    <form onSubmit={handleSubmit}>
                        <div className="add-modal-form-group">
                            <label className="add-modal-label">
                                <FaEnvelope style={{ color: '#6366f1' }} /> Email
                            </label>
                            <input
                                type="email"
                                className="add-modal-input"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="nouvel@email.com"
                                required
                                disabled={loading}
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
                                disabled={loading}
                                autoComplete="off"
                            />
                        </div>

                        <div className="add-modal-form-group">
                            <label className="add-modal-label">
                                <FaEnvelopeOpenText style={{ color: '#6366f1' }} /> Mot de passe messagerie
                            </label>
                            <input
                                type="text"
                                className="add-modal-input"
                                name="pass_mail"
                                value={formData.pass_mail}
                                onChange={handleChange}
                                placeholder="Mot de passe messagerie"
                                disabled={loading}
                            />
                        </div>

                        <div className="add-modal-form-group">
                            <label className="add-modal-label">
                                <FaUser style={{ color: '#6366f1' }} /> Options
                            </label>
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '4px 0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' }}>
                                    <input
                                        type="checkbox"
                                        name="is_primary"
                                        checked={formData.is_primary}
                                        onChange={handleChange}
                                        disabled={loading}
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
                                        disabled={loading}
                                        style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                                    />
                                    <FaCheck style={{ color: '#22c55e' }} /> Vérifié
                                </label>
                            </div>
                        </div>

                        <div className="add-modal-footer">
                            <button type="button" className="add-modal-cancel-btn" onClick={handleCloseModal} disabled={loading}>
                                Annuler
                            </button>
                            <button type="submit" className="add-modal-submit-btn" disabled={loading}>
                                {loading ? <><Spinner animation="border" size="sm" className="me-2" />Ajout...</> : <><FaPlus size={12} className="me-1" />Ajouter l'email</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AddEmailModal;
