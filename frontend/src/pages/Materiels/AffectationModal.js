// src/pages/Materiels/AffectationModal.js
//
// Réaffectation d'un PC ou déplacement d'un écran. Toute la logique métier
// (fermeture de l'affectation en cours, échange d'écrans, historique) est côté
// serveur (backend-Prisma/services/affectationService.js) : la modale ne fait
// que collecter le choix et l'envoyer.

import React, { useState, useEffect, useMemo } from 'react';
import { MySwal } from '../../utils/swal';
import { FaExchangeAlt, FaDesktop, FaLaptop, FaSave, FaInfoCircle } from 'react-icons/fa';
import {
    fetchBeneficiaires, affecterMateriel, fetchAllMateriels, fetchALocaux,
    fetchEcrans, affecterEcran, STATUTS_ECRAN_LABELS,
} from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect/SearchableSelect';
import AppModal from '../../components/AppModal/AppModal';
import { ETATS_PHYSIQUES } from './materielsTableConfig';
import './MaterielsModals.css';

const STOCK = '__STOCK__';
const HORS_POSTE = ['EN_STOCK', 'EN_REPARATION', 'REFORME'];

// Passé à SearchableSelect (prop style).
const selectStyle = {
    backgroundColor: 'var(--color-bg)', height: '40px', fontSize: '0.85rem', color: 'var(--color-text-main)', border: '1px solid var(--color-border)',
};

const Field = ({ label, required, children }) => (
    <div>
        <label className="mat-field-label">
            {label}{required && <span className="mat-required">*</span>}
        </label>
        {children}
    </div>
);

