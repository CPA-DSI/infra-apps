import React from 'react';
import { FaTicketAlt } from 'react-icons/fa';
import { STATUS_STYLES, TICKET_STATUSES } from './statusStyles';
import './UserTicketsChart.css';

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
        {TICKET_STATUSES.map((key) => {
          const count = parStatut?.[key] || 0;
          const percentage = (count / total) * 100;
          if (percentage === 0) return null;
          return (
            <div
              key={key}
              className={`userTicketsChartBarSegment ${STATUS_STYLES[key].className}`}
              style={{ width: `${percentage}%` }}
              title={`${key}: ${count}`}
            />
          );
        })}
      </div>

      <div className="userTicketsChartLegend">
        {TICKET_STATUSES.map((key) => (
          <div key={key} className={`userTicketsChartLegendItem ${STATUS_STYLES[key].className}`}>
            <span className="userTicketsChartLegendDot" />
            <span>{STATUS_STYLES[key].label}</span>
            <span className="userTicketsChartLegendCount">{parStatut?.[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserTicketsChart;
