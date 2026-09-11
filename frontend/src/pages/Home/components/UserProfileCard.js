import React from 'react';
import { FaUserCircle } from 'react-icons/fa';
import './UserProfileCard.css';

const UserProfileCard = ({ user, matricule }) => {
  return (
    <div className="userProfileCard">
      <div className="userProfileCardLeft">
        <FaUserCircle className="userProfileAvatar" />
        <div className="userProfileInfo">
          <h1 className="userProfileName">Mon Espace</h1>
          <p className="userProfileGreeting">
            Bienvenue, {user?.materiel?.utilisateur || 'Utilisateur'}
            {matricule && <span className="userProfileMatricule"> — Matricule {matricule}</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard;
