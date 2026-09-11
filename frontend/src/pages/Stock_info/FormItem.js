import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import Select from 'react-select';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import { fetchProduits, fetchLocaux, fetchMateriels, createMouvement } from '../../services/api';
import { FaBox, FaMapMarkerAlt, FaUser, FaCalendarAlt, FaArrowRight, FaArrowLeft, FaPlus, FaMinus, FaFileAlt, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

import './HomeStock.css';

const MySwal = withReactContent(Swal);

const StockFormItem = React.memo(({ label, name, type = 'text', options = [], formData, handleChange, disabled = false, required = false }) => {
    const getIcon = () => {
        switch(name) {
            case 'id_produit': return <FaBox />;
            case 'id_local_source': return <FaMapMarkerAlt />;
            case 'id_local_destination': return <FaMapMarkerAlt />;
            case 'id_materiels': return <FaUser />;
            case 'date_mouvement': return <FaCalendarAlt />;
            case 'quantite': return <FaBox />;
            case 'motif': return <FaFileAlt />;
            default: return <FaBox />;
        }
    };

    const renderInput = () => {
        if (type === 'select') {
            const normalizedOptions = options.map(opt => ({
                ...opt,
                isDisabled: opt.isDisabled || opt.disabled || false
            }));
            const selectedOption = formData[name] ? normalizedOptions.find(opt => String(opt.value) === String(formData[name])) || null : null;
            const handleSelectChange = (selectedOption) => {
                handleChange({
                    target: {
                        name: name,
                        value: selectedOption ? selectedOption.value : ''
                    }
                });
            };
            return (
                <Select
                    name={name}
                    value={selectedOption}
                    onChange={handleSelectChange}
                    options={normalizedOptions}
                    isDisabled={disabled}
                    isSearchable
                    placeholder="Sélectionner..."
                    styles={{
                        control: (provided) => ({
                            ...provided,
                            fontSize: '0.85rem',
                            minHeight: '38px',
                        }),
                        menu: (provided) => ({
                            ...provided,
                            fontSize: '0.85rem',
                        }),
                        input: (provided) => ({
                            ...provided,
                            fontSize: '0.85rem',
                        }),
                        option: (provided) => ({
                            ...provided,
                            fontSize: '0.85rem',
                        }),
                        singleValue: (provided) => ({
                            ...provided,
                            fontSize: '0.85rem',
                        }),
                    }}
                    classNamePrefix="add-modal-select"
                />
            );
        }
        if (type === 'textarea') {
            return (
                <textarea name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-textarea" placeholder={`Entrez ${label.toLowerCase()}`} required={required} />
            );
        }
        if (type === 'number') {
            return (
                <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-input" placeholder={`Entrez ${label.toLowerCase()}`} min="1" required={required} />
            );
        }
        if (type === 'date') {
            return (
                <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-input" required={required} />
            );
        }
        return (
            <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-input" placeholder={`Entrez ${label.toLowerCase()}`} required={required} />
        );
    };

    return (
        <div className="add-modal-form-group">
            <label className="add-modal-label">
                {getIcon()} {label}
            </label>
            {renderInput()}
        </div>
    );
});

const FormItem = ({ initialData = {}, onSave, onClose, isModal = true }) => {
    const [produits, setProduits] = useState([]);
    const [locaux, setLocaux] = useState([]);
    const [materiels, setMateriels] = useState([]);
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    const [errorInitialData, setErrorInitialData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [mouvementType, setMouvementType] = useState('');
    const [isQuantiteHidden, setIsQuantiteHidden] = useState(false); 
    const [isLocalSourceHidden, setIsLocalSourceHidden] = useState(false);
    const [isProductSelectDisabled, setIsProductSelectDisabled] = useState(false);
    const [isProductNameInputVisible, setIsProductNameInputVisible] = useState(false);
    const [isLocalSourceReadOnly, setIsLocalSourceReadOnly] = useState(false);
    const [productAvailability, setProductAvailability] = useState({ exists: false, checking: false });
    
    const defaultDate = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({
        id_produit: initialData.id_produit || '', id_local_source: initialData.id_local_source || '', id_local_destination: initialData.id_local_destination || '', quantite: initialData.quantite || '', id_materiels: initialData.id_materiels || '', nom_produit: initialData.nom_produit || '', nom_utilisateur: initialData.nom_utilisateur || '', equipe: initialData.equipe || '', date_mouvement: initialData.date_mouvement || defaultDate, type_mouvement: initialData.type_mouvement || '', motif: initialData.motif || '',
    });

    const showNotification = useCallback((message, type = 'success') => {
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
            color: '#ffffff',
            iconColor: '#ffffff'
        });
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        if (name === 'type_mouvement') {
            setMouvementType(value); 
        }
        if (name === 'id_materiels') { 
            const selectedMaterial = materiels.find(m => String(m.id_n) === String(value));
            if (selectedMaterial) {
                updatedFormData.nom_utilisateur = `${selectedMaterial.id_n || 'N/A'} - ${selectedMaterial.utilisateur || 'Inconnu'}`;
                updatedFormData.equipe = selectedMaterial.equipe || 'N/A';
            } else {
                updatedFormData.nom_utilisateur = '';
                updatedFormData.equipe = '';
            }
        }
        setFormData(updatedFormData);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [produitsData, locauxData, materielsData] = await Promise.all([
                    fetchProduits(), fetchLocaux(), fetchMateriels(),
                ]);
                setProduits(produitsData); setLocaux(locauxData); setMateriels(materielsData); setLoadingInitialData(false);
            } catch (error) {
                setErrorInitialData("Erreur lors du chargement des données initiales: " + error.message);
                setLoadingInitialData(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        let formResets = {};
        if (mouvementType === 'ENTREE') {
            setIsQuantiteHidden(false); setIsLocalSourceHidden(true); setIsProductSelectDisabled(true); setIsProductNameInputVisible(true);
            formResets = { id_local_source: '', id_produit: '', quantite: '1' }; 
            
        } else if (mouvementType === 'ENTREE_QUANTITE') {
            setIsQuantiteHidden(false); setIsLocalSourceHidden(true); setIsProductSelectDisabled(false); setIsProductNameInputVisible(false); formResets = { id_local_source: '' };
            } else if (mouvementType === 'SORTIE') {
            setIsQuantiteHidden(false); setIsLocalSourceHidden(false); setIsProductSelectDisabled(false); setIsProductNameInputVisible(false); setIsLocalSourceReadOnly(false); formResets = {};
        } else {
            setIsQuantiteHidden(false); setIsLocalSourceHidden(false); setIsProductSelectDisabled(false); setIsProductNameInputVisible(false);
            formResets = { 
                id_materiels: '', nom_utilisateur: '', id_produit: '', quantite: '', 
                id_local_source: '', id_local_destination: '', nom_produit: ''
            };
        }

        setFormData(prev => ({ ...prev, ...formResets }));
    }, [mouvementType]);

    // Effet pour notifier l'utilisateur quand il n'y a pas de produits
    useEffect(() => {
        if (produits.length === 0 && (mouvementType === 'ENTREE_QUANTITE' || mouvementType === 'SORTIE')) {
            showNotification(
                "⚠️ Aucun produit disponible. Veuillez d'abord ajouter des produits dans l'onglet 'Produits' avant de créer des mouvements de type 'Entrée Quantité' ou 'Sortie'.", 
                'error'
            );
        }
    }, [produits.length, mouvementType, showNotification]);

    // Effet pour vérifier en temps réel si le produit existe déjà
    useEffect(() => {
        const checkProductName = async () => {
            if (mouvementType === 'ENTREE' && isProductNameInputVisible && formData.nom_produit?.trim()) {
                setProductAvailability(prev => ({ ...prev, checking: true }));
                
                // Petit délai pour éviter de vérifier à chaque frappe
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const exists = produits.some(
                    p => p.nom_produit?.toLowerCase() === formData.nom_produit.trim().toLowerCase()
                );
                
                setProductAvailability({ exists, checking: false });
            } else {
                setProductAvailability({ exists: false, checking: false });
            }
        };
        
        checkProductName();
    }, [formData.nom_produit, mouvementType, isProductNameInputVisible, produits]);

    const filteredMateriels = useMemo(() => {
        if (mouvementType === 'ENTREE' || mouvementType === 'ENTREE_QUANTITE') {
            return materiels.filter(materiel => {
                return materiel.equipe === 'Informatique DSI' || (materiel.utilisateur && materiel.utilisateur.includes('DSI')); 
            });
        }
        return materiels; 
    }, [materiels, mouvementType]);

    useEffect(() => {
        if (formData.id_materiels && materiels.length > 0) {
            const selectedMateriel = materiels.find(m => 
                m.id_n && String(m.id_n) === String(formData.id_materiels)
            );
            if (selectedMateriel) {
                const newUserName = `${selectedMateriel.id_n || 'N/A'} - ${selectedMateriel.utilisateur || 'Inconnu'}`;
                if (formData.nom_utilisateur !== newUserName) {
                    setFormData(prevData => ({ ...prevData, nom_utilisateur: newUserName }));
                }
            }
        }
    }, [formData.id_materiels, materiels, formData.nom_utilisateur]);

    // Validation de l'existence des produits
    const validateProductsExist = useCallback(() => {
        if ((mouvementType === 'ENTREE_QUANTITE' || mouvementType === 'SORTIE') && produits.length === 0) {
            const errorMsg = "Impossible de créer ce mouvement : aucun produit n'est enregistré dans la base. Veuillez d'abord ajouter un produit.";
            setSubmitError(errorMsg);
            showNotification(errorMsg, 'error');
            
            // Popup avec information seulement (pas d'action parent)
            MySwal.fire({
                icon: 'warning',
                title: 'Aucun produit disponible',
                text: 'Vous devez ajouter au moins un produit avant de créer ce type de mouvement. Veuillez ajouter un produit depuis l\'onglet "Produits".',
                confirmButtonText: 'Compris',
                confirmButtonColor: '#10b981'
            });
            
            return false;
        }
        return true;
    }, [mouvementType, produits.length, showNotification]);

    // Validation pour vérifier si le produit saisi existe déjà (pour ENTREE)
    const validateProductDoesNotExist = useCallback(() => {
        if (mouvementType === 'ENTREE' && isProductNameInputVisible) {
            const newProductName = formData.nom_produit?.trim();
            
            if (!newProductName) {
                const errorMsg = "Veuillez saisir un nom de produit valide.";
                setSubmitError(errorMsg);
                showNotification(errorMsg, 'error');
                return false;
            }
            
            // Vérifier si le produit existe déjà
            const productExists = produits.some(
                p => p.nom_produit?.toLowerCase() === newProductName.toLowerCase()
            );
            
            if (productExists) {
                const errorMsg = `Le produit "${newProductName}" existe déjà dans la base de données. Veuillez utiliser le type de mouvement "Entrée Quantité Produit" pour ajouter du stock.`;
                setSubmitError(errorMsg);
                showNotification(errorMsg, 'error');
                
                // Popup détaillée
                MySwal.fire({
                    icon: 'warning',
                    title: 'Produit déjà existant',
                    html: `
                        <p>Le produit <strong>"${newProductName}"</strong> existe déjà dans votre inventaire.</p>
                        <br>
                        <p>Pour ajouter des exemplaires de ce produit, veuillez utiliser le type de mouvement :</p>
                        <p style="color: #3b82f6; font-weight: bold;">📦 Entrée Quantité Produit</p>
                    `,
                    confirmButtonText: 'Compris',
                    confirmButtonColor: '#10b981'
                });
                
                return false;
            }
        }
        return true;
    }, [mouvementType, isProductNameInputVisible, formData.nom_produit, produits, showNotification]);

    // Validation pour vérifier que le produit sélectionné existe (pour ENTREE_QUANTITE et SORTIE)
    const validateSelectedProductExists = useCallback(() => {
        if ((mouvementType === 'ENTREE_QUANTITE' || mouvementType === 'SORTIE') && formData.id_produit) {
            const productExists = produits.some(p => String(p.id_produit) === String(formData.id_produit));
            
            if (!productExists) {
                const errorMsg = "Le produit sélectionné n'existe plus dans la base de données.";
                setSubmitError(errorMsg);
                showNotification(errorMsg, 'error');
                
                MySwal.fire({
                    icon: 'error',
                    title: 'Produit introuvable',
                    text: 'Le produit que vous avez sélectionné n\'existe pas ou a été supprimé. Veuillez rafraîchir la page et réessayer.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#ef4444'
                });
                
                return false;
            }
        }
        return true;
    }, [mouvementType, formData.id_produit, produits, showNotification]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation de l'existence des produits
        if (!validateProductsExist()) {
            return;
        }

        // Validation du produit existant (pour ENTREE - vérifie que le produit N'EXISTE PAS déjà)
        if (!validateProductDoesNotExist()) {
            return;
        }

        // Validation du produit sélectionné (pour ENTREE_QUANTITE et SORTIE - vérifie que le produit EXISTE)
        if (!validateSelectedProductExists()) {
            return;
        }

        if (!formData.type_mouvement || !formData.date_mouvement) {
            setSubmitError("Veuillez remplir les champs obligatoires (Type et Date).");
            showNotification("Veuillez remplir les champs obligatoires (Type et Date).", 'error');
            return;
        }
        if (mouvementType === 'ENTREE_QUANTITE' && (formData.quantite <= 0 || !formData.id_produit)) {
            setSubmitError("Veuillez sélectionner un produit et entrer une quantité valide.");
            showNotification("Veuillez sélectionner un produit et entrer une quantité valide.", 'error');
            return;
        }
        if (mouvementType === 'ENTREE' && (formData.quantite <= 0 || !formData.nom_produit)) {
            setSubmitError("Veuillez saisir un nom de produit et une quantité valide.");
            showNotification("Veuillez saisir un nom de produit et une quantité valide.", 'error');
            return;
        }
        if (mouvementType === 'SORTIE' && (!formData.id_produit || !formData.id_local_source || formData.quantite <= 0)) {
            setSubmitError("Veuillez spécifier un produit, une source, une destination et une quantité pour la sortie.");
            showNotification("Veuillez spécifier un produit, une source, une destination et une quantité pour la sortie.", 'error');
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            await createMouvement(formData);
            showNotification("Mouvement enregistré avec succès !", 'success');
            if (onSave) {
                onSave(); 
            }
            if (onClose) {
                onClose();
            }
            
        } catch (err) {
            console.error("Erreur d'insertion:", err.response ? err.response.data : err.message);
            const errorMessage = err.response?.data?.error || err.message || "Une erreur est survenue lors de la soumission.";
            setSubmitError(errorMessage);
            showNotification(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMessageStyle = () => {
        switch (formData.type_mouvement) {
            case 'ENTREE':
                return { backgroundColor: '#e6ffec', color: '#007e33' };
            case 'ENTREE_QUANTITE':
                return { backgroundColor: '#e0f7fa', color: '#0097a7' };
            case 'SORTIE':
                return { backgroundColor: '#fbc1bdff', color: '#d8492cff' };
            default:
                return { backgroundColor: '#ffecb3', color: '#ffa000' };
        }
    };

    const renderMessage = () => {
        const messages = {
            'ENTREE': '* Information : Ce type d\'entrée est utilisé pour les équipe DSI.',
            'ENTREE_QUANTITE': '* Information : Ce type d\'entrée est utilisé pour ajouter une quantité globale de produit.',
            'SORTIE': '* Information : Ce type de sortie permet de déstocker des produits.',
            '': '* Information : Merci de sélectionner le type de mouvements.'
        };
        
        return (
            <div style={{ ...getMessageStyle(), padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                {messages[formData.type_mouvement || '']}
            </div>
        );
    };

    // Modification des options de produit avec message si vide
    const produitOptions = useMemo(() => {
        if (produits.length === 0) {
            return [{ value: '', label: '⚠️ Aucun produit disponible - Ajoutez un produit dans l\'onglet Produits', disabled: true }];
        }
        return produits.map(p => ({ value: p.id_produit, label: p.nom_produit }));
    }, [produits]);

    const localOptions = locaux.map(l => ({ value: l.id_local, label: l.nom_local }));
    const materielOptions = filteredMateriels.map(m => ({ 
        value: m.id_n, 
        label: `${m.id_n} - ${m.utilisateur || 'Utilisateur Inconnu'}${m.equipe ? ` (${m.equipe})` : ''}`
    }));

    const renderFormContent = () => (
        <>
            {submitError && (
                <div className="add-modal-error" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {submitError}
                </div>
            )}
            {renderMessage()}
            <div className="add-modal-form-grid">
                <div>
                    {/* Première colonne */}
                    <StockFormItem label="Type de Mouvement *" name="type_mouvement" type="select"
                        options={[
                            { value: 'ENTREE', label: '📥 Entrée Matériel Unitaire DSI' },
                            { value: 'ENTREE_QUANTITE', label: '📦 Entrée Quantité Produit' },
                            { value: 'SORTIE', label: '📤 Sortie Produit' }
                        ]}
                        formData={formData} handleChange={handleChange} required
                    />
                    {(mouvementType === 'ENTREE' || mouvementType === 'ENTREE_QUANTITE' || mouvementType === 'SORTIE') && (
                        <>
                            <StockFormItem label="Collaborateur (ID/Utilisateur) *" name="id_materiels" type="select" 
                                options={materielOptions} 
                                formData={formData} 
                                handleChange={handleChange} 
                                required={mouvementType !== ''} 
                            />  
                            <div className="add-modal-form-group">
                                <label className="add-modal-label">
                                    <FaUser /> Info Utilisateur (Auto)
                                </label>
                                <input type="text" className="add-modal-input" value={`${formData.nom_utilisateur || ''} (${formData.equipe || 'N/A'})`} readOnly />
                            </div>
                        </>
                    )}

                    {/* Condition 2: Afficher le champ INPUT TEXT si visible (spécifique à ENTREE) */}
                    {isProductNameInputVisible && (
                        <div>
                            <StockFormItem label="Nom du nouveau produit *" name="nom_produit" formData={formData} handleChange={handleChange} required={isProductNameInputVisible} />
                            {/* Indicateur de disponibilité du produit en temps réel */}
                            {productAvailability.checking && (
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', marginLeft: '4px' }}>
                                    <Spinner animation="border" size="sm" style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                                    Vérification...
                                </div>
                            )}
                            {!productAvailability.checking && productAvailability.exists && formData.nom_produit?.trim() && (
                                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FaExclamationTriangle /> ⚠️ Ce produit existe déjà dans la base de données
                                </div>
                            )}
                            {!productAvailability.checking && formData.nom_produit?.trim() && !productAvailability.exists && (
                                <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FaCheck /> ✓ Nouveau produit - sera créé automatiquement
                                </div>
                            )}
                        </div>
                    )}
                    {/* Condition 1: Afficher le champ SELECT si NON désactivé */}
                    {!isProductSelectDisabled && (
                        <>
                            <StockFormItem label="Produit *" name="id_produit" type="select" 
                                options={produitOptions} 
                                formData={formData} 
                                handleChange={handleChange} 
                                required={!isProductSelectDisabled && mouvementType !== ''} 
                            />
                            
                        </>
                    )}
                    {/* Champ Quantité */}
                    {!isQuantiteHidden && (
                        <StockFormItem label="Quantité *" name="quantite" type="number" formData={formData} handleChange={handleChange} required={!isQuantiteHidden && mouvementType !== ''} />
                    )}
                </div>
                <div>
                    {/* Deuxième colonne */}
                    {!isLocalSourceHidden && (
                        <StockFormItem label="Local Source *" name="id_local_source" type="select" options={localOptions} formData={formData} handleChange={handleChange} disabled={isLocalSourceReadOnly} required={!isLocalSourceHidden && mouvementType !== ''} />
                    )}
                    <StockFormItem label="Local Destination *" name="id_local_destination" type="select" options={localOptions} formData={formData} handleChange={handleChange} required />
                    <StockFormItem label="Date Mouvement *" name="date_mouvement" type="date" formData={formData} handleChange={handleChange} required />
                    <StockFormItem label="Motif" name="motif" type="textarea" formData={formData} handleChange={handleChange} />
                </div>
            </div>
        </>
    );

    if (loadingInitialData) {
        return <div className="text-center p-4"><Spinner animation="border" /></div>;
    }
    if (errorInitialData) {
        return <Alert variant="danger">{errorInitialData}</Alert>;
    }

    if (isModal) {
        // Configuration dynamique du header selon le type de mouvement
        const getHeaderConfig = () => {
            const configs = {
                'ENTREE': {
                    color: '#10b981',
                    title: '📥 Entrée Matériel DSI',
                    icon: <FaArrowLeft />,
                    subtitle: 'Enregistrement d\'un nouveau matériel DSI'
                },
                'ENTREE_QUANTITE': {
                    color: '#3b82f6',
                    title: '📦 Entrée Quantité Produit',
                    icon: <FaArrowLeft />,
                    subtitle: 'Ajout de quantité de produit en stock'
                },
                'SORTIE': {
                    color: '#f59e0b',
                    title: '📤 Sortie Produit',
                    icon: <FaArrowRight />,
                    subtitle: 'Destockage de produits'
                }
            };
            return configs[mouvementType] || {
                color: '#6b7280',
                title: '➕ Nouveau Mouvement',
                icon: <FaPlus />,
                subtitle: 'Sélectionnez le type de mouvement ci-dessous'
            };
        };

        const headerConfig = getHeaderConfig();
        
        return (
            <div className="add-modal-overlay">
                <form onSubmit={handleSubmit} className="add-modal-content">
                    <div className="add-modal-header" style={{ backgroundColor: headerConfig.color }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="add-modal-icon-wrapper">
                                {headerConfig.icon}
                            </div>
                            <div>
                                <h2 className="add-modal-title">
                                    {headerConfig.title}
                                </h2>
                                <p className="add-modal-subtitle">{headerConfig.subtitle}</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="add-modal-close-btn">
                            <FaMinus />
                        </button>
                    </div>
                    
                    <div className="add-modal-body">
                        {renderFormContent()}
                    </div>

                    <div className="add-modal-footer">
                        <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                            Annuler
                        </button>
                        <button type="submit" className="add-modal-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : <><FaPlus /> Enregistrer Mouvement</>}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {renderFormContent()}
            
            <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="add-modal-cancel-btn">
                    Annuler
                </button>
                <button type="submit" className="add-modal-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : <><FaPlus /> Enregistrer Mouvement</>}
                </button>
            </div>
        </form>
    );
};

export default FormItem;