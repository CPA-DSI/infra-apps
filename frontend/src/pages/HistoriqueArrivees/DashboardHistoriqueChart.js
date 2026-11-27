import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { fetchAllMouvements, fetchAnneesDisponibles } from '../../services/api';
import { cssVar } from '../../styles/cssVar';
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

const NOW           = new Date();
const CURRENT_YEAR  = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth(); // 0-11

// Fenêtre par défaut (N-3 à N+1), utilisée tant que les années réellement
// disponibles n'ont pas encore été récupérées depuis le backend, ou en cas d'échec.
const DEFAULT_YEAR_BOUNDS = { minYear: CURRENT_YEAR - 3, maxYear: CURRENT_YEAR + 1 };

const FONT = "'Inter Variable', system-ui, sans-serif";
const ZEROS = Array(12).fill(0);

// ApexCharts a besoin de vraies couleurs : on lit les tokens de styles/theme.css
const THEME = {
  in:      cssVar('--color-primary'),
  out:     cssVar('--color-rose'),
  net:     cssVar('--color-success'),
  ratio:   cssVar('--color-warning'),
  sub:     cssVar('--color-text-sub'),
  inGrad:  cssVar('--color-primary-light'),
  outGrad: cssVar('--color-rose-border'),
  white:   cssVar('--color-bg'),
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// Réponse de GET /mouvements/stats/:year : [{ mois: 1..12, total_entrees, total_sorties }]
// → deux tableaux de 12 valeurs. Les éventuels doublons d'un même mois sont cumulés.
const toMonthly = (rows) => {
  const entrees = Array(12).fill(0);
  const sorties = Array(12).fill(0);
  (Array.isArray(rows) ? rows : []).forEach(({ mois, total_entrees, total_sorties }) => {
    const idx = parseInt(mois, 10) - 1;
    if (idx >= 0 && idx < 12) {
      entrees[idx] += Number(total_entrees) || 0;
      sorties[idx] += Number(total_sorties) || 0;
    }
  });
  return { entrees, sorties };
};

// Variation en % par rapport à N-1. null = pas de base de comparaison.
// Le dénominateur est en valeur absolue : pour un solde net négatif
// (ex. -564 → -224), une amélioration doit donner une variation positive.
const computeTrend = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

// ─── Icônes SVG inline ────────────────────────────────────────────────────────
const Icons = {
  ArrowUp: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  ArrowDown: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Chart: () => (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  ),
  Box: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  TrendingDown: () => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  ),
  BarChart: () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/>
      <rect x="17" y="3" width="4" height="18"/>
    </svg>
  ),
  LineChart: () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Star: () => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Table: () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
};

