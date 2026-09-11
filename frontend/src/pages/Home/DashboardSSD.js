import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Chart from 'react-apexcharts';
import { fetchSSDStats } from '../../services/api';
import { FaHdd, FaServer } from 'react-icons/fa';
import './DashboardSSD.css';

const THEME = {
  primary: '#6366f1', secondary: '#8b5cf6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', background: '#0f172a', cardBg: 'rgba(30, 41, 59, 0.8)', textMain: '#f8fafc', textSub: '#94a3b8',
  border: 'rgba(99, 102, 241, 0.2)',
  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  shadow: '0 8px 32px rgba(99, 102, 241, 0.15)',
  glow: '0 0 40px rgba(99, 102, 241, 0.3)',
};

const DISK_TYPES = {
  SSD: 'SSD',
  HDD: 'HDD',
  OTHER: 'Autre',
};

const detectDiskType = (capacity) => {
  if (!capacity || typeof capacity !== 'string') {
    return DISK_TYPES.OTHER;
  }
  
  const normalizedCapacity = capacity.toLowerCase();
  const isSSD = normalizedCapacity.includes('ssd') || 
                normalizedCapacity.includes('nvme') || 
                normalizedCapacity.includes('m.2');
  
  if (isSSD) return DISK_TYPES.SSD;
  
  const isHDD = normalizedCapacity === 'hdd' || 
                normalizedCapacity.includes('disque dur');
  
  return isHDD ? DISK_TYPES.HDD : DISK_TYPES.OTHER;
};

const filterDataByDiskType = (data, diskType) => {
  if (!Array.isArray(data)) return [];
  return data.filter(item => detectDiskType(item.capacite_stockage) === diskType);
};

const calculateTotalByDiskType = (data, diskType) => {
  return filterDataByDiskType(data, diskType)
    .reduce((sum, item) => sum + (parseInt(item.nombre_total, 10) || 0), 0);
};

const formatCapacity = (capacity) => capacity?.trim() || 'Non spécifié';

const parseQuantity = (value) => parseInt(value, 10) || 0;

const createCapacityChartOptions = (categories) => ({
  chart: {
    type: 'bar', height: 280, fontFamily: "'Inter', 'Segoe UI', sans-serif", toolbar: { show: false }, background: 'transparent',
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
      animateGradually: { enabled: true, delay: 150 },
      dynamicAnimation: { enabled: true, speed: 350 }
    },
    dropShadow: {
      enabled: true, top: 4, left: 0, blur: 12, opacity: 0.3, color: THEME.primary
    }
  },
  plotOptions: {
    bar: {
     barHeight: '60%', horizontal: true, borderRadius: 8, borderRadiusApplication: 'end', dataLabels: { position: 'center' }, distributed: true,
    }
  },
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'dark', type: 'horizontal', shadeIntensity: 0.4, gradientToColors: [THEME.secondary], inverseColors: false, opacityFrom: 0.9, opacityTo: 0.9, stops: [0, 100],
      colorStops: [
        { offset: 0, color: THEME.primary, opacity: 1 },
        { offset: 100, color: THEME.secondary, opacity: 1 }
      ]
    }
  },
  colors: ['#6366f1', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e9d5ff'],
  dataLabels: {
    enabled: true,
    textAnchor: 'middle',
    style: {
      colors: ['#ffffff'],
      fontWeight: 700,
      fontSize: '12px'
    },
    formatter: (val) => val > 0 ? val : ''
  },
  stroke: { show: true, width: 0, colors: ['transparent'] },
  xaxis: {
    categories,
    labels: {
      show: true,
      style: { colors: THEME.textSub, fontSize: '11px', fontWeight: 500 },
      offsetY: 5
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      show: true,
      style: { colors: THEME.textSub, fontSize: '12px', fontWeight: 600 }
    }
  },
  grid: {
    show: true,
    borderColor: 'rgba(99, 102, 241, 0.1)',
    strokeDashArray: 4,
    padding: { top: 0, right: 0, bottom: 0, left: 10 }
  },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '13px' },
    y: { formatter: (val) => `${val} unités` }
  },
  legend: { show: false }
});

