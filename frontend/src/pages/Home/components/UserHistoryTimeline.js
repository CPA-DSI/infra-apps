import React from 'react';
import { FaHistory, FaUserEdit, FaExchangeAlt } from 'react-icons/fa';
import './UserHistoryTimeline.css';

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatFullDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFieldLabel = (champ) => {
  const labels = {
    utilisateur: 'Utilisateur',
    equipe: 'Équipe',
    code_pc: 'Code PC',
    etat_pc: 'État PC',
    local: 'Local',
    marque: 'Marque',
    caracteristiques: 'Caractéristiques',
    date_pc: 'Date PC',
    ecran: 'Écran',
    code_ecran: 'Code Écran',
    hdmi: 'HDMI',
    clavier: 'Clavier',
    lan: 'LAN',
    usb: 'USB',
    salle: 'Salle',
    etat_batterie: 'État Batterie',
    commentaire: 'Commentaire',
  };
  return labels[champ] || champ;
};

const getFieldIcon = (champ) => {
  if (champ === 'local') return '📍';
  if (champ === 'equipe') return '👥';
  if (champ === 'etat_pc' || champ === 'etat_batterie') return '⚡';
  if (champ === 'utilisateur') return '👤';
  if (champ === 'marque') return '🏷️';
  if (champ === 'code_pc' || champ === 'code_ecran') return '💻';
  return '📝';
};

const HistoryItem = ({ item }) => (
  <div className="historyTimelineItem">
    <div className="historyTimelineDot">
      <FaUserEdit />
    </div>
    <div className="historyTimelineCard">
      <div className="historyTimelineCardHeader">
        <span className="historyFieldIcon">{getFieldIcon(item.champ_modifie)}</span>
        <span className="historyFieldName">{getFieldLabel(item.champ_modifie)}</span>
        <span className="historyTimelineDate" title={formatFullDate(item.date_modification)}>
          {formatDate(item.date_modification)}
        </span>
      </div>
      <div className="historyTimelineChange">
        <span className="historyValueOld">{item.ancienne_valeur || '—'}</span>
        <FaExchangeAlt className="historyArrowIcon" />
        <span className="historyValueNew">{item.nouvelle_valeur || '—'}</span>
      </div>
      {item.nom_utilisateur && (
        <div className="historyTimelineAuthor">
          Modifié par {item.nom_utilisateur}
        </div>
      )}
    </div>
  </div>
);

const UserHistoryTimeline = ({ history = [] }) => {
  if (!history.length) {
    return (
      <div className="userHistoryTimelineEmpty">
        <FaHistory className="userHistoryTimelineEmptyIcon" />
        <p>Aucun historique disponible.</p>
      </div>
    );
  }

  return (
    <div className="userHistoryTimeline">
      {history.map((item, index) => (
        <HistoryItem key={item.id_historique || index} item={item} />
      ))}
    </div>
  );
};

export default UserHistoryTimeline;
