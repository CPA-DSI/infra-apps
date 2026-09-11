import React from 'react';
import { FaDesktop, FaMapMarkerAlt, FaTag, FaLayerGroup, FaListOl } from 'react-icons/fa';
import StatusBadge from './StatusBadge';
import './UserMaterielCard.css';

const LABEL_CLASS = 'userMaterielLabel';
const VALUE_CLASS = 'userMaterielValue';

const MaterielField = ({ icon: Icon, label, value, isLast = false }) => (
  <div className={`userMaterielField ${!isLast ? 'userMaterielFieldWithBorder' : ''}`}>
    <div className="userMaterielFieldHeader">
      {Icon && <Icon className="userMaterielFieldIcon" />}
      <span className={LABEL_CLASS}>{label}</span>
    </div>
    <span className={VALUE_CLASS}>{value || 'N/A'}</span>
  </div>
);

const UserMaterielCard = ({ materiel }) => {
  if (!materiel) {
    return (
      <div className="userMaterielCard">
        <div className="userMaterielCardHeader">
          <div className="userMaterielCardIcon">
            <FaDesktop />
          </div>
          <h3 className="userMaterielCardTitle">Mon Matériel</h3>
        </div>
        <div className="userMaterielCardContent">
          <div className="userMaterielEmpty">Aucun matériel assigné.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="userMaterielCard">
      <div className="userMaterielCardHeader">
        <div className="userMaterielCardIcon">
          <FaDesktop />
        </div>
        <h3 className="userMaterielCardTitle">Mon Matériel Assigné</h3>
        <div className="userMaterielCardHeaderRight">
          <StatusBadge status={materiel.etat_pc} size="sm" />
        </div>
      </div>
      <div className="userMaterielCardContent">
        <div className="userMaterielGrid">
          <MaterielField icon={FaLayerGroup} label="Poste" value={materiel.utilisateur} />
          <MaterielField icon={FaLayerGroup} label="Équipe" value={materiel.equipe} />
          <MaterielField icon={FaDesktop} label="Code PC" value={materiel.code_pc} />
          <MaterielField icon={FaDesktop} label="État" value={materiel.etat_pc} />
          <MaterielField icon={FaMapMarkerAlt} label="Local" value={materiel.local?.nom_local} />
          <MaterielField icon={FaTag} label="Marque" value={materiel.marque?.nom_marque} />
          <MaterielField icon={FaListOl} label="Caractéristiques" value={materiel.caracteristiques} isLast />
        </div>
      </div>
    </div>
  );
};

export default UserMaterielCard;
