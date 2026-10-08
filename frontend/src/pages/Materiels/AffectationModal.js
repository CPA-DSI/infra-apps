// src/pages/Materiels/AffectationModal.js
//
// Réaffectation d'un PC ou déplacement d'un écran. Toute la logique métier
// (fermeture de l'affectation en cours, échange d'écrans, historique) est côté
// serveur (backend-Prisma/services/affectationService.js) : la modale ne fait
// que collecter le choix et l'envoyer.

import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { FaTimes, FaExchangeAlt, FaDesktop, FaLaptop, FaSave, FaInfoCircle } from 'react-icons/fa';
import {
    fetchBeneficiaires, affecterMateriel, fetchAllMateriels, fetchALocaux,
    fetchEcrans, affecterEcran, STATUTS_ECRAN_LABELS,
} from '../../services/api';
import SearchableSelect from './SearchableSelect';
import './Materiels.css';

const MySwal = withReactContent(Swal);

const STOCK = '__STOCK__';
const HORS_POSTE = ['EN_STOCK', 'EN_REPARATION', 'REFORME'];

const selectStyle = {
    backgroundColor: '#fff', height: '40px', fontSize: '0.85rem', color: '#1e293b', border: '1px solid #e2e8f0',
};
const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' };

const Field = ({ label, required, children }) => (
    <div>
        <label style={labelStyle}>
            {label}{required && <span style={{ color: '#EF4444', marginLeft: '4px' }}>*</span>}
        </label>
        {children}
    </div>
);

