// src/pages/Materiels/EditModal.js

import React, { useState, useEffect, useCallback, memo } from 'react';
import { fetchALocaux, fetchAMarques, updateMateriel } from '../../services/api';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { FaVideo, FaNetworkWired, FaUsb, FaKeyboard, FaTag, FaLaptop, FaTv, FaUsers, FaCalendarAlt, FaBuilding, FaDoorOpen, FaHeart, FaUserCircle, FaPlug, FaKey, FaBatteryFull, FaMicrochip, FaCommentAlt, FaQrcode, FaKeyboard as FaKeyboardIcon, FaLock, FaCheckCircle, FaTimesCircle, FaPlus, FaHdd, FaTimes, FaIdBadge, FaTerminal, FaWifi, FaShieldAlt, FaUserSecret, FaCogs, FaDesktop, FaEdit, FaSave, FaInfoCircle } from 'react-icons/fa';
import { MdComputer, MdSecurity, MdComment, MdDevices, MdMonitor } from 'react-icons/md';
import Select from 'react-select';
import './Materiels.css';

const MySwal = withReactContent(Swal);

const customSelectStyles = {
    control: (provided) => ({
        ...provided,
        padding: '4px 0',
        borderRadius: '10px',
        borderColor: '#e2e8f0',
        fontSize: '0.85rem',
        color: '#1e293b',
        backgroundColor: 'white',
        minHeight: '40px',
        '&:hover': {
            borderColor: '#e2e8f0',
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
        color: '#64748b',
    }),
    clearIndicator: (provided) => ({
        ...provided,
        padding: '8px',
        color: '#64748b',
    }),
    menu: (provided) => ({
        ...provided,
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        zIndex: 10000,
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#f1f5f9' : 'white',
        color: state.isSelected ? 'white' : '#1e293b',
        fontSize: '0.85rem',
        padding: '8px 12px',
        cursor: 'pointer',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#94a3b8',
        fontSize: '0.85rem',
    }),
    singleValue: (provided) => ({
        ...provided,
        color: '#1e293b',
        fontSize: '0.85rem',
    }),
};

const FormItem = memo(({ label, name, type = 'text', options = [], formData, handleChange, onSelectChange, disabled = false, required = false }) => {
    const getIcon = () => {
        switch(name) {
            case 'id_n': return <FaQrcode />;
            case 'id_marque': return <FaLaptop />;
            case 'ecran': return <FaTv />;
            case 'equipe': return <FaUsers />;
            case 'date_pc': return <FaCalendarAlt />;
            case 'date_ecran': return <MdMonitor />;
            case 'salle': return <FaBuilding />;
            case 'id_local': return <FaDoorOpen />;
            case 'etat_pc': return <FaHeart />;
            case 'utilisateur': return <FaUserCircle />;
            case 'code_pc': return <FaTerminal />;
            case 'code_ecran': return <FaDesktop />;
            case 'hdmi':
            case 'lan':
            case 'usb':
            case 'clavier': return <FaPlug />;
            case 'mdp_pc': return <FaKey />;
            case 'mdp_admin': return <FaShieldAlt />;
            case 'etat_batterie': return <FaBatteryFull />;
            case 'caracteristiques': return <FaMicrochip />;
            case 'commentaire': return <FaCommentAlt />;
            default: return <FaHdd />;
        }
    };

    const renderInput = () => {
        if (type === 'select') {
            return (
                <Select
                    name={name}
                    value={options.find(opt => opt.value === formData[name]) || null}
                    onChange={(selectedOption) => onSelectChange && onSelectChange(name, selectedOption)}
                    options={options}
                    isSearchable
                    isClearable
                    placeholder="Sélectionner..."
                    isDisabled={disabled}
                    className="add-modal-select"
                    classNamePrefix="add-modal-select"
                    styles={customSelectStyles}
                    noOptionsMessage={() => "Aucune option disponible"}
                />
            );
        }
        
        if (type === 'textarea') {
            return (
                <textarea name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-textarea" placeholder={`Entrez ${label.toLowerCase()}`} />
            );
        }
        
        if (type === 'checkbox') {
            return (
                <div className="add-modal-checkbox-wrapper">
                    <input type="checkbox" name={name} checked={formData[name] || false} onChange={handleChange} className="add-modal-checkbox" />
                    <span className="add-modal-checkbox-label">{label}</span>
                </div>
            );
        }
        
        return (
            <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-input" placeholder={`Entrez ${label.toLowerCase()}`} />
        );
    };

    if (type === 'checkbox') {
        return renderInput();
    }

    return (
        <div className="add-modal-form-group">
            <label className="add-modal-label">
                {getIcon()} {label}
                {required && <span style={{ color: '#EF4444', marginLeft: '4px' }}>*</span>}
            </label>
            {renderInput()}
        </div>
    );
});

const EditModal = ({ isOpen, onClose, data, onUpdateSuccess }) => {
    const [formData, setFormData] = useState(data || {});
    const [marqueOptions, setMarqueOptions] = useState([]);
    const [localOptions, setLocalOptions] = useState([]);
    const [isLoadingMarques, setIsLoadingMarques] = useState(true);
    const [isLoadingLocaux, setIsLoadingLocaux] = useState(true);
    const [error, setError] = useState(null);
    
    const showNotification = (message, type = 'success') => {
        MySwal.fire({
            icon: type, title: type === 'success' ? 'Succès' : 'Erreur', text: message, timer: 3000, timerProgressBar: true, showConfirmButton: false, toast: true, position: 'top-end', background: type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', iconColor: '#ffffff'
        });
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
        
        try {
            const apiPayload = {
                ...formData,
                id_marque: formData.id_marque ? parseInt(formData.id_marque, 10) : null,
                id_local: formData.id_local ? parseInt(formData.id_local, 10) : null,
                date_pc: formData.date_pc ? new Date(formData.date_pc) : null,
                date_ecran: formData.date_ecran ? new Date(formData.date_ecran) : null,
            };

            await updateMateriel(formData.id_materiels, apiPayload);
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
        return <div className="add-modal-overlay">Erreur : {error}</div>;
    }

    return (
        <div className="add-modal-overlay">
            <form onSubmit={handleSubmit} className="add-modal-content" style={{
                maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                {/* Header amélioré */}
                <div className="add-modal-header" style={{
                    background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="add-modal-icon-wrapper" style={{
                            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                        }}>
                            <FaEdit style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h2 className="add-modal-title" style={{ color: 'white' }}>
                                Modification Matériel N°{formData.id_n || ''}
                            </h2>
                            <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Modifiez les informations ci-dessous
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {formData.code_pc && (
                            <div style={{
                                background: 'rgba(255,255,255,0.1)', padding: '4px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.15)'
                            }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>Code</span>
                                <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '600', marginLeft: '6px' }}>
                                    {formData.code_pc}
                                </span>
                            </div>
                        )}
                        <button onClick={onClose} className="add-modal-close-btn" type="button" style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <FaTimes />
                        </button>
                    </div>
                </div>
                
                <div className="add-modal-body" style={{
                    padding: '24px',
                    background: '#F8FAFC'
                }}>
                    {/* Section d'information */}
                    <div style={{
                        background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '12px'
                    }}>
                        <FaInfoCircle style={{ color: '#3B82F6', fontSize: '1.2rem' }} />
                        <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                            Modifiez les champs souhaités et cliquez sur Sauvegarder pour enregistrer les modifications
                        </span>
                    </div>
                    
                    <div className="add-modal-form-grid" style={{
                       display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'
                    }}>
                        <div style={{ gridColumn: '1', gridRow: '1' }}>
                            <FormItem label="N° Matricule" name="id_n" formData={formData} handleChange={handleChange} required />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '1' }}>
                            <FormItem label="Utilisateur" name="utilisateur" formData={formData} handleChange={handleChange} required />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '2' }}>
                            <FormItem label="Marque Laptop" name="id_marque" type="select" options={marqueOptions} formData={formData} handleChange={handleChange} onSelectChange={handleSelectChange} disabled={isLoadingMarques} />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '2' }}>
                            <FormItem label="Code PC" name="code_pc" formData={formData} handleChange={handleChange} />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '3' }}>
                            <FormItem label="Marque Écran" name="ecran" formData={formData} handleChange={handleChange} />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '3' }}>
                            <FormItem label="Code Écran" name="code_ecran" formData={formData} handleChange={handleChange} />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '4' }}>
                            <FormItem label="Équipe" name="equipe" formData={formData} handleChange={handleChange} required />
                        </div>
                        <div style={{ gridColumn: '1', gridRow: '5' }}>
                            <FormItem label="Date PC" name="date_pc" type="date" formData={formData} handleChange={handleChange} />
                        </div>
                        {/* Le bloc Connectiques occupe exactement les lignes de grille "Équipe" + "Date PC",
                            ce qui garantit l'alignement de "Date Écran" avec "Mot de passe local" ci-dessous. */}
                        <div className="add-modal-form-group" style={{ gridColumn: '2', gridRow: '4 / span 2' }}>
                            <label className="add-modal-label" style={{
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1E293B'
                            }}>
                                <FaPlug /> Connectiques
                            </label>
                            <div className="add-modal-connectiques" style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#F1F5F9', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0'
                            }}>
                                <label className="add-modal-connectique-label" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '0.8rem'
                                }}>
                                    <input type="checkbox" name="hdmi" checked={formData.hdmi || false} onChange={handleChange} className="add-modal-checkbox" />
                                    <FaVideo className="add-modal-connectique-icon" style={{ color: '#8B5CF6' }} />
                                    Adapteur HDMI
                                </label>
                                <label className="add-modal-connectique-label" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '0.8rem'
                                }}>
                                    <input type="checkbox" name="lan" checked={formData.lan || false} onChange={handleChange} className="add-modal-checkbox" />
                                    <FaNetworkWired className="add-modal-connectique-icon" style={{ color: '#3B82F6' }} />
                                    Adapteur LAN
                                </label>
                                <label className="add-modal-connectique-label" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '0.8rem'
                                }}>
                                    <input type="checkbox" name="usb" checked={formData.usb || false} onChange={handleChange} className="add-modal-checkbox" />
                                    <FaUsb className="add-modal-connectique-icon" style={{ color: '#10B981' }} />
                                    Adapteur USB
                                </label>
                                <label className="add-modal-connectique-label" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '0.8rem'
                                }}>
                                    <input type="checkbox" name="clavier" checked={formData.clavier || false} onChange={handleChange} className="add-modal-checkbox" />
                                    <FaKeyboardIcon className="add-modal-connectique-icon" style={{ color: '#F59E0B' }} />
                                    Clavier Externe
                                </label>
                            </div>
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '6' }}>
                            <FormItem label="Date Écran" name="date_ecran" type="date" formData={formData} handleChange={handleChange} />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '6' }}>
                            <FormItem label="Mot de passe local" name="mdp_pc" formData={formData} handleChange={handleChange} />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '7' }}>
                            <FormItem label="salle" name="salle" formData={formData} handleChange={handleChange} />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '7' }}>
                            <FormItem label="Mot de passe Admin" name="mdp_admin" formData={formData} handleChange={handleChange} />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '8' }}>
                            <FormItem label="Local(s)" name="id_local" type="select" options={localOptions} formData={formData} handleChange={handleChange} onSelectChange={handleSelectChange} disabled={isLoadingLocaux} />
                        </div>
                        <div style={{ gridColumn: '2', gridRow: '8' }}>
                            <FormItem label="État Batterie" name="etat_batterie" formData={formData} handleChange={handleChange} />
                        </div>

                        <div style={{ gridColumn: '1', gridRow: '9' }}>
                            <FormItem label="État PC" name="etat_pc" type="select"
                                options={[
                                    { value: 'Très Bon', label: '✅ Très Bon' },
                                    { value: 'Bon', label: '👍 Bon' },
                                    { value: 'Moyen', label: '⚠️ Moyen' },
                                    { value: 'Mauvais', label: '❗ Mauvais' },
                                    { value: 'Disponible', label: '📦 Disponible' },
                                    { value: 'HS', label: '❌ HS' }
                                ]}
                                formData={formData}
                                handleChange={handleChange}
                                onSelectChange={handleSelectChange}
                            />
                        </div>
                        <div className="add-modal-form-group add-modal-actif-group" style={{ gridColumn: '2', gridRow: '9' }}>
                            <label className="add-modal-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', color: '#1E293B' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Actif
                                    {formData.est_actif ? (
                                        <FaCheckCircle className="add-modal-actif-icon" style={{
                                            color: '#10B981',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s ease'
                                        }} />
                                    ) : (
                                        <FaTimesCircle className="add-modal-actif-icon" style={{
                                            color: '#EF4444',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s ease'
                                        }} />
                                    )}
                                </span>
                                <div
                                    className="add-modal-toggle"
                                    onClick={() => handleChange({ target: { name: 'est_actif', type: 'checkbox', checked: !formData.est_actif }})}
                                    style={{
                                        backgroundColor: formData.est_actif ? '#10B981' : '#EF4444',
                                    }}
                                >
                                    <div className="add-modal-toggle-knob" style={{
                                        left: formData.est_actif ? '22px' : '2px',
                                    }} />
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="add-modal-form-grid" style={{
                       display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px'
                    }}>
                        <FormItem label="Caractéristiques" name="caracteristiques" type="textarea" formData={formData} handleChange={handleChange} />
                        <FormItem label="Commentaire" name="commentaire" type="textarea" formData={formData} handleChange={handleChange} />
                    </div>
                </div>

                <div className="add-modal-footer" style={{
                    background: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px'
                }}>
                    <button type="button" onClick={onClose} className="add-modal-cancel-btn" style={{
                        background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 28px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', transition: 'all 0.2s ease', cursor: 'pointer'
                    }}>
                        Annuler
                    </button>
                    <button type="submit" className="add-modal-submit-btn" style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', border: 'none', padding: '10px 32px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                    }}>
                        <FaSave /> Sauvegarder
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditModal;
