/**
 * DashboardEcran Theme Configuration
 * Configuration du thème pour le composant DashboardEcran
 * Thème sombre moderne 2026
 */

import { getChartTheme } from '../../styles/chartTheme';

// Couleurs du dashboard, dérivées du thème partagé des graphiques
export const getEcranTheme = () => {
    const t = getChartTheme();
    return {
        ...t,
        textMain: t.text,
        border: t.grid,
        colors: [t.primary, t.palette[5], t.palette[9], t.warning, t.secondary, t.danger, t.success, t.info],
    };
};

// Configuration des graphiques
export const ecranChartConfig = {
    pie: {
        donut: {
            size: '70%'
        },
        stroke: {
            width: 2
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

export default getEcranTheme;
