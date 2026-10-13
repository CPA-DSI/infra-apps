// src/pages/Materiels/EcransModal.js
//
// Liste des écrans du parc (table ecrans) avec filtre par statut et recherche,
// et formulaire d'ajout d'écrans en stock.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaDesktop, FaSearch, FaPlus } from 'react-icons/fa';
import { fetchEcrans, addEcran, STATUTS_ECRAN_LABELS } from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
import './MaterielsModals.css';

const StatutBadge = ({ statut }) => (
    <span className={`mat-statut-badge mat-statut-badge--${statut}`}>
        {STATUTS_ECRAN_LABELS[statut] || statut}
    </span>
);

const FORMULAIRE_VIDE = { code_ecran: '', modele: '', date_ecran: '', commentaire: '' };

// Ajout d'un écran : il est créé en stock (POST /api/ecrans) et pourra
// ensuite être installé sur un poste via « Installer un écran ».
const AjoutEcranForm = ({ modeles, onAdded }) => {
    const [form, setForm] = useState(FORMULAIRE_VIDE);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [succes, setSucces] = useState(null);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSucces(null);
        if (!form.code_ecran.trim()) {
            setError('Le code écran est requis.');
            return;
        }
        setSubmitting(true);
        try {
            const ecran = await addEcran({
                code_ecran: form.code_ecran.trim(),
                modele: form.modele.trim() || null,
                date_ecran: form.date_ecran || null,
                commentaire: form.commentaire.trim() || null,
            });
            setSucces(`Écran ${ecran.code_ecran} ajouté en stock.`);
            // On garde modèle et date pour enchaîner plusieurs écrans du même lot.
            setForm(prev => ({ ...FORMULAIRE_VIDE, modele: prev.modele, date_ecran: prev.date_ecran }));
            onAdded();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mat-ecran-form">
            <div className="mat-ecran-form-title">
                <span className="mat-ecran-form-icon" aria-hidden="true">
                    <FaPlus size={12} />
                </span>
                Ajouter un écran en stock
            </div>
            <div>
                <label className="mat-field-label" htmlFor="ecran-code">Code écran<span className="mat-required">*</span></label>
                <input id="ecran-code" name="code_ecran" value={form.code_ecran} onChange={handleChange} className="mat-field-input" placeholder="ECR-HP-0001-BNI2" autoFocus />
            </div>
            <div>
                <label className="mat-field-label" htmlFor="ecran-modele">Marque / modèle</label>
                <input id="ecran-modele" name="modele" value={form.modele} onChange={handleChange} className="mat-field-input" placeholder="HP, DELL, PHILIPS..." list="ecrans-modeles" />
                <datalist id="ecrans-modeles">
                    {modeles.map(m => <option key={m} value={m} />)}
                </datalist>
            </div>
            <div>
                <label className="mat-field-label" htmlFor="ecran-date">Date écran</label>
                <input id="ecran-date" name="date_ecran" type="date" value={form.date_ecran} onChange={handleChange} className="mat-field-input" />
            </div>
            <div>
                <label className="mat-field-label" htmlFor="ecran-commentaire">Commentaire</label>
                <textarea id="ecran-commentaire" name="commentaire" value={form.commentaire} onChange={handleChange} className="mat-field-input" />
            </div>

            {error && <div className="mat-alert-error">{error}</div>}
            {succes && <div className="mat-alert-success">{succes}</div>}

            <button type="submit" disabled={submitting} className="btn-pill btn-pill-info">
                <FaPlus size={12} aria-hidden="true" /> {submitting ? 'Ajout...' : 'Ajouter en stock'}
            </button>
        </form>
    );
};

