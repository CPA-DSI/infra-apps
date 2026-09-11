// Fichier: ConfirmationModal.js (issu de votre exemple original)
import React from 'react';
import { Modal, Button } from 'react-bootstrap';

function ConfirmationModal({ show, handleClose, handleConfirm, title, children }) {
    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {children}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Annuler
                </Button>
                <Button variant="danger" onClick={handleConfirm}>
                    Supprimer
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

// CETTE LIGNE EST CRUCIALE :
export default ConfirmationModal;
