import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { fetchDocumentsStats } from '../../services/api';
import './DashboardDocuments.css';

const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',               color: '#065f46', bg: '#d1fae5', icon: '🧾' },
  CONTRAT_MAINTENANCE: { label: 'Contrat maintenance',   color: '#7c2d12', bg: '#ffedd5', icon: '🔧' },
  GARANTIE:            { label: 'Garantie',              color: '#3730a3', bg: '#e0e7ff', icon: '🛡️' },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',      color: '#155e75', bg: '#cffafe', icon: '📘' },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',         color: '#4d7c0f', bg: '#ecfccb', icon: '🌐' },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',    color: '#831843', bg: '#fce7f3', icon: '🔑' },
  BON_LIVRAISON:       { label: 'Bon de livraison',      color: '#92400e', bg: '#fef3c7', icon: '🚚' },
  RAPPORT_AUDIT:       { label: "Rapport d'audit",       color: '#9f1239', bg: '#ffe4e6', icon: '📋' },
  AUTRE:               { label: 'Autre',                 color: '#4b5563', bg: '#f3f4f6', icon: '📁' },
};

const DashboardDocuments = () => {
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
        color: CATEGORY_CONFIG[categorie]?.color || '#6b7280',
        bg: CATEGORY_CONFIG[categorie]?.bg || '#f3f4f6',
        icon: CATEGORY_CONFIG[categorie]?.icon || '📄',
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.byCategory]);

  const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316'
  ];

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
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    xaxis: {
      categories: categoryData.map(c => c.label),
      labels: { rotate: -45, style: { colors: '#94a3b8', fontSize: '11px' } }
    },
    yaxis: {
      title: { text: 'Nombre de documents', style: { color: '#94a3b8' } },
      labels: { style: { colors: '#94a3b8' } }
    },
    plotOptions: {
      bar: { borderRadius: 8, horizontal: false, columnWidth: '60%', dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -20, style: { colors: ['#f1f5f9'], fontSize: '11px' } },
    grid: { borderColor: '#334155', strokeDashArray: 5 },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} document(s)` } },
    colors: [COLORS[0]],
    legend: { position: 'top', labels: { colors: '#94a3b8' } }
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
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    labels: categoryData.map(c => c.label),
    colors: categoryData.map((_, i) => COLORS[i % COLORS.length]),
    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: '#f1f5f9',
              formatter: () => stats.totalDocuments
            }
          }
        }
      }
    },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
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
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    labels: ['Publics', 'Privés'],
    colors: ['#10b981', '#6b7280'],
    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
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
      style: { color: '#f1f5f9', fontSize: '16px', fontWeight: '600' }
    },
    xaxis: {
      categories: ['Avec PJ supplémentaire(s)', 'Sans PJ supplémentaire'],
      labels: { style: { colors: '#94a3b8' } }
    },
    yaxis: {
      title: { text: 'Nombre de documents', style: { color: '#94a3b8' } },
      labels: { style: { colors: '#94a3b8' } }
    },
    plotOptions: {
      bar: { borderRadius: 8, dataLabels: { position: 'top' } }
    },
    dataLabels: { enabled: true, offsetY: -15, style: { colors: ['#f1f5f9'], fontSize: '12px' } },
    colors: ['#06b6d4'],
    grid: { borderColor: '#334155' },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} document(s)` } }
  };

  const pjBarSeries = [{ name: 'Documents', data: [stats.documentsAvecPj, stats.documentsSansPj] }];

  if (loading) {
    return (
      <div className="dashboard-documents-loading">
        <div className="spinner-container">
          <div className="spinner-icon">🔄</div>
          <p>Chargement du tableau de bord documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-documents-error">
        <div className="error-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-documents">
      <div className="header-title">
        <span className="header-icon">📑</span>
        <div>
          <h2>Dashboard Documents</h2>
          <p className="header-subtitle">Analyse des documents et pièces jointes par catégorie</p>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon-wrapper">📑</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalDocuments}</div>
            <div className="stat-label">Documents total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">📎</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalPiecesJointes}</div>
            <div className="stat-label">Pièces jointes</div>
          </div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon-wrapper">📂</div>
          <div className="stat-content">
            <div className="stat-value">{stats.documentsAvecPj}</div>
            <div className="stat-label">Documents avec PJ suppl.</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">🌐</div>
          <div className="stat-content">
            <div className="stat-value">{stats.documentsPublics}</div>
            <div className="stat-label">Documents publics</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper">🔒</div>
          <div className="stat-content">
            <div className="stat-value">{stats.documentsPrives}</div>
            <div className="stat-label">Documents privés</div>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card">
          <Chart options={barChartOptions} series={barChartSeries} type="bar" height={400} />
        </div>
        <div className="chart-card">
          <Chart options={pieChartOptions} series={pieChartSeries} type="donut" height={400} />
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card">
          <Chart options={publicPieOptions} series={publicPieSeries} type="pie" height={350} />
        </div>
        <div className="chart-card">
          <Chart options={pjBarOptions} series={pjBarSeries} type="bar" height={350} />
        </div>
      </div>

      <div className="category-list-container">
        <div className="category-list-header">
          <h3>
            <span>📋</span> Détail par catégorie
          </h3>
          <div className="category-list-count">{categoryData.length} catégories</div>
        </div>
        <div className="category-grid">
          {categoryData.map((cat, idx) => {
            const pct = stats.totalDocuments > 0 ? ((cat.count / stats.totalDocuments) * 100).toFixed(1) : 0;
            return (
              <div key={cat.key} className="category-item">
                <div className="category-rank" style={{ background: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                  <span className="category-icon">{cat.icon}</span>
                </div>
                <div className="category-info">
                  <span className="category-name">{cat.label}</span>
                  <span className="category-count">{cat.count} document{cat.count > 1 ? 's' : ''}</span>
                </div>
                <div className="category-bar">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }}
                  />
                </div>
                <div className="category-percentage">{pct}%</div>
              </div>
            );
          })}
          {categoryData.length === 0 && (
            <div className="dashboard-empty-state">
              <p>Aucune catégorie trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardDocuments;
