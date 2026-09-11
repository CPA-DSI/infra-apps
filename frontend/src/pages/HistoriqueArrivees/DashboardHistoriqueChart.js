import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Chart from 'react-apexcharts';
import { fetchAllMouvements, fetchAnneesDisponibles } from '../../services/api';
import './DashboardHistoriqueChart.css';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

const PERIODS = [
  { key: 'all',  label: 'Annuel',    range: [0, 11] },
  { key: 'q1',   label: 'T1',        range: [0, 2]  },
  { key: 'q2',   label: 'T2',        range: [3, 5]  },
  { key: 'q3',   label: 'T3',        range: [6, 8]  },
  { key: 'q4',   label: 'T4',        range: [9, 11] },
  { key: 's1',   label: 'S1',        range: [0, 5]  },
  { key: 's2',   label: 'S2',        range: [6, 11] },
];

// Fenêtre par défaut (N-3 à N+1), utilisée tant que les années réellement
// disponibles n'ont pas encore été récupérées depuis le backend, ou en cas d'échec.
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEAR_BOUNDS = { minYear: CURRENT_YEAR - 3, maxYear: CURRENT_YEAR + 1 };

const THEME = {
  in:      '#6366f1',
  out:     '#f43f5e',
  net:     '#10b981',
  ratio:   '#f59e0b',
  sub:     '#64748b',
  inGrad:  '#818cf8',
  outGrad: '#fda4af',
};

// ─── Icônes SVG inline ────────────────────────────────────────────────────────
const Icons = {
  ArrowUp: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  ArrowDown: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  ),
  Box: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  TrendingDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/>
      <rect x="17" y="3" width="4" height="18"/>
    </svg>
  ),
  LineChart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Table: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
};

