import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import {
  fetchMarquesWithCount,
  fetchStatsEquipesEtats,
  fetchMaterielsByLocal
} from '../../services/api';
import { getChartTheme } from '../../styles/chartTheme';
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
  
  // Couleurs des graphiques (tokens du thème)
  const t = useMemo(getChartTheme, []);
  const COLORS = t.palette;

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
      style: { color: t.text, fontSize: '16px', fontWeight: '600' }
    },
    xaxis: {
      categories: marques.slice(0, 10).map(m => m.nom_marque || 'Sans nom'),
      labels: { rotate: -45, style: { colors: t.textSub, fontSize: '11px' } }
    },
    yaxis: {
      title: { text: 'Nombre d\'équipements', style: { color: t.textSub } },
      labels: { style: { colors: t.textSub } }
    },
    plotOptions: {
      bar: { borderRadius: 8, horizontal: false, columnWidth: '60%', dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: [t.text], fontSize: '11px' } },
    grid: { borderColor: t.grid, strokeDashArray: 5 },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s)` } },
    colors: [COLORS[0]],
    legend: { position: 'top', labels: { colors: t.textSub } }
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
      style: { color: t.text, fontSize: '16px', fontWeight: '600' }
    },
    labels: marques.slice(0, 10).map(m => m.nom_marque || 'Sans nom'),
    colors: COLORS,
    legend: { position: 'bottom', labels: { colors: t.textSub }, formatter: (val, opts) => `${val} (${marques[opts.seriesIndex]?.nombre_equipements || 0})` },
    plotOptions: { pie: { donut: { size: '55%', labels: { show: true, total: { show: true, label: 'Total', color: t.text, formatter: () => totalEquipements } } } } },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s) (${((val / totalEquipements) * 100).toFixed(1)}%)` } },
    responsive: [{ breakpoint: 480, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }]
  };

  const pieChartSeries = marques.slice(0, 10).map(m => m.nombre_equipements || 0);

  // Configuration Graphique 3: Horizontal Bar - Top 5 Marques
  const top5BarOptions = {
    chart: { type: 'bar', height: 350, background: 'transparent', animations: { enabled: true } },
    title: { text: '🏆 Top 5 des marques', align: 'center', style: { color: t.text, fontSize: '16px', fontWeight: '600' } },
    xaxis: { categories: topMarques.map(m => m.nom_marque || 'Sans nom'), labels: { style: { colors: t.textSub } } },
    yaxis: { title: { text: 'Nombre d\'équipements', style: { color: t.textSub } }, labels: { style: { colors: t.textSub } } },
    plotOptions: { bar: { borderRadius: 6, horizontal: false, dataLabels: { position: 'top' } } },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: [t.warning], fontSize: '12px', fontWeight: 'bold' } },
    colors: [t.warning],
    grid: { borderColor: t.grid },
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
    title: { text: '👥 Répartition par équipe', align: 'center', style: { color: t.text, fontSize: '16px', fontWeight: '600' } },
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '70%', dataLabels: { position: 'top' } } },
    xaxis: { categories: equipeBarData.categories, labels: { style: { colors: t.textSub } } },
    yaxis: { labels: { style: { colors: t.textSub, fontSize: '12px' } } },
    dataLabels: {
      enabled: true,
      offsetX: 24,
      style: { colors: [t.text], fontSize: '11px' },
      formatter: (val) => val
    },
    colors: [t.secondary],
    grid: { borderColor: t.grid, strokeDashArray: 5 },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => `${val} équipement(s) (${((val / (statsEquipes?.totalEquipements || 1)) * 100).toFixed(1)}%)` }
    }
  };

  const equipeBarSeries = [{ name: 'Équipements', data: equipeBarData.data }];

  // Configuration Graphique 5: Pie - États des PC
  const etatsPieOptions = {
    chart: { type: 'pie', background: 'transparent', animations: { enabled: true } },
    title: { text: '💻 États des équipements', align: 'center', style: { color: t.text, fontSize: '16px', fontWeight: '600' } },
    labels: statsEquipes?.etatsCount ? Object.keys(statsEquipes.etatsCount) : ['Aucune donnée'],
    colors: [t.success, t.warning, t.danger, t.primary, t.secondary, t.palette[5]],
    legend: { position: 'bottom', labels: { colors: t.textSub } },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
    tooltip: { theme: 'dark', y: { formatter: (val, { seriesIndex }) => {
      const total = statsEquipes?.totalEquipements || 1;
      return `${val} équipement(s) (${((val / total) * 100).toFixed(1)}%)`;
    } } }
  };

  const etatsPieSeries = statsEquipes?.etatsCount ? Object.values(statsEquipes.etatsCount) : [];

  // Configuration Graphique 6: Bar - Localisation
  const localBarOptions = {
    chart: { type: 'bar', height: 350, background: 'transparent', animations: { enabled: true } },
    title: { text: '📍 Équipements par localisation', align: 'center', style: { color: t.text, fontSize: '16px', fontWeight: '600' } },
    xaxis: { categories: locauxData.map(l => l.nom_local || 'Sans nom'), labels: { rotate: -45, style: { colors: t.textSub, fontSize: '11px' } } },
    yaxis: { title: { text: 'Nombre d\'équipements', style: { color: t.textSub } }, labels: { style: { colors: t.textSub } } },
    plotOptions: { bar: { borderRadius: 8, horizontal: false, dataLabels: { position: 'top' } } },
    dataLabels: { enabled: true, offsetY: -15, style: { colors: [t.text], fontSize: '10px' } },
    colors: [t.cyan],
    grid: { borderColor: t.grid },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} équipement(s)` } }
  };

  const localBarSeries = [{ name: 'Équipements', data: locauxData.map(l => l.nombre_materiels || 0) }];

  if (loading) {
    return (
      <div className="dashboard-marque-loading dash-card dash-card--state">
        <div>
          <div className="dm-spinner-icon">🔄</div>
          <p>Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-marque-error dash-card dash-card--state">
        <div className="dm-error-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button className="dm-retry-btn" onClick={handleRefresh}>
          🔄 Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-marque dash-card">
      {/* En-tête */}
      <div className="dash-header">
        <div className="dm-header-title">
          <span className="dm-header-icon">💻</span>
          <div>
            <h2>Dashboard Marques</h2>
            <p className="dm-header-subtitle">Analyse des équipements par marque, équipe et localisation</p>
          </div>
        </div>
        <div className="dm-header-actions">
          {lastUpdated && (
            <div className="dm-last-updated">
              <span>🕐</span>
              <span>Mis à jour: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <button 
            className={`dm-refresh-btn ${refreshing ? 'active' : ''}`} 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <span className={refreshing ? 'dm-spin' : ''}>🔄</span>
            <span>{refreshing ? 'Chargement...' : 'Rafraîchir'}</span>
          </button>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="dm-stats-cards">
        <div className="dm-stat-card">
          <div className="dm-stat-icon-wrapper">🏷️</div>
          <div className="dm-stat-content">
            <div className="dm-stat-value">{marques.length}</div>
            <div className="dm-stat-label">Marques totales</div>
          </div>
        </div>
        <div className="dm-stat-card highlight">
          <div className="dm-stat-icon-wrapper">🖥️</div>
          <div className="dm-stat-content">
            <div className="dm-stat-value">{totalEquipements}</div>
            <div className="dm-stat-label">Équipements total</div>
          </div>
        </div>
        <div className="dm-stat-card">
          <div className="dm-stat-icon-wrapper">⭐</div>
          <div className="dm-stat-content">
            <div className="dm-stat-value">{topMarques[0]?.nom_marque || '-'}</div>
            <div className="dm-stat-label">Marque la plus utilisée</div>
            <div className="dm-stat-percentage">{topMarques[0]?.nombre_equipements || 0} équipements</div>
          </div>
        </div>
        <div className="dm-stat-card">
          <div className="dm-stat-icon-wrapper">👥</div>
          <div className="dm-stat-content">
            <div className="dm-stat-value">{statsEquipes?.nombreEquipes || 0}</div>
            <div className="dm-stat-label">Équipes concernées</div>
          </div>
        </div>
        <div className="dm-stat-card">
          <div className="dm-stat-icon-wrapper">📍</div>
          <div className="dm-stat-content">
            <div className="dm-stat-value">{locauxData.length}</div>
            <div className="dm-stat-label">Locaux utilisés</div>
          </div>
        </div>
      </div>

      {/* Graphiques principaux - 2 colonnes */}
      <div className="dm-charts-container">
        <div className="dm-chart-card">
          <Chart options={barChartOptions} series={barChartSeries} type="bar" height={400} />
        </div>
        <div className="dm-chart-card">
          <Chart options={pieChartOptions} series={pieChartSeries} type="donut" height={400} />
        </div>
      </div>

      {/* Top 5 et États */}
      <div className="dm-charts-container">
        <div className="dm-chart-card">
          <Chart options={top5BarOptions} series={top5BarSeries} type="bar" height={350} />
        </div>
        <div className="dm-chart-card">
          <Chart options={etatsPieOptions} series={etatsPieSeries} type="pie" height={350} />
        </div>
      </div>

      {/* Équipes et Localisation */}
      <div className="dm-charts-container">
        <div className="dm-chart-card">
          <Chart options={equipeBarOptions} series={equipeBarSeries} type="bar" height={420} />
        </div>
        <div className="dm-chart-card">
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
            <div className="dm-dashboard-empty-state">
              <p>Aucune marque trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMarque;