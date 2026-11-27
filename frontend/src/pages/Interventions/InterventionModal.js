import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { FaTools, FaEdit } from 'react-icons/fa';
import AppModal from '../../components/AppModal/AppModal';
import SearchableSelect from '../../components/SearchableSelect/SearchableSelect';
import { fetchMateriels, fetchLocaux, getTickets, createIntervention, updateIntervention } from '../../services/api';
import { TYPE_CONFIG, INTERVENTION_TYPES } from './interventionConfig';

const DUREES_RAPIDES = [15, 30, 60, 120];

const formulaireVide = (prefill = {}) => ({
  date_intervention: dayjs().format('YYYY-MM-DDTHH:mm'),
  duree_minutes: '',
  type: 'DEPANNAGE',
  description: '',
  id_materiels: '',
  id_ticket: '',
  id_local: '',
  ...prefill,
});

const depuisIntervention = (it) => ({
  date_intervention: dayjs(it.date_intervention).format('YYYY-MM-DDTHH:mm'),
  duree_minutes: it.duree_minutes ?? '',
  type: it.type,
  description: it.description,
  id_materiels: it.id_materiels ? String(it.id_materiels) : '',
  id_ticket: it.id_ticket ? String(it.id_ticket) : '',
  id_local: it.id_local ? String(it.id_local) : '',
});

const versApi = (form, intervention) => ({
  date_intervention: dayjs(form.date_intervention).toISOString(),
  duree_minutes: form.duree_minutes === '' ? null : Number(form.duree_minutes),
  type: form.type,
  description: form.description,
  id_materiels: form.id_materiels || null,
  id_ticket: form.id_ticket || null,
  // Sans local choisi, le backend reprend celui du poste
  id_local: form.id_local || undefined,
  // En modification, on garde le bénéficiaire enregistré (ex. demandeur du ticket)
  id_n_beneficiaire: intervention && form.id_materiels === String(intervention.id_materiels ?? '')
    ? intervention.id_n_beneficiaire
    : undefined,
});

/**
 * Création / modification d'une intervention.
 *  - intervention : intervention à modifier (sinon création)
 *  - prefill      : valeurs initiales d'une création (ex. { id_ticket, id_materiels })
 */
const InterventionModal = ({ show, onClose, onSaved, intervention, prefill }) => {
  const [form, setForm] = useState(formulaireVide());
  const [options, setOptions] = useState({ materiels: [], locaux: [], tickets: [] });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show) return;
    setForm(intervention ? depuisIntervention(intervention) : formulaireVide(prefill));
    setError('');
  }, [show, intervention, prefill]);

  useEffect(() => {
    if (!show) return undefined;
    let annule = false;
    Promise.allSettled([fetchMateriels(), fetchLocaux(), getTickets()]).then(([m, l, t]) => {
      if (annule) return;
      setOptions({
        materiels: (m.value || [])
          .filter(x => !x.est_vide)
          .map(x => ({ value: String(x.id_materiels), label: `${x.code_pc || 'Sans code'} · ${x.utilisateur}${x.id_n ? ` (${x.id_n})` : ''}` })),
        locaux: (l.value || []).map(x => ({ value: String(x.id_local), label: x.nom_local || `Local ${x.id_local}` })),
        tickets: (t.value || []).map(x => ({ value: String(x.idTicket), label: `${x.numeroTicket} · ${x.titre}` })),
      });
    });
    return () => { annule = true; };
  }, [show]);

  const set = (champ, valeur) => setForm(f => ({ ...f, [champ]: valeur }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) {
      setError('La description est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = versApi(form, intervention);
      const saved = intervention
        ? await updateIntervention(intervention.id_intervention, payload)
        : await createIntervention(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      show={show}
      onClose={onClose}
      title={intervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
      subtitle={intervention ? intervention.nom_technicien : 'Vous serez enregistré comme technicien'}
      icon={intervention ? <FaEdit /> : <FaTools />}
      size="lg"
      as="form"
      onSubmit={handleSubmit}
      bodyClassName="itv-modal-body"
      footer={
        <>
          <button type="button" className="add-modal-cancel-btn" onClick={onClose} disabled={submitting}>Annuler</button>
          <button type="submit" className="add-modal-submit-btn" disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      {error && <div className="itv-form-error" role="alert">{error}</div>}

      <div className="itv-form-grid">
        <div className="add-modal-form-group">
          <label className="add-modal-label" htmlFor="itv-date">Date et heure <span className="itv-required">*</span></label>
          <input id="itv-date" type="datetime-local" className="add-modal-input" required
            value={form.date_intervention} onChange={(e) => set('date_intervention', e.target.value)} />
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label" htmlFor="itv-type">Type <span className="itv-required">*</span></label>
          <select id="itv-type" className="add-modal-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
          </select>
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label" htmlFor="itv-duree">Durée (minutes)</label>
          <input id="itv-duree" type="number" min="0" max="10080" className="add-modal-input"
            value={form.duree_minutes} onChange={(e) => set('duree_minutes', e.target.value)} placeholder="Ex. 45" />
          <div className="itv-duree-rapide">
            {DUREES_RAPIDES.map(d => (
              <button key={d} type="button"
                className={`itv-chip ${Number(form.duree_minutes) === d ? 'is-active' : ''}`}
                onClick={() => set('duree_minutes', d)}>
                {d < 60 ? `${d} min` : `${d / 60} h`}
              </button>
            ))}
          </div>
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label">Matériel</label>
          <SearchableSelect value={form.id_materiels} onChange={(v) => set('id_materiels', v)}
            options={options.materiels} placeholder="Aucun matériel" variant="filter" />
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label">Ticket lié</label>
          <SearchableSelect value={form.id_ticket} onChange={(v) => set('id_ticket', v)}
            options={options.tickets} placeholder="Aucun ticket" variant="filter" />
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label">Local</label>
          <SearchableSelect value={form.id_local} onChange={(v) => set('id_local', v)}
            options={options.locaux} placeholder="Local du poste" variant="filter" />
        </div>

        <div className="add-modal-form-group itv-form-full">
          <label className="add-modal-label" htmlFor="itv-description">Description <span className="itv-required">*</span></label>
          <textarea id="itv-description" className="add-modal-textarea" rows={4} maxLength={5000} required
            value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="Ce qui a été fait, pièces changées, suites à donner..." />
        </div>
      </div>
    </AppModal>
  );
};

export default InterventionModal;
