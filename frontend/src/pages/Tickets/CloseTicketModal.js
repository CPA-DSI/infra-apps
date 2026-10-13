import React, { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { FaLock, FaInfoCircle, FaTag, FaCheckCircle, FaClock } from 'react-icons/fa';
import { closeTicket, addCommentaire } from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
import './Tickets.css';

const CloseTicketModal = ({ show, ticketId, onClose, onSuccess }) => {
  const [solution, setSolution] = useState('');
  const [motif, setMotif] = useState('');
  const [dureeResolution, setDureeResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!solution.trim()) {
      Swal.showValidationMessage('La solution est obligatoire pour fermer un ticket.');
      return;
    }

    setSubmitting(true);
    try {
      // La fermeture passe le ticket en RESOLU et enregistre la solution
      // (TicketFermeture) côté serveur : pas de mise à jour séparée du ticket.
      await closeTicket(ticketId, solution, motif, dureeResolution ? Number(dureeResolution) : undefined);

      // L'auteur du commentaire est l'utilisateur connecté, déduit côté serveur
      const contenu = motif
        ? `🔒 Ticket fermé\nSolution : ${solution}\nMotif : ${motif}`
        : `🔒 Ticket fermé\nSolution : ${solution}`;
      try {
        await addCommentaire({ contenu, idTicket: ticketId });
      } catch (cErr) {
        console.error('Erreur ajout commentaire de clôture:', cErr);
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
  }, [ticketId, solution, motif, dureeResolution, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    setSolution('');
    setMotif('');
    setDureeResolution('');
    onClose();
  }, [onClose]);

  return (
    <AppModal
      show={show}
      onClose={handleClose}
      as="form"
      onSubmit={handleSubmit}
      size="md"
      closeOnBackdrop
      icon={<FaLock />}
      title="Fermer le ticket"
      subtitle="Remplissez les informations de clôture"
      contentClassName="tck-modal"
      footer={
        <>
          <button type="button" onClick={handleClose} className="add-modal-cancel-btn" disabled={submitting}>
            Annuler
          </button>
          <button type="submit" className="add-modal-submit-btn" disabled={submitting || !solution.trim()}>
            <FaCheckCircle aria-hidden="true" /> {submitting ? 'Fermeture...' : 'Fermer'}
          </button>
        </>
      }
    >
      <div className="tck-modal-info">
        <FaInfoCircle className="tck-modal-info__icon" aria-hidden="true" />
        <span className="tck-modal-info__text">
          Les champs marqués d'un <span className="tck-required">*</span> sont obligatoires
        </span>
      </div>

      <div className="add-modal-form-group">
        <label className="add-modal-label" htmlFor="tck-close-solution">
          <FaCheckCircle aria-hidden="true" /> Solution apportée *
        </label>
        <textarea
          id="tck-close-solution"
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
        <label className="add-modal-label" htmlFor="tck-close-motif">
          <FaTag aria-hidden="true" /> Motif (optionnel)
        </label>
        <input
          id="tck-close-motif"
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
        <label className="add-modal-label" htmlFor="tck-close-duree">
          <FaClock aria-hidden="true" /> Durée de résolution (en minutes, optionnel)
        </label>
        <input
          id="tck-close-duree"
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
    </AppModal>
  );
};

export default CloseTicketModal;
