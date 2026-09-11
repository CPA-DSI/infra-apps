// HistoriqueArriveesChart.js - Version Top N + Tableau scrollable

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Container, Card, Spinner, Alert, Badge, Row, Col, 
  ButtonGroup, Button, Form, Pagination 
} from 'react-bootstrap';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { 
  FaBoxOpen, FaCubes, FaChartLine, FaWarehouse, 
  FaSort, FaSortUp, FaSortDown, FaSearch 
} from 'react-icons/fa';
import { getHistoriqueArrivees } from '../../services/api';
import moment from 'moment';

// Enregistrement des composants Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Composant KPI Card ---
const KpiCard = ({ icon: Icon, label, value, color, bg }) => (
    <Card 
        className="border-0 h-100" 
        style={{ 
            borderRadius: '16px', 
            background: bg, 
            boxShadow: '0 4px 15px rgba(0,0,0,0.07)' 
        }}
    >
        <Card.Body className="d-flex align-items-center gap-3 p-3">
            <div 
                style={{ 
                    width: 48, height: 48, borderRadius: '12px', 
                    background: color, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', 
                    flexShrink: 0 
                }}
            >
                <Icon style={{ color: '#fff', fontSize: '1.3rem' }} />
            </div>
            <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.1 }}>
                    {value}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                    {label}
                </div>
            </div>
        </Card.Body>
    </Card>
);

// --- Composant de pagination ---
const CustomPagination = ({ currentPage, totalPages, onPageChange }) => {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(0, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }
    
    return (
        <Pagination size="sm" className="mb-0">
            <Pagination.First 
                onClick={() => onPageChange(0)} 
                disabled={currentPage === 0} 
            />
            <Pagination.Prev 
                onClick={() => onPageChange(currentPage - 1)} 
                disabled={currentPage === 0} 
            />
            
            {startPage > 0 && <Pagination.Ellipsis />}
            
            {pages.map(page => (
                <Pagination.Item
                    key={page}
                    active={page === currentPage}
                    onClick={() => onPageChange(page)}
                >
                    {page + 1}
                </Pagination.Item>
            ))}
            
            {endPage < totalPages - 1 && <Pagination.Ellipsis />}
            
            <Pagination.Next 
                onClick={() => onPageChange(currentPage + 1)} 
                disabled={currentPage === totalPages - 1} 
            />
            <Pagination.Last 
                onClick={() => onPageChange(totalPages - 1)} 
                disabled={currentPage === totalPages - 1} 
            />
        </Pagination>
    );
};

const PERIODS = [
    { label: '7 jours', value: 7 },
    { label: '30 jours', value: 30 },
    { label: '90 jours', value: 90 },
    { label: 'Tout', value: 0 },
];

// Options pour le nombre de produits à afficher dans le graphique
const TOP_N_OPTIONS = [
    { label: 'Top 10', value: 10 },
    { label: 'Top 20', value: 20 },
    { label: 'Top 50', value: 50 },
    { label: 'Top 100', value: 100 },
];

