import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import './Tickets.css';

const ConfirmModal = ({ show, title, message, confirmText, cancelText, variant, onConfirm, onCancel, loading }) => {
  const variantMap = {
    danger: 'danger',
    warning: 'warning',
    info: 'info',
    primary: 'primary',
    success: 'success',
  };

  const buttonVariant = variantMap[variant] || 'primary';

  return (
    <Modal show={show} onHide={onCancel} centered className="ticket-modal-modern">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={buttonVariant} onClick={onConfirm} disabled={loading}>
          {loading ? '...' : confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;