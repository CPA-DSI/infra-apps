import React from 'react';
import { Button } from 'react-bootstrap';
import {
  FaInfoCircle, FaEdit, FaTrash, FaLock,
  FaUserPlus, FaEye, FaCheckCircle
} from 'react-icons/fa';

const ActionDropdown = ({ row, onView, onEdit, onDelete, onAssign, onClose }) => {
  const isClosed = row.statut === 'CLOS' || row.statut === 'FERME' || row.statut === 'RESOLU' || row.fermeture;
  const isAssigned = row.idAssigne != null && row.idAssigne !== 0;

  const actions = [];

  actions.push({
    icon: FaEye,
    label: 'Voir',
    variant: 'info',
    onClick: () => onView(row),
  });

  if (!isClosed) {
    actions.push({
      icon: FaEdit,
      label: 'Modifier',
      variant: 'warning',
      onClick: () => onEdit(row),
    });
  }

  actions.push({
    icon: FaTrash,
    label: 'Supprimer',
    variant: 'danger',
    onClick: () => onDelete(row.idTicket),
  });

  if (!isClosed && !row.fermeture) {
    actions.push({
      icon: FaLock,
      label: 'Fermer',
      variant: 'secondary',
      onClick: () => onClose(row.idTicket),
    });
  }

  if (!isAssigned) {
    actions.push({
      icon: FaUserPlus,
      label: 'Assigner',
      variant: 'primary',
      onClick: () => onAssign(row.idTicket),
    });
  }

  return (
    <div className="action-dropdown" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant}
          size="sm"
          onClick={action.onClick}
          title={action.label}
          style={{ padding: '2px 6px', fontSize: '11px', lineHeight: '1.2' }}
        >
          <action.icon size={12} />
        </Button>
      ))}
    </div>
  );
};

export default ActionDropdown;