const HistoriqueArriveesChart = () => {
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(0);
    const [topN, setTopN] = useState(20);
    const [sortField, setSortField] = useState('total_arrivees');
    const [sortDirection, setSortDirection] = useState('desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [tableCurrentPage, setTableCurrentPage] = useState(0);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getHistoriqueArrivees();
                console.log('Données brutes du graphique:', result);
                
                const formatted = result.map(item => ({
                    id_arrivage: item.id_arrivage,
                    id_produit: item.id_produit,
                    nom_produit: item.nom_produit || item.produit?.nom_produit || 'N/A',
                    quantite_arrivee: item.quantite_arrivee || 0,
                    quantite_en_stock: item.quantite_en_stock || item.produit?.quantite_en_stock || 0,
                    ancienne_quantite_stock: item.ancienne_quantite_stock || 0,
                    date_arrivee: item.date_arrivee,
                }));
                
                console.log('Données formatées:', formatted);
                setRawData(formatted);
            } catch (err) {
                console.error('Erreur chargement:', err);
                setError(`Impossible de charger les données : ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filtrage par période
    const filteredData = useMemo(() => {
        if (period === 0) return rawData;
        const cutoff = moment().subtract(period, 'days').startOf('day');
        return rawData.filter(item => moment(item.date_arrivee).isSameOrAfter(cutoff));
    }, [rawData, period]);

    // Agrégation des données par produit
    const aggregatedData = useMemo(() => {
        if (!filteredData.length) return [];
        
        const map = new Map();
        filteredData.forEach(item => {
            const productName = item.nom_produit;
            if (!productName || productName === 'N/A') return;
            
            if (!map.has(productName)) {
                map.set(productName, {
                    nom_produit: productName,
                    total_arrivees: 0,
                    quantite_en_stock_actuel: item.quantite_en_stock || 0,
                    stock_precedent: 0,
                    nombre_mouvements: 0,
                    dernier_arrivage: item.date_arrivee,
                    id_produit: item.id_produit,
                });
            }
            
            const product = map.get(productName);
            product.total_arrivees += item.quantite_arrivee || 0;
            product.quantite_en_stock_actuel = item.quantite_en_stock || product.quantite_en_stock_actuel;
            product.stock_precedent = item.ancienne_quantite_stock || product.stock_precedent;
            product.nombre_mouvements++;
            product.dernier_arrivage = item.date_arrivee;
            product.id_produit = item.id_produit;
        });
        
        return Array.from(map.values());
    }, [filteredData]);

    // Tri et recherche des données pour le tableau
    const sortedAndFilteredData = useMemo(() => {
        let data = [...aggregatedData];
        
        // Recherche
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            data = data.filter(item => 
                item.nom_produit.toLowerCase().includes(term)
            );
        }
        
        // Tri
        data.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        return data;
    }, [aggregatedData, searchTerm, sortField, sortDirection]);

    // Données paginées pour le tableau
    const paginatedTableData = useMemo(() => {
        const start = tableCurrentPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return sortedAndFilteredData.slice(start, end);
    }, [sortedAndFilteredData, tableCurrentPage]);

    const totalPages = Math.ceil(sortedAndFilteredData.length / ITEMS_PER_PAGE);

    // Données pour le graphique (Top N)
    const chartData = useMemo(() => {
        return aggregatedData
            .sort((a, b) => b.total_arrivees - a.total_arrivees)
            .slice(0, topN);
    }, [aggregatedData, topN]);

    // KPI
    const kpis = useMemo(() => {
        const totalArrivees = filteredData.reduce((sum, item) => sum + (item.quantite_arrivee || 0), 0);
        const produitsDistincts = new Set(filteredData.map(item => item.nom_produit)).size;
        
        const stockParProduit = {};
        filteredData.forEach(item => {
            if (item.nom_produit && item.nom_produit !== 'N/A') {
                stockParProduit[item.nom_produit] = item.quantite_en_stock;
            }
        });
        const stockTotal = Object.values(stockParProduit).reduce((sum, stock) => sum + stock, 0);
        const stockMoyen = Object.keys(stockParProduit).length > 0 
            ? Math.round(stockTotal / Object.keys(stockParProduit).length)
            : 0;
        
        const dernierArrivage = filteredData.length > 0 && filteredData[0]?.date_arrivee
            ? moment(filteredData[0].date_arrivee).format('DD/MM/YY')
            : '—';
            
        return { totalArrivees, produitsDistincts, stockMoyen, dernierArrivage };
    }, [filteredData]);

    // Configuration du graphique
    const chartConfig = {
        labels: chartData.map(item => item.nom_produit),
        datasets: [
            {
                label: 'Total Arrivées',
                data: chartData.map(item => item.total_arrivees || 0),
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                borderRadius: 4,
            },
            {
                label: 'Stock Actuel',
                data: chartData.map(item => item.quantite_en_stock_actuel || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2,
                borderRadius: 4,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { size: 12, weight: 'bold' },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle',
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw.toLocaleString()} unité(s)`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    maxRotation: 45,
                    minRotation: 30,
                    font: { size: 10 }
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Quantité',
                    font: { size: 12, weight: 'bold' }
                },
                grid: {
                    color: 'rgba(0,0,0,0.06)',
                    drawBorder: false,
                },
                beginAtZero: true,
            }
        }
    };

    // Gestion du tri
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
        setTableCurrentPage(0);
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <FaSort className="text-muted ms-1" size={12} />;
        return sortDirection === 'asc' 
            ? <FaSortUp className="text-primary ms-1" size={12} />
            : <FaSortDown className="text-primary ms-1" size={12} />;
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="text-center">
                    <Spinner animation="grow" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <p className="text-muted mt-3 small">Chargement des données...</p>
                </div>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="p-4">
                <Alert variant="danger" className="rounded-3 border-0 shadow-sm">
                    <Alert.Heading className="fs-6 fw-bold">⚠️ Erreur de chargement</Alert.Heading>
                    <p className="mb-0 small">{error}</p>
                </Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="p-0">
            {/* En-tête */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                <div>
                    <h5 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-0.3px' }}>
                        Analyse des Mouvements de Stock
                    </h5>
                    <p className="text-muted small mb-0">
                        {aggregatedData.length} produits distincts - {filteredData.length} enregistrements
                    </p>
                </div>
                <ButtonGroup size="sm">
                    {PERIODS.map(p => (
                        <Button
                            key={p.value}
                            variant={period === p.value ? 'primary' : 'outline-secondary'}
                            onClick={() => { 
                                setPeriod(p.value); 
                                setTableCurrentPage(0);
                            }}
                            style={{ 
                                borderRadius: period === p.value ? '8px' : undefined, 
                                fontWeight: 600, 
                                fontSize: '0.78rem' 
                            }}
                        >
                            {p.label}
                        </Button>
                    ))}
                </ButtonGroup>
            </div>

            {/* KPI Cards */}
            <Row className="g-3 mb-4">
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaBoxOpen} 
                        label="Total Arrivées" 
                        value={kpis.totalArrivees.toLocaleString()} 
                        color="linear-gradient(135deg, #6366f1, #818cf8)" 
                        bg="linear-gradient(135deg, #eef2ff, #f5f3ff)" 
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaCubes} 
                        label="Produits Distincts" 
                        value={kpis.produitsDistincts} 
                        color="linear-gradient(135deg, #10b981, #34d399)" 
                        bg="linear-gradient(135deg, #ecfdf5, #f0fdf4)" 
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaWarehouse} 
                        label="Stock Moyen" 
                        value={kpis.stockMoyen.toLocaleString()} 
                        color="linear-gradient(135deg, #f59e0b, #fbbf24)" 
                        bg="linear-gradient(135deg, #fffbeb, #fefce8)" 
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaChartLine} 
                        label="Dernier Arrivage" 
                        value={kpis.dernierArrivage} 
                        color="linear-gradient(135deg, #0ea5e9, #38bdf8)" 
                        bg="linear-gradient(135deg, #f0f9ff, #e0f2fe)" 
                    />
                </Col>
            </Row>

            {/* Section Graphique */}
            <Card className="border-0 mb-4" style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Card.Body className="p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">Top des produits par arrivées</h6>
                            <p className="text-muted small mb-0">Stock actuel vs arrivées cumulées</p>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <Form.Select 
                                size="sm" 
                                className="w-auto"
                                value={topN}
                                onChange={(e) => setTopN(Number(e.target.value))}
                                style={{ borderRadius: '8px' }}
                            >
                                {TOP_N_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Form.Select>
                            <Badge 
                                bg="light" 
                                text="dark" 
                                className="px-3 py-2 rounded-pill"
                                style={{ fontSize: '0.72rem', fontWeight: 700, border: '1px solid #e2e8f0' }}
                            >
                                {chartData.length} produits affichés
                            </Badge>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div style={{ height: '400px' }}>
                            <Bar data={chartConfig} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="text-center py-5">
                            <p className="text-muted small">Aucune donnée pour cette période.</p>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Section Tableau */}
            <Card className="border-0" style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Card.Body className="p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">Liste détaillée des produits</h6>
                            <p className="text-muted small mb-0">
                                {sortedAndFilteredData.length} produits trouvés
                            </p>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="position-relative">
                                <FaSearch className="position-absolute text-muted" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <Form.Control
                                    size="sm"
                                    type="text"
                                    placeholder="Rechercher un produit..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setTableCurrentPage(0);
                                    }}
                                    style={{ 
                                        paddingLeft: '32px', 
                                        borderRadius: '10px',
                                        width: '250px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                            <Badge 
                                bg="light" 
                                text="dark" 
                                className="px-3 py-2 rounded-pill"
                                style={{ fontSize: '0.72rem', fontWeight: 700, border: '1px solid #e2e8f0' }}
                            >
                                {paginatedTableData.length} / {sortedAndFilteredData.length}
                            </Badge>
                        </div>
                    </div>

                    <div className="modern-datatable-wrapper">
                        <div className="table-responsive">
                            <table className="modern-datatable">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('nom_produit')}>
                                            <div className="th-content">
                                                <span>Produit</span>
                                                <SortIcon field="nom_produit" />
                                            </div>
                                        </th>
                                        <th className="text-end" onClick={() => handleSort('total_arrivees')}>
                                            <div className="th-content">
                                                <span>Total Arrivées</span>
                                                <SortIcon field="total_arrivees" />
                                            </div>
                                        </th>
                                        <th className="text-end" onClick={() => handleSort('quantite_en_stock_actuel')}>
                                            <div className="th-content">
                                                <span>Stock Actuel</span>
                                                <SortIcon field="quantite_en_stock_actuel" />
                                            </div>
                                        </th>
                                        <th className="text-end" onClick={() => handleSort('stock_precedent')}>
                                            <div className="th-content">
                                                <span>Stock Précédent</span>
                                                <SortIcon field="stock_precedent" />
                                            </div>
                                        </th>
                                        <th className="text-end" onClick={() => handleSort('nombre_mouvements')}>
                                            <div className="th-content">
                                                <span>Mouvements</span>
                                                <SortIcon field="nombre_mouvements" />
                                            </div>
                                        </th>
                                        <th className="text-end">
                                            <div className="th-content">
                                                <span>Dernier Arrivage</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTableData.length > 0 ? (
                                        paginatedTableData.map((item, index) => (
                                            <tr key={item.id_produit || index}>
                                                <td>
                                                    <div className="product-cell">
                                                        <div className="product-avatar">
                                                            {item.nom_produit.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="product-name">{item.nom_produit}</span>
                                                    </div>
                                                </td>
                                                <td className="text-end">
                                                    <span className="data-pill primary">
                                                        {item.total_arrivees.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <span className="data-pill success">
                                                        {item.quantite_en_stock_actuel.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <span className="data-value">{item.stock_precedent.toLocaleString()}</span>
                                                </td>
                                                <td className="text-end">
                                                    <span className="movement-badge">
                                                        {item.nombre_mouvements}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <span className="date-value">
                                                        {item.dernier_arrivage ? moment(item.dernier_arrivage).format('DD/MM/YY HH:mm') : '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="empty-row">
                                            <td colSpan="6">
                                                <div className="empty-state">
                                                    <div className="empty-icon">📦</div>
                                                    <p>Aucun produit trouvé</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {sortedAndFilteredData.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-4">
                            <div className="text-muted small" style={{ fontSize: '0.8rem' }}>
                                Affichage de {tableCurrentPage * ITEMS_PER_PAGE + 1} à {Math.min((tableCurrentPage + 1) * ITEMS_PER_PAGE, sortedAndFilteredData.length)} sur {sortedAndFilteredData.length} produits
                            </div>
                            <CustomPagination
                                currentPage={tableCurrentPage}
                                totalPages={totalPages}
                                onPageChange={setTableCurrentPage}
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default HistoriqueArriveesChart;