// miseEnStock : ouvre la réaffectation du PC avec « Mettre en stock » déjà
// choisi (cf. EditModal, état « Stock » / « Sans poste »).
const AffectationModal = ({ mode, materiel, onClose, onDone, miseEnStock = false }) => {
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
    const [cible, setCible] = useState(isPC && miseEnStock && materiel.id_n ? STOCK : ''); // PC : id_n ou STOCK ; écran : id_materiels ou statut hors poste
    const [ecranChoisi, setEcranChoisi] = useState(''); // écran : poste sans écran -> écran (stock, réparation ou chez un collègue) à installer
    const [utilisateur, setUtilisateur] = useState('');
    const [equipe, setEquipe] = useState(materiel.equipe || '');
    const [idLocal, setIdLocal] = useState(materiel.id_local ? String(materiel.id_local) : '');
    const [modeConflit, setModeConflit] = useState('stock');
    // Écran : en mode 'stock', où part l'écran remplacé.
    const [statutAncienEcran, setStatutAncienEcran] = useState('EN_STOCK');
    // PC : le bénéficiaire a déjà un PC -> 'stock' ou 'echanger'.
    const [modeConflitPC, setModeConflitPC] = useState('stock');
    const [etatAncienPC, setEtatAncienPC] = useState('');
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
                    // Écrans libres d'abord, puis ceux installés chez un collègue.
                    const [stock, reparation, affectes] = await Promise.all([
                        fetchEcrans('EN_STOCK'), fetchEcrans('EN_REPARATION'), fetchEcrans('AFFECTE'),
                    ]);
                    setEcransDisponibles([...stock, ...reparation, ...affectes.filter(e => e.materiel)]);
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
            // Les utilisateurs qui ont déjà un PC sont proposés : la modale demande
            // alors quoi faire de leur PC actuel (stock ou échange).
            .filter(b => b.poste?.id_materiels !== materiel.id_materiels)
            .map(b => ({
                value: String(b.id_n),
                label: `${b.id_n} - ${b.nom || b.email || 'Sans nom'}${b.poste_vide
                    ? ' (sans poste)'
                    : b.poste ? ` (a déjà le PC ${b.poste.code_pc || `#${b.poste.id_materiels}`})` : ''}`,
            })),
    ], [beneficiaires, materiel.id_n, materiel.id_materiels]);

    const beneficiaireChoisi = isPC && cible && cible !== STOCK
        ? beneficiaires.find(b => String(b.id_n) === cible)
        : null;
    const ancienPC = beneficiaireChoisi?.poste || null;
    const libelleAncienPC = ancienPC ? `PC ${ancienPC.code_pc || `#${ancienPC.id_materiels}`}` : '';
    // Échange possible seulement si le PC réaffecté a un titulaire.
    const echangePossible = Boolean(materiel.id_n);
    const echange = Boolean(ancienPC) && modeConflitPC === 'echanger';

    // Écran : on choisit un bénéficiaire (son poste, éventuellement « Sans
    // poste »), comme pour le PC. Les PC en stock sont proposés à la fin.
    const posteOptions = useMemo(() => {
        const autres = postes.filter(p => p.id_materiels !== materiel.id_materiels);
        const mentionEcran = (p) => (p.code_ecran ? ` (a déjà l'écran ${p.code_ecran})` : '');
        return [
            ...HORS_POSTE.map(s => ({ value: s, label: `📦 ${STATUTS_ECRAN_LABELS[s]}` })),
            ...autres
                .filter(p => p.id_n != null)
                .map(p => ({
                    value: String(p.id_materiels),
                    label: `${p.id_n} - ${p.utilisateur}${p.est_vide ? ' (sans poste)' : ''}${mentionEcran(p)}`,
                })),
            ...autres
                .filter(p => p.id_n == null)
                .map(p => ({
                    value: String(p.id_materiels),
                    label: `💻 PC en stock ${p.code_pc || `#${p.id_materiels}`}${mentionEcran(p)}`,
                })),
        ];
    }, [postes, materiel.id_materiels]);

    const ecranOptions = useMemo(() => ecransDisponibles.map(e => ({
        value: String(e.id_ecran),
        label: `${e.code_ecran}${e.modele ? ` - ${e.modele}` : ''} (${e.materiel
            ? `chez ${e.materiel.id_n ? `${e.materiel.id_n} - ` : ''}${e.materiel.utilisateur}`
            : STATUTS_ECRAN_LABELS[e.statut]})`,
    })), [ecransDisponibles]);

    const posteCible = !isPC && aUnEcran && cible && !HORS_POSTE.includes(cible)
        ? postes.find(p => String(p.id_materiels) === cible)
        : null;
    const conflitEcran = Boolean(posteCible?.id_ecran);
    const nomPosteCible = posteCible
        ? (posteCible.id_n != null ? posteCible.utilisateur : `PC en stock ${posteCible.code_pc || `#${posteCible.id_materiels}`}`)
        : '';
    // Écran à installer pris chez un collègue : son poste se retrouvera sans écran.
    const ecranChezCollegue = !isPC && !aUnEcran
        ? ecransDisponibles.find(e => String(e.id_ecran) === ecranChoisi)?.materiel || null
        : null;

    const handleDestinationEcranChange = (value) => {
        setCible(value);
        setModeConflit('stock');
        setStatutAncienEcran('EN_STOCK');
    };

    // --- Saisie ---
    const handleBeneficiaireChange = (value) => {
        setCible(value);
        setModeConflitPC('stock');
        setEtatAncienPC('');
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
                    ...(ancienPC ? {
                        mode_conflit: modeConflitPC,
                        etat_ancien_pc: modeConflitPC === 'stock' && etatAncienPC ? etatAncienPC : null,
                    } : {}),
                });
                message = res.message;
            } else if (aUnEcran) {
                const horsPoste = HORS_POSTE.includes(cible);
                const res = await affecterEcran(materiel.id_ecran, {
                    ...commun,
                    id_materiels: horsPoste ? null : parseInt(cible, 10),
                    statut: horsPoste ? cible : undefined,
                    mode_conflit: conflitEcran ? modeConflit : 'refuser',
                    ...(conflitEcran && modeConflit === 'stock' ? { statut_ancien_ecran: statutAncienEcran } : {}),
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
    const titre = isPC ? 'Réaffecter le PC' : aUnEcran ? 'Réaffecter l\'écran' : 'Installer un écran';
    const sousTitre = isPC
        ? `Poste ${materiel.code_pc || `#${materiel.id_materiels}`} — actuellement : ${materiel.id_n ? `${materiel.id_n} - ${materiel.utilisateur}` : 'en stock'}`
        : aUnEcran
            ? `Écran ${materiel.code_ecran} — actuellement sur le poste de ${materiel.utilisateur}`
            : `Poste de ${materiel.utilisateur} — aucun écran`;

    return (
        // Ouverte depuis DetailsModal : au-dessus de celle-ci.
        <AppModal
            show
            nested
            onClose={onClose}
            size="md"
            as="form"
            onSubmit={handleSubmit}
            title={titre}
            subtitle={sousTitre}
            icon={isPC ? <FaLaptop /> : <FaDesktop />}
            contentClassName="mat-modal mat-modal--affectation"
            bodyClassName="mat-affectation-body"
            footer={
                <>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                        Annuler
                    </button>
                    <button type="submit" disabled={loading || submitting} className="add-modal-submit-btn">
                        <FaSave aria-hidden="true" /> {submitting ? 'Enregistrement...' : 'Valider'}
                    </button>
                </>
            }
        >
            {loading ? (
                <div className="mat-list-state">Chargement...</div>
            ) : (
                <>
                    {isPC && (
                        <>
                            <Field label="Nouveau bénéficiaire" required>
                                <SearchableSelect value={cible} onChange={handleBeneficiaireChange} options={beneficiaireOptions} placeholder="Choisir un utilisateur..." style={selectStyle} />
                            </Field>
                            {cible && cible !== STOCK && (
                                <div className="mat-two-cols">
                                    <Field label="Nom du bénéficiaire" required>
                                        <input className="mat-field-input" value={utilisateur} onChange={e => setUtilisateur(e.target.value)} />
                                    </Field>
                                    <Field label="Équipe">
                                        <input className="mat-field-input" value={equipe} onChange={e => setEquipe(e.target.value)} />
                                    </Field>
                                </div>
                            )}
                            {ancienPC && (
                                <div className="mat-conflict-box">
                                    <div className="mat-conflict-title">
                                        {utilisateur || beneficiaireChoisi.nom} a déjà le {libelleAncienPC}. Que faire de ce PC ?
                                    </div>
                                    <label className="mat-radio-label">
                                        <input type="radio" checked={modeConflitPC === 'stock'} onChange={() => setModeConflitPC('stock')} />
                                        📦 Le mettre en stock (remplacement)
                                    </label>
                                    {modeConflitPC === 'stock' && (
                                        <div className="mat-conflict-sub">
                                            <label className="mat-field-label" htmlFor="etat-ancien-pc">État physique du {libelleAncienPC} au retour</label>
                                            <select id="etat-ancien-pc" className="mat-field-input" value={etatAncienPC} onChange={e => setEtatAncienPC(e.target.value)}>
                                                <option value="">Inchangé</option>
                                                {ETATS_PHYSIQUES.map(etat => <option key={etat} value={etat}>{etat}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <label className={`mat-radio-label${echangePossible ? '' : ' mat-radio-label--disabled'}`}>
                                        <input
                                            type="radio"
                                            disabled={!echangePossible}
                                            checked={modeConflitPC === 'echanger'}
                                            onChange={() => setModeConflitPC('echanger')}
                                        />
                                        <FaExchangeAlt /> {echangePossible
                                            ? `Échanger : il part chez ${materiel.utilisateur}`
                                            : 'Échanger : impossible, ce PC est en stock'}
                                    </label>
                                </div>
                            )}
                            {!echange && (
                                <Field label="Local">
                                    <select className="mat-field-input" value={idLocal} onChange={e => setIdLocal(e.target.value)}>
                                        <option value="">Non attribué</option>
                                        {locaux.map(l => <option key={l.id_local} value={l.id_local}>{l.nom_local}</option>)}
                                    </select>
                                </Field>
                            )}
                            {echange ? (
                                <div className="mat-info-line">
                                    <FaInfoCircle aria-hidden="true" /> Seuls les PC changent de mains : chacun garde son écran, son local et son équipe.
                                    Aucune fiche « Sans poste » n'est créée.
                                </div>
                            ) : cible === STOCK ? (
                                <div className="mat-info-line">
                                    <FaInfoCircle aria-hidden="true" /> {materiel.utilisateur} gardera une fiche vide (« Sans poste »)
                                    {materiel.id_ecran ? ` et l'écran ${materiel.code_ecran} partira en stock.` : '.'}
                                </div>
                            ) : (materiel.id_n || materiel.id_ecran || ancienPC) && (
                                <div className="mat-info-line">
                                    <FaInfoCircle aria-hidden="true" />
                                    {materiel.id_n && ` ${materiel.utilisateur} gardera une fiche vide (« Sans poste »).`}
                                    {materiel.id_ecran && ` L'écran ${materiel.code_ecran} reste sur ce poste et suit le PC.`}
                                    {ancienPC && (materiel.id_ecran
                                        ? ` L'écran du ${libelleAncienPC}, s'il y en a un, partira en stock.`
                                        : ` L'écran du ${libelleAncienPC}, s'il y en a un, passera sur ce PC.`)}
                                </div>
                            )}
                        </>
                    )}

                    {!isPC && aUnEcran && (
                        <>
                            <Field label="Nouveau bénéficiaire" required>
                                <SearchableSelect value={cible} onChange={handleDestinationEcranChange} options={posteOptions} placeholder="Choisir un utilisateur ou un statut..." style={selectStyle} />
                            </Field>
                            {conflitEcran && (
                                <div className="mat-conflict-box">
                                    <div className="mat-conflict-title">
                                        {nomPosteCible} a déjà l'écran {posteCible.code_ecran}. Que faire de cet écran ?
                                    </div>
                                    <label className="mat-radio-label">
                                        <input type="radio" checked={modeConflit === 'stock'} onChange={() => setModeConflit('stock')} />
                                        📦 Le retirer (remplacement)
                                    </label>
                                    {modeConflit === 'stock' && (
                                        <div className="mat-conflict-sub">
                                            <label className="mat-field-label" htmlFor="statut-ancien-ecran">Destination de l'écran {posteCible.code_ecran}</label>
                                            <select id="statut-ancien-ecran" className="mat-field-input" value={statutAncienEcran} onChange={e => setStatutAncienEcran(e.target.value)}>
                                                {HORS_POSTE.map(s => <option key={s} value={s}>{STATUTS_ECRAN_LABELS[s]}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <label className="mat-radio-label">
                                        <input type="radio" checked={modeConflit === 'echanger'} onChange={() => setModeConflit('echanger')} />
                                        <FaExchangeAlt /> Échanger : il vient sur le poste de {materiel.utilisateur}
                                    </label>
                                </div>
                            )}
                            {posteCible && !(conflitEcran && modeConflit === 'echanger') && (
                                <div className="mat-info-line">
                                    <FaInfoCircle aria-hidden="true" /> Le poste de {materiel.utilisateur} se retrouvera sans écran.
                                </div>
                            )}
                        </>
                    )}

                    {!isPC && !aUnEcran && (
                        <Field label="Écran à installer" required>
                            {ecranOptions.length === 0 ? (
                                <div className="mat-muted-text">Aucun écran disponible.</div>
                            ) : (
                                <SearchableSelect value={ecranChoisi} onChange={setEcranChoisi} options={ecranOptions} placeholder="Choisir un écran (stock, réparation ou chez un collègue)..." style={selectStyle} />
                            )}
                        </Field>
                    )}
                    {ecranChezCollegue && (
                        <div className="mat-info-line">
                            <FaInfoCircle aria-hidden="true" /> Cet écran est chez {ecranChezCollegue.utilisateur}
                            {ecranChezCollegue.code_pc ? ` (${ecranChezCollegue.code_pc})` : ''} : son poste se retrouvera sans écran.
                        </div>
                    )}

                    <div className="mat-two-cols">
                        <Field label="Motif">
                            <input className="mat-field-input" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Arrivée, départ, panne..." />
                        </Field>
                        <Field label="État à la remise">
                            <input className="mat-field-input" value={etatRemise} onChange={e => setEtatRemise(e.target.value)} placeholder="Bon état, rayure..." />
                        </Field>
                    </div>
                    <Field label="Commentaire">
                        <textarea className="mat-field-input" value={commentaire} onChange={e => setCommentaire(e.target.value)} />
                    </Field>

                    {error && (
                        <div className="mat-alert-error">
                            {error}
                        </div>
                    )}
                </>
            )}
        </AppModal>
    );
};

export default AffectationModal;
