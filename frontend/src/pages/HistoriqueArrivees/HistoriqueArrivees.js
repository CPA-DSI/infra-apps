import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Alert, InputGroup, FormControl } from 'react-bootstrap';
import { FaSearch, FaSync, FaFileExcel, FaHistory, FaTimes, FaCalendarAlt, FaClipboardList } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import moment from 'moment';
import DataTable from 'react-data-table-component';
import HistoriqueArriveesChart from './HistoriqueArriveesChart.js';
import { fetchProduits, getHistoriqueArrivees } from '../../services/api';
import './HistoriqueArrivees.css';

const NoDataComponent = ({ filterText }) => (
    <div className="ha-no-data">
        <div className="ha-no-data-icon">📦</div>
        <p className="ha-no-data-title">Aucun historique trouvé</p>
        <p className="ha-no-data-subtitle">
            {filterText ? `Aucun résultat pour "${filterText}"` : "Réessayez avec d'autres filtres"}
        </p>
    </div>
);

const modernStyles = {
    table: {
        style: {
            backgroundColor: 'transparent', borderRadius: '20px', overflow: 'hidden',
        },
    },
    headRow: {
        style: {
            backgroundColor: '#f0f4f8', border: 'none', minHeight: '56px', borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e2e8f0', fontWeight: 700,
        },
    },
    headCells: {
        style: {
            fontSize: '0.75rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none',
        },
    },
    rows: {
        style: {
            fontSize: '14px', fontWeight: '500', color: '#334155', minHeight: '70px', paddingLeft: '16px', paddingRight: '16px', borderBottom: '1px solid #e2e8f0', transition: 'all 0.3s ease',
        },
        highlightOnHoverStyle: {
            backgroundColor: '#f0f8ff', color: '#0056b3', cursor: 'pointer', transitionDuration: '0.2s',
        },
    },
    pagination: {
        style: {
            border: 'none', fontSize: '13px', color: '#6c757d', paddingTop: '20px', backgroundColor: 'transparent',
        },
        pageButtonsStyle: {
            borderRadius: '4px', height: '32px', cursor: 'pointer', transition: 'all 0.3s',
            '&:hover:not(:disabled)': {
                backgroundColor: '#667eea',
                color: 'white',
            },
            '&:disabled': {
                cursor: 'unset',
                opacity: 0.5,
            },
        },
    },
    noData: {
        style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
        },
    },
};

