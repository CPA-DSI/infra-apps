// src/pages/Materiels/AddModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { fetchALocaux, fetchAMarques, addMateriel, fetchAllMateriels } from '../../services/api';
import { MySwal } from '../../utils/swal';
import {
    FaVideo, FaNetworkWired, FaUsb,
    FaPlug, FaCheckCircle, FaTimesCircle, FaPlus,
    FaUserPlus, FaInfoCircle,
    FaKeyboard as FaKeyboardIcon
} from 'react-icons/fa';
import FormItem from '../../components/FormItem/FormItem';
import { getMaterielFieldIcon } from './materielFieldIcons';
import AppModal from '../../components/AppModal/AppModal';
import './MaterielsModals.css';

/**
 * Formate la date actuelle au format YYYY-MM-DD
 * @returns {string} La date formatée (ex: "2025-11-17")
 */
const getFormattedTodayDate = () => {
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
};

// Même valeur que ETAT_STOCK / LIBELLE_STOCK côté backend (affectationService).
const ETAT_STOCK = 'Stock';

const AddModal = ({ onClose, onMaterialAdded }) => {
    const [formData, setFormData] = useState({
        utilisateur: 'Non défini', 
        id_n: '', 
        ecran: '', 
        equipe: 'Autres', 
        date_pc: getFormattedTodayDate(),
        date_ecran: getFormattedTodayDate(),
        salle: 'Autres', 
        etat_pc: 'Bon', 
        etat_batterie: 'Bon', 
        code_pc: '', 
        code_ecran: '', 
        hdmi: false, 
        lan: false, 
        usb: false, 
        clavier: false, 
        mdp_pc: 'azerty', 
        mdp_admin: 'azerty', 
        caracteristiques: '', 
        commentaire: '', 
        id_marque: '', 
        id_local: '',
        est_actif: true
    });
    
    const [error, setError] = useState(null); 
    const [isLoadingMarques, setIsLoadingMarques] = useState(true);
    const [isLoadingLocaux, setIsLoadingLocaux] = useState(true);
    const showNotification = (message, type = 'success') => {
        MySwal.fire({
            icon: type,
            title: type === 'success' ? 'Succès' : 'Erreur',
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            background: type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
            iconColor: 'white'
        });
    }; 
    const [marqueOptions, setMarqueOptions] = useState([]);
    const [localOptions, setLocalOptions] = useState([]);
    const [existingIds, setExistingIds] = useState([]);
    const [idError, setIdError] = useState("");

    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;

        // Un PC en stock n'a ni bénéficiaire ni écran et est inactif ; en sortant
        // de « Stock », on revient aux valeurs par défaut du formulaire.
        if (name === 'etat_pc') {
            setFormData(prev => {
                if (value === ETAT_STOCK) {
                    return {
                        ...prev, etat_pc: value, id_n: '', utilisateur: ETAT_STOCK, equipe: ETAT_STOCK,
                        ecran: '', code_ecran: '', est_actif: false,
                    };
                }
                if (prev.etat_pc === ETAT_STOCK) {
                    return { ...prev, etat_pc: value, utilisateur: 'Non défini', equipe: 'Autres', est_actif: true };
                }
                return { ...prev, etat_pc: value };
            });
            setIdError("");
            return;
        }

        if (name === 'id_n') {
            if (existingIds.includes(value)) {
                setIdError("⚠️ Ce numéro matricule existe déjà !");
            } else {
                setIdError("");
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        if (name === 'id_marque') {
            const marqueSelectionnee = marqueOptions.find(m => m.value === value);
            if (marqueSelectionnee) {
                setFormData(prev => ({
                    ...prev,
                    nom_marque: marqueSelectionnee.label, 
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    nom_marque: '', 
                }));
            }
        }

        if (name === 'id_local') {
            const localSelectionne = localOptions.find(l => l.value === value);
            if (localSelectionne) {
                setFormData(prev => ({ ...prev, nom_local: localSelectionne.label }));
            } else {
                setFormData(prev => ({ ...prev, nom_local: '' }));
            }
        }
    }, [existingIds, marqueOptions, localOptions]);

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

    useEffect(() => {
        const loadExistingIds = async () => {
            try {
                const materiels = await fetchAllMateriels(); 
                const ids = materiels.map(m => m.id_n.toString());
                setExistingIds(ids);
            } catch (err) {
                console.error("Erreur chargement IDs:", err);
            }
        };
        loadExistingIds();
    }, []);

    const enStock = formData.etat_pc === ETAT_STOCK;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (idError) {
            showNotification("Veuillez corriger l'ID avant de soumettre.", 'error');
            return;
        }

        const { id_materiels, nom_marque, nom_local, ...restOfData } = formData;
        
        const dataToSend = {
            ...restOfData,
            ...(formData.id_n && parseInt(formData.id_n, 10) !== 0 ? { id_n: parseInt(formData.id_n, 10) } : {}),    
            id_marque: formData.id_marque ? parseInt(formData.id_marque, 10) : null,
            id_local: formData.id_local ? parseInt(formData.id_local, 10) : null,
            date_pc: formData.date_pc ? new Date(formData.date_pc) : null,
            date_ecran: formData.date_ecran && !enStock ? new Date(formData.date_ecran) : null,
            caracteristiques: formData.caracteristiques || 'Non spécifié',
            utilisateur: formData.utilisateur || 'Non défini',
        };

        try {
            await addMateriel(dataToSend); 
            showNotification("Matériel ajouté avec succès !", 'success');
            setError(null);
            
            if (typeof onMaterialAdded === 'function') {
                onMaterialAdded(); 
            }
            onClose();

        } catch (err) {
            // Pas de setError ici : `error` remplace tout le formulaire (erreurs de
            // chargement). Une erreur d'envoi (400, 409...) doit laisser le
            // formulaire modifiable pour que l'utilisateur corrige sa saisie.
            console.error("Erreur lors de l'ajout du matériel:", err);
            showNotification(`Erreur: ${err.message}`, 'error');
        }
    };

    if (error) {
        return (
            <AppModal
                show
                onClose={onClose}
                size="sm"
                title="Erreur de chargement"
                contentClassName="mat-modal"
                footer={<button type="button" onClick={onClose} className="add-modal-cancel-btn">Fermer</button>}
            >
                {error}
            </AppModal>
        );
    }

    return (
        <>
        {isLoadingMarques && <div className="add-modal-loading">Chargement...</div>}
        <AppModal
            show
            onClose={onClose}
            as="form"
            onSubmit={handleSubmit}
            title="Ajout d'un nouveau poste"
            subtitle="Remplissez les informations ci-dessous"
            icon={<FaPlus />}
            contentClassName="mat-modal mat-modal--add"
            footer={
                <>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                        Annuler
                    </button>
                    <button type="submit" className="add-modal-submit-btn">
                        <FaUserPlus aria-hidden="true" /> Ajouter le poste
                    </button>
                </>
            }
        >
            {idError && (
                <div className="mat-id-error" role="alert">
                    <span className="mat-id-error-icon" aria-hidden="true">⚠️</span>
                    {idError}
                </div>
            )}

            {/* Section d'information */}
            <div className="mat-info-band">
                <FaInfoCircle aria-hidden="true" />
                <span>
                    Les champs marqués d'un <span className="mat-danger-text">*</span> sont obligatoires
                </span>
            </div>

            {enStock && (
                <div className="mat-warning-band">
                    <FaInfoCircle aria-hidden="true" />
                    <span>
                        PC ajouté en stock : sans utilisateur, sans écran et inactif. Il sera affecté via « Réaffecter le PC ».
                    </span>
                </div>
            )}

            {/* Placement automatique en deux colonnes ; le bloc Connectiques occupe les
                lignes « Équipe » + « Date PC » (cf. .mat-form-2col--add), ce qui aligne
                « Date Écran » avec « Mot de passe local ». */}
            <div className="add-modal-form-grid mat-form-2col mat-form-2col--add">
                {/* État PC en tête : « Stock » vide et désactive les champs bénéficiaire et écran ci-dessous. */}
                <div>
                    <FormItem label="État PC" name="etat_pc" type="select"
                        options={[
                            { value: 'Très Bon', label: '✅ Très Bon' },
                            { value: 'Bon', label: '👍 Bon' },
                            { value: 'Moyen', label: '⚠️ Moyen' },
                            { value: 'Mauvais', label: '❗ Mauvais' },
                            { value: 'Disponible', label: '📦 Disponible' },
                            { value: ETAT_STOCK, label: '🗄️ Stock' },
                            { value: 'HS', label: '❌ HS' }
                        ]}
                        formData={formData}
                        handleChange={handleChange} icon={getMaterielFieldIcon("etat_pc")}
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
                        <div
                            className={`add-modal-toggle ${formData.est_actif ? 'is-on' : ''} ${enStock ? 'is-disabled' : ''}`}
                            onClick={() => !enStock && handleChange({ target: { name: 'est_actif', type: 'checkbox', checked: !formData.est_actif }})}
                            title={enStock ? 'Un PC en stock est inactif' : undefined}
                        >
                            <div className="add-modal-toggle-knob" />
                        </div>
                    </label>
                </div>

                <div>
                    <FormItem label="N° Matricule" name="id_n" formData={formData} handleChange={handleChange} required={!enStock} disabled={enStock} icon={getMaterielFieldIcon("id_n")} />
                </div>
                <div>
                    <FormItem label="Utilisateur" name="utilisateur" formData={formData} handleChange={handleChange} required={!enStock} disabled={enStock} icon={getMaterielFieldIcon("utilisateur")} />
                </div>

                <div>
                    <FormItem label="Marque Laptop" name="id_marque" type="select" options={marqueOptions} formData={formData} handleChange={handleChange} disabled={isLoadingMarques} icon={getMaterielFieldIcon("id_marque")} />
                </div>
                <div>
                    <FormItem label="Code PC" name="code_pc" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("code_pc")} />
                </div>

                <div>
                    <FormItem label="Marque Écran" name="ecran" formData={formData} handleChange={handleChange} disabled={enStock} icon={getMaterielFieldIcon("ecran")} />
                </div>
                <div>
                    <FormItem label="Code Écran" name="code_ecran" formData={formData} handleChange={handleChange} disabled={enStock} icon={getMaterielFieldIcon("code_ecran")} />
                </div>

                <div>
                    <FormItem label="Équipe" name="equipe" formData={formData} handleChange={handleChange} required={!enStock} disabled={enStock} icon={getMaterielFieldIcon("equipe")} />
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
                    <FormItem label="Date Écran" name="date_ecran" type="date" formData={formData} handleChange={handleChange} disabled={enStock} icon={getMaterielFieldIcon("date_ecran")} />
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
                    <FormItem label="Local(s)" name="id_local" type="select" options={localOptions} formData={formData} handleChange={handleChange} disabled={isLoadingLocaux} icon={getMaterielFieldIcon("id_local")} />
                </div>
                <div>
                    <FormItem label="État Batterie" name="etat_batterie" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("etat_batterie")} />
                </div>
            </div>

            <div className="add-modal-form-grid mat-form-2col">
                <FormItem label="Caractéristiques" name="caracteristiques" type="textarea" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("caracteristiques")} />
                <FormItem label="Commentaire" name="commentaire" type="textarea" formData={formData} handleChange={handleChange} icon={getMaterielFieldIcon("commentaire")} />
            </div>
        </AppModal>
        </>
    );
};

export default AddModal;