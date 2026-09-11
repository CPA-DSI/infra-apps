/**
 * TicketChartCount - Composant React affichant les statistiques des tickets par statut
 * 
 * Ce composant récupère les tickets via l'API et affiche leur répartition par statut
 * avec des animations et une interface utilisateur moderne.
 * 
 * @module TicketChartCount
 * @version 1.0.0
 * @author Development Team
 * @date 2026-02-25
 */

// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { MdConfirmationNumber, MdTrendingUp, MdAccessTime, MdCheckCircle, MdCancel, MdRefresh, MdErrorOutline } from 'react-icons/md';
import { FaTicketAlt } from 'react-icons/fa';
import DataTable from 'react-data-table-component';

import { getTickets } from '../../services/api';
import './Tickets.css';

// ============================================================================
// CONSTANTES & CONFIGURATION
// ============================================================================

/** Configuration des couleurs et styles pour chaque statut de ticket */
const STATUS_CONFIG = Object.freeze({
  NOUVEAU: { 
    bg: 'rgba(255, 107, 107, 0.15)', 
    border: '#FF6B6B', 
    icon: '#FF6B6B',
    label: 'Nouveau',
    gradient: 'linear-gradient(135deg, #FF6B6B 0%, #ee5a5a 100%)'
  },
  EN_COURS: { 
    bg: 'rgba(78, 205, 196, 0.15)', 
    border: '#4ECDC4', 
    icon: '#4ECDC4',
    label: 'En cours',
    gradient: 'linear-gradient(135deg, #4ECDC4 0%, #3dbdb5 100%)'
  },
  RESOLU: { 
    bg: 'rgba(69, 183, 209, 0.15)', 
    border: '#45B7D1', 
    icon: '#45B7D1',
    label: 'Résolu',
    gradient: 'linear-gradient(135deg, #45B7D1 0%, #3aa8c0 100%)'
  },
  FERME: { 
    bg: 'rgba(150, 206, 180, 0.15)', 
    border: '#96CEB4', 
    icon: '#96CEB4',
    label: 'Fermé',
    gradient: 'linear-gradient(135deg, #96CEB4 0%, #85c0a3 100%)'
  },
});

/** Liste des statuts pour l'itération */
const STATUS_KEYS = Object.freeze(['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME']);

/** Valeurs initiales des statistiques */
const INITIAL_STATS = Object.freeze({
  NOUVEAU: 0,
  EN_COURS: 0,
  RESOLU: 0,
  FERME: 0,
  total: 0
});

/** Configuration de l'animation */
const ANIMATION_CONFIG = Object.freeze({
  duration: 800,
  steps: 20
});

/** Messages d'erreur */
const ERROR_MESSAGES = Object.freeze({
  FETCH_FAILED: 'Impossible de charger les statistiques. Veuillez réessayer.',
  INVALID_DATA: 'Les données reçues sont invalides.'
});

// ============================================================================
// FONCTIONS UTILITAIRES (PURE FUNCTIONS)
// ============================================================================

/**
 * Normalise une chaîne de statut pour la comparaison
 * @param {string|null} status - Le statut à normaliser
 * @returns {string} Le statut normalisé en minuscules
 */
const normalizeStatus = (status) => {
  if (typeof status !== 'string') return '';
  return status.toLowerCase().replace(/[_\s-]/g, ' ');
};

/**
 * Détermine le statut canonique d'un ticket à partir de son statut brut
 * @param {string|null} ticketStatus - Le statut brut du ticket
 * @returns {string|null} Le statut canonique ou null si non reconnu
 */
const determineCanonicalStatus = (ticketStatus) => {
  if (!ticketStatus) return null;
  
  const normalizedStatus = normalizeStatus(ticketStatus);
  
  // Vérifier d'abord la correspondance exacte
  if (STATUS_CONFIG[ticketStatus]) {
    return ticketStatus;
  }
  
  // Vérifier les mappings de mots-clés
  const statusMappings = {
    NOUVEAU: ['nouveau', 'new', 'open'],
    EN_COURS: ['cours', 'progress', 'in progress', 'encours', 'en_cours'],
    RESOLU: ['resolu', 'resolved', 'solve', 'solution'],
    FERME: ['ferme', 'closed', 'close']
  };
  
  for (const [canonicalStatus, keywords] of Object.entries(statusMappings)) {
    if (keywords.some(keyword => normalizedStatus.includes(keyword))) {
      return canonicalStatus;
    }
  }
  
  return null;
};