// ─── Composant StatCard avec mini sparkline ───────────────────────────────────
const StatCard = ({
  type, icon, label, value, unit,
  prevYear, prevValue, trendValue, trendPositiveWhen,
  sparkData,
}) => {
  const isPositive  = trendPositiveWhen === 'up' ? trendValue >= 0 : trendValue <= 0;
  const trendClass  = trendValue === 0 ? 'neutral' : (isPositive ? 'positive' : 'negative');
  const TrendIcon   = trendValue >= 0 ? Icons.TrendingUp : Icons.TrendingDown;
  const sign        = trendValue >= 0 ? '+' : '';

  // Couleur du sparkline selon le type de carte
  const sparkColor = { in: THEME.in, out: THEME.out, net: THEME.net, ratio: THEME.ratio }[type] || THEME.in;

  const sparkOptions = useMemo(() => ({
    chart: {
      type: 'line',
      sparkline: { enabled: true },
      animations: { enabled: false },
    },
    stroke: { curve: 'smooth', width: 2 },
    colors: [sparkColor],
    tooltip: { enabled: false },
  }), [sparkColor]);

  const sparkSeries = useMemo(() => [{ data: sparkData || [] }], [sparkData]);

  return (
    <div className={`stat-card ${type}`}>
      <div className="stat-card-header">
        <div className="stat-icon-box">{icon}</div>
        <span className="stat-label">{label}</span>
      </div>

      <div className="stat-card-body">
        <div className="stat-main-row">
          <span className="stat-value">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </span>
          <span className="stat-unit">{unit}</span>
        </div>

        {/* Mini sparkline */}
        {sparkData && sparkData.length > 0 && (
          <div className="stat-sparkline">
            <Chart
              options={sparkOptions}
              series={sparkSeries}
              type="line"
              height={40}
              width="100%"
            />
          </div>
        )}

        <div className="stat-footer-row">
          <div className="stat-prev-year">
            <span className="stat-label-prev">N-1 ({prevYear}) :</span>
            <span className="stat-value-prev">
              {typeof prevValue === 'number' ? prevValue.toLocaleString('fr-FR') : prevValue}
            </span>
          </div>
          <div className={`stat-trend ${trendClass}`}>
            <TrendIcon />
            <span>{sign}{trendValue.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Barre de progression Entrées vs Sorties ──────────────────────────────────
const FlowProgressBar = ({ entrees, sorties }) => {
  const total = entrees + sorties;
  if (total === 0) return null;
  const pctIn  = ((entrees / total) * 100).toFixed(1);
  const pctOut = ((sorties / total) * 100).toFixed(1);

  return (
    <div className="flow-progress-bar">
      <div className="flow-progress-labels">
        <span className="flow-label-in">
          <span className="flow-dot dot-in" />
          Entrées {pctIn}%
        </span>
        <span className="flow-label-out">
          Sorties {pctOut}%
          <span className="flow-dot dot-out" />
        </span>
      </div>
      <div className="flow-progress-track">
        <div
          className="flow-progress-fill fill-in"
          style={{ width: `${pctIn}%` }}
        />
        <div
          className="flow-progress-fill fill-out"
          style={{ width: `${pctOut}%` }}
        />
      </div>
    </div>
  );
};

// ─── Tableau récapitulatif mensuel ────────────────────────────────────────────
const MonthlyTable = ({ monthlyEntrees, monthlySorties, year, visibleRange }) => {
  const [open, setOpen] = useState(false);
  const [start, end] = visibleRange;

  const rows = useMemo(() => {
    return MONTHS.slice(start, end + 1).map((month, i) => {
      const idx = start + i;
      const e   = monthlyEntrees[idx] || 0;
      const s   = monthlySorties[idx] || 0;
      const net = e - s;
      return { month, e, s, net };
    });
  }, [monthlyEntrees, monthlySorties, start, end]);

  return (
    <div className="monthly-table-wrapper">
      <button className="monthly-table-toggle" onClick={() => setOpen(o => !o)}>
        <Icons.Table />
        <span>Détail mensuel {year}</span>
        {open ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
      </button>

      {open && (
        <div className="monthly-table-container">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="col-in">Entrées</th>
                <th className="col-out">Sorties</th>
                <th className="col-net">Solde Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ month, e, s, net }) => (
                <tr key={month}>
                  <td className="col-month">{month}</td>
                  <td className="col-in">{e.toLocaleString('fr-FR')}</td>
                  <td className="col-out">{s.toLocaleString('fr-FR')}</td>
                  <td className={`col-net ${net >= 0 ? 'positive' : 'negative'}`}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
const DashboardHistoriqueChart = () => {
  // ── États ─────────────────────────────────────────────────────────────────
  const [year,           setYear]           = useState(CURRENT_YEAR);
  const [yearBounds,     setYearBounds]     = useState(DEFAULT_YEAR_BOUNDS);
  const [allEntrees,     setAllEntrees]     = useState(Array(12).fill(0));
  const [allSorties,     setAllSorties]     = useState(Array(12).fill(0));
  const [allPrevEntrees, setAllPrevEntrees] = useState(Array(12).fill(0));
  const [allPrevSorties, setAllPrevSorties] = useState(Array(12).fill(0));
  const [,      setTotals]      = useState({ totalEntrees: 0, totalSorties: 0 });
  const [chartType,   setChartType]   = useState('bar');   // 'bar' | 'line'
  const [period,      setPeriod]      = useState('all');   // clé de PERIODS
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // ── Années sélectionnables, dérivées des données réelles en base ──────────
  const selectableYears = useMemo(() => {
    const { minYear, maxYear } = yearBounds;
    const length = Math.max(0, maxYear - minYear + 1);
    return Array.from({ length }, (_, i) => minYear + i);
  }, [yearBounds]);

  // ── Récupération une seule fois de la plage d'années disponibles ──────────
  useEffect(() => {
    const controller = new AbortController();

    fetchAnneesDisponibles(controller.signal)
      .then(bounds => {
        if (bounds) setYearBounds(bounds);
      })
      .catch(() => {
        // En cas d'échec, on conserve la fenêtre par défaut (N-3 à N+1)
      });

    return () => controller.abort();
  }, []);

  // ── Période active ─────────────────────────────────────────────────────────
  const activePeriod = useMemo(
    () => PERIODS.find(p => p.key === period) || PERIODS[0],
    [period]
  );
  const [rangeStart, rangeEnd] = activePeriod.range;

  // ── Données filtrées selon la période ─────────────────────────────────────
  const filteredEntrees = useMemo(
    () => allEntrees.slice(rangeStart, rangeEnd + 1),
    [allEntrees, rangeStart, rangeEnd]
  );
  const filteredSorties = useMemo(
    () => allSorties.slice(rangeStart, rangeEnd + 1),
    [allSorties, rangeStart, rangeEnd]
  );
  const filteredPrevEntrees = useMemo(
    () => allPrevEntrees.slice(rangeStart, rangeEnd + 1),
    [allPrevEntrees, rangeStart, rangeEnd]
  );
  const filteredPrevSorties = useMemo(
    () => allPrevSorties.slice(rangeStart, rangeEnd + 1),
    [allPrevSorties, rangeStart, rangeEnd]
  );

  const series = useMemo(() => [
    { name: 'Entrées', data: filteredEntrees },
    { name: 'Sorties', data: filteredSorties },
  ], [filteredEntrees, filteredSorties]);

  // ── Totaux de la période filtrée ───────────────────────────────────────────
  const periodEntrees     = useMemo(() => filteredEntrees.reduce((a, b) => a + b, 0), [filteredEntrees]);
  const periodSorties     = useMemo(() => filteredSorties.reduce((a, b) => a + b, 0), [filteredSorties]);
  // N-1 calculé sur la même plage de mois que la période sélectionnée, pour une comparaison cohérente
  const periodPrevEntrees = useMemo(() => filteredPrevEntrees.reduce((a, b) => a + b, 0), [filteredPrevEntrees]);
  const periodPrevSorties = useMemo(() => filteredPrevSorties.reduce((a, b) => a + b, 0), [filteredPrevSorties]);

  // ── Métriques dérivées ─────────────────────────────────────────────────────
  const netValue     = periodEntrees - periodSorties;
  const prevNetValue = periodPrevEntrees - periodPrevSorties;
  const hasPrevData  = periodPrevEntrees > 0 || periodPrevSorties > 0;

  const calculateTrend = useCallback((current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }, []);

  const entreesPercent  = hasPrevData ? calculateTrend(periodEntrees, periodPrevEntrees) : 0;
  const sortiesPercent  = hasPrevData ? calculateTrend(periodSorties, periodPrevSorties) : 0;
  const netValuePercent = hasPrevData ? calculateTrend(netValue, prevNetValue) : 0;

  // ── Mois les plus actifs sur la période affichée ───────────────────────────
  const peakMonth = useMemo(() => {
    const maxEntrees = Math.max(0, ...filteredEntrees);
    const maxSorties = Math.max(0, ...filteredSorties);
    const maxEntreesIdx = filteredEntrees.indexOf(maxEntrees);
    const maxSortiesIdx = filteredSorties.indexOf(maxSorties);
    return {
      entrees: maxEntrees > 0 ? { month: MONTHS[rangeStart + maxEntreesIdx], value: maxEntrees } : null,
      sorties: maxSorties > 0 ? { month: MONTHS[rangeStart + maxSortiesIdx], value: maxSorties } : null,
    };
  }, [filteredEntrees, filteredSorties, rangeStart]);

  // ── Annotations du mois pic sur le graphique ───────────────────────────────
  const peakAnnotations = useMemo(() => {
    const annotations = { xaxis: [] };
    if (peakMonth.entrees) {
      annotations.xaxis.push({
        x: MONTHS_SHORT[MONTHS.indexOf(peakMonth.entrees.month)] + ' ' + year,
        borderColor: THEME.in,
        strokeDashArray: 4,
        label: {
          text: '▲ Pic E',
          style: { color: '#fff', background: THEME.in, fontSize: '10px', fontFamily: 'Poppins, sans-serif' },
          position: 'top',
          orientation: 'horizontal',
        },
      });
    }
    if (peakMonth.sorties) {
      annotations.xaxis.push({
        x: MONTHS_SHORT[MONTHS.indexOf(peakMonth.sorties.month)] + ' ' + year,
        borderColor: THEME.out,
        strokeDashArray: 4,
        label: {
          text: '▼ Pic S',
          style: { color: '#fff', background: THEME.out, fontSize: '10px', fontFamily: 'Poppins, sans-serif' },
          position: 'top',
          orientation: 'horizontal',
        },
      });
    }
    return annotations;
  }, [peakMonth, year]);

  // ── Options du graphique ───────────────────────────────────────────────────
  const chartOptions = useMemo(() => {
    const isLine = chartType === 'line';
    const categories = MONTHS_SHORT.slice(rangeStart, rangeEnd + 1).map(m => `${m} ${year}`);

    return {
      chart: {
        type: chartType,
        toolbar: { show: false },
        fontFamily: 'Poppins, system-ui, sans-serif',
        animations: { enabled: true, speed: 600, animateGradually: { enabled: true, delay: 80 } },
        background: 'transparent',
      },
      annotations: peakAnnotations,
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '52%',
          borderRadius: isLine ? 0 : 6,
          borderRadiusApplication: 'end',
        },
      },
      stroke: isLine
        ? { show: true, curve: 'smooth', width: 3 }
        : { show: true, colors: ['transparent'], width: 2 },
      markers: isLine ? { size: 5, strokeWidth: 2, hover: { size: 7 } } : {},
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            colors: Array(categories.length).fill(THEME.sub),
            fontSize: '11px',
            fontFamily: 'Poppins, sans-serif',
          },
        },
        crosshairs: {
          show: true,
          stroke: { color: 'rgba(100,116,139,0.3)', width: 1, dashArray: 4 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: [THEME.sub], fontSize: '12px', fontFamily: 'Poppins, sans-serif' },
          formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v,
        },
      },
      grid: {
        borderColor: 'rgba(100, 116, 139, 0.1)',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 10, bottom: 0, left: 10 },
      },
      colors: [THEME.in, THEME.out],
      dataLabels: { enabled: false },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: [THEME.sub, THEME.sub] },
        markers: { size: 6, shape: 'circle' },
        itemMargin: { horizontal: 12 },
      },
      fill: isLine
        ? {
            type: 'gradient',
            gradient: {
              shade: 'dark', type: 'vertical', shadeIntensity: 0.3,
              gradientToColors: [THEME.inGrad, THEME.outGrad],
              opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100],
            },
          }
        : {
            type: 'gradient',
            gradient: {
              shade: 'dark', type: 'vertical',
              gradientToColors: [THEME.inGrad, THEME.outGrad],
              stops: [0, 100],
            },
          },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        style: { fontFamily: 'Poppins, sans-serif', fontSize: '12px' },
        y: {
          formatter: (v, { seriesIndex, dataPointIndex }) => {
            const monthName = MONTHS[rangeStart + dataPointIndex] || '';
            const label = seriesIndex === 0 ? 'Entrées' : 'Sorties';
            return `${label} (${monthName} ${year}): <strong>${v.toLocaleString('fr-FR')}</strong> unités`;
          },
        },
      },
    };
  }, [chartType, year, rangeStart, rangeEnd, peakAnnotations]);

  // ── Déduplication des données par mois ────────────────────────────────────
  const deduplicateByMonth = useCallback((data) => {
    const map = {};
    for (let m = 1; m <= 12; m++) {
      map[m] = { mois: m, total_entrees: 0, total_sorties: 0, _seen: false };
    }
    data.forEach(item => {
      const mois = parseInt(item.mois);
      if (!isNaN(mois) && mois >= 1 && mois <= 12) {
        if (!map[mois]._seen) {
          map[mois].total_entrees = Number(item.total_entrees) || 0;
          map[mois].total_sorties = Number(item.total_sorties) || 0;
          map[mois]._seen = true;
        } else {
          map[mois].total_entrees += Number(item.total_entrees) || 0;
          map[mois].total_sorties += Number(item.total_sorties) || 0;
        }
      }
    });
    return Object.values(map)
      .sort((a, b) => a.mois - b.mois)
      .map(({ _seen, ...rest }) => rest);
  }, []);

  // ── Chargement des données ─────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [currentYearData, prevYearData] = await Promise.all([
          fetchAllMouvements(year, controller.signal),
          fetchAllMouvements(year - 1, controller.signal),
        ]);
        if (!currentYearData) {
          if (!controller.signal.aborted) {
            setError(`Aucune donnée disponible pour ${year}`);
          }
          return;
        }

        const monthlyEntrees = Array(12).fill(0);
        const monthlySorties = Array(12).fill(0);
        const monthlyPrevEntrees = Array(12).fill(0);
        const monthlyPrevSorties = Array(12).fill(0);
        let annualEntrees = 0, annualSorties = 0;

        const dedupedCurrent = deduplicateByMonth(currentYearData);
        dedupedCurrent.forEach(item => {
          const idx = item.mois - 1;
          monthlyEntrees[idx] = item.total_entrees;
          monthlySorties[idx] = item.total_sorties;
          annualEntrees += item.total_entrees;
          annualSorties += item.total_sorties;
        });

        if (prevYearData) {
          const dedupedPrev = deduplicateByMonth(prevYearData);
          dedupedPrev.forEach(item => {
            const idx = item.mois - 1;
            monthlyPrevEntrees[idx] = item.total_entrees;
            monthlyPrevSorties[idx] = item.total_sorties;
          });
        }

        setAllEntrees(monthlyEntrees);
        setAllSorties(monthlySorties);
        setAllPrevEntrees(monthlyPrevEntrees);
        setAllPrevSorties(monthlyPrevSorties);
        setTotals({ totalEntrees: annualEntrees, totalSorties: annualSorties });

      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [year, deduplicateByMonth]);

  // ── États de chargement / erreur ───────────────────────────────────────────
  if (loading) return (
    <div className="dashboard-historique">
      <div className="dashboard-loading">
        <div className="spinner" />
        <span>Chargement des données {year}…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-historique">
      <div className="dashboard-error">
        <Icons.Chart />
        <span>Erreur : {error}</span>
      </div>
    </div>
  );

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <div className="dashboard-historique">

      {/* ── En-tête ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-icon-box">
            <Icons.Chart />
          </div>
          <div>
            <h2 className="dashboard-title">
              Bilan <span className="dashboard-year">{year}</span>
              {period !== 'all' && (
                <span className="dashboard-period-badge">
                  {activePeriod.label}
                </span>
              )}
            </h2>
            <p className="dashboard-subtitle">
              Flux d'arrivées et de sorties&nbsp;•&nbsp;Historique annuel
            </p>
          </div>
        </div>

        {/* ── Contrôles ── */}
        <div className="dashboard-controls">

          {/* Sélecteur d'année */}
          <div className="year-selector-dash">
            <label htmlFor="dashboard-year-select" className="year-selector-label">
              <i className="fa fa-calendar" aria-hidden="true"></i>
              Année
            </label>
            <select
              id="dashboard-year-select"
              className="year-selector-select"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {selectableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Sélecteur de période */}
          <div className="period-selector">
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`period-btn ${period === p.key ? 'active' : ''}`}
                onClick={() => setPeriod(p.key)}
                title={p.label}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Toggle Bar / Line */}
          <div className="chart-type-toggle">
            <button
              className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
              title="Graphique en barres"
            >
              <Icons.BarChart /> Barres
            </button>
            <button
              className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Graphique en courbes"
            >
              <Icons.LineChart /> Courbes
            </button>
          </div>
        </div>
      </header>

      {/* ── Grille des statistiques ── */}
      <div className="dashboard-stats-grid">

        {/* Entrées */}
        <StatCard
          type="in"
          icon={<Icons.ArrowUp />}
          label="Entrées"
          value={periodEntrees}
          unit="unités"
          prevYear={year - 1}
          prevValue={periodPrevEntrees}
          trendValue={entreesPercent}
          trendPositiveWhen="up"
          sparkData={allEntrees}
        />

        {/* Sorties */}
        <StatCard
          type="out"
          icon={<Icons.ArrowDown />}
          label="Sorties"
          value={periodSorties}
          unit="unités"
          prevYear={year - 1}
          prevValue={periodPrevSorties}
          trendValue={sortiesPercent}
          trendPositiveWhen="down"
          sparkData={allSorties}
        />

        {/* Solde Net */}
        <StatCard
          type={netValue >= 0 ? 'net' : 'out'}
          icon={<Icons.Box />}
          label="Solde Net"
          value={netValue}
          unit="unités"
          prevYear={year - 1}
          prevValue={prevNetValue}
          trendValue={netValuePercent}
          trendPositiveWhen="up"
          sparkData={allEntrees.map((e, i) => e - allSorties[i])}
        />

      </div>

      {/* ── Barre de progression Entrées vs Sorties ── */}
      <FlowProgressBar entrees={periodEntrees} sorties={periodSorties} />

      {/* ── Mois les plus actifs ── */}
      {(peakMonth.entrees || peakMonth.sorties) && (
        <div className="peak-months-bar">
          {peakMonth.entrees && (
            <div className="peak-item peak-in">
              <Icons.Star />
              <span className="peak-label">Pic Entrées :</span>
              <span className="peak-month">{peakMonth.entrees.month}</span>
              <span className="peak-value">{peakMonth.entrees.value.toLocaleString('fr-FR')} unités</span>
            </div>
          )}
          {peakMonth.sorties && (
            <div className="peak-item peak-out">
              <Icons.Star />
              <span className="peak-label">Pic Sorties :</span>
              <span className="peak-month">{peakMonth.sorties.month}</span>
              <span className="peak-value">{peakMonth.sorties.value.toLocaleString('fr-FR')} unités</span>
            </div>
          )}
        </div>
      )}

      {/* ── Graphique principal ── */}
      <div className="dashboard-chart-container">
        <Chart
          key={`${chartType}-${period}`}
          options={chartOptions}
          series={series}
          type={chartType}
          height={340}
        />
      </div>

      {/* ── Tableau récapitulatif mensuel ── */}
      <MonthlyTable
        monthlyEntrees={allEntrees}
        monthlySorties={allSorties}
        year={year}
        visibleRange={activePeriod.range}
      />
    </div>
  );
};

export default DashboardHistoriqueChart;
