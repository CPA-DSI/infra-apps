/**
 * DashboardEcran Theme Configuration
 * Configuration du thème pour le composant DashboardEcran
 * Thème sombre moderne 2026
 */

// Palette de couleurs principale
export const ecranTheme = {
    primary: '#6366f1',
    primaryLight: '#a5b4fc',
    primaryDark: '#4f46e5',
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
    colors: [
        '#6366f1',
        '#ec4899',
        '#14b8a6',
        '#f59e0b',
        '#8b5cf6',
        '#ef4444',
        '#22c55e',
        '#3b82f6'
    ]
};

// Configuration des animations
export const ecranAnimations = {
    fadeInUp: {
        duration: 600,
        easing: 'ease-out'
    },
    transitions: {
        fast: 150,
        normal: 300,
        slow: 500
    }
};

// Configuration des graphiques
export const ecranChartConfig = {
    pie: {
        donut: {
            size: '70%'
        },
        stroke: {
            width: 2,
            colors: ['#0f172a']
        }
    },
    line: {
        height: 380,
        stroke: {
            curve: 'smooth',
            width: 3
        },
        markers: {
            size: 5,
            strokeWidth: 2,
            hover: {
                size: 7
            }
        },
        grid: {
            strokeDashArray: 4
        }
    }
};

// Labels internationalisés
export const ecranLabels = {
    fr: {
        title: 'Inventaire Écrans',
        subtitle: 'Volumes par marque',
        loading: 'Chargement des données...',
        error: 'Erreur de chargement',
        retry: 'Réessayer',
        total: 'Stock Total',
        units: 'UNITÉS',
        dominantBrand: 'Marque dominante',
        avgByBrand: 'Moyenne par marque',
        uniqueBrands: 'Marques uniques',
        lineChart: 'Graphique linéaire',
        donutChart: 'Graphique en secteurs'
    }
};

export default ecranTheme;