// ─── Composant StatCard avec mini sparkline ───────────────────────────────────
const StatCard = ({
  type, icon, label, value, unit,
  prevLabel, prevValue, trendValue, trendPositiveWhen,
  sparkData,
}) => {
  const hasTrend   = trendValue !== null && Number.isFinite(trendValue);
  const isPositive = trendPositiveWhen === 'up' ? trendValue >= 0 : trendValue <= 0;
  const trendClass = !hasTrend || trendValue === 0 ? 'neutral' : (isPositive ? 'positive' : 'negative');
  const TrendIcon  = trendValue >= 0 ? Icons.TrendingUp : Icons.TrendingDown;
  const sign       = trendValue > 0 ? '+' : '';

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
  // Une courbe plate à zéro n'apporte rien : on ne l'affiche pas
  const showSpark = sparkData && sparkData.length > 1 && sparkData.some(v => v !== 0);

  return (
    <div className={`dhc-stat-card ${type}`}>
      <div className="dhc-stat-card-header">
        <div className="dhc-stat-icon-box" aria-hidden="true">{icon}</div>
        <span className="dhc-stat-label">{label}</span>
      </div>

      <div className="dhc-stat-card-body">
        <div className="dhc-stat-main-row">
          <span className="dhc-stat-value">{fmt(value)}</span>
          <span className="dhc-stat-unit">{unit}</span>
        </div>

        <div className="dhc-stat-sparkline">
          {showSpark && (
            <Chart options={sparkOptions} series={sparkSeries} type="line" height={40} width="100%" />
          )}
        </div>

        <div className="dhc-stat-footer-row">
          <div className="dhc-stat-prev-year">
            <span className="dhc-stat-label-prev">{prevLabel} :</span>
            <span className="dhc-stat-value-prev">{fmt(prevValue)}</span>
          </div>
          {hasTrend ? (
            <div className={`dhc-stat-trend ${trendClass}`}>
              <TrendIcon />
              <span>{sign}{trendValue.toFixed(1)}%</span>
            </div>
          ) : (
            <div className="dhc-stat-trend neutral" title="Aucune valeur N-1 sur la même période : variation non calculable">
              <span>N/A</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Barre de progression Entrées vs Sorties ──────────────────────────────────
const FlowProgressBar = ({ entrees, sorties }) => {
  const total = entrees + sorties;
  if (total === 0) return null;
  const pctIn  = (entrees / total) * 100;
  const pctOut = 100 - pctIn;

  return (
    <div className="dhc-flow-progress-bar">
      <div className="dhc-flow-progress-labels">
        <span className="dhc-flow-label-in">
          <span className="dhc-flow-dot dhc-dot-in" />
          Entrées {pctIn.toFixed(1)}%
        </span>
        <span className="dhc-flow-label-out">
          Sorties {pctOut.toFixed(1)}%
          <span className="dhc-flow-dot dhc-dot-out" />
        </span>
      </div>
      <div className="dhc-flow-progress-track">
        {pctIn > 0  && <div className="dhc-flow-progress-fill dhc-fill-in"  style={{ width: `${pctIn}%` }} />}
        {pctOut > 0 && <div className="dhc-flow-progress-fill dhc-fill-out" style={{ width: `${pctOut}%` }} />}
      </div>
    </div>
  );
};

// ─── Tableau récapitulatif mensuel ────────────────────────────────────────────
const MonthlyTable = ({ monthlyEntrees, monthlySorties, year, visibleRange }) => {
  const [open, setOpen] = useState(false);
  const [start, end] = visibleRange;

  const rows = useMemo(() => MONTHS.slice(start, end + 1).map((month, i) => {
    const idx = start + i;
    const e = monthlyEntrees[idx] || 0;
    const s = monthlySorties[idx] || 0;
    const isFuture = year > CURRENT_YEAR || (year === CURRENT_YEAR && idx > CURRENT_MONTH);
    return { month, e, s, net: e - s, isFuture };
  }), [monthlyEntrees, monthlySorties, start, end, year]);

  const totals = useMemo(() => {
    const e = sum(rows.map(r => r.e));
    const s = sum(rows.map(r => r.s));
    return { e, s, net: e - s };
  }, [rows]);

  const netCell = (net) => `${net > 0 ? '+' : ''}${fmt(net)}`;
  const netClass = (net) => (net > 0 ? 'positive' : net < 0 ? 'negative' : '');

  return (
    <div className="dhc-monthly-table-wrapper">
      <button type="button" className="dhc-monthly-table-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icons.Table />
        <span>Détail mensuel {year}</span>
        {open ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
      </button>

      {open && (
        <div className="dhc-monthly-table-container">
          <table className="dhc-monthly-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="col-in">Entrées</th>
                <th className="col-out">Sorties</th>
                <th className="col-net">Solde Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ month, e, s, net, isFuture }) => (
                <tr key={month} className={isFuture ? 'is-future' : undefined}>
                  <td className="col-month">{month}</td>
                  {isFuture ? (
                    <td colSpan={3} className="col-future">à venir</td>
                  ) : (
                    <>
                      <td className="col-in">{fmt(e)}</td>
                      <td className="col-out">{fmt(s)}</td>
                      <td className={`col-net ${netClass(net)}`}>{netCell(net)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-month">Total</td>
                <td className="col-in">{fmt(totals.e)}</td>
                <td className="col-out">{fmt(totals.s)}</td>
                <td className={`col-net ${netClass(totals.net)}`}>{netCell(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
const DashboardHistoriqueChart = () => {
  // ── États ─────────────────────────────────────────────────────────────────
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [yearBounds, setYearBounds] = useState(DEFAULT_YEAR_BOUNDS);
  const [data,       setData]       = useState(null); // { entrees, sorties, prevEntrees, prevSorties }
  const [chartType,  setChartType]  = useState('bar'); // 'bar' | 'line'
  const [period,     setPeriod]     = useState('all'); // clé de PERIODS
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Années sélectionnables, dérivées des données réelles en base ──────────
  const selectableYears = useMemo(() => {
    const { minYear, maxYear } = yearBounds;
    const length = Math.max(0, maxYear - minYear + 1);
    return Array.from({ length }, (_, i) => maxYear - i); // plus récente en premier
  }, [yearBounds]);

  // ── Récupération une seule fois de la plage d'années disponibles ──────────
  useEffect(() => {
    const controller = new AbortController();
    fetchAnneesDisponibles(controller.signal)
      .then(bounds => {
        if (bounds && Number.isInteger(bounds.minYear) && Number.isInteger(bounds.maxYear)) {
          setYearBounds(bounds);
        }
      })
      .catch(() => {
        // En cas d'échec, on conserve la fenêtre par défaut (N-3 à N+1)
      });
    return () => controller.abort();
  }, []);

  // ── Chargement des données de l'année et de N-1 ───────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchAllMouvements(year, signal),
      // N-1 sert uniquement à la comparaison : son échec ne bloque pas l'affichage
      fetchAllMouvements(year - 1, signal).catch(() => null),
    ])
      .then(([currentRows, prevRows]) => {
        if (signal.aborted) return;
        const current = toMonthly(currentRows);
        const prev    = toMonthly(prevRows);
        setData({
          entrees: current.entrees,
          sorties: current.sorties,
          prevEntrees: prev.entrees,
          prevSorties: prev.sorties,
        });
      })
      .catch(err => {
        if (!signal.aborted) setError(err.message || 'Erreur de chargement');
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [year]);

  const allEntrees     = data?.entrees     ?? ZEROS;
  const allSorties     = data?.sorties     ?? ZEROS;
  const allPrevEntrees = data?.prevEntrees ?? ZEROS;
  const allPrevSorties = data?.prevSorties ?? ZEROS;

  // ── Période active ─────────────────────────────────────────────────────────
  const activePeriod = PERIODS.find(p => p.key === period) || PERIODS[0];
  const [rangeStart, rangeEnd] = activePeriod.range;

  // Pour l'année en cours, les mois futurs sont vides : on compare N-1 sur les
  // mêmes mois écoulés uniquement, sinon l'année partielle paraît toujours en baisse.
  const isPartialYear = year === CURRENT_YEAR && rangeEnd > CURRENT_MONTH;
  const isFuturePeriod = year > CURRENT_YEAR || (year === CURRENT_YEAR && rangeStart > CURRENT_MONTH);
  const cmpEnd = isPartialYear ? Math.max(rangeStart - 1, CURRENT_MONTH) : rangeEnd;

  // ── Données filtrées selon la période ─────────────────────────────────────
  const filteredEntrees = useMemo(() => allEntrees.slice(rangeStart, rangeEnd + 1), [allEntrees, rangeStart, rangeEnd]);
  const filteredSorties = useMemo(() => allSorties.slice(rangeStart, rangeEnd + 1), [allSorties, rangeStart, rangeEnd]);
  const filteredNet     = useMemo(() => filteredEntrees.map((e, i) => e - filteredSorties[i]), [filteredEntrees, filteredSorties]);

  const series = useMemo(() => [
    { name: 'Entrées', data: filteredEntrees },
    { name: 'Sorties', data: filteredSorties },
  ], [filteredEntrees, filteredSorties]);

  // ── Totaux de la période ───────────────────────────────────────────────────
  const periodEntrees     = sum(filteredEntrees);
  const periodSorties     = sum(filteredSorties);
  const periodPrevEntrees = sum(allPrevEntrees.slice(rangeStart, cmpEnd + 1));
  const periodPrevSorties = sum(allPrevSorties.slice(rangeStart, cmpEnd + 1));
  const hasMovements      = periodEntrees + periodSorties > 0;

  // ── Métriques dérivées ─────────────────────────────────────────────────────
  const netValue     = periodEntrees - periodSorties;
  const prevNetValue = periodPrevEntrees - periodPrevSorties;
  // Période future : rien à comparer (sinon N-1 donnerait un faux -100 %)
  const hasPrevData  = !isFuturePeriod && (periodPrevEntrees > 0 || periodPrevSorties > 0);

  const entreesPercent  = hasPrevData ? computeTrend(periodEntrees, periodPrevEntrees) : null;
  const sortiesPercent  = hasPrevData ? computeTrend(periodSorties, periodPrevSorties) : null;
  const netValuePercent = hasPrevData ? computeTrend(netValue, prevNetValue) : null;

  const prevLabel = isPartialYear && !isFuturePeriod
    ?`N-1 (${year - 1}, ${MONTHS_SHORT[rangeStart].toLowerCase()}.–${MONTHS_SHORT[cmpEnd].toLowerCase()}.)`
    : `N-1 (${year - 1})`;

  // ── Mois les plus actifs sur la période affichée ───────────────────────────
  const peakMonth = useMemo(() => {
    const peak = (values) => {
      const max = Math.max(0, ...values);
      if (max === 0) return null;
      const idx = rangeStart + values.indexOf(max);
      return { idx, month: MONTHS[idx], value: max };
    };
    return { entrees: peak(filteredEntrees), sorties: peak(filteredSorties) };
  }, [filteredEntrees, filteredSorties, rangeStart]);

  // ── Annotations du mois pic sur le graphique ───────────────────────────────
  const peakAnnotations = useMemo(() => {
    const make = (idx, text, color) => ({
      x: `${MONTHS_SHORT[idx]} ${year}`,
      borderColor: color,
      strokeDashArray: 4,
      label: {
        text,
        borderColor: color,
        style: { color: THEME.white, background: color, fontSize: '10px', fontFamily: FONT },
        position: 'top',
        orientation: 'horizontal',
      },
    });
    const { entrees, sorties } = peakMonth;
    const xaxis = [];
    if (entrees && sorties && entrees.idx === sorties.idx) {
      // Même mois : une seule annotation, sinon les deux étiquettes se superposent
      xaxis.push(make(entrees.idx, '★ Pic E + S', THEME.sub));
    } else {
      if (entrees) xaxis.push(make(entrees.idx, '▲ Pic E', THEME.in));
      if (sorties) xaxis.push(make(sorties.idx, '▼ Pic S', THEME.out));
    }
    return { xaxis };
  }, [peakMonth, year]);

  // ── Options du graphique ───────────────────────────────────────────────────
  const chartOptions = useMemo(() => {
    const isLine = chartType === 'line';
    const categories = MONTHS_SHORT.slice(rangeStart, rangeEnd + 1).map(m => `${m} ${year}`);

    return {
      chart: {
        type: chartType,
        toolbar: { show: false },
        fontFamily: FONT,
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
          style: { colors: Array(categories.length).fill(THEME.sub), fontSize: '11px', fontFamily: FONT },
        },
        crosshairs: {
          show: true,
          stroke: { color: 'rgba(100,116,139,0.3)', width: 1, dashArray: 4 },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: { colors: [THEME.sub], fontSize: '12px', fontFamily: FONT },
          // Quantités entières : pas de graduations décimales sur les petites valeurs
          formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString()),
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
      fill: {
        type: 'gradient',
        gradient: isLine
          ? {
              shade: 'dark', type: 'vertical', shadeIntensity: 0.3,
              gradientToColors: [THEME.inGrad, THEME.outGrad],
              opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100],
            }
          : {
              shade: 'dark', type: 'vertical',
              gradientToColors: [THEME.inGrad, THEME.outGrad],
              stops: [0, 100],
            },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        style: { fontFamily: FONT, fontSize: '12px' },
        x: {
          formatter: (_v, { dataPointIndex }) => `${MONTHS[rangeStart + dataPointIndex] || ''} ${year}`,
        },
        y: {
          formatter: (v) => `${fmt(v)} unités`,
        },
      },
    };
  }, [chartType, year, rangeStart, rangeEnd, peakAnnotations]);

  // ── Rendu du corps (chargement / erreur / données) ─────────────────────────
  const renderBody = () => {
    if (error) {
      return (
        <div className="dhc-error" role="alert">
          <Icons.Chart />
          <span>Erreur : {error}</span>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="dhc-loading">
          <div className="dhc-spinner" />
          <span>Chargement des données {year}…</span>
        </div>
      );
    }

    return (
      <div className={`dhc-body ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
        {/* ── Grille des statistiques ── */}
        <div className="dhc-stats-grid">
          <StatCard
            type="in"
            icon={<Icons.ArrowUp />}
            label="Entrées"
            value={periodEntrees}
            unit="unités"
            prevLabel={prevLabel}
            prevValue={periodPrevEntrees}
            trendValue={entreesPercent}
            trendPositiveWhen="up"
            sparkData={filteredEntrees}
          />
          <StatCard
            type="out"
            icon={<Icons.ArrowDown />}
            label="Sorties"
            value={periodSorties}
            unit="unités"
            prevLabel={prevLabel}
            prevValue={periodPrevSorties}
            trendValue={sortiesPercent}
            trendPositiveWhen="down"
            sparkData={filteredSorties}
          />
          <StatCard
            type={netValue >= 0 ? 'net' : 'out'}
            icon={<Icons.Box />}
            label="Solde Net"
            value={netValue}
            unit="unités"
            prevLabel={prevLabel}
            prevValue={prevNetValue}
            trendValue={netValuePercent}
            trendPositiveWhen="up"
            sparkData={filteredNet}
          />
        </div>

        {/* ── Barre de progression Entrées vs Sorties ── */}
        <FlowProgressBar entrees={periodEntrees} sorties={periodSorties} />

        {/* ── Mois les plus actifs ── */}
        {(peakMonth.entrees || peakMonth.sorties) && (
          <div className="dhc-peak-months-bar">
            {peakMonth.entrees && (
              <div className="dhc-peak-item dhc-peak-in">
                <Icons.Star />
                <span className="dhc-peak-label">Pic Entrées :</span>
                <span className="dhc-peak-month">{peakMonth.entrees.month}</span>
                <span className="dhc-peak-value">{fmt(peakMonth.entrees.value)} unités</span>
              </div>
            )}
            {peakMonth.sorties && (
              <div className="dhc-peak-item dhc-peak-out">
                <Icons.Star />
                <span className="dhc-peak-label">Pic Sorties :</span>
                <span className="dhc-peak-month">{peakMonth.sorties.month}</span>
                <span className="dhc-peak-value">{fmt(peakMonth.sorties.value)} unités</span>
              </div>
            )}
          </div>
        )}

        {/* ── Graphique principal ── */}
        <div className="dhc-chart-container">
          {hasMovements ? (
            <Chart
              key={`${chartType}-${period}`}
              options={chartOptions}
              series={series}
              type={chartType}
              height={340}
            />
          ) : (
            <div className="dhc-empty">
              <Icons.Chart />
              <span>
                {isFuturePeriod
                  ? `Période à venir : aucun mouvement pour ${activePeriod.label === 'Annuel' ? year : `${activePeriod.label} ${year}`}`
                  : `Aucun mouvement enregistré sur ${activePeriod.label === 'Annuel' ? year : `${activePeriod.label} ${year}`}`}
              </span>
            </div>
          )}
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

  // ── Rendu principal ────────────────────────────────────────────────────────
  // L'en-tête reste affiché pendant le chargement et en cas d'erreur, pour
  // pouvoir changer d'année sans recharger la page.
  return (
    <div className="dhc-root">

      {/* ── En-tête ── */}
      <header className="dhc-header">
        <div className="dhc-header-left">
          <div className="dhc-icon-box">
            <Icons.Chart />
          </div>
          <div>
            <h2 className="dhc-title">
              Bilan <span className="dhc-year">{year}</span>
              {period !== 'all' && (
                <span className="dhc-period-badge">{activePeriod.label}</span>
              )}
            </h2>
            <p className="dhc-subtitle">
              Flux d'arrivées et de sorties&nbsp;•&nbsp;
              {year === CURRENT_YEAR ? `Année en cours, au ${NOW.toLocaleDateString('fr-FR')}` : 'Historique annuel'}
            </p>
          </div>
        </div>

        {/* ── Contrôles ── */}
        <div className="dhc-controls">

          {/* Sélecteur d'année */}
          <div className="dhc-year-selector">
            <label htmlFor="dashboard-year-select" className="dhc-year-selector-label">
              <i className="fa fa-calendar" aria-hidden="true"></i>
              Année
            </label>
            <select
              id="dashboard-year-select"
              className="dhc-year-selector-select"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {selectableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Sélecteur de période */}
          <div className="dhc-period-selector">
            {PERIODS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`dhc-period-btn ${period === p.key ? 'active' : ''}`}
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                title={p.label}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Toggle Bar / Line */}
          <div className="dhc-chart-type-toggle">
            <button
              type="button"
              className={`dhc-toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
              aria-pressed={chartType === 'bar'}
              onClick={() => setChartType('bar')}
              title="Graphique en barres"
            >
              <Icons.BarChart /> Barres
            </button>
            <button
              type="button"
              className={`dhc-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
              aria-pressed={chartType === 'line'}
              onClick={() => setChartType('line')}
              title="Graphique en courbes"
            >
              <Icons.LineChart /> Courbes
            </button>
          </div>
        </div>
      </header>

      {renderBody()}
    </div>
  );
};

export default DashboardHistoriqueChart;