const createDiskTypeChartOptions = () => ({
  chart: {
    type: 'donut', fontFamily: "'Inter', 'Segoe UI', sans-serif", background: 'transparent',
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800
    }
  },
  labels: ['SSD', 'HDD', 'Autre'],
  colors: [THEME.primary, THEME.warning, THEME.textSub],
  stroke: {
    show: true,
    width: 3,
    colors: [THEME.background]
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '14px',
      fontWeight: 700,
      colors: ['#fff', '#fff', '#000']
    },
    formatter: (val, opts) => {
      const total = opts.w.globals.series.reduce((a, b) => a + b, 0);
      const count = opts.w.globals.series[opts.seriesIndex];
      return total > 0 ? `${count} (${val.toFixed(1)}%)` : count;
    },
    dropShadow: {
      enabled: true, top: 2, left: 2, blur: 4, opacity: 0.3
    }
  },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: {
            show: true, fontSize: '14px', fontWeight: 600, color: THEME.textMain, offsetY: -10
          },
          value: {
            show: true, fontSize: '28px', fontWeight: 800, color: THEME.textMain, offsetY: 5, formatter: (val) => val
          },
          total: {
            show: true, label: 'Total', fontSize: '14px', fontWeight: 600, color: THEME.textSub, formatter: (w) => w.globals.series.reduce((a, b) => a + b, 0)
          }
        }
      },
      expandOnClick: true
    }
  },
  tooltip: {
    enabled: true,
    theme: 'dark',
    style: { fontSize: '13px' },
    y: { formatter: (val) => `${val} disques` }
  },
  legend: {
    show: true, position: 'bottom', horizontalAlign: 'center',
    labels: {
      colors: [THEME.textMain, THEME.textMain, THEME.textSub],
      useSeriesColors: false
    },
    markers: {
      size: 10,
      shape: 'circle',
      radius: 4,
      offsetX: -4
    },
    itemMargin: { horizontal: 16, vertical: 8 },
    formatter: (val, opts) => ` ${val}: ${opts.w.globals.series[opts.seriesIndex]}`
  },
  responsive: [{
    breakpoint: 480,
    options: {
      chart: { width: 280 },
      legend: { position: 'bottom' }
    }
  }]
});

const LoadingState = () => (
  <div className="dashboard-ssd-loading-state">
    <div className="dashboard-ssd-loading-spinner"></div>
    <p className="dashboard-ssd-loading-text">Chargement des données de stockage...</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="dashboard-ssd-error-state">
    <p className="dashboard-ssd-error-text">⚠️ Erreur: {message}</p>
    <button onClick={onRetry} className="dashboard-ssd-retry-button">
      Réessayer
    </button>
  </div>
);

const EmptyState = () => (
  <div className="dashboard-ssd-empty-state">
    <FaServer className="dashboard-ssd-empty-icon" />
    <p className="dashboard-ssd-empty-text">Aucune donnée de stockage disponible</p>
  </div>
);

const StatBadge = ({ type, count, percentage, themeColor }) => (
  <div className={`dashboard-ssd-stat-badge dashboard-ssd-stat-badge-${type}`}>
    <div className="dashboard-ssd-stat-icon" style={{ background: themeColor }}>
      <FaHdd style={{ color: '#fff', fontSize: 14 }} />
    </div>
    <div className="dashboard-ssd-stat-info">
      <p className="dashboard-ssd-stat-label">{type.toUpperCase()}</p>
      <p className="dashboard-ssd-stat-value">{count}</p>
      <p className="dashboard-ssd-stat-percentage">{percentage}%</p>
    </div>
  </div>
);

