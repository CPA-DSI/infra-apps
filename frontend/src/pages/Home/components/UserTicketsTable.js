import React from 'react';
import { FaTicketAlt } from 'react-icons/fa';
import StatusBadge from './StatusBadge';
import './UserTicketsTable.css';

const UserTicketsTable = ({ tickets = [] }) => {
  if (!tickets.length) {
    return (
      <div className="userTicketsTableEmpty">
        <FaTicketAlt className="userTicketsTableEmptyIcon" />
        <p>Aucun ticket récent.</p>
      </div>
    );
  }

  return (
    <div className="userTicketsTableWrapper">
      <table className="userTicketsTable">
        <thead>
          <tr>
            <th>N° Ticket</th>
            <th>Titre</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.idTicket}>
              <td>
                <span className="userTicketNumber">{ticket.numeroTicket}</span>
              </td>
              <td>
                <span className="userTicketTitle">{ticket.titre}</span>
              </td>
              <td>
                <StatusBadge status={ticket.statut} size="sm" />
              </td>
              <td>
                <span className="userTicketDate">
                  {new Date(ticket.dateCreation).toLocaleDateString('fr-FR')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTicketsTable;
