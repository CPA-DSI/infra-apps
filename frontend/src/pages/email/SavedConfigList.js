import React from 'react';
import { ListGroup } from 'react-bootstrap';
import { FaCalendarDay, FaCalendarWeek, FaCalendarAlt } from 'react-icons/fa';
import './SavedConfigList.css';

const SavedConfigList = ({ configs, activeTab }) => {
  const items = [
    { key: 'quotidien', label: 'Quotidienne', icon: FaCalendarDay, data: configs.daily },
    { key: 'hebdomadaire', label: 'Hebdomadaire', icon: FaCalendarWeek, data: configs.weekly },
    { key: 'mensuelle', label: 'Mensuelle', icon: FaCalendarAlt, data: configs.monthly },
  ];

  return (
    <div className="modern-card">
      <div className="modern-header">
        <h3 className="h6 mb-0 text-white fw-bold">Configurations sauvegardées</h3>
      </div>
      <ListGroup variant="flush">
        {items.map(item => {
          const isActive = activeTab === item.key;
          const hasConfig = item.data && Object.keys(item.data).length > 0;
          const Icon = item.icon;
          const cronActive = item.data?.cron_actif || item.data?.cron_actif_hebdo;

          return (
            <ListGroup.Item
              key={item.key}
              className={`saved-config-item ${isActive ? 'saved-config-active' : ''}`}
            >
              <div className="d-flex align-items-start gap-2">
                <Icon className={`mt-1 config-icon ${isActive ? 'text-white' : 'text-primary'}`} />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>{item.label}</strong>
                    {hasConfig && (
                      <span className={`badge ${cronActive ? 'bg-success' : 'bg-secondary'}`}>
                        {cronActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  {hasConfig ? (
                    <div className="mt-1 small config-details">
                      <div>📧 {item.data.email_dest ? item.data.email_dest.split(',')[0] + (item.data.email_dest.includes(',') ? '...' : '') : 'Non défini'}</div>
                      <div>🕐 {item.data.heure_envoi || '--:--'}</div>
                      {item.key === 'hebdomadaire' && item.data.jour_envoi && (
                        <div>📅 Jour {item.data.jour_envoi}</div>
                      )}
                      {item.key === 'mensuelle' && item.data.jour_envoi && (
                        <div>📅 Jour {item.data.jour_envoi} du mois</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 small text-muted">Non configuré</div>
                  )}
                </div>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </div>
  );
};

export default SavedConfigList;