const AffectationModal = ({ mode, materiel, onClose, onDone }) => {
    const isPC = mode === 'pc';
    const aUnEcran = Boolean(materiel.id_ecran);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Données de référence
    const [beneficiaires, setBeneficiaires] = useState([]);
    const [locaux, setLocaux] = useState([]);
    const [postes, setPostes] = useState([]);
    const [ecransDisponibles, setEcransDisponibles] = useState([]);

    // Saisie
    const [cible, setCible] = useState('');            // PC : id_n ou STOCK ; écran : id_materiels ou statut hors poste
    const [ecranChoisi, setEcranChoisi] = useState(''); // écran : poste sans écran -> écran du stock à installer
    const [utilisateur, setUtilisateur] = useState('');
    const [equipe, setEquipe] = useState(materiel.equipe || '');
    const [idLocal, setIdLocal] = useState(materiel.id_local ? String(materiel.id_local) : '');
    const [modeConflit, setModeConflit] = useState('echanger');
    const [motif, setMotif] = useState('');
    const [etatRemise, setEtatRemise] = useState('');
    const [commentaire, setCommentaire] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                if (isPC) {
                    const [b, l] = await Promise.all([fetchBeneficiaires(), fetchALocaux()]);
                    setBeneficiaires(b);
                    setLocaux(l);
                } else if (aUnEcran) {
                    setPostes(await fetchAllMateriels());
                } else {
                    const [stock, reparation] = await Promise.all([fetchEcrans('EN_STOCK'), fetchEcrans('EN_REPARATION')]);
                    setEcransDisponibles([...stock, ...reparation]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isPC, aUnEcran]);

    // --- Options ---
    const beneficiaireOptions = useMemo(() => [
        ...(materiel.id_n ? [{ value: STOCK, label: '📦 Mettre en stock (aucun bénéficiaire)' }] : []),
        ...beneficiaires
            // Pas de filtre sur is_active : l'import Excel crée les utilisateurs inactifs.
            .filter(b => !b.poste)
            .map(b => ({ value: String(b.id_n), label: `${b.id_n} - ${b.nom || b.email || 'Sans nom'}${b.poste_vide ? ' (sans poste)' : ''}` })),
    ], [beneficiaires, materiel.id_n]);

    const posteOptions = useMemo(() => [
        ...HORS_POSTE.map(s => ({ value: s, label: `📦 ${STATUTS_ECRAN_LABELS[s]}` })),
        ...postes
            .filter(p => p.id_materiels !== materiel.id_materiels)
            .map(p => ({
                value: String(p.id_materiels),
                label: `${p.id_n ?? 'Stock'} - ${p.utilisateur}${p.code_pc ? ` (${p.code_pc})` : ''} — écran : ${p.code_ecran || 'aucun'}`,
            })),
    ], [postes, materiel.id_materiels]);

    const ecranOptions = useMemo(() => ecransDisponibles.map(e => ({
        value: String(e.id_ecran),
        label: `${e.code_ecran}${e.modele ? ` - ${e.modele}` : ''} (${STATUTS_ECRAN_LABELS[e.statut]})`,
    })), [ecransDisponibles]);

    const posteCible = !isPC && aUnEcran && cible && !HORS_POSTE.includes(cible)
        ? postes.find(p => String(p.id_materiels) === cible)
        : null;
    const conflitEcran = Boolean(posteCible?.id_ecran);

    // --- Saisie ---
    const handleBeneficiaireChange = (value) => {
        setCible(value);
        const b = beneficiaires.find(x => String(x.id_n) === value);
        setUtilisateur(b?.nom || '');
        if (b?.equipe) setEquipe(b.equipe);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (isPC) {
            if (!cible) return setError('Choisissez un bénéficiaire.');
            if (cible !== STOCK && !utilisateur.trim()) return setError('Le nom du bénéficiaire est requis.');
        } else if (aUnEcran ? !cible : !ecranChoisi) {
            return setError(aUnEcran ? 'Choisissez une destination.' : 'Choisissez un écran.');
        }

        const commun = { motif: motif || null, etat_remise: etatRemise || null, commentaire: commentaire || null };

        setSubmitting(true);
        try {
            let message;
            if (isPC) {
                const res = await affecterMateriel(materiel.id_materiels, {
                    ...commun,
                    id_n: cible === STOCK ? null : parseInt(cible, 10),
                    utilisateur,
                    equipe,
                    id_local: idLocal ? parseInt(idLocal, 10) : null,
                });
                message = res.message;
            } else if (aUnEcran) {
                const horsPoste = HORS_POSTE.includes(cible);
                const res = await affecterEcran(materiel.id_ecran, {
                    ...commun,
                    id_materiels: horsPoste ? null : parseInt(cible, 10),
                    statut: horsPoste ? cible : undefined,
                    mode_conflit: conflitEcran ? modeConflit : 'refuser',
                });
                message = res.message;
            } else {
                const res = await affecterEcran(parseInt(ecranChoisi, 10), {
                    ...commun,
                    id_materiels: materiel.id_materiels,
                });
                message = res.message;
            }

            MySwal.fire({ icon: 'success', title: 'Affectation enregistrée', text: message, timer: 2500, showConfirmButton: false });
            onDone();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Rendu ---
    const titre = isPC ? 'Réaffecter le PC' : aUnEcran ? 'Déplacer l\'écran' : 'Installer un écran';
    const sousTitre = isPC
        ? `Poste ${materiel.code_pc || `#${materiel.id_materiels}`} — actuellement : ${materiel.id_n ? `${materiel.id_n} - ${materiel.utilisateur}` : 'en stock'}`
        : aUnEcran
            ? `Écran ${materiel.code_ecran} — actuellement sur le poste de ${materiel.utilisateur}`
            : `Poste de ${materiel.utilisateur} — aucun écran`;

    return (
        // Au-dessus de DetailsModal (.add-modal-overlay = z-index 9999, cf. styles/ModalSystem.css).
        <div className="add-modal-overlay" style={{ zIndex: 10000 }}>
            <form onSubmit={handleSubmit} className="add-modal-content" style={{
                maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                <div className="add-modal-header" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)' }}>
                            {isPC ? <FaLaptop style={{ color: 'white' }} /> : <FaDesktop style={{ color: 'white' }} />}
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>{titre}</h2>
                            <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>{sousTitre}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="add-modal-close-btn" type="button" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <FaTimes />
                    </button>
                </div>

                <div className="add-modal-body" style={{ padding: '24px', background: '#F8FAFC', display: 'grid', gap: '16px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Chargement...</div>
                    ) : (
                        <>
                            {isPC && (
                                <>
                                    <Field label="Nouveau bénéficiaire" required>
                                        <SearchableSelect value={cible} onChange={handleBeneficiaireChange} options={beneficiaireOptions} placeholder="Choisir un utilisateur sans poste..." style={selectStyle} />
                                    </Field>
                                    {cible && cible !== STOCK && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <Field label="Nom du bénéficiaire" required>
                                                <input style={inputStyle} value={utilisateur} onChange={e => setUtilisateur(e.target.value)} />
                                            </Field>
                                            <Field label="Équipe">
                                                <input style={inputStyle} value={equipe} onChange={e => setEquipe(e.target.value)} />
                                            </Field>
                                        </div>
                                    )}
                                    <Field label="Local">
                                        <select style={inputStyle} value={idLocal} onChange={e => setIdLocal(e.target.value)}>
                                            <option value="">Non attribué</option>
                                            {locaux.map(l => <option key={l.id_local} value={l.id_local}>{l.nom_local}</option>)}
                                        </select>
                                    </Field>
                                    {cible === STOCK ? (
                                        <div style={{ fontSize: '0.8rem', color: '#1E40AF', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <FaInfoCircle /> {materiel.utilisateur} gardera une fiche vide (« Sans poste »)
                                            {materiel.id_ecran ? ` et l'écran ${materiel.code_ecran} partira en stock.` : '.'}
                                        </div>
                                    ) : materiel.id_ecran && (
                                        <div style={{ fontSize: '0.8rem', color: '#1E40AF', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <FaInfoCircle /> L'écran {materiel.code_ecran} reste sur ce poste et suit le PC.
                                        </div>
                                    )}
                                </>
                            )}

                            {!isPC && aUnEcran && (
                                <>
                                    <Field label="Destination" required>
                                        <SearchableSelect value={cible} onChange={setCible} options={posteOptions} placeholder="Choisir un poste ou un statut..." style={selectStyle} />
                                    </Field>
                                    {conflitEcran && (
                                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 14px', fontSize: '0.85rem', color: '#92400E' }}>
                                            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                                                Ce poste a déjà l'écran {posteCible.code_ecran}. Que faire de cet écran ?
                                            </div>
                                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                                                <input type="radio" checked={modeConflit === 'echanger'} onChange={() => setModeConflit('echanger')} />
                                                <FaExchangeAlt /> Échanger : il vient sur le poste de {materiel.utilisateur}
                                            </label>
                                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', marginTop: '6px' }}>
                                                <input type="radio" checked={modeConflit === 'stock'} onChange={() => setModeConflit('stock')} />
                                                📦 Le mettre en stock
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}

                            {!isPC && !aUnEcran && (
                                <Field label="Écran à installer" required>
                                    {ecranOptions.length === 0 ? (
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Aucun écran en stock ou en réparation.</div>
                                    ) : (
                                        <SearchableSelect value={ecranChoisi} onChange={setEcranChoisi} options={ecranOptions} placeholder="Choisir un écran..." style={selectStyle} />
                                    )}
                                </Field>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <Field label="Motif">
                                    <input style={inputStyle} value={motif} onChange={e => setMotif(e.target.value)} placeholder="Arrivée, départ, panne..." />
                                </Field>
                                <Field label="État à la remise">
                                    <input style={inputStyle} value={etatRemise} onChange={e => setEtatRemise(e.target.value)} placeholder="Bon état, rayure..." />
                                </Field>
                            </div>
                            <Field label="Commentaire">
                                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} value={commentaire} onChange={e => setCommentaire(e.target.value)} />
                            </Field>

                            {error && (
                                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem' }}>
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="add-modal-footer" style={{ background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn" style={{
                        background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer'
                    }}>
                        Annuler
                    </button>
                    <button type="submit" disabled={loading || submitting} className="add-modal-submit-btn" style={{
                        background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', color: 'white', border: 'none', padding: '10px 32px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: loading || submitting ? 'not-allowed' : 'pointer', opacity: loading || submitting ? 0.6 : 1
                    }}>
                        <FaSave /> {submitting ? 'Enregistrement...' : 'Valider'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AffectationModal;
