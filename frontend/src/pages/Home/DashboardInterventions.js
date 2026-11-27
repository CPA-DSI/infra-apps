// Tableau de bord des interventions (page d'accueil) : nombre d'interventions,
// temps passé, utilisateurs bloqués et récurrences sur un jour, un mois ou une année,
// comparés à la période précédente (« à date » quand la période est en cours).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import dayjs from 'dayjs';
import {
  FaTools, FaClock, FaUserSlash, FaChevronLeft, FaChevronRight, FaArrowRight, FaArrowUp, FaArrowDown, FaRedo,
} from 'react-icons/fa';
import { getInterventionStats } from '../../services/api';
import { cssVar } from '../../styles/cssVar';
import {
  PERIODES, TYPE_CONFIG, INTERVENTION_TYPES, dateParam, decaler, libellePeriode, estPeriodeCourante, libelleSerie, formatDuree,
} from '../Interventions/interventionConfig';
import './DashboardInterventions.css';

const ZOOM = { annee: 'mois', mois: 'jour' };
// Granularité de la série selon la période
const UNITE_SERIE = { annee: 'mois', mois: 'jour', jour: 'heure' };
const LIBELLE_PRECEDENT = { jour: 'Veille', mois: 'Mois préc.', annee: 'Année préc.' };
const COMPARAISON = { jour: 'la veille', mois: 'le mois précédent', annee: "l'année précédente" };
const CUMUL_VS = { jour: 'à la veille', mois: 'au mois précédent', annee: "à l'année précédente" };
const FONT ="'Inter Variable', system-ui, sans-serif";

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

const CarteStat = ({ type, icon, label, valeur, unite, detail, precedentLabel, precedent, tendance, sens, indisponible }) => (
  <div className={`dit-stat-card ${type}`}>
    <div className="dit-stat-header">
      <div className="dit-stat-icon" aria-hidden="true">{icon}</div>
      <span className="dit-stat-label">{label}</span>
    </div>
    <div className="dit-stat-main">
      <span className="dit-stat-value">{valeur}</span>
      {unite && <span className="dit-stat-unit">{unite}</span>}
    </div>
    {detail && <div className="dit-stat-detail">{detail}</div>}
    <div className="dit-stat-footer">
      <span className="dit-stat-prev">
        {precedentLabel} : <strong>{precedent}</strong>
      </span>
      <Tendance valeur={tendance} sens={sens} indisponible={indisponible} />
    </div>
  </div>
);

// Couleur pleine d'une tonalité de TYPE_CONFIG (mêmes valeurs que .tone--*{--tone-solid}).
const couleurTone = (tone) => cssVar(tone === 'neutral' ? '--color-text-sub' : `--color-${tone}`);

const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

// Répartition par type : anneau, clic sur une part → historique filtré sur ce type.
const RepartitionTypes = ({ parType, total, onSelect }) => {
  const types = useMemo(() => INTERVENTION_TYPES.filter(t => parType?.[t]), [parType]);
  const options = useMemo(() => ({
    chart: {
      type: 'donut',
      fontFamily: FONT,
      background: 'transparent',
      events: { dataPointSelection: (_e, _ctx, { dataPointIndex }) => onSelect(types[dataPointIndex]) },
    },
    labels: types.map(t => TYPE_CONFIG[t].label),
    colors: types.map(t => couleurTone(TYPE_CONFIG[t].tone)),
    stroke: { width: 2, colors: [cssVar('--dash-bg-deep')] },
    legend: { position: 'bottom', labels: { colors: cssVar('--dash-text-sub') }, fontSize: '12px' },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '62%',
          labels: {
            show: true,
            value: { color: cssVar('--dash-text'), fontSize: '22px', fontWeight: 700 },
            total: { show: true, label: 'Total', color: cssVar('--dash-text-sub'), formatter: () => fmt(total) },
          },
        },
      },
    },
    tooltip: { theme: 'dark', y: { formatter: v => `${v} (${pct(v, total)} %)` } },
  }), [types, total, onSelect]);

  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Répartition par type</h3>
        <span className="dit-hint">Clic : voir ce type</span>
      </div>
      <Chart type="donut" height={260} series={types.map(t => parType[t])} options={options} />
    </div>
  );
};

