import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import { getHistoriqueMaterielByMaterielId } from '../../services/api';
import { FaExclamationCircle, FaInbox } from 'react-icons/fa';
import UserProfileCard from './components/UserProfileCard';
import UserMaterielCard from './components/UserMaterielCard';
import UserTabs from './components/UserTabs';
import UserTicketsTable from './components/UserTicketsTable';
import UserHistoryTimeline from './components/UserHistoryTimeline';
import './UserDashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets');
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await apiClient.get('/users/me/dashboard');
        setData(response.data);
      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        setError('Erreur lors du chargement du tableau de bord.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!data?.materiel?.id_materiels) return;

      setHistoryLoading(true);
      try {
        const historyData = await getHistoriqueMaterielByMaterielId(data.materiel.id_materiels);
        setHistory(historyData || []);
      } catch (error) {
        console.error('Erreur chargement historique:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    if (data?.materiel?.id_materiels) {
      loadHistory();
    }
  }, [data]);

  if (loading) {
    return (
      <div className="userDashboardContainer">
        <div className="userDashboardLoading">
          <div className="userDashboardSpinner"></div>
          <span className="userDashboardLoadingText">Chargement de votre espace...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="userDashboardContainer">
        <div className="userDashboardError">
          <FaExclamationCircle />
          <span>{error || 'Erreur lors du chargement du tableau de bord.'}</span>
        </div>
      </div>
    );
  }

  const ticketsCount = data.tickets?.recents?.length || 0;
  const historyCount = history.length;
  const hasNoData = !data.materiel && ticketsCount === 0 && historyCount === 0;

  if (hasNoData) {
    return (
      <div className="userDashboardContainer">
        <UserProfileCard user={user} matricule={data.id_n} />
        <div className="userDashboardContent">
          <div className="userDashboardEmptyState">
            <FaInbox className="userDashboardEmptyStateIcon" />
            <h3 className="userDashboardEmptyStateTitle">Aucune donnée disponible</h3>
            <p className="userDashboardEmptyStateText">
              Vous n'avez pas encore de matériel assigné ni de tickets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="userDashboardContainer">
      <UserProfileCard user={user} matricule={data.id_n} />

      <div className="userDashboardContent">
        <div className="userDashboardLeftColumn">
          <UserMaterielCard materiel={data.materiel} />
        </div>

        <div className="userDashboardRightColumn">
          <div className="userDashboardTabsCard">
            <UserTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              ticketsCount={ticketsCount}
              historyCount={historyCount}
            />
            <div className="userDashboardTabContent">
              {activeTab === 'tickets' ? (
                <UserTicketsTable tickets={data.tickets?.recents || []} />
              ) : (
                <UserHistoryTimeline
                  history={history}
                  loading={historyLoading}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
