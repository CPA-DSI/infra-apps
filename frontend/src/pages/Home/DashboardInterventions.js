// Tableau de bord des interventions (page d'accueil) : nombre d'interventions,
// temps passé et utilisateurs bloqués sur un jour, un mois ou une année,
// comparés à la période précédente (« à date » quand la période est en cours).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import dayjs from 'dayjs';
import {
  FaTools, FaClock, FaUserSlash, FaChevronLeft, FaChevronRight, FaArrowRight, FaArrowUp, FaArrowDown,
} from 'react-icons/fa';
import { getInterventionStats } from '../../services/api';
import { cssVar } from '../../styles/cssVar';
import {
  PERIODES, dateParam, decaler, libellePeriode, estPeriodeCourante, libelleSerie, formatDuree,
} from '../Interventions/interventionConfig';
import './DashboardInterventions.css';

const ZOOM = { annee: 'mois', mois: 'jour' };
const LIBELLE_PRECEDENT = { jour: 'Veille', mois: 'Mois préc.', annee: 'Année préc.' };
const COMPARAISON = { jour: 'la veille', mois: 'le mois précédent', annee: "l'année précédente" };
const FONT = "'Inter Variable', system-ui, sans-serif";

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// Variation en % ; null = pas de base de comparaison (période précédente à zéro).
export const variation = (courant, precedent) => {
  if (!precedent) return courant ? null : 0;
  return ((courant - precedent) / precedent) * 100;
};

/**
 * Badge de tendance.
 *  - sens : 'neutre' (une hausse n'est ni bonne ni mauvaise) ou 'baisse' (une baisse est favorable)
 */
const Tendance = ({ valeur, sens, indisponible }) => {
  if (indisponible || valeur === null) {
    return (
      <span className="dit-trend neutral" title="Pas de base de comparaison sur la période précédente">N/A</span>
    );
  }
  const hausse = valeur > 0;
  const classe = valeur === 0 || sens === 'neutre' ? 'info' : (hausse ? 'negative' : 'positive');
  return (
    <span className={`dit-trend ${classe}`}>
      {valeur !== 0 && (hausse ? <FaArrowUp aria-hidden="true" /> : <FaArrowDown aria-hidden="true" />)}
      {hausse ? '+' : ''}{valeur.toFixed(1)}%
    </span>
  );
};

const CarteStat = ({ type, icon, label, valeur, unite, precedentLabel, precedent, tendance, sens, indisponible }) => (
  <div className={`dit-stat-card ${type}`}>
    <div className="dit-stat-header">
      <div className="dit-stat-icon" aria-hidden="true">{icon}</div>
      <span className="dit-stat-label">{label}</span>
    </div>
    <div className="dit-stat-main">
      <span className="dit-stat-value">{valeur}</span>
      {unite && <span className="dit-stat-unit">{unite}</span>}
    </div>
    <div className="dit-stat-footer">
      <span className="dit-stat-prev">
        {precedentLabel} : <strong>{precedent}</strong>
      </span>
      <Tendance valeur={tendance} sens={sens} indisponible={indisponible} />
    </div>
  </div>
);

