// frontend/src/components/Dashboard/DashboardMarque.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import {
  fetchMarquesWithCount,
  fetchStatsEquipesEtats,
  fetchMaterielsByLocal
} from '../../services/api';
import './DashboardMarque.css';

const DashboardMarque = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // États pour les données
  const [marques, setMarques] = useState([]);
  const [statsEquipes, setStatsEquipes] = useState(null);
  const [locauxData, setLocauxData] = useState([]);
  
  // Couleurs prédéfinies
  const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
    '#d946ef', '#f43f5e', '#0ea5e9', '#eab308', '#a855f7'
  ];

  // Chargement initial
  useEffect(() => {
    loadAllData();
  }, []);

  // Charger toutes les données
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [marquesData, statsData, locauxData] = await Promise.all([
        fetchMarquesWithCount(),
        fetchStatsEquipesEtats(),
        fetchMaterielsByLocal()
      ]);
      
      setMarques(marquesData || []);
      setStatsEquipes(statsData);
      setLocauxData(locauxData || []);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Rafraîchir
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Calculs stats
  const totalEquipements = useMemo(() => {
    return marques.reduce((sum, m) => sum + (m.nombre_equipements || 0), 0);
  }, [marques]);

  const topMarques = useMemo(() => {
    return [...marques].sort((a, b) => b.nombre_equipements - a.nombre_equipements).slice(0, 5);
  }, [marques]);

  // Configuration Graphique 1: Bar Chart - Top 10 Marques
  const barChartOptions = {
    chart: {
      type: 'bar',
      height: 400,
      background: 'transparent',
      toolbar: { show: true, tools: { download: true, zoom: false, pan: false } },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    title: {
      text: '📊 Nombre d\'équipements par marque',
      align: 'center',
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    xaxis: {
      categories: marques.slice(0, 10).map(m => m.nom_marque || 'Sans nom'),
      labels: { rotate: -45, style: { colors: '#94a3b8', fontSize: '11px' } }
    },
    yaxis: {
      title: { text: 'Nombre d\'équipements', style: { color: '#94a3b8' } },
      labels: { style: { colors: '#94a3b8' } }
    },
    plotOptions: {
      bar: { borderRadius: 8, horizontal: false, columnWidth: '60%', dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: ['#f1f5f9'], fontSize: '11px' } },
    grid: { borderColor: '#334155', strokeDashArray: 5 },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s)` } },
    colors: [COLORS[0]],
    legend: { position: 'top', labels: { colors: '#94a3b8' } }
  };

  const barChartSeries = [{
    name: 'Nombre d\'équipements',
    data: marques.slice(0, 10).map(m => m.nombre_equipements || 0)
  }];

  // Configuration Graphique 2: Pie Chart - Répartition des marques
  const pieChartOptions = {
    chart: { type: 'donut', background: 'transparent', animations: { enabled: true, speed: 800 } },
    title: {
      text: '🥧 Répartition des équipements par marque',
      align: 'center',
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    labels: marques.slice(0, 10).map(m => m.nom_marque || 'Sans nom'),
    colors: COLORS,
    legend: { position: 'bottom', labels: { colors: '#94a3b8' }, formatter: (val, opts) => `${val} (${marques[opts.seriesIndex]?.nombre_equipements || 0})` },
    plotOptions: { pie: { donut: { size: '55%', labels: { show: true, total: { show: true, label: 'Total', color: '#f1f5f9', formatter: () => totalEquipements } } } } },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s) (${((val / totalEquipements) * 100).toFixed(1)}%)` } },
    responsive: [{ breakpoint: 480, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }]
  };

  const pieChartSeries = marques.slice(0, 10).map(m => m.nombre_equipements || 0);

  // Configuration Graphique 3: Horizontal Bar - Top 5 Marques
  const top5BarOptions = {
    chart: { type: 'bar', height: 350, background: 'transparent', animations: { enabled: true } },
    title: { text: '🏆 Top 5 des marques', align: 'center', style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' } },
    xaxis: { categories: topMarques.map(m => m.nom_marque || 'Sans nom'), labels: { style: { colors: '#94a3b8' } } },
    yaxis: { title: { text: 'Nombre d\'équipements', style: { color: '#94a3b8' } }, labels: { style: { colors: '#94a3b8' } } },
    plotOptions: { bar: { borderRadius: 6, horizontal: false, dataLabels: { position: 'top' } } },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: ['#f59e0b'], fontSize: '12px', fontWeight: 'bold' } },
    colors: ['#f59e0b'],
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s)` } }
  };

  const top5BarSeries = [{ name: 'Équipements', data: topMarques.map(m => m.nombre_equipements || 0) }];

  // Configuration Graphique 4: Bar horizontal - Équipes (Top 10 + Reste)
  const equipeBarData = useMemo(() => {
    const equipeCount = statsEquipes?.equipeCount || {};
    const entries = Object.entries(equipeCount).sort((a, b) => b[1] - a[1]);
    const top10 = entries.slice(0, 10);
    const reste = entries.slice(10);
    const resteSum = reste.reduce((sum, [, count]) => sum + count, 0);

    const categories = top10.map(([nom]) => nom);
    const data = top10.map(([, count]) => count);

    if (resteSum > 0) {
      categories.push(`Reste (${reste.length} équipes)`);
      data.push(resteSum);
    }

    // Ordre croissant car ApexCharts empile les barres horizontales du bas vers le haut
    return { categories: categories.reverse(), data: data.reverse() };
  }, [statsEquipes]);

  const equipeBarOptions = {
    chart: {
      type: 'bar',
      height: 420,
      background: 'transparent',
      toolbar: { show: true, tools: { download: true, zoom: false, pan: false } },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    title: { text: '👥 Répartition par équipe', align: 'center', style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' } },
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '70%', dataLabels: { position: 'top' } } },
    xaxis: { categories: equipeBarData.categories, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8', fontSize: '12px' } } },
    dataLabels: {
      enabled: true,
      offsetX: 24,
      style: { colors: ['#f1f5f9'], fontSize: '11px' },
      formatter: (val) => val
    },
    colors: ['#8b5cf6'],
    grid: { borderColor: '#334155', strokeDashArray: 5 },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => `${val} équipement(s) (${((val / (statsEquipes?.totalEquipements || 1)) * 100).toFixed(1)}%)` }
    }
  };

  const equipeBarSeries = [{ name: 'Équipements', data: equipeBarData.data }];

  // Configuration Graphique 5: Pie - États des PC
  const etatsPieOptions = {
    chart: { type: 'pie', background: 'transparent', animations: { enabled: true } },
    title: { text: '💻 États des équipements', align: 'center', style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' } },
    labels: statsEquipes?.etatsCount ? Object.keys(statsEquipes.etatsCount) : ['Aucune donnée'],
    colors: ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'],
    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
    tooltip: { theme: 'dark', y: { formatter: (val, { seriesIndex }) => {
      const label = Object.keys(statsEquipes?.etatsCount || {})[seriesIndex];
      const total = statsEquipes?.totalEquipements || 1;
      return `${val} équipement(s) (${((val / total) * 100).toFixed(1)}%)`;
    } } }
  };

  const etatsPieSeries = statsEquipes?.etatsCount ? Object.values(statsEquipes.etatsCount) : [];

  // Configuration Graphique 6: Bar - Localisation
  const localBarOptions = {
    chart: { type: 'bar', height: 350, background: 'transparent', animations: { enabled: true } },
    title: { text: '📍 Équipements par localisation', align: 'center', style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' } },
    xaxis: { categories: locauxData.map(l => l.nom_local || 'Sans nom'), labels: { rotate: -45, style: { colors: '#94a3b8', fontSize: '11px' } } },
    yaxis: { title: { text: 'Nombre d\'équipements', style: { color: '#94a3b8' } }, labels: { style: { colors: '#94a3b8' } } },
    plotOptions: { bar: { borderRadius: 8, horizontal: false, dataLabels: { position: 'top' } } },
    dataLabels: { enabled: true, offsetY: -15, style: { colors: ['#f1f5f9'], fontSize: '10px' } },
    colors: ['#06b6d4'],
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s)` } }
  };

  const localBarSeries = [{ name: 'Équipements', data: locauxData.map(l => l.nombre_materiels || 0) }];

  if (loading) {
    return (
      <div className="dashboard-marque-loading">
        <div className="spinner-container">
          <div className="spinner-icon">🔄</div>
          <p>Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-marque-error">
        <div className="error-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button className="retry-btn" onClick={handleRefresh}>
          🔄 Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-marque">
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="header-title">
          <span className="header-icon">💻</span>
          <div>
            <h2>Dashboard Marques</h2>
            <p className="header-subtitle">Analyse des équipements par marque, équipe et localisation</p>
          </div>
        </div>
        <div className="header-actions">
          {lastUpdated && (
            <div className="last-updated">
              <span>🕐</span>
              <span>Mis à jour: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <button 
            className={`refresh-btn ${refreshing ? 'active' : ''}`} 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <span className={refreshing ? 'spin' : ''}>🔄</span>
            <span>{refreshing ? 'Chargement...' : 'Rafraîchir'}</span>
          </button>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon-wrapper">🏷️</div>
          <div className="stat-content">
            <div className="stat-value">{marques.length}</div>
            <div className="stat-label">Marques totales</div>
          </div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon-wrapper">🖥️</div>
          <div className="stat-content">
            <div className="stat-value">{totalEquipements}</div>
            <div className="stat-label">Équipements total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">⭐</div>
          <div className="stat-content">
            <div className="stat-value">{topMarques[0]?.nom_marque || '-'}</div>
            <div className="stat-label">Marque la plus utilisée</div>
            <div className="stat-percentage">{topMarques[0]?.nombre_equipements || 0} équipements</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">👥</div>
          <div className="stat-content">
            <div className="stat-value">{statsEquipes?.nombreEquipes || 0}</div>
            <div className="stat-label">Équipes concernées</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">📍</div>
          <div className="stat-content">
            <div className="stat-value">{locauxData.length}</div>
            <div className="stat-label">Locaux utilisés</div>
          </div>
        </div>
      </div>

      {/* Graphiques principaux - 2 colonnes */}
      <div className="charts-container">
        <div className="chart-card">
          <Chart options={barChartOptions} series={barChartSeries} type="bar" height={400} />
        </div>
        <div className="chart-card">
          <Chart options={pieChartOptions} series={pieChartSeries} type="donut" height={400} />
        </div>
      </div>

      {/* Top 5 et États */}
      <div className="charts-container">
        <div className="chart-card">
          <Chart options={top5BarOptions} series={top5BarSeries} type="bar" height={350} />
        </div>
        <div className="chart-card">
          <Chart options={etatsPieOptions} series={etatsPieSeries} type="pie" height={350} />
        </div>
      </div>

      {/* Équipes et Localisation */}
      <div className="charts-container">
        <div className="chart-card">
          <Chart options={equipeBarOptions} series={equipeBarSeries} type="bar" height={420} />
        </div>
        <div className="chart-card">
          <Chart options={localBarOptions} series={localBarSeries} type="bar" height={380} />
        </div>
      </div>

      {/* Liste détaillée des marques */}
      <div className="marque-list-container">
        <div className="marque-list-header">
          <h3>
            <span>📋</span> Liste détaillée des marques
          </h3>
          <div className="marque-list-count">{marques.length} marques au total</div>
        </div>
        <div className="marque-grid">
          {marques.map((marque, idx) => {
            const percentage = totalEquipements > 0 ? ((marque.nombre_equipements / totalEquipements) * 100).toFixed(1) : 0;
            return (
              <div key={marque.id_marque} className="marque-item">
                <div className="marque-rank" style={{ background: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                  #{idx + 1}
                </div>
                <div className="marque-info">
                  <span className="marque-name">{marque.nom_marque || 'Sans nom'}</span>
                  <span className="marque-count">{marque.nombre_equipements} équipements</span>
                </div>
                <div className="marque-bar">
                  <div 
                    className="marque-bar-fill" 
                    style={{ width: `${percentage}%`, background: COLORS[idx % COLORS.length] }}
                  />
                </div>
                <div className="marque-percentage">{percentage}%</div>
              </div>
            );
          })}
          {marques.length === 0 && (
            <div className="dashboard-empty-state">
              <p>Aucune marque trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMarque;