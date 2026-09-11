import React from 'react';
import './UserTabs.css';

const UserTabs = ({ activeTab, onTabChange, ticketsCount, historyCount }) => {
  return (
    <div className="userTabs">
      <button
        className={`userTab ${activeTab === 'tickets' ? 'userTabActive' : ''}`}
        onClick={() => onTabChange('tickets')}
      >
        <span className="userTabLabel">Mes Tickets</span>
        {ticketsCount !== undefined && (
          <span className="userTabBadge">{ticketsCount}</span>
        )}
      </button>
      <button
        className={`userTab ${activeTab === 'history' ? 'userTabActive' : ''}`}
        onClick={() => onTabChange('history')}
      >
        <span className="userTabLabel">Historique</span>
        {historyCount !== undefined && (
          <span className="userTabBadge">{historyCount}</span>
        )}
      </button>
      <div
        className="userTabIndicator"
        style={{ transform: activeTab === 'history' ? 'translateX(100%)' : 'translateX(0)' }}
      />
    </div>
  );
};

export default UserTabs;
