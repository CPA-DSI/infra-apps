import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { FaTools, FaEdit, FaLock } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/api';
import AppModal from '../../components/AppModal/AppModal';
import SearchableSelect from '../../components/SearchableSelect/SearchableSelect';
import { fetchMateriels, fetchLocaux, getTickets, createIntervention, updateIntervention } from '../../services/api';
import { TYPE_CONFIG, INTERVENTION_TYPES } from './interventionConfig';
import DureePicker from '../../components/DureePicker/DureePicker';
import { formatDuree, parseDuree, dureeVersSaisie, MESSAGE_DUREE_INVALIDE } from '../../utils/duree';

const DUREES_RAPIDES = [15, 30, 60, 120];
const DUREE_MAX_MINUTES = 7 * 24 * 60; // même limite que le backend
const STATUTS_FERMES = ['RESOLU', 'FERME'];

// duree_minutes contient la saisie hh:mm ; convertie en minutes à l'envoi.
const formulaireVide = (prefill) => ({
  date_intervention: dayjs().format('YYYY-MM-DDTHH:mm'),
  type: 'DEPANNAGE',
  description: '',
  solution: '',
  id_materiels: '',
  id_ticket: '',
  id_local: '',
  utilisateur_bloque: false,
  cloturer_ticket: false,
  ...prefill,
  duree_minutes: dureeVersSaisie(prefill?.duree_minutes),
});

const depuisIntervention = (it) => ({
  date_intervention: dayjs(it.date_intervention).format('YYYY-MM-DDTHH:mm'),
  duree_minutes: dureeVersSaisie(it.duree_minutes),
  type: it.type,
  description: it.description,
  solution: it.solution || '',
  id_materiels: it.id_materiels ? String(it.id_materiels) : '',
  id_ticket: it.id_ticket ? String(it.id_ticket) : '',
  id_local: it.id_local ? String(it.id_local) : '',
  utilisateur_bloque: Boolean(it.utilisateur_bloque),
  cloturer_ticket: false,
});

