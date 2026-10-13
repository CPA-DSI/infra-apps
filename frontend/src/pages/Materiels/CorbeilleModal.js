// src/pages/Materiels/CorbeilleModal.js
//
// Corbeille des matériels : fiches supprimées (suppression logique) avec la
// date, l'auteur et le motif. Un PC sorti de l'inventaire peut être restauré
// en stock ; une fiche « Sans poste » ne se restaure pas (on réaffecte un PC
// à l'utilisateur).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaTrashRestore, FaSearch, FaUndo } from 'react-icons/fa';
import { fetchCorbeille, restaurerMateriel } from '../../services/api';
import { MySwal } from '../../utils/swal';
import AppModal from '../../components/AppModal/AppModal';
import './MaterielsModals.css';

const FILTRES = [
    { value: '', label: 'Tous', match: () => true },
    { value: 'pc', label: 'PC (restaurables)', match: m => m.restaurable },
    { value: 'sans_poste', label: 'Fiches « Sans poste »', match: m => !m.restaurable },
];

const CorbeilleModal = ({ onClose, onRestored }) => {
    const [supprimes, setSupprimes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtre, setFiltre] = useState('');
    const [recherche, setRecherche] = useState('');
    const [restaurationId, setRestaurationId] = useState(null);

    const chargerCorbeille = useCallback(() => {
        return fetchCorbeille()
            .then(data => { setSupprimes(data); setError(null); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        chargerCorbeille();
    }, [chargerCorbeille]);

    const supprimesFiltres = useMemo(() => {
        const { match } = FILTRES.find(f => f.value === filtre);
        const q = recherche.trim().toLowerCase();
        return supprimes.filter(m => {
            if (!match(m)) return false;
            if (!q) return true;
            return [m.code_pc, m.utilisateur, m.equipe, m.detail, m.motif, m.supprime_par]
                .some(v => v && String(v).toLowerCase().includes(q));
        });
    }, [supprimes, filtre, recherche]);

    const handleRestaurer = useCallback(async (m) => {
        const result = await MySwal.fire({
            title: 'Restaurer ce PC ?',
            text: `Le PC ${m.code_pc || `#${m.id_materiels}`} reviendra dans la liste, en stock, sans bénéficiaire ni écran.`,
            icon: 'question',
            showCancelButton: true, confirmButtonColor: '#0EA5E9', cancelButtonColor: '#64748b', confirmButtonText: 'Oui, restaurer', cancelButtonText: 'Annuler'
        });
        if (!result.isConfirmed) return;

        setRestaurationId(m.id_materiels);
        try {
            const { message } = await restaurerMateriel(m.id_materiels);
            await chargerCorbeille();
            onRestored();
            MySwal.fire({ icon: 'success', title: 'Restauré !', text: message, timer: 3000, showConfirmButton: false });
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Erreur', text: `Échec de la restauration : ${err.message}` });
        } finally {
            setRestaurationId(null);
        }
    }, [chargerCorbeille, onRestored]);

    const pluriel = supprimes.length > 1 ? 's' : '';

    return (
        <AppModal
            show
            onClose={onClose}
            size="xl"
            title="Corbeille"
            subtitle={`${supprimes.length} fiche${pluriel} supprimée${pluriel} (200 plus récentes) — l'historique est conservé`}
            icon={<FaTrashRestore />}
            contentClassName="mat-modal mat-modal--corbeille mat-corbeille-modal"
            bodyClassName="mat-list-body"
            footer={
                <>
                    <span className="mat-footer-count">
                        {supprimesFiltres.length} résultat{supprimesFiltres.length > 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                        Fermer
                    </button>
                </>
            }
        >
            <div className="mat-list-toolbar">
                {FILTRES.map(f => (
                    <button
                        key={f.value || 'tous'}
                        type="button"
                        onClick={() => setFiltre(f.value)}
                        className={`mat-filter-chip ${filtre === f.value ? 'is-active' : ''}`}
                        aria-pressed={filtre === f.value}
                    >
                        {f.label} <span className="mat-filter-chip-count">({supprimes.filter(f.match).length})</span>
                    </button>
                ))}
                <div className="mat-search-box">
                    <FaSearch aria-hidden="true" />
                    <input
                        value={recherche}
                        onChange={e => setRecherche(e.target.value)}
                        placeholder="Code PC, utilisateur, motif..."
                        aria-label="Rechercher dans la corbeille"
                    />
                </div>
            </div>

            <div className="mat-list-scroll">
                {loading ? (
                    <div className="mat-list-state">Chargement...</div>
                ) : error ? (
                    <div className="mat-alert-error">{error}</div>
                ) : supprimesFiltres.length === 0 ? (
                    <div className="mat-list-state">La corbeille est vide.</div>
                ) : (
                    <table className="mat-table">
                        <thead>
                            <tr>
                                <th>Supprimé le</th>
                                <th>Type</th>
                                <th>Code PC</th>
                                <th>Dernière affectation</th>
                                <th>Motif</th>
                                <th>Par</th>
                                <th><span className="visually-hidden">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {supprimesFiltres.map(m => (
                                <tr key={m.id_materiels}>
                                    <td className="mat-cell-nowrap">{new Date(m.date_suppression).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                    <td>{m.restaurable ? 'PC' : 'Sans poste'}</td>
                                    <td className="mat-cell-strong">{m.code_pc || '—'}</td>
                                    <td>{m.detail || m.utilisateur || '—'}</td>
                                    <td>{m.motif || '—'}</td>
                                    <td>{m.supprime_par || '—'}</td>
                                    <td className="mat-cell-end">
                                        {m.restaurable ? (
                                            <button
                                                type="button"
                                                className="btn-pill btn-pill-info mat-btn-sm"
                                                onClick={() => handleRestaurer(m)}
                                                disabled={restaurationId !== null}
                                                title="Remettre ce PC en stock"
                                            >
                                                <FaUndo size={11} aria-hidden="true" /> {restaurationId === m.id_materiels ? 'Restauration...' : 'Restaurer'}
                                            </button>
                                        ) : (
                                            <span className="mat-not-restorable" title="Pour redonner un PC à l'utilisateur, utilisez « Réaffecter le PC »">
                                                Non restaurable
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </AppModal>
    );
};

export default CorbeilleModal;