const DashboardSSD = () => {
  const [storageData, setStorageData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  
  const [capacityChartSeries, setCapacityChartSeries] = useState([{ name: 'SSD', data: [] }]);
  const [capacityChartOptions, setCapacityChartOptions] = useState(null);
  
  const [diskTypeChartSeries, setDiskTypeChartSeries] = useState([]);
  const [diskTypeChartOptions, setDiskTypeChartOptions] = useState(null);

  const storageStats = useMemo(() => {
    const totalSSD = calculateTotalByDiskType(storageData, DISK_TYPES.SSD);
    const totalHDD = calculateTotalByDiskType(storageData, DISK_TYPES.HDD);
    const totalDisks = totalSSD + totalHDD;
    const ssdPercentage = totalDisks > 0 ? ((totalSSD / totalDisks) * 100).toFixed(1) : 0;
    const hddPercentage = totalDisks > 0 ? ((totalHDD / totalDisks) * 100).toFixed(1) : 0;
    
    return { totalSSD, totalHDD, totalDisks, ssdPercentage, hddPercentage };
  }, [storageData]);

  const capacityChartConfig = useMemo(() => {
    const ssdData = filterDataByDiskType(storageData, DISK_TYPES.SSD);
    const categories = ssdData.map(item => formatCapacity(item.capacite_stockage));
    return createCapacityChartOptions(categories);
  }, [storageData]);

  const diskTypeChartConfig = useMemo(() => createDiskTypeChartOptions(), []);

  const loadStorageData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const data = await fetchSSDStats();
      setStorageData(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.response?.status === 404 
        ? 'Aucune donnée trouvée' 
        : err.message || 'Impossible de charger les données';
      
      setErrorMessage(message);
      console.error('Erreur lors du chargement des données SSD:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorageData();
  }, [loadStorageData]);

  useEffect(() => {
    if (storageData.length === 0) {
      setCapacityChartOptions(capacityChartConfig);
      setDiskTypeChartSeries([0, 0, 0]);
      setDiskTypeChartOptions(diskTypeChartConfig);
      return;
    }

    const ssdData = filterDataByDiskType(storageData, DISK_TYPES.SSD);
    const seriesData = ssdData.map(item => parseQuantity(item.nombre_total));

    setCapacityChartSeries([{ name: 'SSD', data: seriesData }]);
    setCapacityChartOptions(capacityChartConfig);

    const counts = [
      storageStats.totalSSD,
      storageStats.totalHDD,
      calculateTotalByDiskType(storageData, DISK_TYPES.OTHER)
    ];
    
    setDiskTypeChartSeries(counts);
    setDiskTypeChartOptions(diskTypeChartConfig);

  }, [storageData, storageStats, capacityChartConfig, diskTypeChartConfig]);

  const renderContent = () => {
    if (isLoading) return <LoadingState />;
    if (errorMessage) return <ErrorState message={errorMessage} onRetry={loadStorageData} />;
    if (storageData.length === 0) return <EmptyState />;

    return (
      <>
        <div className="dashboard-ssd-charts-container">
          <div className="dashboard-ssd-chart-card">
            <h4 className="dashboard-ssd-chart-title">
              <span className="dashboard-ssd-indicator-primary">●</span> Répartition SSD / HDD
            </h4>
            <div className="dashboard-ssd-chart-wrapper">
              {diskTypeChartOptions && diskTypeChartSeries.length > 0 && (
                <Chart
                  options={diskTypeChartOptions}
                  series={diskTypeChartSeries}
                  type="donut"
                  height={380}
                />
              )}
            </div>
          </div>

          <div className="dashboard-ssd-chart-card">
            <h4 className="dashboard-ssd-chart-title">
              <span className="dashboard-ssd-indicator-secondary">●</span> Capacités SSD
            </h4>
            <div className="dashboard-ssd-chart-wrapper">
              {capacityChartOptions && (
                <Chart
                  options={capacityChartOptions}
                  series={capacityChartSeries}
                  type="bar"
                  height={380}
                />
              )}
            </div>
          </div>
        </div>

        {storageStats.totalDisks > 0 && (
          <div className="dashboard-ssd-stats-modern">
            <div className="dashboard-ssd-stat-card ssd">
              <div className="dashboard-ssd-stat-card-header">
                <div className="dashboard-ssd-stat-icon-modern" style={{ background: THEME.primary }}>
                  <FaHdd style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <span className="dashboard-ssd-stat-type">SSD</span>
              </div>
              <div className="dashboard-ssd-stat-card-body">
                <span className="dashboard-ssd-stat-count">{storageStats.totalSSD}</span>
                <div className="dashboard-ssd-progress-bar">
                  <div 
                    className="dashboard-ssd-progress-fill" 
                    style={{ 
                      width: `${storageStats.ssdPercentage}%`,
                      background: THEME.primary 
                    }} 
                  />
                </div>
                <span className="dashboard-ssd-stat-percent">{storageStats.ssdPercentage}%</span>
              </div>
            </div>

            <div className="dashboard-ssd-stat-card hdd">
              <div className="dashboard-ssd-stat-card-header">
                <div className="dashboard-ssd-stat-icon-modern" style={{ background: THEME.warning }}>
                  <FaHdd style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <span className="dashboard-ssd-stat-type">HDD</span>
              </div>
              <div className="dashboard-ssd-stat-card-body">
                <span className="dashboard-ssd-stat-count">{storageStats.totalHDD}</span>
                <div className="dashboard-ssd-progress-bar">
                  <div 
                    className="dashboard-ssd-progress-fill" 
                    style={{ 
                      width: `${storageStats.hddPercentage}%`,
                      background: THEME.warning 
                    }} 
                  />
                </div>
                <span className="dashboard-ssd-stat-percent">{storageStats.hddPercentage}%</span>
              </div>
            </div>

            <div className="dashboard-ssd-system-status">
              <div className="dashboard-ssd-status-pulse"></div>
              <div className="dashboard-ssd-status-text">
                <span className="dashboard-ssd-status-label">Système</span>
                <span className="dashboard-ssd-status-value">Actif</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="dashboard-ssd-container">
      <div className="dashboard-ssd-header">
        <div className="dashboard-ssd-icon-container">
          <FaHdd className="dashboard-ssd-icon" />
        </div>
        <div className="dashboard-ssd-title-block">
          <h3 className="dashboard-ssd-title">Dashboard Stockage</h3>
          <p className="dashboard-ssd-subtitle">Statistiques des disques SSD et HDD</p>
        </div>
      </div>

      {renderContent()}
    </div>
  );
};

export default DashboardSSD;