// Temps passé par technicien : barres horizontales (liste déjà triée par durée côté API).
const TempsTechniciens = ({ techniciens }) => {
  const max = techniciens[0]?.duree || 1;
  return (
    <div className="dit-panel">
      <div className="dit-chart-head"><h3>Temps passé par technicien</h3></div>
      <ul className="dit-techs">
        {techniciens.map(t => (
          <li key={t.id_technicien ?? 'aucun'}>
            <span className="dit-tech-nom" title={t.nom}>{t.nom}</span>
            <span className="dit-tech-barre" aria-hidden="true">
              <span style={{ width: `${Math.max(2, (t.duree / max) * 100)}%` }} />
            </span>
            <span className="dit-tech-val">
              {formatDuree(t.duree)} <small>· {t.total}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Durée moyenne (sur les seules interventions dont la durée est renseignée) et
// part des durées manquantes : la durée totale est sous-estimée d'autant.
const DetailDuree = ({ stats }) => {
  const avecDuree = stats.avec_duree ?? stats.total;
  const sansDuree = stats.total - avecDuree;
  return (
    <>
      moyenne <strong>{avecDuree ? formatDuree(Math.round(stats.duree_totale / avecDuree)) : '—'}</strong>
      {sansDuree > 0 && (
        <span className="dit-alerte" title="Durée non renseignée : la durée totale est sous-estimée">
          {' '}· {fmt(sansDuree)} sans durée ({pct(sansDuree, stats.total)} %)
        </span>
      )}
    </>
  );
};

const ONGLETS_RECURRENCE = [
  { key: 'materiels', label: 'Matériels', param: 'materiel', vide: 'Aucun matériel avec plusieurs interventions' },
  { key: 'utilisateurs', label: 'Utilisateurs', param: 'beneficiaire', vide: 'Aucun utilisateur avec plusieurs interventions' },
];

// Matériels / utilisateurs revenant plusieurs fois (hors installation, préventif,
// déménagement) ; clic sur une ligne → historique filtré.
const Recurrences = ({ recurrences, materielsConcernes, onSelect }) => {
  const [onglet, setOnglet] = useState('materiels');
  const courant = ONGLETS_RECURRENCE.find(o => o.key === onglet);
  const lignes = recurrences?.[onglet] || [];
  const max = lignes[0]?.total || 1;
  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Récurrences</h3>
        <div className="dit-segment dit-segment--small" role="group" aria-label="Récurrences">
          {ONGLETS_RECURRENCE.map(o => (
            <button key={o.key} type="button" className={onglet === o.key ? 'active' : ''}
              aria-pressed={onglet === o.key} onClick={() => setOnglet(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <span className="dit-hint">
        2 interventions ou plus, hors travaux planifiés
        {onglet === 'materiels' ? ` · ${fmt(materielsConcernes)} matériel${materielsConcernes > 1 ? 's' : ''} concerné${materielsConcernes > 1 ? 's' : ''} au total` : ''}
      </span>
      {lignes.length ? (
        <ul className="dit-recurrences">
          {lignes.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => onSelect(courant.param, r.id)}
                title={`Voir les interventions de ${r.libelle}`}>
                <span className="dit-rec-nom">
                  <strong>{r.libelle}</strong>
                  {r.detail && <small>{r.detail}</small>}
                </span>
                <span className="dit-tech-barre" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
                </span>
                <span className="dit-tech-val">
                  {r.total}× <small>· {formatDuree(r.duree)}</small>
                  {r.bloquees > 0 && <FaUserSlash className="dit-rec-bloque" title={`${r.bloquees} bloquante${r.bloquees > 1 ? 's' : ''}`} aria-label={`${r.bloquees} bloquante${r.bloquees > 1 ? 's' : ''}`} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dit-empty dit-empty--small"><FaRedo aria-hidden="true" /><span>{courant.vide}</span></div>
      )}
    </div>
  );
};

// Options ApexCharts communes aux panneaux secondaires.
const baseOptions = () => ({
  chart: { toolbar: { show: false }, fontFamily: FONT, foreColor: cssVar('--dash-text-sub'), background: 'transparent', zoom: { enabled: false } },
  dataLabels: { enabled: false },
  grid: { borderColor: 'rgba(100, 116, 139, 0.15)', strokeDashArray: 4 },
  legend: { position: 'top', horizontalAlign: 'right', labels: { colors: cssVar('--dash-text') } },
  tooltip: { theme: 'dark', shared: true, intersect: false },
});

// Index du point « maintenant » dans la série si la période est en cours.
const indexMaintenant = (periode) => {
  const now = dayjs();
  if (periode === 'annee') return now.month();
  if (periode === 'mois') return now.date() - 1;
  return now.hour();
};

// Cumul de la période comparé à la période précédente complète.
const CumulCompare = ({ serie, seriePrec, periode, refDate }) => {
  const config = useMemo(() => {
    const longue = seriePrec.length > serie.length ? seriePrec : serie;
    const fin = estPeriodeCourante(periode, refDate) ? indexMaintenant(periode) : Infinity;
    const cumul = (points, jusqua) => {
      let s = 0;
      return longue.map((_, i) => (i > jusqua || !points[i] ? null : (s += points[i].total)));
    };
    const base = baseOptions();
    return {
      series: [
        { name: libellePeriode(periode, refDate), type: 'area', data: cumul(serie, fin) },
        { name: libellePeriode(periode, decaler(periode, refDate, -1)), type: 'line', data: cumul(seriePrec, Infinity) },
      ],
      options: {
        ...base,
        chart: { ...base.chart, type: 'line' },
        colors: [cssVar('--color-primary'), cssVar('--color-text-sub')],
        stroke: { width: [2.5, 2], curve: 'straight', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [0.18, 1] },
        markers: { size: 0, hover: { size: 4 } },
        xaxis: {
          categories: longue.map(p => libelleSerie(periode, p.index)),
          tickAmount: periode === 'mois' ? 10 : undefined,
          labels: { rotate: 0, hideOverlappingLabels: true },
          axisBorder: { show: false },
          axisTicks: { show: false },
          tooltip: { enabled: false },
        },
        yaxis: { min: 0, forceNiceScale: true, labels: { formatter: v => Math.round(v) } },
        tooltip: { ...base.tooltip, y: { formatter: v => (v === null || v === undefined ? '—' : `${v} cumulée${v > 1 ? 's' : ''}`) } },
      },
    };
  }, [serie, seriePrec, periode, refDate]);

  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Cumul comparé {CUMUL_VS[periode]}</h3>
      </div>
      <Chart type="line" height={260} series={config.series} options={config.options} />
    </div>
  );
};

// Interventions bloquantes (utilisateur empêché de travailler) / non bloquantes,
// point par point (colonnes empilées).
const BloquantesSerie = ({ serie, periode, totalBloquees }) => {
  const config = useMemo(() => {
    const base = baseOptions();
    return {
      series: [
        { name: 'Bloquante', data: serie.map(p => p.bloquees || 0) },
        { name: 'Non bloquant', data: serie.map(p => p.total - (p.bloquees || 0)) },
      ],
      options: {
        ...base,
        chart: { ...base.chart, type: 'bar', stacked: true },
        colors: [cssVar('--color-rose'), cssVar('--color-text-sub')],
        plotOptions: { bar: { borderRadius: 3, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last', columnWidth: periode === 'annee' ? '50%' : '65%' } },
        stroke: { show: true, width: 1, colors: ['transparent'] },
        xaxis: {
          categories: serie.map(p => libelleSerie(periode, p.index)),
          tickAmount: periode === 'mois' ? 10 : undefined,
          labels: { rotate: 0, hideOverlappingLabels: true },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { min: 0, forceNiceScale: true, labels: { formatter: v => Math.round(v) } },
      },
    };
  }, [serie, periode]);

  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Interventions bloquantes par {UNITE_SERIE[periode]}</h3>
      </div>
      {totalBloquees > 0 ? (
        <Chart type="bar" height={260} series={config.series} options={config.options} />
      ) : (
        <div className="dit-empty dit-empty--small">
          <FaUserSlash aria-hidden="true" />
          <span>Aucune intervention bloquante sur la période</span>
        </div>
      )}
    </div>
  );
};

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Heures de pointe : jour de la semaine × heure.
const HeuresPointe = ({ matrice }) => {
  const config = useMemo(() => {
    const heures = matrice.flatMap(ligne => ligne.flatMap((n, h) => (n ? [h] : [])));
    const debut = Math.min(8, ...heures);
    const fin = Math.max(18, ...heures);
    // Samedi et dimanche masqués s'ils sont vides
    const jours = JOURS.map((label, j) => ({ label, j }))
      .filter(({ j }) => j < 5 || matrice[j].some(n => n));
    const max = Math.max(1, ...matrice.flat());
    const base = baseOptions();
    return {
      // ApexCharts dessine la première série en bas : lundi doit être en haut
      series: [...jours].reverse().map(({ label, j }) => ({
        name: label,
        data: Array.from({ length: fin - debut + 1 }, (_, k) => ({ x: `${debut + k}h`, y: matrice[j][debut + k] })),
      })),
      options: {
        ...base,
        chart: { ...base.chart, type: 'heatmap' },
        legend: { show: false },
        colors: [cssVar('--color-primary')],
        stroke: { width: 2, colors: [cssVar('--dash-bg-deep')] },
        plotOptions: {
          heatmap: {
            radius: 3,
            enableShades: true,
            shadeIntensity: 0.6,
            colorScale: {
              ranges: [
                { from: 0, to: 0, color: cssVar('--dash-surface'), name: 'aucune' },
                { from: 1, to: max, color: cssVar('--color-primary'), name: 'interventions' },
              ],
            },
          },
        },
        xaxis: { labels: { rotate: 0, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
        tooltip: { theme: 'dark', y: { formatter: v => `${v} intervention${v > 1 ? 's' : ''}` } },
      },
    };
  }, [matrice]);

  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Heures de pointe</h3>
        <span className="dit-hint">Interventions par jour de la semaine et par heure</span>
      </div>
      <Chart type="heatmap" height={260} series={config.series} options={config.options} />
    </div>
  );
};

// Durée moyenne par type (interventions dont la durée est renseignée).
const MoyenneTypes = ({ moyennes }) => {
  const lignes = INTERVENTION_TYPES
    .filter(t => moyennes?.[t] !== null && moyennes?.[t] !== undefined)
    .map(t => ({ type: t, moyenne: moyennes[t] }))
    .sort((a, b) => b.moyenne - a.moyenne);
  const max = lignes[0]?.moyenne || 1;
  return (
    <div className="dit-panel">
      <div className="dit-chart-head">
        <h3>Durée moyenne par type</h3>
        <span className="dit-hint">hh:mm</span>
      </div>
      {lignes.length ? (
        <ul className="dit-techs">
          {lignes.map(l => (
            <li key={l.type}>
              <span className="dit-tech-nom">{TYPE_CONFIG[l.type].label}</span>
              <span className="dit-tech-barre" aria-hidden="true">
                <span style={{ width: `${Math.max(2, (l.moyenne / max) * 100)}%`, background: couleurTone(TYPE_CONFIG[l.type].tone) }} />
              </span>
              <span className="dit-tech-val">{formatDuree(l.moyenne)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dit-empty dit-empty--small"><FaClock aria-hidden="true" /><span>Aucune durée renseignée</span></div>
      )}
    </div>
  );
};

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
  const voirHistorique = useCallback((filtre = '') => {
    navigate(`/HistoriqueInterventions?periode=${periode}&date=${refKey}${filtre}`);
  }, [navigate, periode, refKey]);
  const voirType = useCallback((type) => { if (type) voirHistorique(`&type=${type}`); }, [voirHistorique]);
  const voirRecurrence = useCallback((param, id) => voirHistorique(`&${param}=${id}`), [voirHistorique]);

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
            detail={stats.total > 0 && <>dont {fmt(stats.depuis_tickets)} depuis un ticket ({pct(stats.depuis_tickets, stats.total)} %)</>}
            precedentLabel={precedentLabel} precedent={fmt(prec.total)}
            tendance={variation(stats.total, prec.total)} sens="neutre" indisponible={indisponible}
          />
          <CarteStat
            type="time" icon={<FaClock />} label="Durée totale"
            valeur={formatDuree(stats.duree_totale)} unite="hh:mm"
            detail={stats.total > 0 && <DetailDuree stats={stats} />}
            precedentLabel={precedentLabel} precedent={formatDuree(prec.duree_totale)}
            tendance={variation(stats.duree_totale, prec.duree_totale)} sens="neutre" indisponible={indisponible}
          />
          <CarteStat
            type="bloque" icon={<FaUserSlash />} label="Utilisateurs bloqués"
            valeur={fmt(stats.utilisateurs_bloques)} unite={stats.utilisateurs_bloques > 1 ? 'utilisateurs' : 'utilisateur'}
            detail={stats.interventions_bloquantes > 0 && (
              <>{fmt(stats.interventions_bloquantes)} intervention{stats.interventions_bloquantes > 1 ? 's' : ''} · <strong>{formatDuree(stats.temps_bloque)}</strong> de blocage</>
            )}
            precedentLabel={precedentLabel} precedent={fmt(prec.utilisateurs_bloques)}
            tendance={variation(stats.utilisateurs_bloques, prec.utilisateurs_bloques)} sens="baisse" indisponible={indisponible}
          />
        </div>

        <div className="dit-chart">
          <div className="dit-chart-head">
            <h3>Interventions par {UNITE_SERIE[periode]}</h3>
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

        {stats.total > 0 && (
          <div className="dit-panels">
            <RepartitionTypes parType={stats.par_type} total={stats.total} onSelect={voirType} />
            <TempsTechniciens techniciens={stats.par_technicien || []} />
            <Recurrences recurrences={stats.recurrences} materielsConcernes={stats.materiels_concernes || 0} onSelect={voirRecurrence} />
          </div>
        )}

        {(stats.total > 0 || prec.total > 0) && (
          <div className="dit-panels dit-panels--2">
            <CumulCompare serie={stats.serie || []} seriePrec={prec.serie || []} periode={periode} refDate={ref} />
            {stats.total > 0 && (
              <>
                <BloquantesSerie serie={stats.serie || []} periode={periode} totalBloquees={stats.interventions_bloquantes} />
                {periode !== 'jour' && stats.par_jour_heure && <HeuresPointe matrice={stats.par_jour_heure} />}
                <MoyenneTypes moyennes={stats.duree_moyenne_par_type} />
              </>
            )}
          </div>
        )}
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
            onClick={() => voirHistorique()}>
            Voir le détail <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      {renderCorps()}
    </div>
  );
};

export default DashboardInterventions;
