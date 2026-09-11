// src/pages/HistoriqueMateriel/HistoriqueMateriel.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, InputGroup, Form, Spinner } from 'react-bootstrap';
import { FaSearch, FaSync, FaHistory, FaTimes, FaFileExcel, FaPlus } from 'react-icons/fa';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getHistoriqueMateriel, createHistoriqueMateriel } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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

const modernStyles = {
    table: {
        style: {
            backgroundColor: 'transparent',
            borderRadius: '16px',
        },
    },
    headRow: {
        style: {
            backgroundColor: '#f9fafb', border: 'none', minHeight: '52px', borderRadius: '12px 12px 0 0', borderBottom: '2px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        },
    },
    headCells: {
        style: {
            fontSize: '0.75rem', fontWeight: '600', color: '#374151', letterSpacing: '0.02em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none'
        },
    },
    rows: {
        style: {
            fontSize: '0.85rem', fontWeight: '500', color: '#212529', minHeight: '48px', backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6', transition: 'all 0.2s ease'
        },
        highlightOnHoverStyle: {
            backgroundColor: '#f5f3ff', color: '#5b21b6', cursor: 'pointer', transitionDuration: '0.2s'
        },
    },
    pagination: {
        style: {
            border: 'none', fontSize: '12px', color: '#6c757d', paddingTop: '16px', paddingBottom: '16px'
        },
    },
};

const paginationOptions = {
    rowsPerPageText: 'Lignes par page :',
    rangeSeparatorText: 'sur',
    selectAllRowsItem: true,
    selectAllRowsItemText: 'Tout'
};

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
                <span style={{ fontWeight: '500', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.9rem' }}>💻</span>
                        {row.materiel?.code_pc || 'N/A'}
                    </span>
                    {row.materiel?.caracteristiques && (
                        <span style={{ fontSize: '0.72rem', color: '#6c757d', marginLeft: '22px' }}>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                        {row.materiel?.utilisateur || 'N/A'}
                    </span>
                    <span style={{ fontWeight: '500', color: '#6366f1' }}>
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
                <span title={row.materiel?.equipe || 'N/A'} className="ha-cell-badge ha-cell-badge--equipe">
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
                <span title={row.materiel?.local?.nom_local || 'N/A'} className="ha-cell-badge ha-cell-badge--local">
                    {row.materiel?.local?.nom_local || 'N/A'}
                </span>
            ),
        },
        {
            name: 'Ancienne État',
            selector: row => row.ancienne_valeur || '',
            grow: 2,
            cell: row => (
                <span title={row.ancienne_valeur || 'Aucune'} className="ha-cell-badge ha-cell-badge--ancien">
                    {row.ancienne_valeur || 'Aucune'}
                </span>
            ),
        },
        {
            name: 'Nouvelle État',
            selector: row => row.nouvelle_valeur || '',
            grow: 2,
            cell: row => (
                <span title={row.nouvelle_valeur || 'Aucune'} className="ha-cell-badge ha-cell-badge--nouveau">
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
                <span title={row.nom_utilisateur || 'Système'} className="ha-cell-badge ha-cell-badge--modifie">
                    {row.nom_utilisateur || 'Système'}
                </span>
            ),
        },
    ], []);

    return (
        <div className="container-fluid py-2 px-2" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 p-2 p-md-3 rounded-3" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 6px 24px rgba(99, 102, 241, 0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', minHeight: '80px' }}>
                <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center justify-content-center flex-shrink-0" style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', width: '55px', height: '55px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                        <FaHistory className="text-white" style={{ fontSize: '1.5rem' }} />
                    </div>
                    <div>
                        <h1 className="h5 fw-bold text-white mb-1">{userRole === 'USER' ? 'Mon historique' : 'Historique des Matériels'}</h1>
                        <p className="text-white mb-0" style={{ fontSize: '0.8rem', opacity: 0.8 }}>{userRole === 'USER' ? 'Suivi des modifications de votre équipement' : 'Suivi complet des modifications apportées aux équipements'}</p>
                    </div>
                </div>

                <div className="d-flex gap-2">
                    <Button className="border-0 rounded-circle shadow-sm ha-btn-refresh" onClick={fetchHistorique} title="Rafraîchir">
                        <FaSync />
                    </Button>
                    {userRole !== 'USER' && (
                    <Button className="mtr-btn-add shadow-md" onClick={handleOpenAddModal} title="Ajouter un historique">
                        <FaPlus size={15} />
                        <span className="ms-2">Ajouter</span>
                    </Button>
                    )}
                    {userRole !== 'USER' && (
                    <Button className="mtr-btn-export shadow-md" onClick={handleExportExcel} disabled={filteredHistorique.length === 0}>
                        <FaFileExcel size={15} />
                        <span className="ms-2">Exporter</span>
                    </Button>
                    )}
                </div>
            </div>

            <Card className="border-0 ha-table-card mb-4">
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
                                    <Button variant="link" className="text-muted p-0 ms-2" onClick={() => setSearchTerm('')}>
                                        <FaTimes />
                                    </Button>
                                )}
                            </InputGroup>
                        </div>

                        <div className="col-md-3 col-lg-2">
                            <Form.Select
                                value={filterMateriel}
                                onChange={(e) => setFilterMateriel(e.target.value)}
                                className="rounded-pill border-0 shadow-sm"
                                style={{ backgroundColor: '#f8f9fa', height: '38px', fontSize: '0.85rem' }}
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
                                className="rounded-pill border-0 shadow-sm"
                                style={{ backgroundColor: '#f8f9fa', height: '38px', fontSize: '0.85rem' }}
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
                                className="rounded-pill border-0 shadow-sm"
                                style={{ backgroundColor: '#f8f9fa', height: '38px', fontSize: '0.85rem' }}
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
                                    className="rounded-pill border-0 shadow-sm"
                                    style={{ backgroundColor: '#f8f9fa', height: '38px', fontSize: '0.85rem' }}
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
                                <Button variant="outline-secondary" size="sm" className="border-0 rounded-pill w-100" onClick={handleResetFilters} style={{ backgroundColor: '#f0f0f0', color: '#6c757d' }}>
                                    <FaTimes size={14} className="me-2" />
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
                                customStyles={modernStyles}
                                noDataComponent={
                                <div className="text-center py-5">
                                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
                                    <h5 style={{ color: '#374151' }}>Aucun historique trouvé</h5>
                                    <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
                                        {error ? error : 'Essayez avec d\'autres filtres.'}
                                    </p>
                                </div>
                            }
                        />
                    </div>
                </Card.Body>
            </Card>

            {showAddModal && (
                <div className="add-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div className="add-modal-content" style={{ background: 'white', width: '100%', maxWidth: '600px', maxHeight: '90vh', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div className="add-modal-header" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FaPlus />
                                </div>
                                <div>
                                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.15rem', fontWeight: '600' }}>Ajouter un historique</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.8rem' }}>Enregistrer une nouvelle modification de matériel</p>
                                </div>
                            </div>
                            <button onClick={handleCloseAddModal} className="add-modal-close-btn" type="button" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer' }}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className="add-modal-body" style={{ padding: '24px', overflowY: 'auto', background: '#F8FAFC' }}>
                            {formError && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FaTimes style={{ fontSize: '1rem' }} />
                                    {formError}
                                </div>
                            )}

                            <form onSubmit={handleSubmitForm}>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                        Matériel <span style={{ color: '#dc2626' }}>*</span>
                                    </label>
                                    <select name="id_materiels" value={formData.id_materiels} onChange={handleFormChange} className="add-modal-select" required>
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

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                        Champ modifié <span style={{ color: '#dc2626' }}>*</span>
                                    </label>
                                    <input type="text" name="champ_modifie" value={formData.champ_modifie} onChange={handleFormChange} className="add-modal-select" placeholder="Ex: etat_pc, equipe, utilisateur..." required />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                        Ancienne valeur
                                    </label>
                                    <input type="text" name="ancienne_valeur" value={formData.ancienne_valeur} onChange={handleFormChange} className="add-modal-select" placeholder="Valeur précédente" />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                        Nouvelle valeur
                                    </label>
                                    <input type="text" name="nouvelle_valeur" value={formData.nouvelle_valeur} onChange={handleFormChange} className="add-modal-select" placeholder="Nouvelle valeur" />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#374151' }}>
                                        Nom de l'utilisateur
                                    </label>
                                    <input type="text" name="nom_utilisateur" value={formData.nom_utilisateur} onChange={handleFormChange} className="add-modal-select" placeholder="Nom de l'utilisateur (laisser vide pour Système)" />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" onClick={handleCloseAddModal} disabled={submitting} style={{ background: 'white', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 24px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        Annuler
                                    </button>
                                    <button type="submit" disabled={submitting} style={{ background: submitting ? '#a5b4fc' : '#6366f1', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        {submitting ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoriqueMateriel;
