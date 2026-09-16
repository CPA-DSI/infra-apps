import React from 'react';
import { FaUsers, FaMapMarkerAlt, FaUserCircle, FaDesktop } from 'react-icons/fa';
import { statusConfig } from '../../Materiels/materielsTableConfig';
import './UserMaterielCard.css';

const StatutBadge = ({ etatPc }) => {
  const config = statusConfig[etatPc] || { emoji: '❓', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
  return (
    <span
      className="userMaterielStatusBadge"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      <span>{config.emoji}</span>
      {etatPc || 'Inconnu'}
    </span>
  );
};

const MarqueBadge = ({ marque }) => {
  if (marque?.url) {
    return (
      <div className="userMaterielLogo">
        <img src={marque.url} alt={`Logo ${marque.nom_marque || 'marque'}`} />
      </div>
    );
  }
  return <div className="userMaterielLogoFallback">{marque?.nom_marque || 'N/A'}</div>;
};

const ActifBadge = ({ estActif }) => {
  const isActive = estActif === true || estActif === 'true' || estActif === 'Oui' || estActif === 'oui';
  return (
    <span
      className="userMaterielActifBadge"
      style={{
        backgroundColor: isActive ? '#d1fae5' : '#fee2e2',
        color: isActive ? '#065f46' : '#991b1b',
        border: `1px solid ${isActive ? '#10b981' : '#ef4444'}`,
      }}
    >
      <span>{isActive ? '✅' : '❌'}</span>
      {isActive ? 'Actif' : 'Inactif'}
    </span>
  );
};

const InfoRow = ({ icon: Icon, children }) => (
  <div className="userMaterielInfoItem">
    <Icon />
    <span>{children}</span>
  </div>
);

const UserMaterielCard = ({ materiel }) => {
  if (!materiel) {
    return (
      <div className="userMaterielCard">
        <div className="userMaterielEmpty">
          <FaDesktop className="userMaterielEmptyIcon" />
          Aucun matériel assigné.
        </div>
      </div>
    );
  }

  return (
    <div className="userMaterielCard">
      <div className="userMaterielTop">
        <MarqueBadge marque={materiel.marque} />
        <div className="userMaterielTitle">
          <div className="userMaterielCode">{materiel.code_pc || `Matériel #${materiel.id_n}`}</div>
          {materiel.caracteristiques && (
            <div className="userMaterielSub">{materiel.caracteristiques}</div>
          )}
        </div>
        <StatutBadge etatPc={materiel.etat_pc} />
      </div>

      <div className="userMaterielInfo">
        <InfoRow icon={FaUserCircle}>{materiel.utilisateur || 'N/A'}</InfoRow>
        <InfoRow icon={FaUsers}>{materiel.equipe || 'Aucune équipe'}</InfoRow>
        <InfoRow icon={FaMapMarkerAlt}>
          {materiel.local?.nom_local || 'Non attribué'}
          {materiel.salle ? ` • Salle ${materiel.salle}` : ''}
        </InfoRow>
      </div>

      <div className="userMaterielFooter">
        <ActifBadge estActif={materiel.est_actif} />
      </div>
    </div>
  );
};

export default UserMaterielCard;