/**
 * Calcule les statistiques des tickets par statut
 * @param {Array} tickets - Tableau des tickets
 * @returns {Object} Les statistiques calculées
 */
const calculateTicketStats = (tickets) => {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return { ...INITIAL_STATS };
  }

  const stats = { ...INITIAL_STATS };
  const unclassifiedStatuses = [];

  for (const ticket of tickets) {
    const status = determineCanonicalStatus(ticket.statut);
    if (status && STATUS_CONFIG[status]) {
      stats[status]++;
    } else {
      unclassifiedStatuses.push(ticket.statut);
    }
  }

  // Le total reflète la somme des cartes affichées (et non tickets.length) :
  // un ticket dont le statut n'est reconnu par aucune carte ne doit pas
  // gonfler silencieusement le total sans apparaître nulle part à l'écran.
  stats.total = STATUS_KEYS.reduce((sum, key) => sum + stats[key], 0);

  if (unclassifiedStatuses.length > 0) {
    console.warn(
      `TicketChartCount: ${unclassifiedStatuses.length} ticket(s) avec un statut non reconnu, exclus des statistiques :`,
      unclassifiedStatuses
    );
  }

  return stats;
};

/**
 * Calcule les pourcentages pour chaque statut
 * @param {Object} stats - Les statistiques des tickets
 * @returns {Object} Les pourcentages par statut
 */
