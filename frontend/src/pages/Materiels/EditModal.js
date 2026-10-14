// src/pages/Materiels/EditModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { fetchALocaux, fetchAMarques, updateMateriel } from '../../services/api';
import { MySwal, notify } from '../../utils/swal';
import { escapeHtml } from '../../utils/escapeHtml';
import { FaVideo, FaNetworkWired, FaUsb, FaPlug, FaCheckCircle, FaTimesCircle, FaTimes, FaEdit, FaSave, FaInfoCircle, FaKeyboard as FaKeyboardIcon } from 'react-icons/fa';
import FormItem from '../../components/FormItem/FormItem';
import { getMaterielFieldIcon } from './materielFieldIcons';
import AffectationModal from './AffectationModal';
import AppModal from '../../components/AppModal/AppModal';
import './MaterielsModals.css';

// États posés par la mise en stock (affectation), jamais enregistrés par le
// PUT : les choisir ici déclenche la vraie mise en stock.
const ETATS_MISE_EN_STOCK = ['Stock', 'Sans poste'];

const ETAT_OPTIONS = [
    { value: 'Très Bon', label: '✅ Très Bon' },
    { value: 'Bon', label: '👍 Bon' },
    { value: 'Moyen', label: '⚠️ Moyen' },
    { value: 'Mauvais', label: '❗ Mauvais' },
    { value: 'Disponible', label: '📦 Disponible' },
    { value: 'HS', label: '❌ HS' },
    { value: 'Stock', label: '📥 Stock' },
    { value: 'Sans poste', label: '🚫 Sans poste' }
];

const customSelectStyles = {
    control: (provided) => ({
        ...provided,
        padding: '4px 0',
        borderRadius: '10px',
        borderColor: 'var(--color-border)',
        fontSize: '0.85rem',
        color: 'var(--color-text-main)',
        backgroundColor: 'white',
        minHeight: '40px',
        '&:hover': {
            borderColor: 'var(--color-border)',
        },
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0 12px',
        fontSize: '0.85rem',
    }),
    input: (provided) => ({
        ...provided,
        margin: '0',
        padding: '0',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        padding: '8px',
        color: 'var(--color-text-sub)',
    }),
    clearIndicator: (provided) => ({
        ...provided,
        padding: '8px',
        color: 'var(--color-text-sub)',
    }),
    menu: (provided) => ({
        ...provided,
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        zIndex: 'var(--z-dropdown)',
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? 'var(--color-primary)' : state.isFocused ? 'var(--color-border-light)' : 'white',
        color: state.isSelected ? 'white' : 'var(--color-text-main)',
        fontSize: '0.85rem',
        padding: '8px 12px',
        cursor: 'pointer',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: 'var(--color-text-muted)',
        fontSize: '0.85rem',
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--color-text-main)',
        fontSize: '0.85rem',
    }),
};

