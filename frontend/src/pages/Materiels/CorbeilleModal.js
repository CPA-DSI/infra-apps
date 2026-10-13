// src/pages/Materiels/CorbeilleModal.js
//
// Corbeille des matériels : fiches supprimées (suppression logique) avec la
// date, l'auteur et le motif. Un PC sorti de l'inventaire peut être restauré
// en stock ; une fiche « Sans poste » ne se restaure pas (on réaffecte un PC
// à l'utilisateur).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaTimes, FaTrashRestore, FaSearch, FaUndo } from 'react-icons/fa';
import { fetchCorbeille, restaurerMateriel } from '../../services/api';
import { MySwal } from '../../utils/swal';
import './Materiels.css';

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
            showCancelButton: true, confirmButtonColor: '#0EA5E9', cancelButtonColor: '#64748b', confirmButtonText: 'Oui, restaurer', cancelButtonText: 'Annuler',
            customClass: { container: 'swal-au-dessus-modale' }
        });
        if (!result.isConfirmed) return;

        setRestaurationId(m.id_materiels);
        try {
            const { message } = await restaurerMateriel(m.id_materiels);
            await chargerCorbeille();
            onRestored();
            MySwal.fire({ icon: 'success', title: 'Restauré !', text: message, timer: 3000, showConfirmButton: false, customClass: { container: 'swal-au-dessus-modale' } });
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Erreur', text: `Échec de la restauration : ${err.message}`, customClass: { container: 'swal-au-dessus-modale' } });
        } finally {
            setRestaurationId(null);
        }
    }, [chargerCorbeille, onRestored]);

    const th = { fontSize: '0.72rem', fontWeight: 600, color: '#475569', padding: '10px 12px', borderBottom: '2px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#F8FAFC' };
    const td = { fontSize: '0.82rem', color: '#1E293B', padding: '9px 12px', borderBottom: '1px solid #F1F5F9' };

    return (
        <div className="add-modal-overlay">
            <div className="add-modal-content" style={{
                maxWidth: '1300px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden'
            }}>
                <div className="add-modal-header" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{ background: 'linear-gradient(135deg, #64748B, #94A3B8)', boxShadow: '0 4px 15px rgba(100, 116, 139, 0.3)' }}>
                            <FaTrashRestore style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>Corbeille</h2>
                            <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {supprimes.length} fiche{supprimes.length > 1 ? 's' : ''} supprimée{supprimes.length > 1 ? 's' : ''} (200 plus récentes) — l'historique est conservé
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="add-modal-close-btn" type="button" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <FaTimes />
                    </button>
                </div>

                <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    {FILTRES.map(f => (
                        <button
                            key={f.value || 'tous'}
                            type="button"
                            onClick={() => setFiltre(f.value)}
                            style={{
                                border: '1px solid', borderColor: filtre === f.value ? '#6366f1' : '#e2e8f0', background: filtre === f.value ? '#e0e7ff' : 'white',
                                color: filtre === f.value ? '#4338ca' : '#374151', borderRadius: '20px', padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            {f.label} <span style={{ opacity: 0.7 }}>({supprimes.filter(f.match).length})</span>
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '5px 14px' }}>
                        <FaSearch style={{ color: '#94a3b8', fontSize: '0.8rem' }} />
                        <input
                            value={recherche}
                            onChange={e => setRecherche(e.target.value)}
                            placeholder="Code PC, utilisateur, motif..."
                            style={{ border: 'none', outline: 'none', fontSize: '0.82rem', width: '200px', background: 'transparent' }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', background: 'white' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Chargement...</div>
                    ) : error ? (
                        <div style={{ margin: '20px 24px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem' }}>{error}</div>
                    ) : supprimesFiltres.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px', fontSize: '0.9rem' }}>La corbeille est vide.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={th}>Supprimé le</th>
                                    <th style={th}>Type</th>
                                    <th style={th}>Code PC</th>
                                    <th style={th}>Dernière affectation</th>
                                    <th style={th}>Motif</th>
                                    <th style={th}>Par</th>
                                    <th style={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {supprimesFiltres.map(m => (
                                    <tr key={m.id_materiels}>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(m.date_suppression).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td style={td}>{m.restaurable ? 'PC' : 'Sans poste'}</td>
                                        <td style={{ ...td, fontWeight: 600 }}>{m.code_pc || '—'}</td>
                                        <td style={td}>{m.detail || m.utilisateur || '—'}</td>
                                        <td style={td}>{m.motif || '—'}</td>
                                        <td style={td}>{m.supprime_par || '—'}</td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            {m.restaurable ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestaurer(m)}
                                                    disabled={restaurationId !== null}
                                                    title="Remettre ce PC en stock"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '10px', fontWeight: 600, fontSize: '0.78rem',
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', cursor: restaurationId !== null ? 'not-allowed' : 'pointer', opacity: restaurationId !== null ? 0.6 : 1
                                                    }}
                                                >
                                                    <FaUndo size={11} /> {restaurationId === m.id_materiels ? 'Restauration...' : 'Restaurer'}
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }} title="Pour redonner un PC à l'utilisateur, utilisez « Réaffecter le PC »">
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

                <div className="add-modal-footer" style={{ background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {supprimesFiltres.length} résultat{supprimesFiltres.length > 1 ? 's' : ''}
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

export default CorbeilleModal;
