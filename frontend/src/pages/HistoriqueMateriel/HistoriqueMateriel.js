// src/pages/HistoriqueMateriel/HistoriqueMateriel.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, InputGroup, Form, Spinner } from 'react-bootstrap';
import { FaSearch, FaSync, FaHistory, FaTimes, FaFileExcel, FaPlus } from 'react-icons/fa';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getHistoriqueMateriel, createHistoriqueMateriel } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import AppModal from '../../components/AppModal/AppModal';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import './HistoriqueMateriel.css';

const formatDate = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const tableCustomStyles = tableStyles({
    headCells: { style: { textTransform: 'capitalize' } },
    rows: {
        style: { minHeight: '48px' },
        highlightOnHoverStyle: { backgroundColor: 'var(--color-secondary-soft)', color: '#5b21b6' },
    },
});

const HistoriqueMateriel = () => {
    const { user } = useAuth();
    const userRole = user?.role || '';
    const userIdN = user?.id_n || '';
    const [historique, setHistorique] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMateriel, setFilterMateriel] = useState('');
    const [filterLocal, setFilterLocal] = useState('');
    const [filterColumn, setFilterColumn] = useState('');
    const [filterColumnValue, setFilterColumnValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        id_materiels: '',
        champ_modifie: '',
        ancienne_valeur: '',
        nouvelle_valeur: '',
        nom_utilisateur: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const fetchHistorique = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getHistoriqueMateriel();
            setHistorique(data);
        } catch (err) {
            console.error('Erreur lors du chargement de l\'historique:', err);
            setError('Impossible de charger l\'historique des matériels.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistorique();
    }, [fetchHistorique]);

    const uniqueColumnValues = useMemo(() => {
        const values = [...new Set(historique.map(item => {
            switch (filterColumn) {
                case 'id_n': return item.materiel?.id_n;
                case 'equipe': return item.materiel?.equipe;
                case 'utilisateur': return item.materiel?.utilisateur;
                case 'nom_utilisateur': return item.nom_utilisateur;
                case 'code_pc': return item.materiel?.code_pc;
                case 'nom_local': return item.materiel?.local?.nom_local;
                case 'champ_modifie': return item.champ_modifie;
                case 'ancienne_valeur': return item.ancienne_valeur;
                case 'nouvelle_valeur': return item.nouvelle_valeur;
                default: return null;
            }
        }).filter(Boolean))];
        return values.sort();
    }, [historique, filterColumn]);

    const filteredHistorique = useMemo(() => {
        return historique.filter(item => {
            const lowerCaseSearch = searchTerm.toLowerCase();

            const materiel = item.materiel || {};
            const utilisateur = item.nom_utilisateur || '';
            const champModifie = item.champ_modifie || '';
            const ancienneValeur = item.ancienne_valeur || '';
            const nouvelleValeur = item.nouvelle_valeur || '';

            const searchMatch = 
                String(item.id_historique).toLowerCase().includes(lowerCaseSearch) ||
                String(materiel.utilisateur || '').toLowerCase().includes(lowerCaseSearch) ||
                String(materiel.code_pc || '').toLowerCase().includes(lowerCaseSearch) ||
                String(materiel.id_n || '').toLowerCase().includes(lowerCaseSearch) ||
                String(materiel.equipe || '').toLowerCase().includes(lowerCaseSearch) ||
                String(materiel.local?.nom_local || '').toLowerCase().includes(lowerCaseSearch) ||
                String(utilisateur || '').toLowerCase().includes(lowerCaseSearch) ||
                champModifie.toLowerCase().includes(lowerCaseSearch) ||
                ancienneValeur.toLowerCase().includes(lowerCaseSearch) ||
                nouvelleValeur.toLowerCase().includes(lowerCaseSearch);

            const materielMatch = !filterMateriel ||
                String(materiel.id_materiels) === filterMateriel;

            const localMatch = !filterLocal ||
                String(materiel.local?.nom_local || '') === filterLocal;

            const userMatch = userRole !== 'USER' || (materiel.id_n === userIdN);

            let columnMatch = true;
            if (filterColumn && filterColumnValue) {
                const value = (() => {
                    switch (filterColumn) {
                        case 'id_n': return item.materiel?.id_n;
                        case 'equipe': return item.materiel?.equipe;
                        case 'utilisateur': return item.materiel?.utilisateur;
                        case 'nom_utilisateur': return item.nom_utilisateur;
                        case 'code_pc': return item.materiel?.code_pc;
                        case 'nom_local': return item.materiel?.local?.nom_local;
                        case 'champ_modifie': return item.champ_modifie;
                        case 'ancienne_valeur': return item.ancienne_valeur;
                        case 'nouvelle_valeur': return item.nouvelle_valeur;
                        default: return null;
                    }
                })();
                columnMatch = String(value || '').toLowerCase().includes(filterColumnValue.toLowerCase());
            }

            return searchMatch && materielMatch && localMatch && columnMatch && userMatch;
        });
    }, [historique, searchTerm, filterMateriel, filterLocal, filterColumn, filterColumnValue, userRole, userIdN]);

    const handleResetFilters = useCallback(() => {
        setSearchTerm('');
        setFilterMateriel('');
        setFilterLocal('');
        setFilterColumn('');
        setFilterColumnValue('');
    }, []);

    const handleOpenAddModal = useCallback(() => {
        setFormData({
            id_materiels: '',
            champ_modifie: '',
            ancienne_valeur: '',
            nouvelle_valeur: '',
            nom_utilisateur: '',
        });
        setFormError('');
        setShowAddModal(true);
    }, []);

    const handleCloseAddModal = useCallback(() => {
        setShowAddModal(false);
        setFormError('');
    }, []);

    const handleFormChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmitForm = useCallback(async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        try {
            if (!formData.id_materiels || !formData.champ_modifie) {
                throw new Error('Veuillez remplir les champs obligatoires : Matériel et Champ modifié.');
            }

            const payload = {
                id_materiels: Number(formData.id_materiels),
                champ_modifie: formData.champ_modifie,
                ancienne_valeur: formData.ancienne_valeur || null,
                nouvelle_valeur: formData.nouvelle_valeur || null,
                nom_utilisateur: formData.nom_utilisateur || null,
            };

            await createHistoriqueMateriel(payload);
            handleCloseAddModal();
            fetchHistorique();
        } catch (err) {
            setFormError(err.message || 'Erreur lors de l\'ajout de l\'historique.');
        } finally {
            setSubmitting(false);
        }
    }, [formData, handleCloseAddModal, fetchHistorique]);

    const handleExportExcel = useCallback(() => {
        const dataToExport = filteredHistorique.map(item => ({
            'ID Historique': item.id_historique,
            'Matériel ID': item.materiel?.id_materiels || 'N/A',
            'Matricule (id_n)': item.materiel?.id_n || 'N/A',
            'Équipe': item.materiel?.equipe || 'N/A',
            'Utilisateur': item.materiel?.utilisateur || 'N/A',
            'Code PC': item.materiel?.code_pc || 'N/A',
            'Ancienne valeur': item.ancienne_valeur || '',
            'Nouvelle valeur': item.nouvelle_valeur || '',
            'Date modification': formatDate(item.date_modification),
            'Modifié par': item.nom_utilisateur || 'Système',
        }));

        if (dataToExport.length === 0) {
            alert('Aucune donnée à exporter.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
            if (!worksheet[cellAddress]) continue;
            if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
            worksheet[cellAddress].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4F46E5" } }
            };
        }

        worksheet['!cols'] = [
            { wch: 15 },
            { wch: 12 },
            { wch: 14 },
            { wch: 16 },
            { wch: 20 },
            { wch: 15 },
            { wch: 30 },
            { wch: 30 },
            { wch: 20 },
            { wch: 20 },
        ];

        const filterRange = { s: { c: 0, r: 0 }, e: { c: 9, r: 0 } };
        worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(filterRange) };

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historique Materiels");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        const formattedDate = `${year}-${month}-${day}`;
        const formattedTime = `${hours}h${minutes}m${seconds}s`;
        const filename = `historique_materiels_${formattedDate}_${formattedTime}.xlsx`;

        saveAs(blob, filename);
    }, [filteredHistorique]);

    const columns = useMemo(() => [
        {
            name: 'Date modification',
            selector: row => row.date_modification,
            sortable: true,
            grow: 1,
            cell: row => formatDate(row.date_modification),
        },
        {
            name: 'Laptop',
            selector: row => row.materiel?.code_pc || 'N/A',
            sortable: true,
            grow: 2,
            cell: row => (
                <span className="hm-cell-pc">
                    <span className="hm-cell-pc-code">
                        <span className="hm-cell-pc-icon" aria-hidden="true">💻</span>
                        {row.materiel?.code_pc || 'N/A'}
                    </span>
                    {row.materiel?.caracteristiques && (
                        <span className="hm-cell-pc-caract">
                            {row.materiel.caracteristiques}
                        </span>
                    )}
                </span>
            ),
        },
        {
            name: 'Utilisateur',
            selector: row => `${row.materiel?.id_n || ''} ${row.materiel?.utilisateur || ''}`,
            sortable: true,
            grow: 1,
            cell: row => (
                <span className="hm-cell-user">
                    <span className="hm-cell-user-name">
                        {row.materiel?.utilisateur || 'N/A'}
                    </span>
                    <span className="hm-cell-user-id">
                        ({row.materiel?.id_n || 'N/A'})
                    </span>
                </span>
            ),
        },
        {
            name: 'Équipe',
            selector: row => row.materiel?.equipe || '',
            sortable: true,
            grow: 1,
            cell: row => (
                <span title={row.materiel?.equipe || 'N/A'} className="hm-cell-badge hm-cell-badge--equipe">
                    {row.materiel?.equipe || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Local',
            selector: row => row.materiel?.local?.nom_local || '',
            sortable: true,
            grow: 1,
            cell: row => (
                <span title={row.materiel?.local?.nom_local || 'N/A'} className="hm-cell-badge hm-cell-badge--local">
                    {row.materiel?.local?.nom_local || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Ancienne État',
            selector: row => row.ancienne_valeur || '',
            grow: 2,
            cell: row => (
                <span title={row.ancienne_valeur || 'Aucune'} className="hm-cell-badge hm-cell-badge--ancien">
                    {row.ancienne_valeur || 'Aucune'}
                </span>
            ),
        },
        {
            name: 'Nouvelle État',
            selector: row => row.nouvelle_valeur || '',
            grow: 2,
            cell: row => (
                <span title={row.nouvelle_valeur || 'Aucune'} className="hm-cell-badge hm-cell-badge--nouveau">
                    {row.nouvelle_valeur || 'Aucune'}
                </span>
            ),
        },
        {
            name: 'Modifié Par',
            selector: row => row.nom_utilisateur || 'Système',
            sortable: true,
            grow: 1,
            cell: row => (
                <span title={row.nom_utilisateur || 'Système'} className="hm-cell-badge hm-cell-badge--modifie">
                    {row.nom_utilisateur || 'Système'}
                </span>
            ),
        },
    ], []);

    const isUser = userRole === 'USER';

    return (
        <div className="container-fluid py-2 px-2 page-historique-materiel">
            <PageHeader
                icon={<FaHistory />}
                title={isUser ? 'Mon historique' : 'Historique des Matériels'}
                subtitle={isUser ? 'Suivi des modifications de votre équipement' : 'Suivi complet des modifications apportées aux équipements'}
                actions={
                    <>
                        <button type="button" className="btn-refresh" onClick={fetchHistorique} title="Rafraîchir" aria-label="Rafraîchir">
                            <FaSync aria-hidden="true" />
                        </button>
                        {!isUser && (
                            <button type="button" className="btn-pill btn-pill-primary" onClick={handleOpenAddModal} title="Ajouter un historique">
                                <FaPlus size={15} aria-hidden="true" />
                                Ajouter
                            </button>
                        )}
                        {!isUser && (
                            <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcel} disabled={filteredHistorique.length === 0}>
                                <FaFileExcel size={15} aria-hidden="true" />
                                Exporter
                            </button>
                        )}
                    </>
                }
            />

            <Card className="border-0 hm-table-card mb-4">
                <Card.Body className="p-4 p-lg-5">
                    <div className="row mb-3 g-3">
                        <div className="col-md-4 col-lg-3">
                            <InputGroup className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm">
                                <InputGroup.Text className="bg-transparent border-0">
                                    <FaSearch className="text-muted" />
                                </InputGroup.Text>
                                <Form.Control
                                    className="bg-transparent border-0 shadow-none p-0"
                                    placeholder="Rechercher..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <Button variant="link" className="text-muted p-0 ms-2" onClick={() => setSearchTerm('')} aria-label="Effacer la recherche">
                                        <FaTimes />
                                    </Button>
                                )}
                            </InputGroup>
                        </div>

                        <div className="col-md-3 col-lg-2">
                            <Form.Select
                                value={filterMateriel}
                                onChange={(e) => setFilterMateriel(e.target.value)}
                                className={`filter-pill ${filterMateriel ? 'is-active' : ''}`}
                            >
                                <option value="">Tous les matériels</option>
                                {[...new Set(historique.map(item => item.materiel?.id_materiels).filter(Boolean))].map(id => {
                                    const mat = historique.find(item => item.materiel?.id_materiels === id)?.materiel;
                                    return (
                                        <option key={id} value={id}>
                                            {mat?.code_pc ? `PC: ${mat.code_pc}` : `ID: ${id}`}
                                        </option>
                                    );
                                })}
                            </Form.Select>
                        </div>

                        <div className="col-md-3 col-lg-2">
                            <Form.Select
                                value={filterColumn}
                                onChange={(e) => {
                                    setFilterColumn(e.target.value);
                                    setFilterColumnValue('');
                                }}
                                className={`filter-pill ${filterColumn ? 'is-active' : ''}`}
                            >
                                <option value="">Toutes les colonnes</option>
                                <option value="utilisateur">Utilisateur</option>
                                <option value="nom_utilisateur">Modifié par</option>
                                <option value="ancienne_valeur">Ancienne valeur</option>
                                <option value="nouvelle_valeur">Nouvelle valeur</option>
                            </Form.Select>
                        </div>

                        <div className="col-md-3 col-lg-2">
                            <Form.Select
                                value={filterLocal}
                                onChange={(e) => setFilterLocal(e.target.value)}
                                className={`filter-pill ${filterLocal ? 'is-active' : ''}`}
                            >
                                <option value="">Tous les locaux</option>
                                {[...new Set(historique.map(item => item.materiel?.local?.nom_local).filter(Boolean))].sort().map(local => (
                                    <option key={local} value={local}>
                                        {local}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        {filterColumn && (
                        <div className="col-md-3 col-lg-2">
                                <Form.Control
                                    type="text"
                                    list="filterColumnValuesList"
                                    placeholder="Valeur à filtrer..."
                                    value={filterColumnValue}
                                    onChange={(e) => setFilterColumnValue(e.target.value)}
                                    className={`filter-pill ${filterColumnValue ? 'is-active' : ''}`}
                                />
                                <datalist id="filterColumnValuesList">
                                    {uniqueColumnValues.map(val => (
                                        <option key={val} value={val} />
                                    ))}
                                </datalist>
                            </div>
                        )}

                        <div className="col-md-2 col-lg-2">
                            <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm text-center">
                                <small className="text-muted">
                                    <strong>{filteredHistorique.length}</strong> résultat{filteredHistorique.length > 1 ? 's' : ''}
                                </small>
                            </div>
                        </div>

                        {(searchTerm || filterMateriel || filterLocal || filterColumn || filterColumnValue) && (
                            <div className="col-md-2 col-lg-2">
                                <Button variant="outline-secondary" size="sm" className="border-0 rounded-pill w-100 hm-btn-reset" onClick={handleResetFilters}>
                                    <FaTimes size={14} className="me-2" aria-hidden="true" />
                                    Réinitialiser
                                </Button>
                            </div>
                        )}
                    </div>

                        <div className="table-responsive">
                            <DataTable
                                columns={columns}
                                data={filteredHistorique}
                                pagination
                                paginationComponentOptions={paginationOptions}
                                highlightOnHover
                                pointerOnHover
                                responsive
                                progressPending={loading}
                                persistTableHead
                                progressComponent={
                                    <div className="p-5 text-center">
                                        <Spinner animation="grow" variant="primary" size="sm" className="me-2" />
                                        <span className="text-muted">Chargement des données...</span>
                                    </div>
                                }
                                customStyles={tableCustomStyles}
                                noDataComponent={
                                <div className="text-center py-5">
                                    <div className="hm-empty-icon" aria-hidden="true">📭</div>
                                    <h5 className="hm-empty-title">Aucun historique trouvé</h5>
                                    <p className="hm-empty-text">
                                        {error ? error : 'Essayez avec d\'autres filtres.'}
                                    </p>
                                </div>
                            }
                        />
                    </div>
                </Card.Body>
            </Card>

            <AppModal
                show={showAddModal}
                onClose={handleCloseAddModal}
                title="Ajouter un historique"
                subtitle="Enregistrer une nouvelle modification de matériel"
                icon={<FaPlus />}
                size="md"
                as="form"
                onSubmit={handleSubmitForm}
                bodyClassName="hm-modal-body"
                footer={
                    <>
                        <button type="button" className="add-modal-cancel-btn" onClick={handleCloseAddModal} disabled={submitting}>
                            Annuler
                        </button>
                        <button type="submit" className="add-modal-submit-btn" disabled={submitting}>
                            {submitting ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </>
                }
            >
                {formError && (
                    <div className="hm-form-error" role="alert">
                        <FaTimes aria-hidden="true" />
                        {formError}
                    </div>
                )}

                <div className="add-modal-form-group">
                    <label htmlFor="hm-id-materiels" className="add-modal-label">
                        Matériel <span className="hm-required">*</span>
                    </label>
                    <select id="hm-id-materiels" name="id_materiels" value={formData.id_materiels} onChange={handleFormChange} className="add-modal-select" required>
                        <option value="">Sélectionner un matériel</option>
                        {[...new Set(historique.map(item => item.materiel?.id_materiels).filter(Boolean))].map(id => {
                            const mat = historique.find(item => item.materiel?.id_materiels === id)?.materiel;
                            return (
                                <option key={id} value={id}>
                                    {mat?.code_pc ? `PC: ${mat.code_pc}` : `ID: ${id}`}
                                </option>
                            );
                        })}
                    </select>
                </div>

                <div className="add-modal-form-group">
                    <label htmlFor="hm-champ-modifie" className="add-modal-label">
                        Champ modifié <span className="hm-required">*</span>
                    </label>
                    <input id="hm-champ-modifie" type="text" name="champ_modifie" value={formData.champ_modifie} onChange={handleFormChange} className="add-modal-input" placeholder="Ex: etat_pc, equipe, utilisateur..." required />
                </div>

                <div className="add-modal-form-group">
                    <label htmlFor="hm-ancienne-valeur" className="add-modal-label">Ancienne valeur</label>
                    <input id="hm-ancienne-valeur" type="text" name="ancienne_valeur" value={formData.ancienne_valeur} onChange={handleFormChange} className="add-modal-input" placeholder="Valeur précédente" />
                </div>

                <div className="add-modal-form-group">
                    <label htmlFor="hm-nouvelle-valeur" className="add-modal-label">Nouvelle valeur</label>
                    <input id="hm-nouvelle-valeur" type="text" name="nouvelle_valeur" value={formData.nouvelle_valeur} onChange={handleFormChange} className="add-modal-input" placeholder="Nouvelle valeur" />
                </div>

                <div className="add-modal-form-group">
                    <label htmlFor="hm-nom-utilisateur" className="add-modal-label">Nom de l'utilisateur</label>
                    <input id="hm-nom-utilisateur" type="text" name="nom_utilisateur" value={formData.nom_utilisateur} onChange={handleFormChange} className="add-modal-input" placeholder="Nom de l'utilisateur (laisser vide pour Système)" />
                </div>
            </AppModal>
        </div>
    );
};

export default HistoriqueMateriel;
