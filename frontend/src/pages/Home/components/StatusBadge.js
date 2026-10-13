import React from 'react';
import { getStatusToneClass } from './statusStyles';
import './StatusBadge.css';

const StatusBadge = ({ status, size = 'md' }) => (
  <span className={`statusBadge statusBadge--${size} ${getStatusToneClass(status)}`}>
    <span className="statusBadgeIcon">●</span>
    {status}
  </span>
);

export default StatusBadge;
