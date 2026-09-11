import React from 'react';
import './StatusBadge.css';

const STATUS_CONFIG = {
  Actif: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: '●' },
  'En maintenance': { bg: '#fef9c3', color: '#854d0e', border: '#fef08a', icon: '●' },
  Inactif: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: '●' },
  NOUVEAU: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', icon: '●' },
  EN_COURS: { bg: '#fef9c3', color: '#854d0e', border: '#fef08a', icon: '●' },
  RESOLU: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: '●' },
  FERME: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: '●' },
};

const getStatusConfig = (status) => {
  if (!status) return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: '●' };
  const normalized = status.toUpperCase();
  if (STATUS_CONFIG[normalized]) return STATUS_CONFIG[normalized];
  if (STATUS_CONFIG[status]) return STATUS_CONFIG[status];
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: '●' };
};

const StatusBadge = ({ status, size = 'md' }) => {
  const config = getStatusConfig(status);
  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '11px' },
    md: { padding: '4px 12px', fontSize: '12px' },
    lg: { padding: '6px 16px', fontSize: '13px' },
  };

  return (
    <span
      className="statusBadge"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        borderRadius: '20px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
      }}
    >
      <span style={{ fontSize: size === 'lg' ? '10px' : '8px' }}>{config.icon}</span>
      {status}
    </span>
  );
};

export default StatusBadge;
