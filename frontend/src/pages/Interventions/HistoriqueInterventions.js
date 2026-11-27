// Historique des interventions : navigation Jour / Mois / Année, indicateurs,
// graphique (clic = zoom sur la période), journal et saisie des interventions.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import Chart from 'react-apexcharts';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  FaTools, FaPlus, FaSync, FaFileExcel, FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaSearch, FaTicketAlt, FaUserSlash, FaLock, FaTimes,
} from 'react-icons/fa';
import PageHeader from '../../components/PageHeader/PageHeader';
import { getInterventions, deleteIntervention } from '../../services/api';
import { MySwal, swalButtons, notify } from '../../utils/swal';
import { toneClass } from '../../utils/tones';
import { cssVar } from '../../styles/cssVar';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import InterventionModal from './InterventionModal';
import {
  TYPE_CONFIG, INTERVENTION_TYPES, PERIODES, dateParam, decaler, libellePeriode, estPeriodeCourante,
  libelleSerie, formatDuree,
} from './interventionConfig';
import './HistoriqueInterventions.css';

const ZOOM = { annee: 'mois', mois: 'jour' };

const TABLE_STYLES = tableStyles({ rows: { style: { minHeight: '56px' } } });

const lireRef = (valeur) => {
  const d = dayjs(valeur);
  return valeur && d.isValid() ? d : dayjs();
};

const TypeChip = ({ type }) => (
  <span className={`itv-type ${toneClass(TYPE_CONFIG[type]?.tone)} tone-chip`}>{TYPE_CONFIG[type]?.label || type}</span>
);