const DashboardInterventions = () => {
  const navigate = useNavigate();
  const [periode, setPeriode] = useState('mois');
  const [ref, setRef] = useState(() => dayjs());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refKey = ref.format('YYYY-MM-DD');

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setError(null);
    getInterventionStats({ periode, date: dateParam(periode, dayjs(refKey)) })
      .then(d => { if (!annule) setData(d); })
      .catch(err => { if (!annule) setError(err.message || 'Chargement impossible.'); })
      .finally(() => { if (!annule) setLoading(false); });
    return () => { annule = true; };
  }, [periode, refKey]);

  const allerA = useCallback((p, d) => { setPeriode(p); setRef(d); }, []);

  const stats = data?.stats;
  const prec = data?.precedent;
  const precedentLabel = `${LIBELLE_PRECEDENT[periode]}${prec?.a_date ? ' (à date)' : ''}`;
  const indisponible = Boolean(prec?.a_venir);

  const chart = useMemo(() => {
    const serie = stats?.serie || [];
    const primary = cssVar('--color-primary');
    const warning = cssVar('--color-warning');
    return {
      series: [
        { name: 'Interventions', type: 'column', data: serie.map(p => p.total) },
        { name: 'Temps passé', type: 'line', data: serie.map(p => Math.round((p.duree / 60) * 100) / 100) },
      ],
      options: {
        chart: {
          type: 'line',
          toolbar: { show: false },
          fontFamily: FONT,
          foreColor: cssVar('--dash-text-sub'),
          background: 'transparent',
          events: {
            dataPointSelection: (_e, _ctx, { dataPointIndex }) => {
              const point = serie[dataPointIndex];
              if (!point || !ZOOM[periode]) return;
              allerA(ZOOM[periode], periode === 'annee' ? ref.month(point.index).date(1) : ref.date(point.index));
            },
          },
        },
        colors: [primary, warning],
        stroke: { width: [0, 3], curve: 'smooth' },
        markers: { size: [0, 3] },
        plotOptions: { bar: { borderRadius: 4, columnWidth: periode === 'annee' ? '50%' : '65%' } },
        fill: {
          type: ['gradient', 'solid'],
          gradient: { shade: 'dark', type: 'vertical', gradientToColors: [cssVar('--color-primary-light')], stops: [0, 100] },
        },
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right', labels: { colors: cssVar('--dash-text') } },
        grid: { borderColor: 'rgba(100, 116, 139, 0.15)', strokeDashArray: 4 },
        xaxis: {
          categories: serie.map(p => libelleSerie(periode, p.index)),
          tickAmount: periode === 'mois' ? 10 : undefined,
          labels: { rotate: 0, hideOverlappingLabels: true },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: [
          { title: { text: 'Interventions' }, min: 0, forceNiceScale: true, labels: { formatter: v => Math.round(v) } },
          { opposite: true, title: { text: 'Heures' }, min: 0, forceNiceScale: true, labels: { formatter: v => formatDuree(Math.round(v * 60)) } },
        ],
        tooltip: {
          theme: 'dark',
          shared: true,
          intersect: false,
          y: {
            formatter: (v, { seriesIndex }) => (seriesIndex === 1 ? formatDuree(Math.round(v * 60)) : `${v} intervention${v > 1 ? 's' : ''}`),
          },
        },
      },
    };
  }, [stats, periode, ref, allerA]);

  const renderCorps = () => {
    if (error) return <div className="dit-state dit-state--error" role="alert">Erreur : {error}</div>;
    if (!data) {
      return (
        <div className="dit-state">
          <div className="dit-spinner" />
          <span>Chargement des interventions…</span>
        </div>
      );
    }
    return (
      <div className={`dit-body ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
        <div className="dit-stats-grid">
          <CarteStat
            type="count" icon={<FaTools />} label="Interventions"
            valeur={fmt(stats.total)} unite={stats.total > 1 ? 'interventions' : 'intervention'}
            precedentLabel={precedentLabel} precedent={fmt(prec.total)}
            tendance={variation(stats.total, prec.total)} sens="neutre" indisponible={indisponible}
          />
          <CarteStat
            type="time" icon={<FaClock />} label="Durée totale"
            valeur={formatDuree(stats.duree_totale)} unite="hh:mm"
            precedentLabel={precedentLabel} precedent={formatDuree(prec.duree_totale)}
            tendance={variation(stats.duree_totale, prec.duree_totale)} sens="neutre" indisponible={indisponible}
          />
          <CarteStat
            type="bloque" icon={<FaUserSlash />} label="Utilisateurs bloqués"
            valeur={fmt(stats.utilisateurs_bloques)} unite={stats.utilisateurs_bloques > 1 ? 'interventions' : 'intervention'}
            precedentLabel={precedentLabel} precedent={fmt(prec.utilisateurs_bloques)}
            tendance={variation(stats.utilisateurs_bloques, prec.utilisateurs_bloques)} sens="baisse" indisponible={indisponible}
          />
        </div>

        <div className="dit-chart">
          <div className="dit-chart-head">
            <h3>Interventions par {periode === 'annee' ? 'mois' : periode === 'mois' ? 'jour' : 'heure'}</h3>
            {ZOOM[periode] && stats.total > 0 && (
              <span className="dit-hint">Cliquez sur une barre pour voir le {ZOOM[periode] === 'mois' ? 'mois' : 'jour'} en détail</span>
            )}
          </div>
          {stats.total > 0 ? (
            <Chart key={periode} type="line" height={320} series={chart.series} options={chart.options} />
          ) : (
            <div className="dit-empty">
              <FaTools aria-hidden="true" />
              <span>Aucune intervention sur {libellePeriode(periode, ref)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dit-root">
      <header className="dit-header">
        <div className="dit-header-left">
          <div className="dit-icon-box" aria-hidden="true"><FaTools /></div>
          <div>
            <h2 className="dit-title">
              Interventions <span className="dit-periode">{libellePeriode(periode, ref)}</span>
            </h2>
            <p className="dit-subtitle">
              Activité du service informatique&nbsp;•&nbsp;comparée à {COMPARAISON[periode]}
              {prec?.a_date ? ' à la même date' : ''}
            </p>
          </div>
        </div>

        <div className="dit-controls">
          <div className="dit-segment" role="group" aria-label="Période">
            {PERIODES.map(p => (
              <button key={p.key} type="button" className={periode === p.key ? 'active' : ''}
                aria-pressed={periode === p.key} onClick={() => allerA(p.key, ref)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="dit-segment">
            <button type="button" onClick={() => setRef(decaler(periode, ref, -1))} aria-label="Période précédente"><FaChevronLeft /></button>
            <button type="button" disabled={estPeriodeCourante(periode, ref)} onClick={() => setRef(dayjs())}>Aujourd'hui</button>
            <button type="button" onClick={() => setRef(decaler(periode, ref, 1))} aria-label="Période suivante"><FaChevronRight /></button>
          </div>
          <button type="button" className="dit-link"
            onClick={() => navigate(`/HistoriqueInterventions?periode=${periode}&date=${refKey}`)}>
            Voir le détail <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      {renderCorps()}
    </div>
  );
};

export default DashboardInterventions;
