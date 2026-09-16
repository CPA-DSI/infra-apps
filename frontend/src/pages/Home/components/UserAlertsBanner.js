import React, { useMemo } from 'react';
import { FaTicketAlt, FaExclamationTriangle } from 'react-icons/fa';
import './UserAlertsBanner.css';

const TICKET_ALERT_AFTER_DAYS = 3;
const MATERIEL_ALERT_AFTER_MONTHS = 12;

const daysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

const monthsSince = (date) => {
  const start = new Date(date);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
};

const buildAlerts = (tickets, materiel) => {
  const alerts = [];

  tickets.forEach((ticket) => {
    if (ticket.statut === 'FERME' || !ticket.dateMaj) return;
    const days = daysSince(ticket.dateMaj);
    if (days >= TICKET_ALERT_AFTER_DAYS) {
      alerts.push({
        id: `ticket-${ticket.idTicket}`,
        icon: FaTicketAlt,
        text: `Ticket ${ticket.numeroTicket} en attente de réponse depuis ${days} jour${days > 1 ? 's' : ''}.`,
      });
    }
  });

  if (materiel?.date_modification) {
    const months = monthsSince(materiel.date_modification);
    if (months >= MATERIEL_ALERT_AFTER_MONTHS) {
      alerts.push({
        id: 'materiel-stale',
        icon: FaExclamationTriangle,
        text: `Votre matériel n'a pas été mis à jour depuis ${months} mois — pensez à signaler tout problème.`,
      });
    }
  }

  return alerts;
};

const UserAlertsBanner = ({ tickets = [], materiel }) => {
  const alerts = useMemo(() => buildAlerts(tickets, materiel), [tickets, materiel]);

  if (!alerts.length) return null;

  return (
    <div className="userAlertsBanner">
      {alerts.map(({ id, icon: Icon, text }) => (
        <div key={id} className="userAlertItem">
          <Icon className="userAlertIcon" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
};

export default UserAlertsBanner;
