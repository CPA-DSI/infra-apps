// HistoriqueArriveesChart.js - Version Top N

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Container, Card, Spinner, Alert, Badge, Row, Col, 
  ButtonGroup, Button, Form 
} from 'react-bootstrap';
import Chart from 'react-apexcharts';
import {
  FaBoxOpen, FaCubes, FaChartLine, FaWarehouse
} from 'react-icons/fa';
import { getHistoriqueArrivees } from '../../services/api';
import dayjs from 'dayjs';
import './HistoriqueArriveesChart.css';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrAfter);

// ApexCharts a besoin de vraies couleurs : on lit les tokens de styles/theme.css
const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// --- Composant KPI Card (variant : primary | success | warning | info) ---
const KpiCard = ({ icon: Icon, label, value, variant }) => (
    <Card className={`border-0 h-100 hac-kpi hac-kpi--${variant}`}>
        <Card.Body className="d-flex align-items-center gap-3 p-3">
            <div className="hac-kpi__icon" aria-hidden="true">
                <Icon />
            </div>
            <div>
                <div className="hac-kpi__value">
                    {value}
                </div>
                <div className="hac-kpi__label">
                    {label}
                </div>
            </div>
        </Card.Body>
    </Card>
);

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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getHistoriqueArrivees();

                const formatted = result.map(item => ({
                    id_arrivage: item.id_arrivage,
                    id_produit: item.id_produit,
                    nom_produit: item.nom_produit || item.produit?.nom_produit || 'N/A',
                    quantite_arrivee: item.quantite_arrivee || 0,
                    quantite_en_stock: item.quantite_en_stock || item.produit?.quantite_en_stock || 0,
                    ancienne_quantite_stock: item.ancienne_quantite_stock || 0,
                    date_arrivee: item.date_arrivee,
                }));
                
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
        const cutoff = dayjs().subtract(period, 'day').startOf('day');
        return rawData.filter(item => dayjs(item.date_arrivee).isSameOrAfter(cutoff));
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
            ? dayjs(filteredData[0].date_arrivee).format('DD/MM/YY')
            : '—';
            
        return { totalArrivees, produitsDistincts, stockMoyen, dernierArrivage };
    }, [filteredData]);

    // Configuration du graphique (ApexCharts)
    const chartSeries = useMemo(() => [
        { name: 'Total Arrivées', data: chartData.map(item => item.total_arrivees || 0) },
        { name: 'Stock Actuel', data: chartData.map(item => item.quantite_en_stock_actuel || 0) },
    ], [chartData]);

    const chartOptions = useMemo(() => ({
        chart: {
            toolbar: { show: false },
            fontFamily: 'inherit',
        },
        plotOptions: {
            bar: { borderRadius: 4, columnWidth: '70%' },
        },
        dataLabels: { enabled: false },
        colors: [cssVar('--color-primary', '#6366f1'), cssVar('--color-success', '#10b981')],
        xaxis: {
            categories: chartData.map(item => item.nom_produit),
            labels: {
                rotate: -45,
                style: { fontSize: '10px' },
            },
        },
        yaxis: {
            title: { text: 'Quantité', style: { fontSize: '12px', fontWeight: 'bold' } },
        },
        legend: {
            position: 'top',
            markers: { shape: 'circle' },
        },
        grid: {
            borderColor: 'rgba(0,0,0,0.06)',
        },
        tooltip: {
            y: {
                formatter: (val) => `${val.toLocaleString()} unité(s)`,
            },
        },
    }), [chartData]);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center hac-chart-loading">
                <div className="text-center">
                    <Spinner animation="grow" variant="primary" />
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
                    <h5 className="fw-bold text-dark mb-1 hac-chart-title">
                        Analyse des Mouvements de Stock
                    </h5>
                    <p className="text-muted small mb-0">
                        {aggregatedData.length} produits distincts - {filteredData.length} enregistrements
                    </p>
                </div>
                <ButtonGroup size="sm" className="hac-period-group" aria-label="Période">
                    {PERIODS.map(p => (
                        <Button
                            key={p.value}
                            variant={period === p.value ? 'primary' : 'outline-secondary'}
                            onClick={() => setPeriod(p.value)}
                            className={`hac-period-btn ${period === p.value ? 'is-active' : ''}`}
                            aria-pressed={period === p.value}
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
                        variant="primary"
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaCubes} 
                        label="Produits Distincts" 
                        value={kpis.produitsDistincts} 
                        variant="success"
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaWarehouse} 
                        label="Stock Moyen" 
                        value={kpis.stockMoyen.toLocaleString()} 
                        variant="warning"
                    />
                </Col>
                <Col xs={6} md={3}>
                    <KpiCard 
                        icon={FaChartLine} 
                        label="Dernier Arrivage" 
                        value={kpis.dernierArrivage} 
                        variant="info"
                    />
                </Col>
            </Row>

            {/* Section Graphique */}
            <Card className="border-0 mb-4 hac-chart-card">
                <Card.Body className="p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">Top des produits par arrivées</h6>
                            <p className="text-muted small mb-0">Stock actuel vs arrivées cumulées</p>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <Form.Select 
                                size="sm" 
                                className="w-auto hac-chart-select"
                                aria-label="Nombre de produits affichés"
                                value={topN}
                                onChange={(e) => setTopN(Number(e.target.value))}
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
                                className="px-3 py-2 rounded-pill hac-chart-count"
                            >
                                {chartData.length} produits affichés
                            </Badge>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="hac-chart-area">
                            <Chart options={chartOptions} series={chartSeries} type="bar" height="100%" />
                        </div>
                    ) : (
                        <div className="text-center py-5">
                            <p className="text-muted small">Aucune donnée pour cette période.</p>
                        </div>
                    )}
                </Card.Body>
            </Card>

        </Container>
    );
};

export default HistoriqueArriveesChart;