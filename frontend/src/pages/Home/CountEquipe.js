// frontend/src/pages/Home/CountEquipe.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import DataTable from 'react-data-table-component';
import FilterComponent from './FilterComponent';
import { fetchCountEquipe } from '../../services/api';
import './CountEquipe.css';

const ACCENT_COLOR = '#8b5cf6';
const TOP_N = 10;

const normalize = (value) => (value || '').toString().toLowerCase();

const tableStyles = {
  table: { style: { backgroundColor: 'transparent' } },
  headRow: {
    style: { backgroundColor: '#1e293b', minHeight: '44px', borderBottom: '2px solid #334155' },
  },
  headCells: {
    style: {
      fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
  },
  rows: {
    style: {
      fontSize: '13px', color: '#f1f5f9', minHeight: '42px', backgroundColor: 'transparent',
      '&:not(:last-of-type)': { borderBottom: '1px solid #334155' },
    },
    highlightOnHoverStyle: {
      backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#f1f5f9', transitionDuration: '0.2s',
    },
  },
  pagination: {
    style: { backgroundColor: 'transparent', color: '#94a3b8', border: 'none' },
  },
  noData: {
    style: { backgroundColor: 'transparent', color: '#94a3b8' },
  },
};

const CountEquipe = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterText, setFilterText] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCountEquipe();
      const list = Array.isArray(data) ? data : [];
      // L'API renvoie nombre_equipe en string (sérialisation du BigInt de COUNT(*)
      // côté backend) : on le convertit une seule fois ici pour que les additions
      // et le tri numérique fonctionnent correctement en aval.
      setRows(list.map((row, idx) => ({ ...row, _id: idx, nombre_equipe: Number(row.nombre_equipe) || 0 })));
    } catch (err) {
      console.error('Erreur lors du chargement de CountEquipe:', err);
      setError(err.message || 'Erreur lors du chargement des équipes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    loadData();
  };

  // Filtrage par nom d'équipe ou de local
  const filteredRows = useMemo(() => {
    const term = normalize(filterText);
    if (!term) return rows;
    return rows.filter(
      (row) => normalize(row.equipe).includes(term) || normalize(row.nom_local).includes(term)
    );
  }, [rows, filterText]);

  // Une équipe peut apparaître dans plusieurs locaux : on agrège son total
  const equipeAggregates = useMemo(() => {
    const totals = new Map();
    filteredRows.forEach((row) => {
      const key = row.equipe || 'Non renseigné';
      totals.set(key, (totals.get(key) || 0) + (row.nombre_equipe || 0));
    });
    return [...totals.entries()]
      .map(([equipe, total]) => ({ equipe, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const totalEquipements = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (row.nombre_equipe || 0), 0),
    [filteredRows]
  );

  const nombreLocaux = useMemo(
    () => new Set(filteredRows.map((row) => row.nom_local || 'Non renseigné')).size,
    [filteredRows]
  );

  const topEquipe = equipeAggregates[0];

  // Top équipes pour le graphique, le reste regroupé dans "Autres"
  const chartData = useMemo(() => {
    const top = equipeAggregates.slice(0, TOP_N);
    const reste = equipeAggregates.slice(TOP_N);
    const resteSum = reste.reduce((sum, item) => sum + item.total, 0);

    const categories = top.map((item) => item.equipe);
    const data = top.map((item) => item.total);

    if (resteSum > 0) {
      categories.push(`Autres (${reste.length} équipes)`);
      data.push(resteSum);
    }

    // ApexCharts empile les barres horizontales du bas vers le haut
    return { categories: categories.reverse(), data: data.reverse() };
  }, [equipeAggregates]);

  const chartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: true, tools: { download: true, zoom: false, pan: false } },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
    },
    title: {
      text: equipeAggregates.length > TOP_N
        ? `👥 Top ${TOP_N} équipes par nombre d'équipements`
        : "👥 Équipes par nombre d'équipements",
      align: 'center',
      style: { color: '#f1f5f9', fontSize: '15px', fontWeight: '600' },
    },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 6, barHeight: '65%', dataLabels: { position: 'top' } },
    },
    xaxis: { categories: chartData.categories, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { style: { colors: '#94a3b8', fontSize: '12px' } } },
    dataLabels: {
      enabled: true,
      offsetX: 24,
      style: { colors: ['#f1f5f9'], fontSize: '11px' },
    },
    colors: [ACCENT_COLOR],
    grid: { borderColor: '#334155', strokeDashArray: 5 },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val) =>
          `${val} équipement(s)${totalEquipements ? ` (${((val / totalEquipements) * 100).toFixed(1)}%)` : ''}`,
      },
    },
  }), [chartData, equipeAggregates.length, totalEquipements]);

  const chartSeries = useMemo(
    () => [{ name: "Nombre d'équipements", data: chartData.data }],
    [chartData]
  );

  const tableColumns = useMemo(() => [
    { name: 'Équipe', selector: (row) => row.equipe || 'Non renseigné', sortable: true, grow: 2 },
    { name: 'Local', selector: (row) => row.nom_local || 'Non renseigné', sortable: true, grow: 2 },
    { name: 'Équipements', selector: (row) => row.nombre_equipe || 0, sortable: true, right: true, grow: 1 },
  ], []);

  if (loading) {
    return (
      <div className="count-equipe count-equipe-loading">
        <div className="count-equipe-spinner-icon">🔄</div>
        <p>Chargement des équipes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="count-equipe count-equipe-error">
        <div className="count-equipe-error-icon">⚠️</div>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button className="count-equipe-retry-btn" onClick={handleRefresh}>🔄 Réessayer</button>
      </div>
    );
  }

  return (
    <div className="count-equipe">
      <div className="count-equipe-header">
        <div className="count-equipe-header-title">
          <span className="count-equipe-header-icon">👥</span>
          <div>
            <h2>Équipements par équipe</h2>
            <p className="count-equipe-header-subtitle">Répartition des équipements par équipe et par local</p>
          </div>
        </div>
        <button
          className={`count-equipe-refresh-btn ${refreshing ? 'active' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <span className={refreshing ? 'count-equipe-spin' : ''}>🔄</span>
          <span>{refreshing ? 'Chargement...' : 'Rafraîchir'}</span>
        </button>
      </div>

      <div className="count-equipe-stats">
        <div className="count-equipe-stat-card">
          <div className="count-equipe-stat-value">{equipeAggregates.length}</div>
          <div className="count-equipe-stat-label">Équipes</div>
        </div>
        <div className="count-equipe-stat-card highlight">
          <div className="count-equipe-stat-value">{totalEquipements}</div>
          <div className="count-equipe-stat-label">Équipements total</div>
        </div>
        <div className="count-equipe-stat-card">
          <div className="count-equipe-stat-value">{topEquipe?.equipe || '-'}</div>
          <div className="count-equipe-stat-label">Équipe en tête</div>
          {topEquipe && <div className="count-equipe-stat-percentage">{topEquipe.total} équipement(s)</div>}
        </div>
        <div className="count-equipe-stat-card">
          <div className="count-equipe-stat-value">{nombreLocaux}</div>
          <div className="count-equipe-stat-label">Locaux</div>
        </div>
      </div>

      <FilterComponent
        filterText={filterText}
        onFilter={(e) => setFilterText(e.target.value)}
        onClear={() => setFilterText('')}
      />

      <div className="count-equipe-content">
        <div className="count-equipe-chart-card">
          {chartData.data.length > 0 ? (
            <Chart options={chartOptions} series={chartSeries} type="bar" height={360} />
          ) : (
            <div className="count-equipe-empty-state">Aucune donnée à afficher</div>
          )}
        </div>

        <div className="count-equipe-table-card">
          <DataTable
            keyField="_id"
            columns={tableColumns}
            data={filteredRows}
            pagination
            paginationPerPage={5}
            paginationRowsPerPageOptions={[5, 10, 20]}
            customStyles={tableStyles}
            highlightOnHover
            noDataComponent={<div className="count-equipe-empty-state">Aucune équipe trouvée</div>}
          />
        </div>
      </div>
    </div>
  );
};

export default CountEquipe;
