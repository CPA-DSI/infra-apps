import React, { useState, useEffect, useCallback, memo } from 'react';
import { createTicket, updateTicket, fetchAllUsers, fetchAllMateriels, fetchTechnicians } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import Select from 'react-select';
import {
    FaTicketAlt, FaUser, FaHdd, FaSave, FaTimes, FaInfoCircle,
    FaTag, FaCommentAlt, FaQrcode, FaCheckCircle, FaShieldAlt,
    FaUserPlus, FaUserCircle, FaIdBadge
} from 'react-icons/fa';
import './Tickets.css';

const MySwal = withReactContent(Swal);

const FormItem = memo(({ label, name, type = 'text', options = [], formData, handleChange, disabled = false, required = false }) => {
    const getIcon = () => {
        switch(name) {
            case 'idTicket': return <FaTicketAlt />;
            case 'numeroTicket': return <FaQrcode />;
            case 'titre': return <FaTag />;
            case 'description': return <FaCommentAlt />;
            case 'statut': return <FaCheckCircle />;
            case 'priorite': return <FaShieldAlt />;
            case 'idMateriels': return <FaHdd />;
            case 'idDemandeur': return <FaUser />;
            case 'idAssigne': return <FaUserPlus />;
            case 'nomDemandeur': return <FaUserCircle />;
            case 'nomAssigne': return <FaUserCircle />;
            default: return <FaIdBadge />;
        }
    };

    const renderInput = () => {
        if (type === 'select') {
            return (
                <select name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-select" disabled={disabled} required={required}>
                    <option value="">Sélectionner...</option>
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        if (type === 'searchable-select') {
            const reactSelectOptions = options.map(opt => ({ value: opt.value, label: opt.label }));
            const selectedOption = reactSelectOptions.find(opt => String(opt.value) === String(formData[name] || ''));
            return (
                <Select
                    name={name}
                    value={selectedOption || null}
                    onChange={selected => handleChange({ target: { name, value: selected ? selected.value : '' } })}
                    options={reactSelectOptions}
                    placeholder="Sélectionner..."
                    isClearable
                    isDisabled={disabled}
                    classNamePrefix="react-select"
                    styles={{
                        control: (provided) => ({
                            ...provided,
                            minHeight: '42px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                            boxShadow: 'none',
                            '&:hover': { borderColor: '#6366f1' },
                        }),
                        menu: (provided) => ({
                            ...provided,
                            borderRadius: '10px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }),
                        placeholder: (provided) => ({
                            ...provided,
                            color: '#94a3b8',
                        }),
                    }}
                />
            );
        }

        if (type === 'textarea') {
            return (
                <textarea name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-textarea" placeholder={`Entrez ${label.toLowerCase()}`} rows={3} />
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
            <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-input" placeholder={`Entrez ${label.toLowerCase()}`} required={required} />
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

const TicketModal = ({ show, onClose, type, ticketData, onSaveSuccess, onError }) => {
    const { user } = useAuth();
    const isRestrictedUser = user?.role === 'USER';

    const [materielsList, setMaterielsList] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [usersItList, setUsersItList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        idTicket: null,
        numeroTicket: '',
        titre: '',
        description: '',
        statut: 'NOUVEAU',
        priorite: 'MOYENNE',
        idMateriels: '',
        idDemandeur: '',
        idAssigne: '',
        nomDemandeur: '',
        nomAssigne: '',
    });

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
            color: '#ffffff',
            iconColor: '#ffffff'
        });
    };

    useEffect(() => {
        if (!show) return;

        const loadData = async () => {
            // Chaque source est chargée indépendamment : l'échec de l'une (ex: 403 sur
            // /users pour un rôle USER) ne doit pas empêcher les autres de s'afficher.
            const [materielsResult, techniciansResult, usersResult] = await Promise.allSettled([
                fetchAllMateriels(),
                fetchTechnicians(),
                isRestrictedUser ? Promise.resolve(null) : fetchAllUsers(),
            ]);

            if (materielsResult.status === 'fulfilled') {
                const materielsData = materielsResult.value;
                const formattedMateriels = materielsData.map(item => ({
                    id_materiels: item.id_materiels,
                    id_n_proprietaire: item.id_n,
                    nom_materiel: ` Laptops : ${item.caracteristiques || 'N/A'}`,
                }));
                setMaterielsList(formattedMateriels);

                // Un rôle USER n'a pas accès à /api/users : le backend limite déjà
                // /materiels_all à son propre matériel, on s'en sert pour verrouiller
                // le champ Demandeur sur lui-même.
                if (isRestrictedUser) {
                    const own = materielsData[0];
                    if (own) {
                        const selfEntry = {
                            id_n: own.id_n,
                            nom_full: ` Matricule N° ${own.id_n || 'Inconnu'} : ${own.utilisateur || 'N/A'} (${own.nom_local || 'N/A'})`,
                        };
                        setUsersList([selfEntry]);
                        if (type === 'add') {
                            // Un seul matériel possédé : on le présélectionne directement,
                            // inutile de faire cliquer sur un dropdown à une seule option.
                            const ownMateriel = formattedMateriels.length === 1 ? formattedMateriels[0] : null;
                            setFormData(prev => ({
                                ...prev,
                                idDemandeur: String(selfEntry.id_n),
                                nomDemandeur: selfEntry.nom_full,
                                ...(ownMateriel && { idMateriels: String(ownMateriel.id_materiels) }),
                            }));
                        }
                    }
                }
            } else {
                console.error("Erreur lors du chargement du matériel:", materielsResult.reason);
                showNotification("Erreur lors du chargement du matériel.", 'error');
            }

            if (techniciansResult.status === 'fulfilled') {
                const itData = techniciansResult.value;
                const uniqueItUsers = Array.from(new Map(itData.map(item => [
                    item.id_n,
                    {
                        id_n: item.id_n,
                        nom_complet: `${item.utilisateur || 'N/A'}`,
                        equipe: item.equipe || 'N/A',
                        nom_avec_matricule: `N° ${item.id_n || 'Inconnu'} : ${item.utilisateur || 'N/A'} Info (${item.nom_local || 'N/A'})`
                    }
                ])).values());
                setUsersItList(uniqueItUsers);
            } else {
                console.error("Erreur lors du chargement des techniciens:", techniciansResult.reason);
                showNotification("Erreur lors du chargement des techniciens.", 'error');
            }

            if (!isRestrictedUser) {
                if (usersResult.status === 'fulfilled') {
                    const formattedUsers = usersResult.value.map(item => ({
                        id_n: item.id_n,
                        id_user: item.id_user,
                        nom_full: ` Matricule N° ${item.materiel?.id_n || 'Inconnu'} : ${item.materiel?.utilisateur || 'N/A'} (${item.materiel?.local?.nom_local || 'N/A'})`,
                    }));
                    setUsersList(formattedUsers);
                } else {
                    console.error("Erreur lors du chargement des demandeurs:", usersResult.reason);
                    showNotification("Erreur lors du chargement des demandeurs.", 'error');
                }
            }

            setLoading(false);
        };

        loadData();

        if (type === 'edit' && ticketData) {
            setFormData({
                idTicket: ticketData.idTicket,
                numeroTicket: ticketData.numeroTicket || '',
                titre: ticketData.titre || '',
                description: ticketData.description || '',
                statut: ticketData.statut || 'NOUVEAU',
                priorite: ticketData.priorite || 'MOYENNE',
                idMateriels: ticketData.idMateriels?.toString() || '',
                idDemandeur: ticketData.idDemandeur?.toString() || '',
                idAssigne: ticketData.idAssigne?.toString() || '',
                nomDemandeur: ticketData.nomDemandeur || '',
                nomAssigne: ticketData.nomAssigne || '',
            });
        } else if (type === 'add') {
            setFormData({
                idTicket: null,
                numeroTicket: '',
                titre: '',
                description: '',
                statut: 'NOUVEAU',
                priorite: 'MOYENNE',
                idMateriels: '',
                idDemandeur: '',
                idAssigne: '',
                nomDemandeur: '',
                nomAssigne: '',
            });
        }
    }, [show, type, ticketData, isRestrictedUser]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;

        if (name === 'idDemandeur') {
            const selectedUser = usersList.find(user => String(user.id_n) === value);
            setFormData(prev => ({
                ...prev,
                idDemandeur: value,
                nomDemandeur: selectedUser ? selectedUser.nom_full : '',
            }));
            return;
        }

        if (name === 'idAssigne') {
            const selectedTech = usersItList.find(tech => String(tech.id_n) === value);
            setFormData(prev => ({
                ...prev,
                idAssigne: value === "" ? null : parseInt(value, 10),
                nomAssigne: selectedTech ? `${selectedTech.nom_avec_matricule} (${selectedTech.equipe})` : '',
            }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, [usersList, usersItList]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const {
                idTicket, idMateriels, idDemandeur, idAssigne, titre, description, statut, priorite, nomDemandeur, nomAssigne
            } = formData;

            console.log("Valeurs envoyées:", { idMateriels, idDemandeur });

            if (!idMateriels || !idDemandeur) {
                throw new Error("Le matériel et le demandeur sont obligatoires.");
            }

            const dataToSubmit = {
                idMateriels: parseInt(idMateriels, 10),
                idDemandeur: parseInt(idDemandeur, 10),
                idAssigne: idAssigne ? parseInt(idAssigne, 10) : null,
                titre,
                description,
                statut: statut || "NOUVEAU",
                priorite: priorite || "MOYENNE",
                nomDemandeur: nomDemandeur || "",
                nomAssigne: nomAssigne || "",
            };

            let result;
            if (type === 'edit') {
                result = await updateTicket(idTicket, dataToSubmit);
            } else {
                result = await createTicket(dataToSubmit);
            }

            console.log("Succès !", result);
            showNotification("Ticket sauvegardé avec succès !", 'success');
            onClose();
            if (onSaveSuccess) onSaveSuccess(type);
        } catch (error) {
            console.error("Erreur lors de la soumission :", error.message);
            showNotification(`Erreur: ${error.message}`, 'error');
            if (onError) onError(error);
        }
    };

    if (!show) return null;

    if (loading) return <div className="add-modal-loading">Chargement...</div>;

    const statutOptions = [
        { value: 'NOUVEAU', label: 'NOUVEAU' },
        { value: 'EN_COURS', label: 'EN_COURS' },
        { value: 'RESOLU', label: 'RESOLU' },
        { value: 'FERME', label: 'FERME' },
    ];

    const prioriteOptions = [
        { value: 'BASSE', label: 'BASSE' },
        { value: 'MOYENNE', label: 'MOYENNE' },
        { value: 'HAUTE', label: 'HAUTE' },
        { value: 'URGENTE', label: 'URGENTE' },
    ];

    return (
        <>
            <div className="add-modal-overlay" onClick={onClose}>
                <div className="add-modal-content" onClick={e => e.stopPropagation()} style={{
                    maxWidth: '850px',
                }}>
                    <div className="add-modal-header" style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="add-modal-icon-wrapper" style={{
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                            }}>
                                <FaTicketAlt style={{ color: 'white' }} />
                            </div>
                            <div>
                                <h2 className="add-modal-title" style={{ color: 'white' }}>
                                    {type === 'add' ? 'Nouveau Ticket' : `Modifier Ticket #${formData.idTicket}`}
                                </h2>
                                <p className="add-modal-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {type === 'add' ? 'Remplissez les informations ci-dessous' : 'Modifiez les champs du ticket'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="add-modal-close-btn" type="button" style={{
                            background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            <FaTimes />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div className="add-modal-body" style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '24px',
                        background: '#F8FAFC'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '12px'
                        }}>
                            <FaInfoCircle style={{ color: '#3B82F6', fontSize: '1.2rem' }} />
                            <span style={{ color: '#1E40AF', fontSize: '0.85rem' }}>
                                Les champs marqués d'un <span style={{ color: '#EF4444' }}>*</span> sont obligatoires
                            </span>
                        </div>

                        {formData.numeroTicket && (
                            <div style={{ marginBottom: '20px' }}>
                                <div className="add-modal-form-group">
                                    <label className="add-modal-label">
                                        <FaTicketAlt /> N° Ticket
                                    </label>
                                    <span style={{
                                        padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                                        backgroundColor: '#f8fafc', color: '#334155', fontWeight: '600', fontSize: '0.85rem'
                                    }}>
                                        {formData.numeroTicket}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="add-modal-form-grid" style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'
                        }}>
                            <FormItem label="Titre" name="titre" formData={formData} handleChange={handleChange} required />
                            <FormItem label="Description" name="description" type="textarea" formData={formData} handleChange={handleChange} required />
                            <FormItem label="Demandeur" name="idDemandeur" type="searchable-select"
                                options={usersList.map(u => ({ value: u.id_n, label: u.nom_full }))}
                                formData={formData}
                                handleChange={handleChange}
                                disabled={isRestrictedUser}
                                required
                            />
                            <FormItem label="Matériel concerné" name="idMateriels" type="searchable-select"
                                options={materielsList
                                    .filter(m => String(m.id_n_proprietaire) === String(formData.idDemandeur))
                                    .map(m => ({ value: m.id_materiels, label: m.nom_materiel }))}
                                formData={formData} handleChange={handleChange}
                                disabled={isRestrictedUser && materielsList.length === 1}
                                required />
                            <FormItem label="Assigné à (DSI)" name="idAssigne" type="searchable-select"
                                options={usersItList.map(t => ({ value: t.id_n, label: t.nom_avec_matricule }))}
                                formData={formData} handleChange={handleChange} />
                            <FormItem label="Statut" name="statut" type="select" options={statutOptions} formData={formData} handleChange={handleChange} />
                            <FormItem label="Priorité" name="priorite" type="select" options={prioriteOptions} formData={formData} handleChange={handleChange} />
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
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', padding: '10px 32px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}>
                            <FaSave /> Sauvegarder
                        </button>
                    </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default TicketModal;