import React from 'react';
import { Modal } from 'react-bootstrap';
import FormItem from './FormItem';
import './HomeStock.css';

const AddStockModal = ({ show, onClose, onSuccess }) => {
  return (
    <Modal show={show} onHide={onClose} centered size="lg" contentClassName="bg-transparent">
      <Modal.Body className="p-0">
        <FormItem onSave={onSuccess} onClose={onClose} />
      </Modal.Body>
    </Modal>
  );
};

export default AddStockModal;