const calculatePercentages = (stats) => {
  const { total } = stats;

  if (total === 0) {
    return {
      NOUVEAU: 0,
      EN_COURS: 0,
      RESOLU: 0,
      FERME: 0
    };
  }

  // Méthode du plus grand reste : arrondir chaque pourcentage indépendamment
  // (comme le faisait l'ancien code, via toFixed) peut faire dévier la somme
  // affichée de 100 % (ex. 33/33/33/0 => 99 %). On répartit donc les unités
  // d'arrondi restantes aux statuts ayant le plus grand reste, pour garantir
  // que la somme des 4 cartes vaut toujours exactement 100.
  const rawPercentages = STATUS_KEYS.map((key) => (stats[key] / total) * 100);
  const flooredPercentages = rawPercentages.map(Math.floor);
  const missingUnits = 100 - flooredPercentages.reduce((sum, value) => sum + value, 0);

  const remainderOrder = STATUS_KEYS
    .map((key, index) => ({ key, remainder: rawPercentages[index] - flooredPercentages[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  const percentages = {};
  STATUS_KEYS.forEach((key, index) => {
    percentages[key] = flooredPercentages[index];
  });

  for (let i = 0; i < missingUnits; i++) {
    percentages[remainderOrder[i].key] += 1;
  }

  return percentages;
};

/**
 * Fonction d'easing pour les animations
 * @param {number} progress - Progression de l'animation (0 à 1)
 * @returns {number} Valeur ajustée avec easing
 */
const easeOutCubic = (progress) => {
  return 1 - Math.pow(1 - progress, 3);
};

/**
 * Interpole les valeurs entre deux états
 * @param {Object} fromState - État de départ
 * @param {Object} toState - État d'arrivée
 * @param {number} progress - Progression (0 à 1)
 * @returns {Object} État interpolé
 */
const interpolateStats = (fromState, toState, progress) => {
  const easedProgress = easeOutCubic(progress);
  const interpolateValue = (from, to) => Math.round(from + (to - from) * easedProgress);

  const interpolated = { total: interpolateValue(fromState.total, toState.total) };
  for (const key of STATUS_KEYS) {
    interpolated[key] = interpolateValue(fromState[key], toState[key]);
  }

  return interpolated;
};

// ============================================================================
// HOOKS PERSONNALISÉS
// ============================================================================

/**
 * Hook pour l'animation des statistiques
 * @param {Object} targetStats - Statistiques cibles
 * @param {boolean} isLoading - Indique si le chargement est en cours
 * @returns {Object} Statistiques animées
 */
const useAnimatedStats = (targetStats, isLoading) => {
  const [animatedStats, setAnimatedStats] = useState(INITIAL_STATS);
  const animationRef = useRef(null);
  const previousStatsRef = useRef(INITIAL_STATS);
  
  useEffect(() => {
    // Annuler l'animation précédente
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    
    // Ne pas animer pendant le chargement
    if (isLoading) {
      setAnimatedStats(INITIAL_STATS);
      return;
    }
    
    const { duration, steps } = ANIMATION_CONFIG;
    const interval = duration / steps;
    let currentStep = 0;
    
    // Stocker les stats précédentes pour l'interpolation
    previousStatsRef.current = animatedStats;
    const fromStats = { ...previousStatsRef.current };
    const toStats = { ...targetStats };
    
    animationRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      if (progress >= 1) {
        // Animation terminée
        setAnimatedStats(toStats);
        clearInterval(animationRef.current);
        animationRef.current = null;
      } else {
        // Interpolation
        setAnimatedStats(interpolateStats(fromStats, toStats, progress));
      }
    }, interval);
    
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [targetStats, isLoading]);
  
  return animatedStats;
};

/**
 * Hook pour la gestion du chargement des tickets
 * @returns {Object} État et fonctions pour le chargement
 */
const useTicketLoader = () => {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchTickets = useCallback(async (isManualRefresh = false) => {
    try {
      if (!isManualRefresh) {
        setLoading(true);
      }
      setError(null);
      
      const data = await getTickets();
      
      // Validation des données reçues
      if (!Array.isArray(data)) {
        throw new Error('INVALID_DATA');
      }
      
      const ticketsList = Array.isArray(data) ? data : [];
      const newStats = calculateTicketStats(ticketsList);
      setStats(newStats);
      setTickets(ticketsList);
      
    } catch (err) {
      console.error('Erreur lors de la récupération des tickets:', err);

      // getTickets() (services/api.js) convertit déjà l'erreur axios en Error
      // avec un message lisible (réponse serveur, ou "aucune réponse" en cas de
      // panne réseau) : `err.response`/`err.name` n'existent plus à ce stade,
      // on réutilise donc directement `err.message`.
      const errorMessage = err.message === 'INVALID_DATA'
        ? ERROR_MESSAGES.INVALID_DATA
        : (err.message || ERROR_MESSAGES.FETCH_FAILED);

      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTickets(true);
  }, [fetchTickets]);
  
  // Chargement initial
  useEffect(() => {
    fetchTickets(false);
  }, [fetchTickets]);
  
  return {
    stats,
    tickets,
    loading,
    error,
    isRefreshing,
    refresh: handleRefresh
  };
};

// ============================================================================
// COMPOSANTS ENFANTS
// ============================================================================

/**
 * Composant StatusCard - Affiche une carte de statistiques pour un statut
 * @param {Object} props - Propriétés du composant
 * @param {string} props.statusKey - Clé du statut
 * @param {number} props.count - Nombre de tickets
 * @param {number} props.percentage - Pourcentage
 * @param {React.ReactNode} props.icon - Icône à afficher
 * @returns {JSX.Element} Carte de statistiques
 */
const StatusCard = React.memo(({ statusKey, count, percentage, icon }) => {
  const config = STATUS_CONFIG[statusKey];
  
  const cardStyle = {
    background: config.bg, borderRadius: '20px', padding: '20px', textAlign: 'center', border: `2px solid ${config.border}`, transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', cursor: 'default',
  };
  
  const topBarStyle = {
   position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: config.gradient,
  };
  
  const circleContainerStyle = {
    width: '60px', height: '60px', borderRadius: '50%', background: `conic-gradient(${config.border} ${percentage}%, #e2e8f0 0%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', position: 'relative',
  };
  
  const circleInnerStyle = {
    width: '48px', height: '48px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  
  const percentageStyle = {
    fontSize: '18px', fontWeight: 700, color: config.border,
  };
  
  const labelContainerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px',
  };
  
  const labelStyle = {
    fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
  };
  
  const countStyle = {
    fontSize: '28px', fontWeight: 700, color: config.border, transition: 'transform 0.3s ease',
  };
  
  return (
    <div
      className="stat-card"
      style={cardStyle}
      role="figure"
      aria-label={`${config.label}: ${count} tickets (${percentage}%)`}
    >
      <div style={topBarStyle} />
      
      <div style={circleContainerStyle}>
        <div style={circleInnerStyle}>
          <span style={percentageStyle}>{percentage}%</span>
        </div>
      </div>
      
      <div style={labelContainerStyle}>
        {React.cloneElement(icon, { size: 16, color: config.icon })}
        <span style={labelStyle}>{config.label}</span>
      </div>
      
      <div style={countStyle}>{count}</div>
    </div>
  );
});

StatusCard.displayName = 'StatusCard';

/**
 * Composant LoadingSpinner - Affiche un indicateur de chargement
 * @returns {JSX.Element} Indicateur de chargement
 */
const LoadingSpinner = () => {
  const containerStyle = {
    height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px',
  };
  
  const spinnerStyle = {
    width: 48, height: 48, border: '4px solid #e2e8f0', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite',
  };
  
  const textStyle = {
    color: '#94a3b8', fontWeight: 600, fontSize: '14px',
  };
  
  return (
    <div style={containerStyle}>
      <div style={spinnerStyle} />
      <span style={textStyle}>Chargement...</span>
    </div>
  );
};

/**
 * Composant ErrorMessage - Affiche un message d'erreur avec bouton de retry
 * @param {Object} props - Propriétés du composant
 * @param {string} props.message - Message d'erreur
 * @param {Function} props.onRetry - Fonction de retry
 * @returns {JSX.Element} Message d'erreur
 */
const ErrorMessage = React.memo(({ message, onRetry }) => {
  const containerStyle = {
    background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '20px',
  };
  
  const iconStyle = {
    marginBottom: '8px',
  };
  
  const textStyle = {
    color: '#ef4444', margin: 0, fontWeight: 600,
  };
  
  const buttonStyle = {
    marginTop: '12px', padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s ease',
  };
  
  return (
    <div role="alert" style={containerStyle}>
      <MdErrorOutline size={32} color="#ef4444" style={iconStyle} />
      <p style={textStyle}>{message}</p>
      <button
        onClick={onRetry}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.background = '#dc2626'}
        onMouseOut={(e) => e.target.style.background = '#ef4444'}
      >
        Réessayer
      </button>
    </div>
  );
});

ErrorMessage.displayName = 'ErrorMessage';

/**
 * Composant RefreshButton - Bouton de rafraîchissement
 * @param {Object} props - Propriétés du composant
 * @param {boolean} props.isRefreshing - Indique si le rafraîchissement est en cours
 * @param {Function} props.onClick - Fonction au clic
 * @returns {JSX.Element} Bouton de rafraîchissement
 */
const RefreshButton = React.memo(({ isRefreshing, onClick }) => {
  const containerStyle = {
    background: 'rgba(102, 126, 234, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  
  const buttonStyle = {
    background: 'transparent', border: 'none', cursor: isRefreshing ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
  };
  
  return (
    <div style={containerStyle}>
      <button
        onClick={onClick}
        disabled={isRefreshing}
        style={buttonStyle}
        aria-label="Actualiser les statistiques"
        title="Actualiser"
      >
        <MdRefresh size={20} color={isRefreshing ? '#a0aec0' : '#667eea'} />
      </button>
    </div>
  );
});

RefreshButton.displayName = 'RefreshButton';

/**
 * Composant TotalCard - Carte affichant le total des tickets
 * @param {number} total - Nombre total de tickets
 * @returns {JSX.Element} Carte du total
 */
const TotalCard = React.memo(({ total }) => {
  const cardStyle = {
   background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: '20px 24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, boxShadow: '0 8px 25px rgba(102, 126, 234, 0.35)',
  };
  
  const labelStyle = {
    textTransform: 'uppercase', letterSpacing: '1px', fontSize: '13px',
  };
  
  const countStyle = {
    fontSize: '24px', fontWeight: 700, letterSpacing: '1px', background: 'rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '12px',
  };
  
  return (
    <div style={cardStyle}>
      <span style={labelStyle}>Total Tickets</span>
      <div style={countStyle}>{total}</div>
    </div>
  );
});

TotalCard.displayName = 'TotalCard';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

/**
 * TicketChartCount - Composant principal affichant les statistiques des tickets
 * @returns {JSX.Element} Composant de statistiques des tickets
 */
const TicketChartCount = () => {
  // Utilisation du hook personnalisé pour le chargement
  const { stats, tickets, loading, error, isRefreshing, refresh } = useTicketLoader();
  
  // Calcul des pourcentages avec useMemo pour la performance
  const percentages = useMemo(
    () => calculatePercentages(stats),
    [stats.NOUVEAU, stats.EN_COURS, stats.RESOLU, stats.FERME, stats.total]
  );
  
  // Animation des statistiques
  const animatedStats = useAnimatedStats(stats, loading);
  
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR');
  };

  const sortedTickets = useMemo(() => {
    // Les dates manquantes/invalides (NaN) sont repoussées en fin de liste
    // plutôt que de produire un ordre indéterminé (NaN - NaN dans le comparateur).
    return [...tickets].sort((a, b) => {
      const dateA = new Date(a.dateCreation).getTime();
      const dateB = new Date(b.dateCreation).getTime();
      const validA = !Number.isNaN(dateA);
      const validB = !Number.isNaN(dateB);

      if (!validA && !validB) return 0;
      if (!validA) return 1;
      if (!validB) return -1;

      return dateB - dateA;
    });
  }, [tickets]);

  const datatableStyles = {
    table: { style: { backgroundColor: 'transparent', borderRadius: '16px' } },
    headRow: {
      style: {
        backgroundColor: '#f8f9fa', border: 'none', minHeight: '52px',
        borderRadius: '10px 10px 0 0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      },
    },
    headCells: {
      style: {
        fontSize: '0.72rem', fontWeight: '700', color: '#374151', letterSpacing: '0.06em',
        textTransform: 'uppercase', padding: '14px', verticalAlign: 'middle',
        textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb',
        whiteSpace: 'nowrap', userSelect: 'none',
      },
    },
    rows: {
      style: {
        fontSize: '13px', fontWeight: '500', color: '#212529', minHeight: '52px',
        backgroundColor: '#ffffff',
        '&:not(:last-of-type)': { borderBottom: '1px solid #e9ecef' },
        '&:hover': { backgroundColor: '#f0f7ff !important', transition: 'background-color 0.2s ease' },
      },
      highlightOnHoverStyle: {
        backgroundColor: '#EBF4FF', color: '#0056b3', cursor: 'pointer', transitionDuration: '0.2s',
      },
    },
    pagination: {
      style: { border: 'none', fontSize: '12px', color: '#6c757d', padding: '18px' },
    },
  };

  const datatableColumns = useMemo(() => [
    { name: 'N° Ticket', selector: (row) => row.numeroTicket, sortable: true, minWidth: '120px', grow: 1 },
    { name: 'Titre', selector: (row) => row.titre, sortable: true, minWidth: '180px', grow: 2 },
    { name: 'Demandeur', selector: (row) => row.nomDemandeurFormate || row.nomDemandeur || row.demandeur?.utilisateur || row.demandeur?.email_1 || '—', sortable: true, minWidth: '170px', grow: 1.2 },
    { name: 'Statut', selector: (row) => row.statut, sortable: true, minWidth: '110px', grow: 0.9, center: true },
    { name: 'Créé le', cell: (row) => formatDate(row.dateCreation), sortable: true, minWidth: '110px', grow: 0.9, center: true },
  ], []);
  
  // =========================================================================
  // STYLES DU COMPOSANT
  // =========================================================================
  
  const containerStyle = {
    background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', padding: '28px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)', fontFamily: "'Poppins', system-ui, sans-serif", border: '1px solid rgba(255, 255, 255, 0.5)', width: '100%', maxWidth: 'auto',
  };
  
  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '15px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  };
  
  const iconBoxStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: '14px', borderRadius: '18px', display: 'flex', alignItems: 'center', boxShadow: '0 8px 20px rgba(102, 126, 234, 0.35)',
  };
  
   const statsGridStyle = {
     display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px',
   };
   
   const contentGridStyle = {
     display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start',
   };
   
   const chartSectionStyle = {
     display: 'flex', flexDirection: 'column', gap: '16px',
   };
  
  // =========================================================================
  // RENDU DU COMPOSANT
  // =========================================================================
  
  return (
    <div style={containerStyle}>
      {/* En-tête */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={iconBoxStyle}>
            <MdConfirmationNumber size={22} />
          </div>
          <div>
            <h3 style={{ 
              margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.5px'
            }}>
              Tickets
            </h3>
            <span style={{ 
              fontSize: '12px', color: '#94a3b8', fontWeight: 500
            }}>
              Répartition par statut
            </span>
          </div>
        </div>
        
        <RefreshButton 
          isRefreshing={isRefreshing} 
          onClick={refresh} 
        />
      </div>
      
      {/* Contenu principal */}
      {!loading ? (
        <>
          {error ? (
            <ErrorMessage 
              message={error} 
              onRetry={refresh} 
            />
          ) : (
              <>
                <div style={contentGridStyle}>
                  {/* Section graphique / statistiques */}
                  <div style={chartSectionStyle}>
                    {/* Grille des statistiques par statut */}
                    <div style={statsGridStyle}>
                      <StatusCard 
                        statusKey="NOUVEAU" 
                        count={animatedStats.NOUVEAU} 
                        percentage={percentages.NOUVEAU}
                        icon={<MdTrendingUp />}
                      />
                      <StatusCard 
                        statusKey="EN_COURS" 
                        count={animatedStats.EN_COURS} 
                        percentage={percentages.EN_COURS}
                        icon={<MdAccessTime />}
                      />
                      <StatusCard 
                        statusKey="RESOLU" 
                        count={animatedStats.RESOLU} 
                        percentage={percentages.RESOLU}
                        icon={<MdCheckCircle />}
                      />
                      <StatusCard 
                        statusKey="FERME" 
                        count={animatedStats.FERME} 
                        percentage={percentages.FERME}
                        icon={<MdCancel />}
                      />
                    </div>
                    
                    {/* Carte du total */}
                    <TotalCard total={animatedStats.total} />
                  </div>

                  {/* Section tableau des tickets */}
                  <div>
                    <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Derniers tickets</h4>
                    {sortedTickets.length === 0 ? (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
                        <div style={{ display: 'flex', background: '#f8f9fa', minHeight: '52px', borderRadius: '10px 10px 0 0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                          {datatableColumns.map((col, idx) => (
                            <div 
                              key={idx}
                              style={{ 
                                flex: col.grow || 1, 
                                minWidth: col.minWidth || 'auto',
                                padding: '14px', 
                                fontSize: '0.72rem', 
                                fontWeight: 700, 
                                color: '#374151', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.06em',
                                textAlign: col.center ? 'center' : 'left',
                                backgroundColor: '#f3f4f6',
                                borderBottom: '2px solid #e5e7eb',
                                whiteSpace: 'nowrap',
                                userSelect: 'none'
                              }}
                            >
                              {col.name}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#64748b', background: '#fff' }}>
                          <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)' }}>
                            <FaTicketAlt size={48} color="#667eea" />
                          </div>
                          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#334155' }}>Aucun historique trouvé</h3>
                          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>Essayez avec d'autres filtres.</p>
                        </div>
                      </div>
                    ) : (
                      <DataTable
                        columns={datatableColumns}
                        data={sortedTickets}
                        pagination
                        paginationPerPage={5}
                        paginationRowsPerPageOptions={[5, 10, 20]}
                        progressPending={isRefreshing}
                        progressComponent={<LoadingSpinner />}
                        customStyles={datatableStyles}
                        highlightOnHover
                        pointerOnHover
                      />
                    )}
                  </div>
                </div>
              </>
          )}
        </>
      ) : (
        <LoadingSpinner />
      )}
      
      {/* Styles d'animation globaux */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default TicketChartCount;

// Export des constantes pour les tests
export { 
  STATUS_CONFIG, 
  STATUS_KEYS, 
  INITIAL_STATS,
  ERROR_MESSAGES,
  calculateTicketStats,
  calculatePercentages,
  determineCanonicalStatus,
  normalizeStatus 
};
