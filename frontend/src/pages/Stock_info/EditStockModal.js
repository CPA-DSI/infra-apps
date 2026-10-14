// EditStockModal.js
import React from 'react';
import { FaEdit } from 'react-icons/fa';
import AppModal from '../../components/AppModal/AppModal';
import FormItemUpdate from './FormItemUpdate';
import './HomeStockUpdate.css';

const EditStockModal = ({ show, onClose, item, onSuccess }) => {
    const handleSave = () => {
        if (onSuccess) onSuccess();
        onClose();
    };

    return (
        <AppModal
            show={show}
            onClose={onClose}
            title="Modifier le mouvement"
            subtitle="Modifiez les informations du mouvement sélectionné"
            icon={<FaEdit />}
            headerBg="var(--color-secondary)"
        >
            {item ? (
                <FormItemUpdate
                    initialData={item}
                    onSave={handleSave}
                    onClose={onClose}
                />
            ) : (
                <p>Chargement des données...</p>
            )}
        </AppModal>
    );
};

export default EditStockModal;