const EcransModal = ({ onClose }) => {
    const [ecrans, setEcrans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtreStatut, setFiltreStatut] = useState('');
    const [recherche, setRecherche] = useState('');

    const chargerEcrans = useCallback(() => {
        return fetchEcrans()
            .then(data => { setEcrans(data); setError(null); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        chargerEcrans();
    }, [chargerEcrans]);

    const modeles = useMemo(
        () => [...new Set(ecrans.map(e => e.modele).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [ecrans]
    );

    const compteurs = useMemo(() => ecrans.reduce((acc, e) => {
        acc[e.statut] = (acc[e.statut] || 0) + 1;
        return acc;
    }, {}), [ecrans]);

    const ecransFiltres = useMemo(() => {
        const q = recherche.trim().toLowerCase();
        return ecrans.filter(e => {
            if (filtreStatut && e.statut !== filtreStatut) return false;
            if (!q) return true;
            return [e.code_ecran, e.modele, e.materiel?.utilisateur, e.materiel?.code_pc, e.materiel?.id_n, e.materiel?.equipe]
                .some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
        });
    }, [ecrans, filtreStatut, recherche]);

    const filtres = [{ value: '', label: 'Tous', count: ecrans.length }, ...Object.keys(STATUTS_ECRAN_LABELS).map(s => ({
        value: s, label: STATUTS_ECRAN_LABELS[s], count: compteurs[s] || 0,
    }))];

    return (
        <AppModal
            show
            onClose={onClose}
            size="xl"
            title="Écrans"
            subtitle={`${ecrans.length} écran${ecrans.length > 1 ? 's' : ''} dans le parc`}
            icon={<FaDesktop />}
            contentClassName="mat-modal mat-modal--ecrans mat-ecrans-modal"
            bodyClassName="mat-ecrans-body"
            footer={
                <>
                    <span className="mat-footer-count">
                        {ecransFiltres.length} résultat{ecransFiltres.length > 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                        Fermer
                    </button>
                </>
            }
        >
            <div className="mat-ecrans-main">
                <div className="mat-list-toolbar">
                    {filtres.map(f => (
                        <button
                            key={f.value || 'tous'}
                            type="button"
                            onClick={() => setFiltreStatut(f.value)}
                            className={`mat-filter-chip ${filtreStatut === f.value ? 'is-active' : ''}`}
                            aria-pressed={filtreStatut === f.value}
                        >
                            {f.label} <span className="mat-filter-chip-count">({f.count})</span>
                        </button>
                    ))}
                    <div className="mat-search-box">
                        <FaSearch aria-hidden="true" />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Code, modèle, utilisateur..."
                            aria-label="Rechercher un écran"
                        />
                    </div>
                </div>

                <div className="mat-list-scroll">
                    {loading ? (
                        <div className="mat-list-state">Chargement...</div>
                    ) : error ? (
                        <div className="mat-alert-error">{error}</div>
                    ) : ecransFiltres.length === 0 ? (
                        <div className="mat-list-state">Aucun écran trouvé.</div>
                    ) : (
                        <table className="mat-table">
                            <thead>
                                <tr>
                                    <th>Code écran</th>
                                    <th>Modèle</th>
                                    <th>Date écran</th>
                                    <th>Statut</th>
                                    <th>Utilisateur</th>
                                    <th>Équipe</th>
                                    <th>Code PC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ecransFiltres.map(e => (
                                    <tr key={e.id_ecran}>
                                        <td className="mat-cell-strong">{e.code_ecran}</td>
                                        <td>{e.modele || '—'}</td>
                                        <td>{e.date_ecran ? new Date(e.date_ecran).toLocaleDateString('fr-FR') : '—'}</td>
                                        <td><StatutBadge statut={e.statut} /></td>
                                        <td>{e.materiel ? `${e.materiel.id_n ?? 'Stock'} - ${e.materiel.utilisateur}` : '—'}</td>
                                        <td>{e.materiel?.equipe || '—'}</td>
                                        <td>{e.materiel?.code_pc || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <aside className="mat-ecrans-aside">
                <AjoutEcranForm modeles={modeles} onAdded={chargerEcrans} />
            </aside>
        </AppModal>
    );
};

export default EcransModal;
