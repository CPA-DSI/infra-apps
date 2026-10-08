// src/pages/Materiels/EcransModal.js
//
// Liste des écrans du parc (table ecrans) avec filtre par statut et recherche,
// et formulaire d'ajout d'écrans en stock.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaTimes, FaDesktop, FaSearch, FaPlus } from 'react-icons/fa';
import { fetchEcrans, addEcran, STATUTS_ECRAN_LABELS } from '../../services/api';
import './Materiels.css';

const STATUT_STYLES = {
    AFFECTE: { color: '#065f46', bg: '#d1fae5', border: '#10b981' },
    EN_STOCK: { color: '#1e40af', bg: '#dbeafe', border: '#3b82f6' },
    EN_REPARATION: { color: '#92400e', bg: '#fef3c7', border: '#f59e0b' },
    REFORME: { color: '#991b1b', bg: '#fee2e2', border: '#ef4444' },
};

const StatutBadge = ({ statut }) => {
    const s = STATUT_STYLES[statut] || { color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
    return (
        <span style={{
            backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap'
        }}>
            {STATUTS_ECRAN_LABELS[statut] || statut}
        </span>
    );
};

const champStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white',
};
const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#1E293B', marginBottom: '5px' };

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
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>
                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <FaPlus size={12} />
                </span>
                Ajouter un écran en stock
            </div>
            <div>
                <label style={labelStyle}>Code écran<span style={{ color: '#EF4444', marginLeft: '4px' }}>*</span></label>
                <input name="code_ecran" value={form.code_ecran} onChange={handleChange} style={champStyle} placeholder="ECR-HP-0001-BNI2" autoFocus />
            </div>
            <div>
                <label style={labelStyle}>Marque / modèle</label>
                <input name="modele" value={form.modele} onChange={handleChange} style={champStyle} placeholder="HP, DELL, PHILIPS..." list="ecrans-modeles" />
                <datalist id="ecrans-modeles">
                    {modeles.map(m => <option key={m} value={m} />)}
                </datalist>
            </div>
            <div>
                <label style={labelStyle}>Date écran</label>
                <input name="date_ecran" type="date" value={form.date_ecran} onChange={handleChange} style={champStyle} />
            </div>
            <div>
                <label style={labelStyle}>Commentaire</label>
                <textarea name="commentaire" value={form.commentaire} onChange={handleChange} style={{ ...champStyle, resize: 'vertical', minHeight: '70px' }} />
            </div>

            {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '9px 12px', fontSize: '0.8rem' }}>{error}</div>
            )}
            {succes && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: '10px', padding: '9px 12px', fontSize: '0.8rem' }}>{succes}</div>
            )}

            <button type="submit" disabled={submitting} style={{
                background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 600, fontSize: '0.88rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1
            }}>
                <FaPlus size={12} /> {submitting ? 'Ajout...' : 'Ajouter en stock'}
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

    const th = { fontSize: '0.72rem', fontWeight: 600, color: '#475569', padding: '10px 12px', borderBottom: '2px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#F8FAFC' };
    const td = { fontSize: '0.82rem', color: '#1E293B', padding: '9px 12px', borderBottom: '1px solid #F1F5F9' };

    const filtres = [{ value: '', label: 'Tous', count: ecrans.length }, ...Object.keys(STATUTS_ECRAN_LABELS).map(s => ({
        value: s, label: STATUTS_ECRAN_LABELS[s], count: compteurs[s] || 0,
    }))];

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
                maxWidth: '1400px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden'
            }}>
                <div className="add-modal-header" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{ background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)' }}>
                            <FaDesktop style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>Écrans</h2>
                            <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {ecrans.length} écran{ecrans.length > 1 ? 's' : ''} dans le parc
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="add-modal-close-btn" type="button" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <FaTimes />
                    </button>
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 600px', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    {filtres.map(f => (
                        <button
                            key={f.value || 'tous'}
                            type="button"
                            onClick={() => setFiltreStatut(f.value)}
                            style={{
                                border: '1px solid', borderColor: filtreStatut === f.value ? '#6366f1' : '#e2e8f0', background: filtreStatut === f.value ? '#e0e7ff' : 'white',
                                color: filtreStatut === f.value ? '#4338ca' : '#374151', borderRadius: '20px', padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '5px 14px' }}>
                        <FaSearch style={{ color: '#94a3b8', fontSize: '0.8rem' }} />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Code, modèle, utilisateur..."
                            style={{ border: 'none', outline: 'none', fontSize: '0.82rem', width: '200px', background: 'transparent' }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', background: 'white' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Chargement...</div>
                    ) : error ? (
                        <div style={{ margin: '20px 24px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem' }}>{error}</div>
                    ) : ecransFiltres.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px', fontSize: '0.9rem' }}>Aucun écran trouvé.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={th}>Code écran</th>
                                    <th style={th}>Modèle</th>
                                    <th style={th}>Date écran</th>
                                    <th style={th}>Statut</th>
                                    <th style={th}>Utilisateur</th>
                                    <th style={th}>Équipe</th>
                                    <th style={th}>Code PC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ecransFiltres.map(e => (
                                    <tr key={e.id_ecran}>
                                        <td style={{ ...td, fontWeight: 600 }}>{e.code_ecran}</td>
                                        <td style={td}>{e.modele || '—'}</td>
                                        <td style={td}>{e.date_ecran ? new Date(e.date_ecran).toLocaleDateString('fr-FR') : '—'}</td>
                                        <td style={td}><StatutBadge statut={e.statut} /></td>
                                        <td style={td}>{e.materiel ? `${e.materiel.id_n ?? 'Stock'} - ${e.materiel.utilisateur}` : '—'}</td>
                                        <td style={td}>{e.materiel?.equipe || '—'}</td>
                                        <td style={td}>{e.materiel?.code_pc || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                </div>

                <aside style={{ flex: '0 1 320px', minWidth: '260px', borderLeft: '1px solid #E2E8F0', background: '#F8FAFC', padding: '20px', overflowY: 'auto' }}>
                    <AjoutEcranForm modeles={modeles} onAdded={chargerEcrans} />
                </aside>
                </div>

                <div className="add-modal-footer" style={{ background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {ecransFiltres.length} résultat{ecransFiltres.length > 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn" style={{
                        background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer'
                    }}>
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EcransModal;
