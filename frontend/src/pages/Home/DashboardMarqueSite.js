import React, { useState, useEffect, useCallback, memo } from 'react';
import Chart from 'react-apexcharts';
import { fetchMaterielsByLocal } from '../../services/api';
import { FaWarehouse, FaThLarge, FaServer, FaSyncAlt, FaClock } from 'react-icons/fa';
import './DashboardMarqueSite.css';

const DashboardMarqueSite = () => {
  const [totalMateriels, setTotalMateriels] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localsData, setLocalsData] = useState({});
  const [hoveredLocal, setHoveredLocal] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const theme = {
    primary: '#6366f1',
    primaryLight: '#a5b4fc',
    secondary: '#4f46e5',
    bg: '#0f172a',
    bgSecondary: '#1e293b',
    bgTertiary: '#334155',
    textMain: '#f1f5f9',
    textSub: '#94a3b8',
    accent: '#312e81',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: '#334155',
    colors: ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#3b82f6']
  };

  const [chartData, setChartData] = useState({
    series: [],
    options: {}
  });

  useEffect(() => {
    const fetchDataAndProcess = async () => {
      try {
        setLoading(true);
        
        // Utilisation du pattern apiData comme demandé
        const apiData = await fetchMaterielsByLocal();

        // Vérifier que apiData est un tableau
        if (!Array.isArray(apiData)) {
          console.warn('Les données reçues ne sont pas un tableau:', apiData);
          setLoading(false);
          return;
        }

        // Filtrer les données vides et vérifier la structure
        const validData = apiData.filter(item => item && item.nom_local);
        
        if (validData.length === 0) {
          console.warn('Aucune donnée de local trouvée');
          setLocalsData({});
          setTotalMateriels(0);
          setLoading(false);
          return;
        }

        // Préparer les données pour le graphique
        const localCounts = {};
        let totalMaterielsCount = 0;
        
        apiData.forEach(item => {
          const localName = item.nom_local || 'Autre';
          const count = item.nombre_materiels || 0;
          localCounts[localName] = (localCounts[localName] || 0) + count;
          totalMaterielsCount += count;
        });

        setTotalMateriels(totalMaterielsCount);
        setLocalsData(localCounts);
        setLastUpdated(new Date());

        // Trier les locaux par nombre décroissant
        const sortedEntries = Object.entries(localCounts).sort((a, b) => b[1] - a[1]);
        const sortedLocalCounts = Object.fromEntries(sortedEntries);
        
        const localNames = Object.keys(sortedLocalCounts);
        const values = Object.values(sortedLocalCounts);

        // Configuration du graphique - Version sombre
        const options = {
          chart: {
            type: 'bar',
            height: 400,
            background: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif',
            toolbar: {
              show: false
            },
            animations: {
              enabled: true,
              easing: 'easeinout',
              speed: 1000,
              animateGradually: {
                enabled: true,
                delay: 150
              },
              dynamicAnimation: {
                enabled: true,
                speed: 350
              }
            }
          },
          colors: theme.colors,
          plotOptions: {
            bar: {
              borderRadius: 8,
              horizontal: false,
              columnWidth: '55%',
              dataLabels: {
                position: 'top'
              },
              distributed: false
            }
          },
          dataLabels: {
            enabled: true,
            style: {
              colors: ['#f1f5f9'],
              fontWeight: 'bold',
              fontSize: '12px'
            },
            offsetY: -20
          },
          xaxis: {
            categories: localNames,
            labels: {
              style: {
                colors: '#94a3b8',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif'
              },
              rotate: -45,
              rotateAlways: false
            },
            title: {
              text: 'Locaux',
              style: {
                color: '#94a3b8',
                fontSize: '14px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600
              }
            }
          },
          yaxis: {
            labels: {
              style: {
                colors: '#94a3b8',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif'
              },
              formatter: (val) => {
                return Math.round(val);
              }
            },
            title: {
              text: 'Nombre de matériel',
              style: {
                color: '#94a3b8',
                fontSize: '14px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600
              }
            }
          },
          title: {
            text: '',
            align: 'center',
            style: {
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#f1f5f9'
            }
          },
          subtitle: {
            text: '',
            align: 'center',
            style: {
              fontSize: '14px',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#94a3b8'
            }
          },
          legend: {
            show: false
          },
          tooltip: {
            enabled: true,
            theme: 'dark',
            style: {
              fontSize: '13px',
              background: '#1e293b',
              color: '#f1f5f9',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            y: {
              formatter: function (val) {
                return val + ' matériel(s)';
              }
            },
            marker: {
              show: true
            }
          },
          grid: {
            borderColor: '#334155',
            strokeDashArray: 4,
            xaxis: {
              lines: {
                show: false
              }
            },
            yaxis: {
              lines: {
                show: true
              }
            },
            padding: {
              top: 0,
              right: 10,
              bottom: 0,
              left: 10
            }
          },
          stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
          },
          fill: {
            opacity: 0.9,
            type: 'gradient',
            gradient: {
              shade: 'dark',
              type: 'vertical',
              shadeIntensity: 0.3,
              opacityFrom: 0.8,
              opacityTo: 0.4,
              stops: [0, 100]
            }
          },
          responsive: [
            {
              breakpoint: 768,
              options: {
                chart: {
                  height: 300
                },
                dataLabels: {
                  enabled: false
                },
                xaxis: {
                  labels: {
                    rotate: -90,
                    style: {
                      fontSize: '10px'
                    }
                  }
                }
              }
            },
            {
              breakpoint: 480,
              options: {
                chart: {
                  height: 250
                },
                dataLabels: {
                  enabled: false
                }
              }
            }
          ]
        };

        setChartData({
          series: [{
            name: 'Matériels',
            data: values
          }],
          options: options
        });
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors de la récupération des données:', err);
        setError(err.message || 'Erreur lors du chargement des données');
        setLoading(false);
      }
    };

    fetchDataAndProcess();

    // Mise à jour automatique toutes les 30 secondes
    const interval = setInterval(fetchDataAndProcess, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fonction de rafraîchissement manuel
  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMaterielsByLocal()
      .then(apiData => {
        if (!Array.isArray(apiData)) {
          console.warn('Les données reçues ne sont pas un tableau:', apiData);
          setLoading(false);
          return;
        }

        const validData = apiData.filter(item => item && item.nom_local);
        
        if (validData.length === 0) {
          setLocalsData({});
          setTotalMateriels(0);
          setLastUpdated(new Date());
          setLoading(false);
          return;
        }

        const localCounts = {};
        let totalMaterielsCount = 0;
        
        apiData.forEach(item => {
          const localName = item.nom_local || 'Autre';
          const count = item.nombre_materiels || 0;
          localCounts[localName] = (localCounts[localName] || 0) + count;
          totalMaterielsCount += count;
        });

        // Trier les locaux par nombre décroissant
        const sortedEntries = Object.entries(localCounts).sort((a, b) => b[1] - a[1]);
        setLocalsData(Object.fromEntries(sortedEntries));
        setTotalMateriels(totalMaterielsCount);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur lors de la récupération des données:', err);
        setError(err.message || 'Erreur lors du chargement des données');
        setLoading(false);
      });
  }, []);

  // --- STYLES ---

  const getLocalColor = (index) => theme.colors[index % theme.colors.length];

  const getPercentage = (count) => {
    const total = Object.values(localsData).reduce((a, b) => a + b, 0);
    return total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  };

  if (loading) return (
    <div className="dashboard-container">
      <div className="dashboard-loading" role="status" aria-label="Chargement des données">
        <div className="dashboard-loading-spinner"></div>
        <span className="dashboard-loading-text">Chargement des données...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-container">
      <div className="dashboard-error">
        <span className="dashboard-error-text">{error}</span>
        <button className="dashboard-retry-btn" onClick={handleRefresh}>
          <FaSyncAlt /> Réessayer
        </button>
      </div>
    </div>
  );

  // État vide
  const isEmpty = Object.keys(localsData).length === 0;

  return (
    <div className="dashboard-container">
      
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-icon-box" aria-hidden="true">
            <FaWarehouse size={22} /> 
          </div>
          <div>
            <h3 className="dashboard-title">Parc par Local</h3>
            <span className="dashboard-subtitle">Volumes par site</span>
          </div>
        </div>
        <div className="dashboard-header-right">
          <button 
            className="dashboard-refresh-btn" 
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Rafraîchir les données"
            title="Rafraîchir les données"
          >
            <FaSyncAlt className={loading ? 'spinning' : ''} />
          </button>
          {lastUpdated && (
            <div className="dashboard-last-updated" title={`Dernière mise à jour: ${lastUpdated.toLocaleTimeString('fr-FR')}`}>
              <FaClock size={14} />
              <span>{lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>
        
      <div className="dashboard-chart">
        {isEmpty ? (
          <div className="dashboard-empty-state">
            <FaWarehouse size={48} color={theme.textSub} />
            <p>Aucune donnée de local disponible</p>
          </div>
        ) : (
          <Chart
            options={chartData.options}
            series={chartData.series}
            type="bar"
            aria-label="Graphique du parc par local"
          />
        )}
      </div>

      {!isEmpty && (
        <>
          <div className="dashboard-legend">
            {Object.keys(localsData).map((localName, index) => {
              const color = getLocalColor(index);
              const percentage = getPercentage(localsData[localName]);
              const isHovered = hoveredLocal === localName;
              
              return (
                <div 
                  key={localName} 
                  className="dashboard-legend-item"
                  style={{
                    background: isHovered ? `${color}25` : undefined,
                    borderColor: isHovered ? color : undefined,
                    boxShadow: isHovered ? `0 8px 20px ${color}30` : undefined
                  }}
                  onMouseEnter={() => setHoveredLocal(localName)}
                  onMouseLeave={() => setHoveredLocal(null)}
                  role="listitem"
                  aria-label={`${localName}: ${localsData[localName]} équipements (${percentage}%)`}
                >
                  <div 
                    className="dashboard-legend-color"
                    style={{
                      backgroundColor: color,
                      boxShadow: isHovered ? `0 2px 8px ${color}50` : undefined
                    }}
                  />
                  <div className="dashboard-legend-content">
                    <div className="dashboard-legend-name">
                      {localName}
                    </div>
                    <div className="dashboard-legend-percentage">
                      {percentage}%
                    </div>
                  </div>
                  <div 
                    className="dashboard-legend-count"
                    style={{ color: color }}
                  >
                    {localsData[localName]}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dashboard-total-card" role="status" aria-live="polite">
            <div className="dashboard-total-card-glow" />
            <div className="dashboard-total-card-left">
              <div className="dashboard-total-card-icon">
                <FaServer size={18} color={theme.primaryLight} />
              </div>
              <span className="dashboard-total-card-label">Total Équipements</span>
            </div>
            <span className="dashboard-total-card-value">
              {totalMateriels}
              <small className="dashboard-total-card-unit">UNITÉS</small>
            </span>
          </div>
        </>
      )}

    </div>
  );
};

// Memoize pour optimiser les performances
const DashboardMarqueSiteMemo = memo(DashboardMarqueSite);
export default DashboardMarqueSiteMemo;
