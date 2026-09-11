import React, { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { FaLock, FaTimes, FaInfoCircle, FaTag, FaCheckCircle, FaClock } from 'react-icons/fa';
import { closeTicket, addCommentaire, updateTicket } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Tickets.css';

const CloseTicketModal = ({ show, ticketId, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [solution, setSolution] = useState('');
  const [motif, setMotif] = useState('');
  const [dureeResolution, setDureeResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fermePar = user?.id_user ?? 0;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!solution.trim()) {
      Swal.showValidationMessage('La solution est obligatoire pour fermer un ticket.');
      return;
    }

    setSubmitting(true);
    try {
      await closeTicket(ticketId, solution, motif, fermePar, dureeResolution ? Number(dureeResolution) : undefined);

      try {
        await updateTicket(ticketId, { statut: 'RESOLU', solution: solution.trim() });
      } catch (updateErr) {
        console.error('Erreur mise à jour statut ticket:', updateErr);
      }

      const idAuteur = user?.id_user;
      if (idAuteur) {
        const contenu = motif
          ? `🔒 Ticket fermé\nSolution : ${solution}\nMotif : ${motif}`
          : `🔒 Ticket fermé\nSolution : ${solution}`;
        try {
          await addCommentaire({ contenu, idTicket: ticketId, idAuteur });
        } catch (cErr) {
          console.error('Erreur ajout commentaire de clôture:', cErr);
        }
      }

      onSuccess?.();
      Swal.fire({ icon: 'success', title: 'Fermée et résolue !', text: 'Le ticket a été clôturé.', timer: 2000, showConfirmButton: false });
      onClose();
    } catch (err) {
      if (err.response?.status === 401) {
        Swal.fire({
          icon: 'error',
          title: 'Session expirée',
          text: 'Votre session a expiré. Veuillez vous reconnecter.',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          window.location.href = '/login';
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de la fermeture.' });
      }
    } finally {
      setSubmitting(false);
    }
  }, [ticketId, solution, motif, dureeResolution, user, fermePar, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    setSolution('');
    setMotif('');
    setDureeResolution('');
    onClose();
  }, [onClose]);

  if (!show) return null;

  return (
    <>
      <div className="add-modal-overlay" onClick={handleClose}>
        <div className="add-modal-content" onClick={e => e.stopPropagation()} style={{
          maxWidth: '600px',
        }}>
          <div className="add-modal-header" style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div className="add-modal-icon-wrapper" style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}>
                <FaLock style={{ color: 'white' }} />
              </div>
              <div>
                <h2 className="add-modal-title" style={{ color: 'white' }}>
                  Fermer le ticket
                </h2>
                <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Remplissez les informations de clôture
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="add-modal-close-btn" type="button" style={{
              background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
            }}>
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
          <div className="add-modal-body" style={{
              padding: '24px',
              background: '#F8FAFC'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '12px'
            }}>
              <FaInfoCircle style={{ color: '#3B82F6', fontSize: '1.2rem' }} />
              <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                Les champs marqués d'un <span style={{ color: '#EF4444' }}>*</span> sont obligatoires
              </span>
            </div>

            <div className="add-modal-form-group">
              <label className="add-modal-label">
                <FaCheckCircle /> Solution apportée *
              </label>
              <textarea
                name="solution"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="add-modal-textarea"
                placeholder="Décrivez la solution apportée..."
                rows={3}
                required
                disabled={submitting}
              />
            </div>
            <div className="add-modal-form-group">
              <label className="add-modal-label">
                <FaTag /> Motif (optionnel)
              </label>
              <input
                type="text"
                name="motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="add-modal-input"
                placeholder="Motif de fermeture..."
                disabled={submitting}
              />
            </div>
            <div className="add-modal-form-group">
              <label className="add-modal-label">
                <FaClock /> Durée de résolution (en minutes, optionnel)
              </label>
              <input
                type="number"
                name="dureeResolution"
                min="0"
                value={dureeResolution}
                onChange={(e) => setDureeResolution(e.target.value)}
                className="add-modal-input"
                placeholder="Durée en minutes..."
                disabled={submitting}
              />
            </div>
          </div>

          <div className="add-modal-footer" style={{
            background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px'
          }}>
            <button type="button" onClick={handleClose} className="add-modal-cancel-btn" style={{
              background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', transition: 'all 0.2s ease', cursor: 'pointer'
            }} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="add-modal-submit-btn" style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', padding: '10px 32px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }} disabled={submitting || !solution.trim()}>
              <FaCheckCircle /> {submitting ? 'Fermeture...' : 'Fermer'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CloseTicketModal;
