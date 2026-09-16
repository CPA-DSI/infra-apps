import React from 'react';
import { FaTicketAlt } from 'react-icons/fa';
import './UserTicketsChart.css';

const STATUT_META = [
  { key: 'NOUVEAU', label: 'Nouveau', color: '#1e40af', bg: '#dbeafe' },
  { key: 'EN_COURS', label: 'En cours', color: '#854d0e', bg: '#fef9c3' },
  { key: 'RESOLU', label: 'Résolu', color: '#166534', bg: '#dcfce7' },
  { key: 'FERME', label: 'Fermé', color: '#475569', bg: '#f1f5f9' },
];

const UserTicketsChart = ({ parStatut, total = 0 }) => {
  if (!total) {
    return (
      <div className="userTicketsChart userTicketsChartEmpty">
        <FaTicketAlt className="userTicketsChartEmptyIcon" />
        <span>Aucun ticket pour le moment.</span>
      </div>
    );
  }

  return (
    <div className="userTicketsChart">
      <div className="userTicketsChartHeader">
        <span className="userTicketsChartTitle">Mes tickets par statut</span>
        <span className="userTicketsChartTotal">{total} au total</span>
      </div>

      <div className="userTicketsChartBar">
        {STATUT_META.map(({ key, color }) => {
          const count = parStatut?.[key] || 0;
          const percentage = (count / total) * 100;
          if (percentage === 0) return null;
          return (
            <div
              key={key}
              className="userTicketsChartBarSegment"
              style={{ width: `${percentage}%`, backgroundColor: color }}
              title={`${key}: ${count}`}
            />
          );
        })}
      </div>

      <div className="userTicketsChartLegend">
        {STATUT_META.map(({ key, label, color, bg }) => (
          <div key={key} className="userTicketsChartLegendItem" style={{ backgroundColor: bg }}>
            <span className="userTicketsChartLegendDot" style={{ backgroundColor: color }} />
            <span className="userTicketsChartLegendLabel" style={{ color }}>{label}</span>
            <span className="userTicketsChartLegendCount" style={{ color }}>{parStatut?.[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserTicketsChart;