const versApi = (form, intervention, cloturer) => ({
  date_intervention: dayjs(form.date_intervention).toISOString(),
  duree_minutes: parseDuree(form.duree_minutes),
  type: form.type,
  description: form.description,
  solution: form.solution,
  utilisateur_bloque: form.utilisateur_bloque,
  cloturer_ticket: cloturer,
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
 * Solution partagée : la case « Clôturer le ticket » ferme le ticket lié (statut
 * Résolu) avec la solution, la durée et la date de l'intervention. L'intervention
 * qui a clôturé un ticket garde ce ticket, et ses modifications y sont recopiées.
 */
const InterventionModal = ({ show, onClose, onSaved, intervention, prefill }) => {
  const { user } = useAuth();
  const peutCloturer = hasPermission(user?.role, PERMISSIONS.TICKETS_CLOSE);
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
        tickets: (t.value || []).map(x => ({ value: String(x.idTicket), label: `${x.numeroTicket} · ${x.titre}`, statut: x.statut })),
      });
    });
    return () => { annule = true; };
  }, [show]);

  const set = (champ, valeur) => setForm(f => ({ ...f, [champ]: valeur }));

  // Intervention qui a déjà clôturé son ticket : ticket figé, solution obligatoire
  const estCloture = Boolean(intervention?.cloture_ticket && intervention.id_ticket);
  const ticketChoisi = options.tickets.find(t => t.value === form.id_ticket);
  const ticketOuvert = Boolean(ticketChoisi && !STATUTS_FERMES.includes(ticketChoisi.statut));
  const proposerCloture = !estCloture && peutCloturer && ticketOuvert;
  const cloturer = proposerCloture && form.cloturer_ticket;
  const solutionObligatoire = estCloture || cloturer;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) {
      setError('La description est obligatoire.');
      return;
    }
    if (solutionObligatoire && !form.solution.trim()) {
      setError(estCloture
        ? 'La solution est obligatoire : elle est partagée avec le ticket clôturé.'
        : 'La solution est obligatoire pour clôturer le ticket.');
      return;
    }
    const duree = parseDuree(form.duree_minutes);
    if (Number.isNaN(duree)) {
      setError(MESSAGE_DUREE_INVALIDE);
      return;
    }
    if (duree !== null && duree > DUREE_MAX_MINUTES) {
      setError('Durée trop longue (168:00 maximum).');
      return;
    }
    setSubmitting(true);
    try {
      const payload = versApi(form, intervention, cloturer);
      const saved = intervention
        ? await updateIntervention(intervention.id_intervention, payload)
        : await createIntervention(payload);
      onSaved(saved, { ticketCloture: cloturer });
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
          <label className="add-modal-label" htmlFor="itv-duree">Durée (hh:mm)</label>
          <DureePicker id="itv-duree" value={form.duree_minutes} maxMinutes={DUREE_MAX_MINUTES}
            onChange={(v) => set('duree_minutes', v)} />
          <div className="itv-duree-rapide">
            {DUREES_RAPIDES.map(d => (
              <button key={d} type="button"
                className={`itv-chip ${parseDuree(form.duree_minutes) === d ? 'is-active' : ''}`}
                onClick={() => set('duree_minutes', formatDuree(d))}>
                {formatDuree(d)}
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
          {estCloture ? (
            <div className="add-modal-input itv-ticket-fige" title="Le ticket d'une intervention de clôture ne peut pas être changé">
              <FaLock aria-hidden="true" /> {intervention.ticket?.numeroTicket || `Ticket ${intervention.id_ticket}`}
            </div>
          ) : (
            <SearchableSelect value={form.id_ticket} onChange={(v) => set('id_ticket', v)}
              options={options.tickets} placeholder="Aucun ticket" variant="filter" />
          )}
        </div>

        <div className="add-modal-form-group">
          <label className="add-modal-label">Local</label>
          <SearchableSelect value={form.id_local} onChange={(v) => set('id_local', v)}
            options={options.locaux} placeholder="Local du poste" variant="filter" />
        </div>

        <label className="add-modal-checkbox-wrapper itv-form-full" htmlFor="itv-bloque">
          <input id="itv-bloque" type="checkbox" className="add-modal-checkbox"
            checked={form.utilisateur_bloque} onChange={(e) => set('utilisateur_bloque', e.target.checked)} />
          <span className="add-modal-checkbox-label">L'utilisateur n'a pas pu travailler</span>
        </label>

        <div className="add-modal-form-group itv-form-full">
          <label className="add-modal-label" htmlFor="itv-description">Description <span className="itv-required">*</span></label>
          <textarea id="itv-description" className="add-modal-textarea" rows={4} maxLength={5000} required
            value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="Ce qui a été fait, pièces changées, suites à donner..." />
        </div>

        <div className="add-modal-form-group itv-form-full">
          <label className="add-modal-label" htmlFor="itv-solution">
            Solution {solutionObligatoire && <span className="itv-required">*</span>}
          </label>
          <textarea id="itv-solution" className="add-modal-textarea" rows={3} maxLength={5000}
            required={solutionObligatoire}
            value={form.solution} onChange={(e) => set('solution', e.target.value)}
            placeholder="Solution apportée au problème..." />
        </div>

        {estCloture && (
          <p className="itv-cloture-info itv-form-full">
            <FaLock aria-hidden="true" /> Cette intervention a clôturé le ticket {intervention.ticket?.numeroTicket}.
            La solution, la durée et la date sont recopiées dans le ticket.
          </p>
        )}

        {proposerCloture && (
          <label className="add-modal-checkbox-wrapper itv-form-full" htmlFor="itv-cloturer">
            <input id="itv-cloturer" type="checkbox" className="add-modal-checkbox"
              checked={form.cloturer_ticket} onChange={(e) => set('cloturer_ticket', e.target.checked)} />
            <span className="add-modal-checkbox-label">
              Clôturer le ticket {ticketChoisi.label.split(' · ')[0]} avec cette solution (statut Résolu)
            </span>
          </label>
        )}
      </div>
    </AppModal>
  );
};

export default InterventionModal;
