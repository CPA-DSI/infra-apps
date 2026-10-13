import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Alert, InputGroup, FormControl } from 'react-bootstrap';
import { FaSearch, FaSync, FaFileExcel, FaHistory, FaTimes, FaCalendarAlt, FaClipboardList } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import DataTable from 'react-data-table-component';
import HistoriqueArriveesChart from './HistoriqueArriveesChart.js';
import { fetchProduits, getHistoriqueArrivees } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import './HistoriqueArrivees.css';

const NoDataComponent = ({ filterText }) => (
    <div className="ha-no-data">
        <div className="ha-no-data-icon" aria-hidden="true">📦</div>
        <p className="ha-no-data-title">Aucun historique trouvé</p>
        <p className="ha-no-data-subtitle">
            {filterText ? `Aucun résultat pour "${filterText}"` : "Réessayez avec d'autres filtres"}
        </p>
    </div>
);

// Tableau : thème partagé, seules la taille de police et la hauteur des lignes diffèrent
const tableCustomStyles = tableStyles({
    rows: { style: { fontSize: '14px', minHeight: '70px' } },
});

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
            setError(`Erreur: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
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
                    <span className={`ha-badge ${isPositive ? 'ha-badge--positive' : 'ha-badge--negative'}`}>
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
                <span className="ha-badge ha-badge--stock">
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
                            {dayjs(row.date_arrivee).format('DD/MM/YYYY')}
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
                <span className="ha-badge ha-badge--prec">
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
                            {dayjs(row.ancienne_date_stock).format('DD/MM/YYYY')}
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
            'Date Mouvement': dayjs(item.date_arrivee).format('DD/MM/YYYY HH:mm'),
            'Stock Précédent': item.ancienne_quantite_stock ?? 'N/A',
            'Date Stock Précédent': item.ancienne_date_stock ? dayjs(item.ancienne_date_stock).format('DD/MM/YYYY') : 'N/A',
            // Origine de la ligne (motif d'import, annulation / modification de mouvement, ajustement manuel)
            'Remarque': item.remarque || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        worksheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 12 },
            { wch: 20 }, { wch: 15 }, { wch: 20 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historique des Arrivées");
        
        let fileName = `Historique_Arrivees_${dayjs().format('YYYY-MM-DD')}`;
        if (dateRange.start && dateRange.end) {
            fileName += `_${dayjs(dateRange.start).format('DD-MM')}_au_${dayjs(dateRange.end).format('DD-MM')}`;
        }
        
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    }, [finalFilteredData, dateRange]);

    return (
        <div className="container-fluid py-2 px-2 ha-page">
            
            <PageHeader
                icon={<FaHistory />}
                title="Historique des Mouvements"
                subtitle="Suivez l'historique des arrivées de produits en stock"
                actions={
                    <button
                        type="button"
                        className="btn-pill btn-pill-ghost btn-refresh"
                        onClick={() => fetchHistoriqueData()}
                        title="Rafraîchir"
                        aria-label="Rafraîchir"
                        disabled={loading}
                    >
                        <FaSync className={loading ? 'ha-spin' : ''} aria-hidden="true" />
                    </button>
                }
            />

            <div className="mb-4">
                <div className="border-0 shadow-lg ha-card">
                    <div className="p-3 p-md-4 p-lg-5">
                        <HistoriqueArriveesChart data={data} />
                    </div>
                </div>
            </div>

            <div>
                <div className="border-0 shadow-lg ha-card">
                    <div className="p-3 p-md-4 p-lg-5">
                        {/* Titre moderne avec sous-titre et bouton export */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center justify-content-between ha-table-heading">
                                <div className="d-flex align-items-center">
                                    <div className="me-3" aria-hidden="true">
                                        <div className="rounded-circle bg-primary bg-opacity-10 p-3 d-flex align-items-center justify-content-center ha-title-icon">
                                            <FaClipboardList size={24} className="text-primary" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="mb-1 fw-semibold ha-title">
                                            Registre des arrivages
                                        </h3>
                                        <p className="text-muted mb-0 small">
                                            <FaHistory size={12} className="me-1 text-muted" aria-hidden="true" />
                                            Suivi détaillé des réceptions produit
                                            <span className="mx-2">•</span>
                                            Mise à jour en temps réel
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    type="button"
                                    className="btn-pill btn-pill-success ha-btn-export"
                                    onClick={exportToExcel}
                                    disabled={data.length === 0}
                                    aria-label="Exporter"
                                >
                                    <FaFileExcel size={15} aria-hidden="true" />
                                    <span>Exporter</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <div className="row g-2">
                                <div className="col-md-4">  {/* au lieu de 3 */}
                                    <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm ha-search-bar">
                                        <FaSearch aria-hidden="true" />
                                        <input type="text" aria-label="Rechercher dans l'historique" placeholder="Rechercher dans l'historique..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="ha-search-input" />
                                        {filterText && (
                                            <button type="button" onClick={() => setFilterText('')} className="ha-search-clear-btn" aria-label="Effacer la recherche">
                                                <FaTimes aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="col-md-2">
                                    <InputGroup>
                                        <InputGroup.Text className="ha-filter-field" aria-hidden="true">
                                            <FaCalendarAlt />
                                        </InputGroup.Text>
                                        <FormControl type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} placeholder="Date début" aria-label="Date début" className="ha-filter-field" />
                                    </InputGroup>
                                </div>
                                
                                <div className="col-md-2">
                                    <InputGroup>
                                        <InputGroup.Text className="ha-filter-field" aria-hidden="true">
                                            <FaCalendarAlt />
                                        </InputGroup.Text>
                                        <FormControl type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} placeholder="Date fin" aria-label="Date fin" className="ha-filter-field" />
                                    </InputGroup>
                                </div>
                                
                                <div className="col-md-3">  {/* au lieu de 6 */}
                                    <select className="form-select ha-filter-field ha-filter-select" aria-label="Filtrer par produit" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                                        <option value="">Tous les produits</option>
                                        {products.map(product => (
                                            <option key={product.id_produit} value={product.id_produit}>
                                                {product.nom_produit}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="col-md-1 text-md-end">  {/* au lieu de 4 */}
                                    <Button variant="outline-secondary" onClick={resetFilters} className="ha-btn-reset">
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
                                customStyles={tableCustomStyles}
                                noDataComponent={<NoDataComponent filterText={filterText} />}
                                paginationComponentOptions={paginationOptions}
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