const HistoriqueInterventions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Période dans l'URL : le lien partagé ouvre la même vue
  const periode = PERIODES.some(p => p.key === searchParams.get('periode')) ? searchParams.get('periode') : 'mois';
  const dateUrl = searchParams.get('date');
  const ref = useMemo(() => lireRef(dateUrl), [dateUrl]);

  // Filtre type initial depuis l'URL (lien « Répartition par type » du tableau de bord)
  const [types, setTypes] = useState(() => (INTERVENTION_TYPES.includes(searchParams.get('type')) ? [searchParams.get('type')] : []));
  const [technicien, setTechnicien] = useState('');
  const [source, setSource] = useState('');
  const [bloque, setBloque] = useState(false);
  // Filtres matériel / bénéficiaire initiaux depuis l'URL (panneau « Récurrences » du tableau de bord)
  const [materiel, setMateriel] = useState(() => searchParams.get('materiel') || '');
  const [beneficiaire, setBeneficiaire] = useState(() => searchParams.get('beneficiaire') || '');
  const [recherche, setRecherche] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ show: false, intervention: null, prefill: null });

  const refKey = ref.format('YYYY-MM-DD');
  const allerA = useCallback((p, d) => {
    setSearchParams({ periode: p, date: d.format('YYYY-MM-DD') }, { replace: true });
  }, [setSearchParams]);

  const charger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getInterventions({ periode, date: dateParam(periode, dayjs(refKey)), types, technicien, source, bloque, materiel, beneficiaire }));
    } catch (err) {
      setError(err.message || 'Impossible de charger les interventions.');
    } finally {
      setLoading(false);
    }
  }, [periode, refKey, types, technicien, source, bloque, materiel, beneficiaire]);

  useEffect(() => { charger(); }, [charger]);

  // Ouverture depuis un ticket ou un matériel : navigate(..., { state: { nouvelleIntervention } })
  useEffect(() => {
    const prefill = location.state?.nouvelleIntervention;
    if (!prefill) return;
    setModal({ show: true, intervention: null, prefill });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  const toggleType = (t) => setTypes(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = data?.interventions || [];
    if (!q) return liste;
    return liste.filter(it => [
      it.description, it.solution, it.nom_technicien, it.ticket?.numeroTicket, it.materiel?.code_pc,
      it.materiel?.utilisateur, it.local?.nom_local, TYPE_CONFIG[it.type]?.label,
    ].some(v => String(v || '').toLowerCase().includes(q)));
  }, [data, recherche]);

  const stats = data?.stats;

  // Libellé des filtres matériel / bénéficiaire, lu sur les interventions chargées
  const libelleMateriel = useMemo(() => {
    const it = (data?.interventions || []).find(i => String(i.id_materiels) === materiel);
    return it?.materiel?.code_pc || `Matériel n°${materiel}`;
  }, [data, materiel]);
  const libelleBeneficiaire = useMemo(() => {
    const it = (data?.interventions || []).find(i => String(i.id_n_beneficiaire) === beneficiaire && i.materiel?.id_n === i.id_n_beneficiaire);
    return it ? `${beneficiaire} - ${it.materiel.utilisateur}` : `Utilisateur N°${beneficiaire}`;
  }, [data, beneficiaire]);

  const handleSaved = (_saved, { ticketCloture } = {}) => {
    setModal({ show: false, intervention: null, prefill: null });
    notify(ticketCloture ? 'Intervention enregistrée, ticket clôturé.' : 'Intervention enregistrée.');
    charger();
  };

  const handleDelete = useCallback(async (it) => {
    const { isConfirmed } = await MySwal.fire({
      ...swalButtons('danger'),
      icon: 'warning',
      title: 'Supprimer cette intervention ?',
      text: it.description.split('\n')[0],
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
    });
    if (!isConfirmed) return;
    try {
      await deleteIntervention(it.id_intervention);
      notify('Intervention supprimée.');
      charger();
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [charger]);

  const handleExport = () => {
    const rows = lignes.map(it => ({
      Date: dayjs(it.date_intervention).format('DD/MM/YYYY HH:mm'),
      Type: TYPE_CONFIG[it.type]?.label || it.type,
      Description: it.description,
      Solution: it.solution || '',
      'Durée (hh:mm)': it.duree_minutes == null ? '' : formatDuree(it.duree_minutes),
      Technicien: it.nom_technicien || '',
      Matériel: it.materiel?.code_pc || '',
      Utilisateur: it.materiel?.utilisateur || '',
      Local: it.local?.nom_local || '',
      Ticket: it.ticket?.numeroTicket || '',
      'Clôture du ticket': it.cloture_ticket ? 'Oui' : '',
      Origine: it.source === 'TICKET' ? 'Ticket' : 'Saisie',
      'Utilisateur bloqué': it.utilisateur_bloque ? 'Oui' : 'Non',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 17 }, { wch: 14 }, { wch: 60 }, { wch: 50 }, { wch: 11 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Interventions');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `interventions_${periode}_${dateParam(periode, ref)}.xlsx`);
  };

  const chart = useMemo(() => {
    const serie = stats?.serie || [];
    const primary = cssVar('--color-primary');
    return {
      series: [{ name: 'Interventions', data: serie.map(p => p.total) }],
      options: {
        chart: {
          type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', foreColor: cssVar('--color-text-sub'),
          events: {
            dataPointSelection: (_e, _ctx, { dataPointIndex }) => {
              const point = serie[dataPointIndex];
              if (!point || !ZOOM[periode]) return;
              const d = periode === 'annee' ? ref.month(point.index).date(1) : ref.date(point.index);
              allerA(ZOOM[periode], d);
            },
          },
        },
        colors: [primary],
        plotOptions: { bar: { borderRadius: 4, columnWidth: periode === 'annee' ? '50%' : '70%' } },
        dataLabels: { enabled: false },
        xaxis: {
          categories: serie.map(p => libelleSerie(periode, p.index)),
          tickAmount: periode === 'mois' ? 10 : undefined,
          labels: { rotate: 0, hideOverlappingLabels: true },
        },
        yaxis: { labels: { formatter: v => Math.round(v) }, forceNiceScale: true, min: 0 },
        grid: { borderColor: cssVar('--color-border-light'), strokeDashArray: 4 },
        tooltip: {
          y: { formatter: (v, { dataPointIndex }) => `${v} · ${formatDuree(serie[dataPointIndex]?.duree)}` },
        },
        states: { hover: { filter: { type: 'darken', value: 0.85 } } },
      },
    };
  }, [stats, periode, ref, allerA]);

  const maxTech = Math.max(1, ...(stats?.par_technicien || []).map(t => t.duree));

  const columns = useMemo(() => [
    {
      name: 'Date', sortable: true, width: '130px',
      selector: r => r.date_intervention,
      cell: r => (
        <span className="itv-date">
          <strong>{dayjs(r.date_intervention).format('DD/MM/YYYY')}</strong>
          <small>{dayjs(r.date_intervention).format('HH:mm')}</small>
        </span>
      ),
    },
    { name: 'Type', sortable: true, width: '140px', selector: r => r.type, cell: r => <TypeChip type={r.type} /> },
    {
      name: 'Description', grow: 3, wrap: true,
      selector: r => r.description,
      cell: r => (
        <span className="itv-desc">
          {(r.ticket || r.utilisateur_bloque) && (
            <span className="itv-desc-tags">
              {r.ticket && <span className="itv-ticket"><FaTicketAlt aria-hidden="true" /> {r.ticket.numeroTicket}</span>}
              {r.cloture_ticket && r.ticket && <span className="itv-cloture"><FaLock aria-hidden="true" /> Clôture</span>}
              {r.utilisateur_bloque && <span className="itv-bloque"><FaUserSlash aria-hidden="true" /> Utilisateur bloqué</span>}
            </span>
          )}
          <span className="itv-desc-text">{r.description}</span>
          {r.solution && <span className="itv-solution"><strong>Solution :</strong> {r.solution}</span>}
        </span>
      ),
    },
    {
      name: 'Matériel', grow: 1.4, sortable: true,
      selector: r => r.materiel?.code_pc || '',
      cell: r => (r.materiel ? (
        <span className="itv-mat"><strong>{r.materiel.code_pc || 'Sans code'}</strong><small>{r.materiel.utilisateur}{r.local ? ` · ${r.local.nom_local}` : ''}</small></span>
      ) : <span className="itv-muted">{r.local?.nom_local || '—'}</span>),
    },
    { name: 'Technicien', grow: 1.2, sortable: true, selector: r => r.nom_technicien || '', cell: r => r.nom_technicien || '—' },
    { name: 'Durée', sortable: true, width: '95px', right: true, selector: r => r.duree_minutes ?? -1, cell: r => (r.duree_minutes == null ? '—' : formatDuree(r.duree_minutes)) },
    {
      name: '', width: '96px', right: true,
      cell: r => (r.modifiable ? (
        <span className="itv-actions">
          <button type="button" className="itv-icon-btn" title="Modifier" aria-label="Modifier" onClick={() => setModal({ show: true, intervention: r, prefill: null })}><FaEdit /></button>
          {!(r.cloture_ticket && r.ticket) && (
            <button type="button" className="itv-icon-btn itv-icon-btn--danger" title="Supprimer" aria-label="Supprimer" onClick={() => handleDelete(r)}><FaTrash /></button>
          )}
        </span>
      ) : null),
    },
  ], [handleDelete]);

  return (
    <div className="container-fluid py-2 px-2 page-interventions">
      <PageHeader
        icon={<FaTools />}
        title="Historique des interventions"
        subtitle="Tickets clôturés et interventions saisies par le service informatique"
        actions={
          <>
            <button type="button" className="btn-refresh" onClick={charger} title="Rafraîchir" aria-label="Rafraîchir"><FaSync aria-hidden="true" /></button>
            <button type="button" className="btn-pill btn-pill-primary" onClick={() => setModal({ show: true, intervention: null, prefill: null })}>
              <FaPlus size={15} aria-hidden="true" /> Nouvelle intervention
            </button>
            <button type="button" className="btn-pill btn-pill-warning" onClick={handleExport} disabled={!lignes.length}>
              <FaFileExcel size={15} aria-hidden="true" /> Exporter
            </button>
          </>
        }
      />

      <div className="itv-toolbar">
        <div className="itv-seg" role="group" aria-label="Période">
          {PERIODES.map(p => (
            <button key={p.key} type="button" className={periode === p.key ? 'is-active' : ''} aria-pressed={periode === p.key} onClick={() => allerA(p.key, ref)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="itv-nav">
          <button type="button" onClick={() => allerA(periode, decaler(periode, ref, -1))} aria-label="Période précédente"><FaChevronLeft /></button>
          <strong>{libellePeriode(periode, ref)}</strong>
          <button type="button" onClick={() => allerA(periode, decaler(periode, ref, 1))} aria-label="Période suivante"><FaChevronRight /></button>
        </div>
        <button type="button" className="itv-chip" disabled={estPeriodeCourante(periode, ref)} onClick={() => allerA(periode, dayjs())}>Aujourd'hui</button>
        <input
          type="date" className="itv-date-input" aria-label="Aller à la date"
          value={refKey} onChange={(e) => e.target.value && allerA(periode, dayjs(e.target.value))}
        />
      </div>

      <div className="itv-toolbar itv-toolbar--filters">
        {INTERVENTION_TYPES.map(t => (
          <button key={t} type="button" aria-pressed={types.includes(t)}
            className={`itv-chip ${types.includes(t) ? `is-active ${toneClass(TYPE_CONFIG[t].tone)}` : ''}`}
            onClick={() => toggleType(t)}>
            {TYPE_CONFIG[t].label}
          </button>
        ))}
        <span className="itv-sep" aria-hidden="true" />
        <select className="itv-select" value={technicien} onChange={(e) => setTechnicien(e.target.value)} aria-label="Technicien">
          <option value="">Tous les techniciens</option>
          <option value="moi">Mes interventions</option>
        </select>
        <select className="itv-select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Origine">
          <option value="">Toutes origines</option>
          <option value="TICKET">Depuis un ticket</option>
          <option value="MANUELLE">Saisies</option>
        </select>
        <button type="button" aria-pressed={bloque} className={`itv-chip ${bloque ? 'is-active tone--danger' : ''}`} onClick={() => setBloque(b => !b)}>
          <FaUserSlash aria-hidden="true" /> Utilisateur bloqué
        </button>
        {materiel && (
          <button type="button" className="itv-chip is-active" aria-label={`Retirer le filtre ${libelleMateriel}`} onClick={() => setMateriel('')}>
            {libelleMateriel} <FaTimes aria-hidden="true" />
          </button>
        )}
        {beneficiaire && (
          <button type="button" className="itv-chip is-active" aria-label={`Retirer le filtre ${libelleBeneficiaire}`} onClick={() => setBeneficiaire('')}>
            {libelleBeneficiaire} <FaTimes aria-hidden="true" />
          </button>
        )}
        {(types.length > 0 || technicien || source || bloque || materiel || beneficiaire) && (
          <button type="button" className="itv-link" onClick={() => { setTypes([]); setTechnicien(''); setSource(''); setBloque(false); setMateriel(''); setBeneficiaire(''); }}>Réinitialiser</button>
        )}
      </div>

      {error && <div className="itv-error" role="alert">{error}</div>}

      <div className="itv-kpis">
        <div className="itv-kpi"><span>Interventions</span><strong>{stats?.total ?? '—'}</strong></div>
        <div className="itv-kpi"><span>Temps passé</span><strong>{stats ? formatDuree(stats.duree_totale) : '—'}</strong></div>
        <div className="itv-kpi"><span>Matériels concernés</span><strong>{stats?.materiels_concernes ?? '—'}</strong></div>
        <div className="itv-kpi"><span>Issues de tickets</span><strong>{stats?.depuis_tickets ?? '—'}</strong></div>
        <div className="itv-kpi"><span>Interventions bloquantes</span><strong>{stats?.interventions_bloquantes ?? '—'}</strong></div>
      </div>

      <div className="itv-grid">
        <section className="itv-card">
          <h2 className="itv-card-title">
            Interventions par {periode === 'annee' ? 'mois' : periode === 'mois' ? 'jour' : 'heure'}
          </h2>
          <Chart type="bar" height={260} series={chart.series} options={chart.options} />
          {ZOOM[periode] && <p className="itv-hint">Cliquez sur une barre pour voir le {ZOOM[periode] === 'mois' ? 'mois' : 'jour'} en détail.</p>}
        </section>

        <section className="itv-card">
          <h2 className="itv-card-title">Temps par technicien</h2>
          {stats?.par_technicien?.length ? (
            <ul className="itv-bars">
              {stats.par_technicien.map(t => (
                <li key={t.id_technicien ?? 'aucun'}>
                  <div className="itv-bars-head"><span>{t.nom}</span><span className="itv-num">{formatDuree(t.duree)} · {t.total}</span></div>
                  <div className="itv-bars-track"><div style={{ width: `${(t.duree / maxTech) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="itv-muted">Aucune intervention sur la période.</p>}
          <h2 className="itv-card-title itv-card-title--sub">Par type</h2>
          <div className="itv-types">
            {INTERVENTION_TYPES.filter(t => stats?.par_type?.[t]).map(t => (
              <span key={t} className={`itv-type ${toneClass(TYPE_CONFIG[t].tone)} tone-chip`}>{TYPE_CONFIG[t].label} · {stats.par_type[t]}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="itv-card">
        <div className="itv-journal-head">
          <h2 className="itv-card-title">Journal · {libellePeriode(periode, ref)}</h2>
          <label className="itv-search">
            <FaSearch aria-hidden="true" />
            <input type="search" placeholder="Rechercher..." value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans le journal" />
          </label>
        </div>
        <DataTable
          columns={columns}
          data={lignes}
          pagination
          paginationPerPage={20}
          paginationComponentOptions={paginationOptions}
          progressPending={loading && !data}
          customStyles={TABLE_STYLES}
          highlightOnHover
          responsive
          persistTableHead
          noDataComponent={<p className="itv-muted py-4">Aucune intervention pour cette période et ces filtres.</p>}
        />
      </section>

      <InterventionModal
        show={modal.show}
        intervention={modal.intervention}
        prefill={modal.prefill}
        onClose={() => setModal({ show: false, intervention: null, prefill: null })}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default HistoriqueInterventions;
