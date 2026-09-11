import React, { useState, useEffect, useCallback } from 'react';
// ... autres imports nécessaires (API_URL, etc.)

// Le composant accepte maintenant les données (mouvements) et la fonction de rafraîchissement (onRefresh) via les props
const StockInfo = ({ mouvements: data, materiels, locaux, onRefresh }) => {
  
  // Utilisez loading uniquement pour les opérations CRUD (delete, refresh manuel)
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  
  // États pour contrôler l'ouverture des différentes modales
  const [showAddModal, setShowAddModal] = useState(false); 
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Utilisez useCallback pour mémoriser la fonction et éviter des recréations inutiles
  const fetchAllMouvements = useCallback(async () => {
      setLoading(true);
      setError(null);
  
      try {
          // Remplacez API_URL par votre constante d'URL réelle si nécessaire
          const response = await fetch(API_URL); 
          
          if (!response.ok) {
              const errorBody = await response.text(); 
              console.error("Détails de l'erreur API:", errorBody);
              throw new Error(`Statut: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // On s'attend à ce que l'API retourne un objet avec une clé 'mouvements'
          if (!Array.isArray(result.mouvements)) {
             throw new Error('Format de données inattendu (mouvements manquant ou n\'est pas un tableau).');
          }
  
          // CORRECTION : Utilisez onRefresh pour mettre à jour les données dans le composant parent
          if (onRefresh) {
            onRefresh(result.mouvements);
          }

          setLoading(false);
      } catch (error) {
          console.error("Erreur lors du fetching:", error);
          // Affichez l'erreur à l'utilisateur
          setError(`Erreur lors du chargement des données. ${error.message}`); 
          setLoading(false);
      }
    }, [onRefresh]); // Ajoutez onRefresh comme dépendance de useCallback

    // Le useEffect appelle la fonction au montage initial du composant
    useEffect(() => {
        fetchAllMouvements();
    }, [fetchAllMouvements]); // Ajoutez fetchAllMouvements comme dépendance de useEffect

    // ... le reste de votre composant (rendu, autres fonctions) ...

    return (
        // ... votre JSX ici ...
        <div>
            {loading && <p>Chargement en cours...</p>}
            {error && <p className="error">{error}</p>}
            {/* Afficher les données (data) */}
            {/* ... */}
        </div>
    );
};

export default StockInfo;
