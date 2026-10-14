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
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import { toneClass } from '../../utils/tones';
import { STATUS_CONFIG as TICKET_STATUS_CONFIG, TICKET_STATUSES } from './ticketConfig';
import './Tickets.css';

// ============================================================================
// CONSTANTES & CONFIGURATION
// ============================================================================

/** Statuts suivis par le graphique (couleurs : tonalités de styles/tones.css) */
const STATUS_CONFIG = Object.freeze(
  Object.fromEntries(TICKET_STATUSES.map((key) => [key, TICKET_STATUS_CONFIG[key]]))
);

/** Thème commun des tableaux, en-têtes plus compacts */
const TABLE_STYLES = tableStyles({
  headCells: { style: { fontSize: '0.72rem', paddingLeft: '14px', paddingRight: '14px' } },
  rows: { style: { fontSize: '13px' } },
});

/** Liste des statuts pour l'itération */
const STATUS_KEYS = Object.freeze([...TICKET_STATUSES]);

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
  const animatedStatsRef = useRef(animatedStats);

  useEffect(() => {
    animatedStatsRef.current = animatedStats;
  }, [animatedStats]);

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
    previousStatsRef.current = animatedStatsRef.current;
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

  // Seul le pourcentage est dynamique ; la couleur vient de la tonalité
  const cardVars = {
    '--tcc-pct': `${percentage}%`,
  };

  return (
    <div
      className={`tcc-stat-card ${toneClass(config.tone)}`}
      style={cardVars}
      role="figure"
      aria-label={`${config.label}: ${count} tickets (${percentage}%)`}
    >
      <div className="tcc-stat-card__bar" />

      <div className="tcc-stat-card__ring">
        <div className="tcc-stat-card__ring-inner">
          <span className="tcc-stat-card__pct">{percentage}%</span>
        </div>
      </div>

      <div className="tcc-stat-card__label-row">
        {React.cloneElement(icon, { size: 16, color: config.icon, 'aria-hidden': true })}
        <span className="tcc-stat-card__label">{config.label}</span>
      </div>

      <div className="tcc-stat-card__count">{count}</div>
    </div>
  );
});

StatusCard.displayName = 'StatusCard';

/**
 * Composant LoadingSpinner - Affiche un indicateur de chargement
 * @returns {JSX.Element} Indicateur de chargement
 */
const LoadingSpinner = () => (
  <div className="tcc-loading">
    <div className="tcc-loading__spinner" />
    <span className="tcc-loading__text">Chargement...</span>
  </div>
);

/**
 * Composant ErrorMessage - Affiche un message d'erreur avec bouton de retry
 * @param {Object} props - Propriétés du composant
 * @param {string} props.message - Message d'erreur
 * @param {Function} props.onRetry - Fonction de retry
 * @returns {JSX.Element} Message d'erreur
 */
const ErrorMessage = React.memo(({ message, onRetry }) => (
  <div role="alert" className="tcc-error">
    <MdErrorOutline size={32} className="tcc-error__icon" aria-hidden="true" />
    <p className="tcc-error__text">{message}</p>
    <button type="button" onClick={onRetry} className="tcc-error__btn">
      Réessayer
    </button>
  </div>
));

ErrorMessage.displayName = 'ErrorMessage';

/**
 * Composant RefreshButton - Bouton de rafraîchissement
 * @param {Object} props - Propriétés du composant
 * @param {boolean} props.isRefreshing - Indique si le rafraîchissement est en cours
 * @param {Function} props.onClick - Fonction au clic
 * @returns {JSX.Element} Bouton de rafraîchissement
 */
const RefreshButton = React.memo(({ isRefreshing, onClick }) => (
  <div className="tcc-refresh">
    <button
      type="button"
      onClick={onClick}
      disabled={isRefreshing}
      className={`tcc-refresh__btn ${isRefreshing ? 'is-refreshing' : ''}`.trim()}
      aria-label="Actualiser les statistiques"
      title="Actualiser"
    >
      <MdRefresh size={20} aria-hidden="true" />
    </button>
  </div>
));

RefreshButton.displayName = 'RefreshButton';

/**
 * Composant TotalCard - Carte affichant le total des tickets
 * @param {number} total - Nombre total de tickets
 * @returns {JSX.Element} Carte du total
 */
const TotalCard = React.memo(({ total }) => (
  <div className="tcc-total">
    <span className="tcc-total__label">Total Tickets</span>
    <div className="tcc-total__count">{total}</div>
  </div>
));

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
    [stats]
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

  const datatableColumns = useMemo(() => [
    { name: 'N° Ticket', selector: (row) => row.numeroTicket, sortable: true, minWidth: '120px', grow: 1 },
    { name: 'Titre', selector: (row) => row.titre, sortable: true, minWidth: '180px', grow: 2 },
    { name: 'Demandeur', selector: (row) => row.nomDemandeurFormate || row.nomDemandeur || row.demandeur?.utilisateur || row.demandeur?.email_1 || '—', sortable: true, minWidth: '170px', grow: 1.2 },
    { name: 'Statut', selector: (row) => row.statut, sortable: true, minWidth: '110px', grow: 0.9, center: true },
    { name: 'Créé le', cell: (row) => formatDate(row.dateCreation), sortable: true, minWidth: '110px', grow: 0.9, center: true },
  ], []);
  
  // =========================================================================
  // RENDU DU COMPOSANT
  // =========================================================================
  
  return (
    <div className="tcc-container">
      {/* En-tête */}
      <div className="tcc-header">
        <div className="tcc-header__main">
          <div className="tcc-header__icon" aria-hidden="true">
            <MdConfirmationNumber size={22} />
          </div>
          <div>
            <h3 className="tcc-header__title">Tickets</h3>
            <span className="tcc-header__subtitle">Répartition par statut</span>
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
            <div className="tcc-content">
              {/* Section graphique / statistiques */}
              <div className="tcc-chart-section">
                {/* Grille des statistiques par statut */}
                <div className="tcc-stats-grid">
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
                <h4 className="tcc-table-title">Derniers tickets</h4>
                {sortedTickets.length === 0 ? (
                  <div className="tcc-empty">
                    <div className="tcc-empty__head">
                      {datatableColumns.map((col, idx) => (
                        <div
                          key={idx}
                          className="tcc-empty__cell"
                          style={{
                            flex: col.grow || 1,
                            minWidth: col.minWidth || 'auto',
                            textAlign: col.center ? 'center' : 'left',
                          }}
                        >
                          {col.name}
                        </div>
                      ))}
                    </div>
                    <div className="tcc-empty__body">
                      <div className="tcc-empty__icon" aria-hidden="true">
                        <FaTicketAlt size={48} />
                      </div>
                      <h3 className="tcc-empty__title">Aucun historique trouvé</h3>
                      <p className="tcc-empty__text">Essayez avec d'autres filtres.</p>
                    </div>
                  </div>
                ) : (
                  <DataTable
                    columns={datatableColumns}
                    data={sortedTickets}
                    pagination
                    paginationPerPage={5}
                    paginationRowsPerPageOptions={[5, 10, 20]}
                    paginationComponentOptions={paginationOptions}
                    progressPending={isRefreshing}
                    progressComponent={<LoadingSpinner />}
                    customStyles={TABLE_STYLES}
                    highlightOnHover
                    pointerOnHover
                  />
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <LoadingSpinner />
      )}
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
