import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { fetchDocumentsStats } from '../../services/api';
import { getChartTheme, darkTitleStyle } from '../../styles/chartTheme';
import './DashboardDocuments.css';

const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',               icon: '🧾' },
  CONTRAT_MAINTENANCE: { label: 'Contrat maintenance',   icon: '🔧' },
  GARANTIE:            { label: 'Garantie',              icon: '🛡️' },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',      icon: '📘' },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',         icon: '🌐' },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',    icon: '🔑' },
  BON_LIVRAISON:       { label: 'Bon de livraison',      icon: '🚚' },
  RAPPORT_AUDIT:       { label: "Rapport d'audit",       icon: '📋' },
  AUTRE:               { label: 'Autre',                 icon: '📁' },
};

const DashboardDocuments = () => {
  const t = useMemo(getChartTheme, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalPiecesJointes: 0,
    documentsAvecPj: 0,
    documentsSansPj: 0,
    documentsPublics: 0,
    documentsPrives: 0,
    byCategory: [],
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDocumentsStats();
        setStats({
          totalDocuments: data.totalDocuments ?? 0,
          totalPiecesJointes: data.totalPiecesJointes ?? 0,
          documentsAvecPj: data.documentsAvecPj ?? 0,
          documentsSansPj: data.documentsSansPj ?? 0,
          documentsPublics: data.documentsPublics ?? 0,
          documentsPrives: data.documentsPrives ?? 0,
          byCategory: Array.isArray(data.byCategory) ? data.byCategory : [],
        });
      } catch (err) {
        console.error('Erreur chargement stats documents:', err);
        setError(err.message || 'Erreur lors du chargement des statistiques documents.');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const categoryData = useMemo(() => {
    return stats.byCategory
      .map(({ categorie, count }) => ({
        key: categorie,
        label: CATEGORY_CONFIG[categorie]?.label || categorie,
        count: count || 0,
        icon: CATEGORY_CONFIG[categorie]?.icon || '📄',
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.byCategory]);

  const COLORS = t.palette.slice(0, 9);

  const barChartOptions = {
    chart: {
      type: 'bar',
      height: 400,
      background: 'transparent',
      toolbar: { show: true, tools: { download: true, zoom: false, pan: false } },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    title: {
      text: '📊 Documents par catégorie',
      align: 'center',
      style: darkTitleStyle(t)
    },
    xaxis: {
      categories: categoryData.map(c => c.label),
      labels: { rotate: -45, style: { colors: t.textSub, fontSize: '11px' } }
    },
    yaxis: {
      title: { text: 'Nombre de documents', style: { color: t.textSub } },
      labels: { style: { colors: t.textSub } }
    },
    plotOptions: {
      bar: { borderRadius: 8, horizontal: false, columnWidth: '60%', dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: [t.text], fontSize: '11px' } },
    grid: { borderColor: t.grid, strokeDashArray: 5 },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} document(s)` } },
    colors: [COLORS[0]],
    legend: { position: 'top', labels: { colors: t.textSub } }
  };

  const barChartSeries = [{
    name: 'Documents',
    data: categoryData.map(c => c.count)
  }];

  const pieChartOptions = {
    chart: { type: 'donut', background: 'transparent', animations: { enabled: true, speed: 800 } },
    title: {
      text: '🥧 Répartition des documents',
      align: 'center',
      style: darkTitleStyle(t)
    },
    labels: categoryData.map(c => c.label),
    colors: categoryData.map((_, i) => COLORS[i % COLORS.length]),
    legend: { position: 'bottom', labels: { colors: t.textSub } },
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: t.text,
              formatter: () => stats.totalDocuments
            }
          }
        }
      }
    },
    dataLabels: { enabled: true, style: { colors: ['white'], fontSize: '11px' } },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val, opts) => {
          const pct = stats.totalDocuments > 0 ? ((val / stats.totalDocuments) * 100).toFixed(1) : 0;
          return `${val} (${pct}%)`;
        }
      }
    },
    responsive: [{ breakpoint: 480, options: { chart: { width: '100%' }, legend: { position: 'bottom' } } }]
  };

  const pieChartSeries = categoryData.map(c => c.count);

  const publicPieOptions = {
    chart: { type: 'pie', background: 'transparent', animations: { enabled: true } },
    title: {
      text: '🌐 Visibilité des documents',
      align: 'center',
      style: darkTitleStyle(t)
    },
    labels: ['Publics', 'Privés'],
    colors: [t.success, t.textSub],
    legend: { position: 'bottom', labels: { colors: t.textSub } },
    dataLabels: { enabled: true, style: { colors: ['white'], fontSize: '11px' } },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val) => `${val} document(s)`
      }
    }
  };

  const publicPieSeries = [stats.documentsPublics, stats.documentsPrives];

  const pjBarOptions = {
    chart: {
      type: 'bar',
      height: 350,
      background: 'transparent',
      animations: { enabled: true },
    },
    title: {
      text: '📎 Documents avec / sans pièce jointe supplémentaire',
      align: 'center',
      style: darkTitleStyle(t)
    },
    xaxis: {
      categories: ['Avec PJ supplémentaire(s)', 'Sans PJ supplémentaire'],
      labels: { style: { colors: t.textSub } }
    },
    yaxis: {
      title: { text: 'Nombre de documents', style: { color: t.textSub } },
      labels: { style: { colors: t.textSub } }
    },
    plotOptions: {
      bar: { borderRadius: 8, dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -15, style: { colors: [t.text], fontSize: '12px' } },
    colors: [t.cyan],
    grid: { borderColor: t.grid },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} document(s)` } }
  };

  const pjBarSeries = [{ name: 'Documents', data: [stats.documentsAvecPj, stats.documentsSansPj] }];

  if (loading) {
    return (
      <div className="dash-card dash-card--state dashboard-documents-loading">
        <div className="dd-spinner-container">
          <div className="dd-spinner-icon">🔄</div>
          <p>Chargement du tableau de bord documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-card dash-card--state dashboard-documents-error">
        <div className="dd-error-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="dash-card dashboard-documents">
      <div className="dd-header-title">
        <span className="dd-header-icon">📑</span>
        <div>
          <h2>Dashboard Documents</h2>
          <p className="dd-header-subtitle">Analyse des documents et pièces jointes par catégorie</p>
        </div>
      </div>

      <div className="dd-stats-cards">
        <div className="dd-stat-card">
          <div className="dd-stat-icon-wrapper">📑</div>
          <div className="dd-stat-content">
            <div className="dd-stat-value">{stats.totalDocuments}</div>
            <div className="dd-stat-label">Documents total</div>
          </div>
        </div>
        <div className="dd-stat-card">
          <div className="dd-stat-icon-wrapper">📎</div>
          <div className="dd-stat-content">
            <div className="dd-stat-value">{stats.totalPiecesJointes}</div>
            <div className="dd-stat-label">Pièces jointes</div>
          </div>
        </div>
        <div className="dd-stat-card highlight">
          <div className="dd-stat-icon-wrapper">📂</div>
          <div className="dd-stat-content">
            <div className="dd-stat-value">{stats.documentsAvecPj}</div>
            <div className="dd-stat-label">Documents avec PJ suppl.</div>
          </div>
        </div>
        <div className="dd-stat-card">
          <div className="dd-stat-icon-wrapper">🌐</div>
          <div className="dd-stat-content">
            <div className="dd-stat-value">{stats.documentsPublics}</div>
            <div className="dd-stat-label">Documents publics</div>
          </div>
        </div>
        <div className="dd-stat-card">
          <div className="dd-stat-icon-wrapper">🔒</div>
          <div className="dd-stat-content">
            <div className="dd-stat-value">{stats.documentsPrives}</div>
            <div className="dd-stat-label">Documents privés</div>
          </div>
        </div>
      </div>

      <div className="dd-charts-container">
        <div className="dd-chart-card">
          <Chart options={barChartOptions} series={barChartSeries} type="bar" height={400} />
        </div>
        <div className="dd-chart-card">
          <Chart options={pieChartOptions} series={pieChartSeries} type="donut" height={400} />
        </div>
      </div>

      <div className="dd-charts-container">
        <div className="dd-chart-card">
          <Chart options={publicPieOptions} series={publicPieSeries} type="pie" height={350} />
        </div>
        <div className="dd-chart-card">
          <Chart options={pjBarOptions} series={pjBarSeries} type="bar" height={350} />
        </div>
      </div>

      <div className="dd-category-list-container">
        <div className="dd-category-list-header">
          <h3>
            <span>📋</span> Détail par catégorie
          </h3>
          <div className="dd-category-list-count">{categoryData.length} catégories</div>
        </div>
        <div className="dd-category-grid">
          {categoryData.map((cat, idx) => {
            const pct = stats.totalDocuments > 0 ? ((cat.count / stats.totalDocuments) * 100).toFixed(1) : 0;
            return (
              <div key={cat.key} className="dd-category-item">
                <div className="dd-category-rank" style={{ background: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                  <span className="dd-category-icon">{cat.icon}</span>
                </div>
                <div className="dd-category-info">
                  <span className="dd-category-name">{cat.label}</span>
                  <span className="dd-category-count">{cat.count} document{cat.count > 1 ? 's' : ''}</span>
                </div>
                <div className="dd-category-bar">
                  <div
                    className="dd-category-bar-fill"
                    style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }}
                  />
                </div>
                <div className="dd-category-percentage">{pct}%</div>
              </div>
            );
          })}
          {categoryData.length === 0 && (
            <div className="dd-dashboard-empty-state">
              <p>Aucune catégorie trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardDocuments;
