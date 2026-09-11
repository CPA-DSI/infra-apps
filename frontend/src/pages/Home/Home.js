import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UserDashboard from './UserDashboard';
import './Home.css';
import DashboardMarque from './DashboardMarque.js';
import DashboardEcran from './DashboardEcran.js';
import DashboardSSD from './DashboardSSD.js';
import DashboardDocuments from './DashboardDocuments.js';
import CountEquipe from './CountEquipe.js';
import MailChartFromAPI from '../MailInfo/MailChartFromAPI.js';
import HistoriqueArriveesChart from '../HistoriqueArrivees/HistoriqueArriveesChart.js';
import DashboardHistoriqueChart from '../HistoriqueArrivees/DashboardHistoriqueChart.js';
import TicketChartCount from '../Tickets/TicketChartCount.js';

const Home = () => {
  const { user } = useAuth();

  if (user?.role === 'USER') {
    return <UserDashboard />;
  }

  return (
    <div className="homeContainer">
      <div className="headerSection">
        <div className="headerContent">
          <div className="headerText">
            <h1 className="title">Tous les tableaux de bord</h1>
            <p className="subtitle">Visualisez les statistiques et indicateurs clés de votre infrastructure</p>
          </div>
        </div>
      </div>

      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <DashboardHistoriqueChart />
          </div>
        </div>
      </div>
      
      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <HistoriqueArriveesChart />
          </div>
        </div>
      </div>

      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <DashboardMarque />
          </div>
        </div>
      </div>
      
      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <TicketChartCount />
          </div>
        </div>
      </div>
      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <MailChartFromAPI />
          </div>
        </div>
      </div>

      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <DashboardEcran />
          </div>
        </div>
      </div>
      
      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <DashboardSSD />
          </div>
        </div>
      </div>

      <div className="cardGrid cardGridFull">
        <div className="dashboardCard">
          <div className="cardContent">
            <DashboardDocuments />
          </div>
        </div>
      </div>

      <div className="cardGrid cardGridFull">
        <div className="dashboardCard dashboardCardTall">
          <div className="cardContent">
            <CountEquipe />
          </div>
        </div>
      </div>
      
    </div>

  );
};

export default Home;

