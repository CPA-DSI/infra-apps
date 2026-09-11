// EditStockModal.js
import React from 'react';
import { Modal } from 'react-bootstrap';
import FormItemUpdate from './FormItemUpdate';
import './HomeStockUpdate.css';

const EditStockModal = ({ show, onClose, item, onSuccess }) => {
    const handleSave = (updatedMovementData) => {
        if (onSuccess) onSuccess();
        onClose();
    };

    return (
        <Modal show={show} onHide={onClose} centered size="lg" className="custom-edit-modal" >
            <Modal.Header closeButton className="border-0 pb-0">
                <div>
                    <Modal.Title className="h4 fw-bold text-dark">
                        ✏️ Modifier le mouvement
                    </Modal.Title>
                    <p className="text-muted mb-0 small">
                        Modifiez les informations du mouvement sélectionné
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body>
                {item ? (
                    <FormItemUpdate
                        initialData={item}
                        onSave={handleSave}
                        onClose={onClose}
                    />
                ) : (
                    <p>Chargement des données...</p>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default EditStockModal;