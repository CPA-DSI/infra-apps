import React from 'react';
import { FaEye, FaEdit, FaBan, FaCheckCircle } from 'react-icons/fa';

const ActionButtons = React.memo(({ row, handleView, handleEdit, handleToggleStatus }) => {
    const isActive = row.is_active !== false;
    const toggleLabel = isActive ? 'Désactiver' : 'Activer';
    return (
        <div className="d-flex gap-2" role="group" aria-label="Actions">
            <button type="button" className="btn-icon btn-icon--info" onClick={() => handleView(row)} title="Voir les détails" aria-label="Voir les détails">
                <FaEye size={12} aria-hidden="true" />
            </button>
            <button type="button" className="btn-icon btn-icon--warning" onClick={() => handleEdit(row)} title="Modifier" aria-label="Modifier">
                <FaEdit size={12} aria-hidden="true" />
            </button>
            <button type="button" className={`btn-icon ${isActive ? 'btn-icon--warning' : 'btn-icon--success'}`} onClick={() => handleToggleStatus(row, !isActive)} title={toggleLabel} aria-label={toggleLabel}>
                {isActive ? <FaBan size={12} aria-hidden="true" /> : <FaCheckCircle size={12} aria-hidden="true" />}
            </button>
        </div>
    );
});

export default ActionButtons;