const EditModal = ({ isOpen, onClose, data, onUpdateSuccess }) => {
    const [formData, setFormData] = useState(data || {});
    const [marqueOptions, setMarqueOptions] = useState([]);
    const [localOptions, setLocalOptions] = useState([]);
    const [isLoadingMarques, setIsLoadingMarques] = useState(true);
    const [isLoadingLocaux, setIsLoadingLocaux] = useState(true);
    const [error, setError] = useState(null);
    const [affectationStock, setAffectationStock] = useState(false);

    // Un PC affecté peut être mis en stock ; sinon « Stock » / « Sans poste »
    // ne sont proposés que s'ils sont déjà l'état actuel.
    const peutMettreEnStock = Boolean(data?.id_n) && !data?.est_vide;
    const etatOptions = ETAT_OPTIONS.filter(o =>
        !ETATS_MISE_EN_STOCK.includes(o.value) || peutMettreEnStock || o.value === data?.etat_pc
    );

    const showNotification = (message, type = 'success') => {
        notify(message, type);
    };

    useEffect(() => {
        if (data) {
            const formatDate = (dateString) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${date.getFullYear()}-${month}-${day}`;
            };

            setFormData({
                ...data,
                id_marque: data.id_marque?.toString() || '',
                id_local: data.id_local?.toString() || '',
                date_pc: formatDate(data.date_pc),
                date_ecran: formatDate(data.date_ecran),
            });
        } else {
            setFormData({});
        }
    }, [data]);

    useEffect(() => {
        const loadMarques = async () => {
            try {
                const data = await fetchAMarques(); 
                const options = data.map(m => ({
                    value: m.id_marque.toString(),
                    label: m.nom_marque
                }));
                setMarqueOptions(options);
            } catch (err) {
                console.error("Erreur lors du chargement des marques:", err);
                setError(err.message || "Une erreur est survenue.");
                showNotification("Erreur lors du chargement des marques.", 'error');
            } finally {
                setIsLoadingMarques(false);
            }
        };
        loadMarques();
    }, []);

    useEffect(() => {
        const loadLocaux = async () => {
            try {
                const data = await fetchALocaux(); 
                const options = data.map(l => ({
                    value: l.id_local.toString(),
                    label: l.nom_local
                }));
                setLocalOptions(options);
            } catch (err) {
                console.error("Erreur lors du chargement des locaux:", err);
                setError(err.message || "Une erreur est survenue."); 
                showNotification("Erreur lors du chargement des locaux.", 'error');
            } finally {
                setIsLoadingLocaux(false);
            }
        };
        loadLocaux();
    }, []);

    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const handleSelectChange = useCallback((name, selectedOption) => {
        setFormData(prev => ({
            ...prev,
            [name]: selectedOption ? selectedOption.value : ''
        }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // « Stock » / « Sans poste » sur un PC affecté : on propose la vraie mise
        // en stock (fenêtre de réaffectation) au lieu de changer le seul libellé.
        const miseEnStock = peutMettreEnStock && ETATS_MISE_EN_STOCK.includes(formData.etat_pc);
        let confirmerStock = false;
        if (miseEnStock) {
            const choix = await MySwal.fire({
                icon: 'question',
                title: 'Mettre le PC en stock ?',
                html: `L'état « ${escapeHtml(formData.etat_pc)} » correspond à une mise en stock du PC <b>${escapeHtml(formData.code_pc || `#${formData.id_materiels}`)}</b> : `
                    + `${escapeHtml(formData.utilisateur)} gardera une fiche « Sans poste »${formData.id_ecran ? ` et l'écran ${escapeHtml(formData.code_ecran)} partira en stock` : ''}.`
                    + `<br/><br/>Les autres modifications sont enregistrées dans les deux cas.`,
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: '📥 Mettre en stock',
                denyButtonText: "Enregistrer sans changer l'état",
                cancelButtonText: 'Annuler',
            });
            if (choix.isDismissed) return;
            confirmerStock = choix.isConfirmed;
        }

        try {
            // Seuls les champs modifiables sont envoyés : matricule, utilisateur,
            // statut Actif et écran passent par l'affectation (historisée).
            const apiPayload = {
                equipe: formData.equipe,
                caracteristiques: formData.caracteristiques,
                code_pc: formData.code_pc,
                hdmi: formData.hdmi,
                clavier: formData.clavier,
                lan: formData.lan,
                usb: formData.usb,
                etat_pc: formData.etat_pc,
                salle: formData.salle,
                mdp_pc: formData.mdp_pc,
                mdp_admin: formData.mdp_admin,
                etat_batterie: formData.etat_batterie,
                commentaire: formData.commentaire,
                id_marque: formData.id_marque ? parseInt(formData.id_marque, 10) : null,
                id_local: formData.id_local ? parseInt(formData.id_local, 10) : null,
                date_pc: formData.date_pc ? new Date(formData.date_pc) : null,
            };

            // L'état est alors posé par la mise en stock (ou reste inchangé).
            if (miseEnStock) delete apiPayload.etat_pc;

            await updateMateriel(formData.id_materiels, apiPayload);

            if (confirmerStock) {
                setAffectationStock(true);
                return;
            }
            showNotification("Matériel mis à jour avec succès !", 'success');

            if (onUpdateSuccess) {
                onUpdateSuccess();
            }
            onClose();

        } catch (error) {
            console.error("Erreur détaillée:", error);
            showNotification(`Erreur lors de la mise à jour du matériel: ${error.message}`, 'error');
        }
    };

    if (!isOpen) return null;

    if (isLoadingMarques || isLoadingLocaux) {
        return <div className="add-modal-loading">Chargement...</div>;
    }

    if (error) {
        return (
            <AppModal
                show
                onClose={onClose}
                size="sm"
                title="Erreur"
                contentClassName="mat-modal"
                footer={<button type="button" onClick={onClose} className="add-modal-cancel-btn">Fermer</button>}
            >
                Erreur : {error}
            </AppModal>
        );
    }

    // Les autres champs sont déjà enregistrés : fermer ou valider recharge la liste.
    if (affectationStock) {
        return (
            <AffectationModal
                mode="pc"
                // Local saisi ici : la réaffectation le renvoie, il ne doit pas être écrasé.
                materiel={{ ...data, id_local: formData.id_local ? parseInt(formData.id_local, 10) : null }}
                miseEnStock
                onClose={onClose}
                onDone={() => {
                    if (onUpdateSuccess) onUpdateSuccess();
                    onClose();
                }}
            />
        );
    }

    const header = (
        <div className="add-modal-header">
            <div className="d-flex align-items-center gap-3">
                <div className="add-modal-icon-wrapper" aria-hidden="true">
                    <FaEdit />
                </div>
                <div>
                    <h2 className="add-modal-title">
                        Modification Matériel N°{formData.id_n || ''}
                    </h2>
                    <p className="add-modal-subtitle">
                        Modifiez les informations ci-dessous
                    </p>
                </div>
            </div>
            <div className="mat-modal-header-actions">
                {formData.code_pc && (
                    <div className="mat-modal-code-badge">
                        <span className="mat-modal-code-badge-label">Code</span>
                        <span className="mat-modal-code-badge-value">{formData.code_pc}</span>
                    </div>
                )}
                <button onClick={onClose} className="add-modal-close-btn" type="button" aria-label="Fermer">
                    <FaTimes />
                </button>
            </div>
        </div>
    );

    return (
        <AppModal
            show={isOpen}
            onClose={onClose}
            as="form"
            onSubmit={handleSubmit}
            header={header}
            ariaLabel={`Modification Matériel N°${formData.id_n || ''}`}
            contentClassName="mat-modal mat-modal--edit"
            footer={
                <>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                        Annuler
                    </button>
                    <button type="submit" className="add-modal-submit-btn">
                        <FaSave aria-hidden="true" /> Sauvegarder
                    </button>
                </>
            }
        >
            {/* Section d'information */}
            <div className="mat-info-band">
                <FaInfoCircle aria-hidden="true" />
                <span>
                    Modifiez les champs souhaités et cliquez sur Sauvegarder. Le matricule, l'utilisateur, le statut Actif
                    et l'écran se changent depuis le détail du matériel (« Réaffecter le PC » / « Déplacer l'écran »)
                    ou le bouton Status de la liste, pour garder l'historique.
                </span>
            </div>

            {/* Placement automatique en deux colonnes ; le bloc Connectiques occupe les
                lignes « Équipe » + « Date PC » (cf. .mat-form-2col--edit), ce qui aligne
                « Date Écran » avec « Mot de passe local ». */}
            <div className="add-modal-form-grid mat-form-2col mat-form-2col--edit">
                <div>
                    <FormItem label="N° Matricule" name="id_n" formData={formData} handleChange={handleChange} disabled icon={getMaterielFieldIcon("id_n")} />
                </div>
                <div>
                    <FormItem label="Utilisateur (via « Réaffecter le PC »)" name="utilisateur" formData={formData} handleChange={handleChange} disabled icon={getMaterielFieldIcon("utilisateur")} />
                </div>

                <div>
                    <FormItem label="Marque Laptop" name="id_marque" type="select" options={marqueOptions} formData={formData} handleChange={handleChange} onSelectChange={handleSelectChange} disabled={isLoadingMarques} isClearable selectStyles={customSelectStyles} noOptionsMessage={() => "Aucune option disponible"} icon={getMaterielFieldIcon("id_marque")} />
                </div>
                <div>
                    <FormItem label="Code PC" name="code_pc" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("code_pc")} />
                </div>

                <div>
                    <FormItem label="Marque Écran" name="ecran" formData={formData} handleChange={handleChange} disabled icon={getMaterielFieldIcon("ecran")} />
                </div>
                <div>
                    <FormItem label="Code Écran" name="code_ecran" formData={formData} handleChange={handleChange} disabled icon={getMaterielFieldIcon("code_ecran")} />
                </div>

                <div>
                    <FormItem label="Équipe" name="equipe" formData={formData} handleChange={handleChange} required icon={getMaterielFieldIcon("equipe")} />
                </div>
                <div>
                    <FormItem label="Date PC" name="date_pc" type="date" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("date_pc")} />
                </div>
                <div className="add-modal-form-group mat-connectiques-cell">
                    <span className="add-modal-label mat-form-title-label">
                        <FaPlug aria-hidden="true" /> Connectiques
                    </span>
                    <div className="add-modal-connectiques">
                        <label className="add-modal-connectique-label">
                            <input type="checkbox" name="hdmi" checked={formData.hdmi || false} onChange={handleChange} className="add-modal-checkbox" />
                            <FaVideo className="add-modal-connectique-icon is-hdmi" aria-hidden="true" />
                            Adapteur HDMI
                        </label>
                        <label className="add-modal-connectique-label">
                            <input type="checkbox" name="lan" checked={formData.lan || false} onChange={handleChange} className="add-modal-checkbox" />
                            <FaNetworkWired className="add-modal-connectique-icon is-lan" aria-hidden="true" />
                            Adapteur LAN
                        </label>
                        <label className="add-modal-connectique-label">
                            <input type="checkbox" name="usb" checked={formData.usb || false} onChange={handleChange} className="add-modal-checkbox" />
                            <FaUsb className="add-modal-connectique-icon is-usb" aria-hidden="true" />
                            Adapteur USB
                        </label>
                        <label className="add-modal-connectique-label">
                            <input type="checkbox" name="clavier" checked={formData.clavier || false} onChange={handleChange} className="add-modal-checkbox" />
                            <FaKeyboardIcon className="add-modal-connectique-icon is-clavier" aria-hidden="true" />
                            Clavier Externe
                        </label>
                    </div>
                </div>

                <div>
                    <FormItem label="Date Écran" name="date_ecran" type="date" formData={formData} handleChange={handleChange} disabled icon={getMaterielFieldIcon("date_ecran")} />
                </div>
                <div>
                    <FormItem label="Mot de passe local" name="mdp_pc" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("mdp_pc")} />
                </div>

                <div>
                    <FormItem label="salle" name="salle" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("salle")} />
                </div>
                <div>
                    <FormItem label="Mot de passe Admin" name="mdp_admin" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("mdp_admin")} />
                </div>

                <div>
                    <FormItem label="Local(s)" name="id_local" type="select" options={localOptions} formData={formData} handleChange={handleChange} onSelectChange={handleSelectChange} disabled={isLoadingLocaux} isClearable selectStyles={customSelectStyles} noOptionsMessage={() => "Aucune option disponible"} icon={getMaterielFieldIcon("id_local")} />
                </div>
                <div>
                    <FormItem label="État Batterie" name="etat_batterie" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("etat_batterie")} />
                </div>

                <div>
                    <FormItem label="État PC" name="etat_pc" type="select" icon={getMaterielFieldIcon("etat_pc")}
                        options={etatOptions}
                        formData={formData}
                        handleChange={handleChange}
                        onSelectChange={handleSelectChange}
                        isClearable
                        selectStyles={customSelectStyles}
                        noOptionsMessage={() => "Aucune option disponible"}
                    />
                </div>
                <div className="add-modal-form-group add-modal-actif-group">
                    <label className="add-modal-label mat-form-title-label">
                        <span className="add-modal-actif-state">
                            Actif
                            {formData.est_actif ? (
                                <FaCheckCircle className="add-modal-actif-icon is-on" aria-hidden="true" />
                            ) : (
                                <FaTimesCircle className="add-modal-actif-icon" aria-hidden="true" />
                            )}
                        </span>
                        {/* Lecture seule : le statut se change via le bouton Status de la liste. */}
                        <div
                            className={`add-modal-toggle is-readonly ${formData.est_actif ? 'is-on' : ''}`}
                            title="Statut modifiable depuis le bouton Status de la liste"
                        >
                            <div className="add-modal-toggle-knob" />
                        </div>
                    </label>
                </div>
            </div>

            <div className="add-modal-form-grid mat-form-2col">
                <FormItem label="Caractéristiques" name="caracteristiques" type="textarea" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("caracteristiques")} />
                <FormItem label="Commentaire" name="commentaire" type="textarea" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("commentaire")} />
            </div>
        </AppModal>
    );
};

export default EditModal;
