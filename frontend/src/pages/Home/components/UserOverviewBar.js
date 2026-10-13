import React from 'react';
import { Link } from 'react-router-dom';
import { FaTicketAlt, FaCheckCircle, FaCalendarAlt, FaPlus } from 'react-icons/fa';
import './UserOverviewBar.css';

const formatAnciennete = (datePc) => {
  if (!datePc) return null;
  const start = new Date(datePc);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

  if (months < 1) return "Moins d'un mois";
  if (months < 12) return `${months} mois`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearsLabel = `${years} an${years > 1 ? 's' : ''}`;
  return remainingMonths > 0 ? `${yearsLabel} et ${remainingMonths} mois` : yearsLabel;
};

const StatTile = ({ icon: Icon, label, value, tone }) => (
  <div className="userStatTile">
    <div className={`userStatTileIcon userStatTileIcon--${tone}`}>
      <Icon />
    </div>
    <div className="userStatTileContent">
      <span className="userStatTileValue">{value}</span>
      <span className="userStatTileLabel">{label}</span>
    </div>
  </div>
);

const UserOverviewBar = ({ ticketsOuverts = 0, ticketsFermes = 0, materiel }) => {
  const anciennete = formatAnciennete(materiel?.date_pc);

  return (
    <div className="userOverviewBar">
      <div className="userStatsTiles">
        <StatTile icon={FaTicketAlt} label="Tickets ouverts" value={ticketsOuverts} tone="primary" />
        <StatTile icon={FaCheckCircle} label="Tickets fermés" value={ticketsFermes} tone="success" />
        {anciennete && (
          <StatTile icon={FaCalendarAlt} label="Ancienneté matériel" value={anciennete} tone="warning" />
        )}
      </div>

      <Link to="/Tickets" className="userOverviewCta">
        <FaPlus />
        Créer un ticket
      </Link>
    </div>
  );
};

export default UserOverviewBar;