const HistoriqueArrivees = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedProduct, setSelectedProduct] = useState('');
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });

    // Version CORRIGÉE - Appel API simplifié sans paramètres de filtrage backend
    const fetchHistoriqueData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await getHistoriqueArrivees();
            
            console.log('Données reçues:', response);
            
            const normalizeData = (arr) => arr.map(item => ({
                ...item,
                nom_produit: item.nom_produit || item.produit?.nom_produit || null,
                quantite_en_stock: item.quantite_en_stock ?? item.produit?.quantite_en_stock ?? null,
            }));

            if (Array.isArray(response)) {
                const normalized = normalizeData(response);
                setData(normalized);
                setPagination({
                    currentPage: 1,
                    totalPages: Math.ceil(response.length / 50),
                    totalItems: response.length
                });
            } else {
                setData([]);
            }
        } catch (err) {
            console.error('Erreur fetchHistoriqueData:', err);
            setError(`Erreur: ${err.response?.data?.message || err.message}`);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Version corrigée pour les produits
    const fetchProducts = useCallback(async () => {
        try {
            const response = await fetchProduits();
            if (Array.isArray(response)) {
                setProducts(response);
            } else {
                setProducts([]);
            }
        } catch (err) {
            console.error('Erreur chargement produits:', err);
            setProducts([]);
        }
    }, []);

    useEffect(() => {
        fetchHistoriqueData();
        fetchProducts();
    }, [fetchHistoriqueData, fetchProducts]);

    // Filtrage côté client pour la plage de dates et le produit sélectionné
    const getFilteredDataByDateAndProduct = useMemo(() => {
        let result = [...data];
        
        // Filtre par produit
        if (selectedProduct) {
            result = result.filter(item => item.id_produit === parseInt(selectedProduct));
        }
        
        // Filtre par plage de dates
        if (dateRange.start) {
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            result = result.filter(item => {
                const itemDate = new Date(item.date_arrivee);
                return itemDate >= startDate;
            });
        }
        
        if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(item => {
                const itemDate = new Date(item.date_arrivee);
                return itemDate <= endDate;
            });
        }
        
        return result;
    }, [data, selectedProduct, dateRange.start, dateRange.end]);

    const resetFilters = () => {
        setFilterText('');
        setDateRange({ start: '', end: '' });
        setSelectedProduct('');
        setError(null);
    };

    const columns = useMemo(() => [
        { 
            name: 'Produit', 
            selector: row => row.nom_produit, 
            sortable: true,
            grow: 2,
            cell: row => (
                <div className="ha-cell-produit">
                    <span className="ha-cell-produit-name">
                        {row.nom_produit || 'N/A'}
                    </span>
                </div>
            ),
        },
        { 
            name: 'Qté Arrivée', 
            selector: row => row.quantite_arrivee, 
            sortable: true,
            center: true,
             cell: row => {
                const qty = row.quantite_arrivee || 0;
                const isPositive = qty >= 0;
                return (
                    <span className={isPositive ? "ha-badge-qty-positive" : "ha-badge-qty-negative"}>
                        {isPositive ? '+' : '-'}{Math.abs(qty)}
                    </span>
                );
            },
        },
        { 
            name: 'Stock Actuel', 
            selector: row => row.quantite_en_stock, 
            sortable: true,
            center: true,
            cell: row => (
                <span className="ha-badge-stock">
                    {row.quantite_en_stock ?? 'N/A'}
                </span>
            ),
        },
        { 
            name: 'Date Mouv.', 
            selector: row => row.date_arrivee, 
            sortable: true,
            cell: row => {
                if (!row.date_arrivee) return 'N/A';
                const date = new Date(row.date_arrivee);
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                let ageText = '';
                if (diffDays === 0) ageText = "Aujourd'hui";
                else if (diffDays === 1) ageText = 'Hier';
                else if (diffDays < 7) ageText = `${diffDays}j`;
                else if (diffDays < 30) ageText = `${Math.floor(diffDays / 7)}sem`;
                else ageText = `${Math.floor(diffDays / 30)}mois`;
                return (
                    <div className="ha-cell-date">
                        <span className="ha-cell-date-main">
                            {moment(row.date_arrivee).format('DD/MM/YYYY')}
                        </span>
                        <span className="ha-cell-date-age">
                            {ageText}
                        </span>
                    </div>
                );
            },
        },
        { 
            name: 'Stock Préc.', 
            selector: row => row.ancienne_quantite_stock, 
            sortable: true, 
            center: true,
            cell: row => (
                <span className="ha-badge-stock-prec">
                    {row.ancienne_quantite_stock !== null && row.ancienne_quantite_stock !== undefined 
                        ? row.ancienne_quantite_stock 
                        : 'N/A'}
                </span>
            ),
        },
        { 
            name: 'Date Stock Préc.', 
            selector: row => row.ancienne_date_stock, 
            sortable: true,
            cell: row => {
                if (!row.ancienne_date_stock) return (
                    <span className="ha-text-na">N/A</span>
                );
                return (
                    <div className="ha-cell-date">
                        <span className="ha-cell-date-main">
                            {moment(row.ancienne_date_stock).format('DD/MM/YYYY')}
                        </span>
                    </div>
                );
            },
        },
    ], []);

    // Appliquer tous les filtres (recherche texte + dates + produit)
    const finalFilteredData = useMemo(() => {
        // D'abord filtrer par dates et produit
        let result = getFilteredDataByDateAndProduct;
        
        // Ensuite filtrer par texte de recherche
        if (filterText.trim()) {
            const lowerCaseFilter = filterText.toLowerCase();
            result = result.filter(item => {
                return (
                    item.nom_produit?.toLowerCase().includes(lowerCaseFilter) ||
                    item.quantite_arrivee?.toString().includes(lowerCaseFilter)
                );
            });
        }
        
        return result;
    }, [getFilteredDataByDateAndProduct, filterText]);

    const exportToExcel = useCallback(() => {
        if (finalFilteredData.length === 0) {
            setError("Aucune donnée à exporter");
            return;
        }

        const excelData = finalFilteredData.map(item => ({
            'Produit': item.nom_produit,
            'Quantité Arrivée': item.quantite_arrivee,
            'Stock Actuel': item.quantite_en_stock,
            'Date Mouvement': moment(item.date_arrivee).format('DD/MM/YYYY HH:mm'),
            'Stock Précédent': item.ancienne_quantite_stock ?? 'N/A',
            'Date Stock Précédent': item.ancienne_date_stock ? moment(item.ancienne_date_stock).format('DD/MM/YYYY') : 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        worksheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 12 },
            { wch: 20 }, { wch: 15 }, { wch: 20 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historique des Arrivées");
        
        let fileName = `Historique_Arrivees_${moment().format('YYYY-MM-DD')}`;
        if (dateRange.start && dateRange.end) {
            fileName += `_${moment(dateRange.start).format('DD-MM')}_au_${moment(dateRange.end).format('DD-MM')}`;
        }
        
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    }, [finalFilteredData, dateRange]);

    return (
        <div className="container-fluid py-2 px-2 ha-container">
            
            <div className="d-flex justify-content-between align-items-center mb-4 p-2 p-md-3 rounded-3 ha-header">
                <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center justify-content-center flex-shrink-0 ha-header-icon">
                        <FaHistory className="text-white" style={{ fontSize: '1.5rem' }} />
                    </div>
                    <div>
                        <h1 className="h5 fw-bold text-white mb-1 ha-header-title">
                            Historique des Mouvements
                        </h1>
                        <p className="text-white mb-0 ha-header-subtitle">
                            Suivez l'historique des arrivées de produits en stock
                        </p>
                    </div>
                </div>
                
                <div className="d-flex gap-2">
                    <Button 
                        className="border-0 rounded-circle shadow-sm ha-btn-refresh" 
                        onClick={() => fetchHistoriqueData()}
                        title="Rafraîchir"
                        disabled={loading}
                    >
                        <FaSync className={loading ? 'fa-spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="mb-4">
                <div className="border-0 shadow-lg ha-dashboard-card">
                    <div className="p-4 p-lg-5">
                        <HistoriqueArriveesChart data={data} />
                    </div>
                </div>
            </div>

            <div>
                <div className="border-0 shadow-lg ha-table-card">
                    <div className="p-4 p-lg-5">
                        {/* Titre moderne avec sous-titre et bouton export */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                    <div className="ha-title-icon me-3">
                                        <div className="rounded-circle bg-primary bg-opacity-10 p-3 d-flex align-items-center justify-content-center" 
                                             style={{ width: '48px', height: '48px' }}>
                                            <FaClipboardList size={24} className="text-primary" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="mb-1 fw-semibold" style={{ color: '#1e293b' }}>
                                            Registre des arrivages
                                        </h3>
                                        <p className="text-muted mb-0 small">
                                            <FaHistory size={12} className="me-1 text-muted" />
                                            Suivi détaillé des réceptions produit
                                            <span className="mx-2">•</span>
                                            Mise à jour en temps réel
                                        </p>
                                    </div>
                                </div>
                                
                                <Button 
                                    variant="success"
                                    className="border-0 rounded-pill shadow-sm ha-btn-export"
                                    onClick={exportToExcel}
                                    disabled={data.length === 0}
                                >
                                    <FaFileExcel size={15} />
                                    <span>Exporter</span>
                                </Button>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <div className="row g-2">
                                <div className="col-md-4">  {/* au lieu de 3 */}
                                    <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm ha-search-bar">
                                        <FaSearch style={{ color: '#6c757d', marginRight: '8px' }} />
                                        <input type="text" placeholder="Rechercher dans l'historique..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="ha-search-input" />
                                        {filterText && (
                                            <button onClick={() => setFilterText('')} className="ha-search-clear-btn">
                                                <FaTimes />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="col-md-2">
                                    <InputGroup>
                                        <InputGroup.Text style={{ backgroundColor: '#f8f9fa', border: 'none' }}>
                                            <FaCalendarAlt />
                                        </InputGroup.Text>
                                        <FormControl type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} placeholder="Date début" style={{ backgroundColor: '#f8f9fa', border: 'none' }} />
                                    </InputGroup>
                                </div>
                                
                                <div className="col-md-2">
                                    <InputGroup>
                                        <InputGroup.Text style={{ backgroundColor: '#f8f9fa', border: 'none' }}>
                                            <FaCalendarAlt />
                                        </InputGroup.Text>
                                        <FormControl type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} placeholder="Date fin" style={{ backgroundColor: '#f8f9fa', border: 'none' }} />
                                    </InputGroup>
                                </div>
                                
                                <div className="col-md-3">  {/* au lieu de 6 */}
                                    <select className="form-select" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={{ borderRadius: '30px', backgroundColor: '#f8f9fa', border: 'none' }}>
                                        <option value="">Tous les produits</option>
                                        {products.map(product => (
                                            <option key={product.id_produit} value={product.id_produit}>
                                                {product.nom_produit}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="col-md-1 text-md-end">  {/* au lieu de 4 */}
                                    <Button variant="outline-secondary" onClick={resetFilters} style={{ borderRadius: '30px' }}>
                                        Réinitialiser les filtres
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3 d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                {finalFilteredData.length} résultat{finalFilteredData.length > 1 ? 's' : ''}
                                {data.length !== finalFilteredData.length && ` (filtré sur ${data.length} total)`}
                            </small>
                            {pagination.totalItems > 0 && (
                                <small className="text-muted">
                                    Page {pagination.currentPage} sur {pagination.totalPages} - Total: {pagination.totalItems} enregistrements
                                </small>
                            )}
                        </div>

                        {error && <Alert variant="danger" className="mb-4" onClose={() => setError(null)} dismissible>{error}</Alert>}

                        <div className="table-responsive">
                            <DataTable
                                columns={columns}
                                data={finalFilteredData}
                                pagination
                                paginationPerPage={10}
                                paginationRowsPerPageOptions={[10, 20, 50]}
                                highlightOnHover
                                pointerOnHover
                                responsive
                                progressPending={loading}
                                progressComponent={
                                    <div className="ha-spinner-wrapper">
                                        <div className="spinner-border text-primary ha-spinner" role="status">
                                            <span className="visually-hidden">Chargement...</span>
                                        </div>
                                        <p className="text-muted mt-3">Chargement de l'historique...</p>
                                    </div>
                                }
                                customStyles={modernStyles}
                                noDataComponent={<NoDataComponent filterText={filterText} />}
                                paginationComponentOptions={{
                                    rowsPerPageText: 'Lignes par page :',
                                    rangeSeparatorText: 'sur',
                                    selectAllRowsItem: true,
                                    selectAllRowsItemText: 'Tout'
                                }}
                                persistTableHead
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoriqueArrivees;