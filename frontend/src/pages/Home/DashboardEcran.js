import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Chart from 'react-apexcharts';
import { FaDesktop, FaRedo, FaChartPie, FaChartLine, FaTrophy, FaExclamationTriangle } from 'react-icons/fa';
import { fetchEcranStats } from '../../services/api';
import { ecranTheme, ecranChartConfig, ecranLabels } from './DashboardEcranTheme';
import './DashboardEcran.css';
const labels = ecranLabels.fr;

const EcranChart = () => {
    const [totalEcran, setTotalEcran] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [, setSeriesData] = useState([]);
    const [, setChartLabels] = useState([]);
    const [hoveredBrand, setHoveredBrand] = useState(null);

    const [chartType, setChartType] = useState('line');
    const [animated, setAnimated] = useState(false);

    const [pieChartData, setPieChartData] = useState({
        series: [],
        options: {
            chart: {
                type: 'donut', fontFamily: 'Inter, system-ui, sans-serif',
                animations: {
                    enabled: true, easing: 'easeinout', speed: 800
                }
            },
            colors: ecranTheme.colors, labels: [],
            dataLabels: {
                enabled: true,
                formatter: (val) => `${val.toFixed(1)}%`,
                style: {
                    fontSize: '11px', colors: ['#c7bfbf']
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: ecranChartConfig.pie.donut.size,
                        labels: {
                            show: true,
                            name: {
                                show: true, color: ecranTheme.textSub, fontSize: '12px'
                            },
                            value: {
                               show: true, color: ecranTheme.textMain, fontSize: '14px', fontWeight: 700, formatter: (val) => `${val}`
                            },
                            total: {
                               show: true, label: labels.total, color: ecranTheme.textSub,
                                formatter: (w) => {
                                    return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                }
                            }
                        }
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                y: { formatter: (val) => `${val} unités` }
            },
            legend: {
                show: false
            },
            stroke: {
                width: ecranChartConfig.pie.stroke.width,
                colors: ecranChartConfig.pie.stroke.colors
            }
        }
    });

    const [chartData, setChartData] = useState({
        series: [],
        options: {
            chart: {
                type: 'line', height: ecranChartConfig.line.height, width: '100%', fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false }, zoom: { enabled: false },
                animations: {
                    enabled: true, easing: 'easeinout', speed: 800,
                    animateGradually: {
                        enabled: true,
                        delay: 150
                    }
                }
            },
            stroke: {
                curve: ecranChartConfig.line.stroke.curve,
                width: ecranChartConfig.line.stroke.width
            },
            colors: ecranTheme.colors,
            xaxis: {
                categories: [],
                labels: {
                    style: { colors: ecranTheme.textSub, fontSize: '11px', fontWeight: 600 },
                    rotate: -45,
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: {
                    text: "Nombre d'écrans",
                    style: { color: ecranTheme.textSub, fontSize: '13px', fontWeight: 600 }
                },
                labels: { style: { colors: ecranTheme.textSub } }
            },
            dataLabels: {
                enabled: true, offsetY: -10,
                style: {
                    fontSize: '11px',
                    colors: [ecranTheme.textMain]
                },
                background: {
                    enabled: true, foreColor: '#000000', padding: 6, borderRadius: 4, borderWidth: 1, borderColor: ecranTheme.border,
                },
            },
            grid: {
                borderColor: ecranTheme.border,
                strokeDashArray: ecranChartConfig.line.grid.strokeDashArray,
            },
            markers: {
                size: ecranChartConfig.line.markers.size, colors: ecranTheme.colors, strokeColors: '#fff', strokeWidth: ecranChartConfig.line.markers.strokeWidth,
                hover: { size: ecranChartConfig.line.markers.hover.size }
            },
            tooltip: {
                theme: 'dark',
                y: { formatter: (val) => `${val} unités` },
                x: { show: true }
            },
            legend: {
                show: false
            }
        }
    });

    const handleRetry = useCallback(() => {
        setLoading(true);
        setError(null);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await fetchEcranStats();
            
            const brandCounts = {};
            data.forEach(item => {
                const brandName = item.ecran; 
                if (brandName) {
                    brandCounts[brandName] = (brandCounts[brandName] || 0) + 1;
                }
            });

            const total = data.length > 0 
                ? parseInt(data.nombre_total_lignes || data.length, 10) 
                : 0;
            setTotalEcran(total); 

            const labelsArray = Object.keys(brandCounts);
            const counts = Object.values(brandCounts);

            setChartLabels(labelsArray);
            setSeriesData([{
                name: "Nombre d'écrans",
                data: counts
            }]);

            setChartData(prev => ({
                series: [{
                    name: "Nombre d'écrans",
                    data: counts
                }],
                options: {
                    ...prev.options,
                    xaxis: {
                        ...prev.options.xaxis,
                        categories: labelsArray
                    }
                }
            }));

            setPieChartData(prev => ({
                ...prev,
                series: counts,
                options: {
                    ...prev.options,
                    labels: labelsArray
                }
            }));

            setLoading(false);
            setAnimated(true);
            
        } catch (error) {
            console.error("Erreur lors de la récupération des données:", error);
            setError(error.message || "Erreur de chargement des écrans");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const data = chartData.series[0]?.data || [];
        const categories = chartData.options.xaxis.categories || [];
        
        if (data.length === 0) return null;

        const total = data.reduce((a, b) => a + b, 0);
        const maxCount = Math.max(...data, 0);
        const minCount = Math.min(...data.filter(d => d > 0), 0);
        const avgCount = (total / data.length).toFixed(1);
        const dominantBrand = categories[data.indexOf(maxCount)] || '';
        const uniqueBrands = categories.length;

        return { 
            total, maxCount, minCount, avgCount, dominantBrand, uniqueBrands
        };
    }, [chartData]);

    const getPercentage = useCallback((count) => {
        const total = totalEcran;
        return total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    }, [totalEcran]);

    const getBrandColor = (index) => ecranTheme.colors[index % ecranTheme.colors.length];

    const legendData = useMemo(() => {
        return chartData.series.length > 0 
            ? chartData.series[0].data.map((value, index) => ({
                name: chartData.options.xaxis.categories[index],
                value: value,
                percentage: getPercentage(value),
                color: getBrandColor(index)
            }))
            : [];
    }, [chartData, getPercentage]);

    if (loading) return (
        <div className="ecran-container" role="status" aria-live="polite">
            <div className="ecran-loading">
                <div className="ecran-loading-spinner" aria-hidden="true"></div>
                <span className="ecran-loading-text">{labels.loading}</span>
            </div>
        </div>
    );

    if (error) return (
        <div className="ecran-container ecran-error" role="alert">
            <div className="ecran-error-content">
                <FaExclamationTriangle size={32} className="ecran-error-icon" aria-hidden="true" />
                <h4>{labels.error}</h4>
                <p>{error}</p>
                <button className="ecran-retry-btn" onClick={handleRetry} aria-label={labels.retry} >
                    <FaRedo aria-hidden="true" /> {labels.retry}
                </button>
            </div>
        </div>
    );

    return (
        <div className={`ecran-container ${animated ? 'ecran-animated' : ''}`}>
            <header className="ecran-header">
                <div className="ecran-header-left">
                    <div className="ecran-icon-box" aria-hidden="true">
                        <FaDesktop size={22} />
                    </div>
                    <div>
                        <h3 className="ecran-title">{labels.title}</h3>
                        <span className="ecran-subtitle">{labels.subtitle}</span>
                    </div>
                </div>
                <div className="ecran-header-right">
                    <div className="ecran-chart-toggle" role="group" aria-label="Type de graphique" >
                        <button
                            className={`ecran-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                            onClick={() => setChartType('line')}
                            aria-pressed={chartType === 'line'}
                            title={labels.lineChart}
                        >
                            <FaChartLine size={14} aria-hidden="true" />
                        </button>
                        <button
                            className={`ecran-toggle-btn ${chartType === 'donut' ? 'active' : ''}`}
                            onClick={() => setChartType('donut')}
                            aria-pressed={chartType === 'donut'}
                            title={labels.donutChart}
                        >
                            <FaChartPie size={14} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            {stats && (
                <section className="ecran-stats-grid" aria-label="Statistiques" >
                    <article className="ecran-stat-card">
                        <div 
                            className="ecran-stat-icon" 
                            style={{ background: `${ecranTheme.primary}20` }}
                            aria-hidden="true"
                        >
                            <FaTrophy size={16} color={ecranTheme.primary} />
                        </div>
                        <div className="ecran-stat-content">
                            <span className="ecran-stat-label">{labels.dominantBrand}</span>
                            <span className="ecran-stat-value">{stats.dominantBrand}</span>
                        </div>
                    </article>
                    
                    <article className="ecran-stat-card">
                        <div className="ecran-stat-icon" style={{ background: `${ecranTheme.success}20` }} aria-hidden="true" >
                            <FaDesktop size={16} color={ecranTheme.success} />
                        </div>
                        <div className="ecran-stat-content">
                            <span className="ecran-stat-label">{labels.avgByBrand}</span>
                            <span className="ecran-stat-value">{stats.avgCount}</span>
                        </div>
                    </article>
                    
                    <article className="ecran-stat-card">
                        <div className="ecran-stat-icon" style={{ background: `${ecranTheme.warning}20` }} aria-hidden="true" >
                            <FaChartPie size={16} color={ecranTheme.warning} />
                        </div>
                        <div className="ecran-stat-content">
                            <span className="ecran-stat-label">{labels.uniqueBrands}</span>
                            <span className="ecran-stat-value">{stats.uniqueBrands}</span>
                        </div>
                    </article>
                </section>
            )}
            
            <div 
                className="ecran-chart-wrapper"
                role="img"
                aria-label={`Graphique ${chartType === 'line' ? 'linéaire' : 'en secteurs'} des écrans`}
            >
                {chartType === 'line' ? (
                    <Chart
                        options={chartData.options}
                        series={chartData.series}
                        type="line"
                        height={ecranChartConfig.line.height}
                    />
                ) : (
                    <Chart
                        options={pieChartData.options}
                        series={pieChartData.series}
                        type="donut"
                        height={ecranChartConfig.line.height}
                    />
                )}
            </div>

            <nav className="ecran-legend" aria-label="Légende des marques" >
                {legendData.map((item) => {
                    const isHovered = hoveredBrand === item.name;
                    
                    return (
                        <div 
                            key={item.name}
                            className="ecran-legend-item"
                            style={{
                                background: isHovered ? `${item.color}25` : undefined,
                                borderColor: isHovered ? item.color : undefined,
                                boxShadow: isHovered ? `0 8px 20px ${item.color}30` : undefined
                            }}
                            onMouseEnter={() => setHoveredBrand(item.name)}
                            onMouseLeave={() => setHoveredBrand(null)}
                            role="listitem"
                            tabIndex={0}
                            aria-label={`${item.name}: ${item.value} unités (${item.percentage}%)`}
                        >
                            <div 
                                className="ecran-legend-color" 
                                style={{ 
                                    backgroundColor: item.color, 
                                    boxShadow: isHovered ? `0 2px 8px ${item.color}50` : undefined 
                                }}
                                aria-hidden="true"
                            />
                            <div className="ecran-legend-content">
                                <div className="ecran-legend-name">
                                    {item.name}
                                </div>
                                <div className="ecran-legend-percentage">
                                    {item.percentage}%
                                </div>
                            </div>
                            <div 
                                className="ecran-legend-value" 
                                style={{ color: item.color }}
                                aria-hidden="true"
                            >
                                {item.value}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div 
                className="ecran-total-card"
                style={{
                    transform: hoveredBrand ? 'scale(1.01)' : undefined
                }}
                role="region"
                aria-label={`${labels.total}: ${totalEcran} ${labels.units}`}
            >
                <div className="ecran-total-card-bg" aria-hidden="true" />
                <div className="ecran-total-card-left">
                    <div className="ecran-total-card-icon" aria-hidden="true">
                        <FaDesktop size={18} color={ecranTheme.primaryLight} />
                    </div>
                    <span className="ecran-total-card-label">{labels.total}</span>
                </div>
                <span className="ecran-total-card-value">
                    {totalEcran}
                    <small className="ecran-total-card-unit">{labels.units}</small>
                </span>
            </div>
        </div>
    );
};

export default EcranChart;
