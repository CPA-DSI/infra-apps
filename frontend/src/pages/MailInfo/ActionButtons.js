import React from 'react';
import { Button } from 'react-bootstrap';
import { FaEye, FaEdit, FaBan, FaCheckCircle } from 'react-icons/fa';

const ActionButtons = React.memo(({ row, handleView, handleEdit, handleToggleStatus }) => {
    const isActive = row.is_active !== false;
    return (
        <div className="d-flex gap-2" role="group" aria-label="Actions">
            <Button variant="light" onClick={() => handleView(row)} title="Voir les détails" className="shadow-sm border-0 p-2 rounded-circle" >
                <FaEye size={12} className="text-info" />
            </Button>
            <Button variant="light" onClick={() => handleEdit(row)} title="Modifier" className="shadow-sm border-0 p-2 rounded-circle" >
                <FaEdit size={12} className="text-warning" />
            </Button>
            <Button variant="light" onClick={() => handleToggleStatus(row, !isActive)} title={isActive ? 'Désactiver' : 'Activer'} className="shadow-sm border-0 p-2 rounded-circle" >
                {isActive ? <FaBan size={12} className="text-warning" /> : <FaCheckCircle size={12} className="text-success" />}
            </Button>
        </div>
    );
});

export default ActionButtons;
