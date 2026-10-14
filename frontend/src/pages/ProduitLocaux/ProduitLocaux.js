// src/pages/ProduitLocaux/ProduitLocaux.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ProduitLocaux.css';
import DataTable from 'react-data-table-component';
import { Button, Form, Badge } from 'react-bootstrap';
import { MySwal, swalButtons } from '../../utils/swal';
import { FaEdit, FaSync, FaFileExcel, FaWarehouse, FaTrash, FaSearch, FaBox, FaMapMarkerAlt, FaPlus } from 'react-icons/fa';
import { fetchProduits, fetchLocaux, addProduct, updateProduct, deleteProduct, addLocation, updateLocation, deleteLocation } from '../../services/api';
import ProductModal from './ProductModal';
import PageHeader from '../../components/PageHeader/PageHeader';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import LocationModal from './LocationModal';

// Thème commun + spécificités de la page (lignes plus hautes, en-têtes non capitalisés)
const tableCustomStyles = tableStyles({
  headCells: { style: { textTransform: 'capitalize' } },
  rows: { style: { fontSize: '14px', minHeight: '65px' } },
});

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

const ProduitLocaux = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // États pour les modales et les données sélectionnées
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null); 

  // États pour la recherche
  const [searchProducts, setSearchProducts] = useState('');
  const [searchLocations, setSearchLocations] = useState('');

  // --- Logique de récupération des données ---
  const fetchBothData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, locationsData] = await Promise.all([
        fetchProduits(),
        fetchLocaux()
      ]);
      setProducts(productsData || []);
      setLocations(locationsData || []);
    } catch (err) {
      console.error('Erreur fetchBothData:', err);
      const original = err.originalError || err;
      const errorMessage = original?.response?.data?.error || original?.response?.data?.message || err.message || "Une erreur est survenue lors du chargement des données.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBothData();
  }, [fetchBothData]);

  // --- Données filtrées ---  
  const filteredProducts = useMemo(() => {
    if (!searchProducts.trim()) return products;
    const search = searchProducts.toLowerCase();
    return products.filter(p => 
      (p.nom_produit?.toLowerCase() || '').includes(search)
    );
  }, [products, searchProducts]);

  const filteredLocations = useMemo(() => {
    if (!searchLocations.trim()) return locations;
    const search = searchLocations.toLowerCase();
    return locations.filter(l => 
      (l.nom_local?.toLowerCase() || '').includes(search) ||
      (l.description?.toLowerCase() || '').includes(search)
    );
  }, [locations, searchLocations]);


  // --- Gestion de la fermeture de la modale ---
  const handleCloseProductModal = useCallback(() => {
      setShowProductModal(false);
      setEditingProduct(null);
  }, []);
   
  const handleRefresh = useCallback(() => fetchBothData(), [fetchBothData]);

  // Export Excel pour les produits
  const handleExportExcelProducts = useCallback(() => {
    const csvContent = [
      ['Nom Produit', 'Quantité en Stock', 'Seuil Alerte', 'Date d\'arrivée'].join(','),
      ...filteredProducts.map(p => [
        `"${p.nom_produit || ''}"`, p.quantite_en_stock || 0, p.seuil_alerte || '', p.last_date || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produits_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredProducts]);

  const handleOpenAddModalProduct = useCallback(() => {
    setEditingProduct(null);
    setShowProductModal(true);
  }, []);
   
  const handleEditProduct = useCallback((row) => {
    setEditingProduct(row);
    setShowProductModal(true);
  }, []);

  const confirmDeleteProduct = useCallback(async (row) => {
    MySwal.fire({
        title: 'Confirmer la suppression',
        text: `Êtes-vous sûr de vouloir supprimer le produit ${row.nom_produit} ?`,
        icon: 'warning',
        showCancelButton: true, ...swalButtons('danger'), confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteProduct(row.id_produit);
                await fetchBothData();
                MySwal.fire('Supprimé!', 'Le produit a été supprimé avec succès.', 'success');
            } catch (err) {
                setError("Erreur lors de la suppression du produit.");
                MySwal.fire('Erreur', 'Erreur lors de la suppression du produit.', 'error');
            }
        }
    });
  }, [fetchBothData]);

  const handleSaveProduct = useCallback(async (formData) => {
    const newProductName = formData.nom_produit.trim().toLowerCase();
    const nameExists = products.some(product => 
      product.nom_produit.trim().toLowerCase() === newProductName && 
      (!editingProduct || product.id_produit !== editingProduct.id_produit) 
    );

    if (nameExists) {
      throw new Error("Erreur : Ce produit existe déjà. Veuillez saisir un nouveau nom de produit.");
    }

    try {
      if (editingProduct) {
          await updateProduct(editingProduct.id_produit, formData); 
      } else {
          await addProduct(formData); 
      }     
       
      handleCloseProductModal();
      await fetchBothData(); 

    } catch (err) {
      console.error("Détail de l'erreur de sauvegarde:", err.response ? err.response.data : err.message);
      setError(`Erreur lors de la sauvegarde du produit. Détails: ${err.response?.data?.details || err.message}`);
    }
  }, [products, editingProduct, handleCloseProductModal, fetchBothData]);

  const handleExportExcelLocations = useCallback(() => {
    const csvContent = [
      ['ID Local', 'Nom Local', 'Description'].join(','),
      ...filteredLocations.map(l => [
        l.id_local || '', `"${l.nom_local || ''}"`, `"${l.description || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `locaux_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredLocations]);

  const handleOpenAddModalLocation = useCallback(() => {
    setEditingLocation(null);
    setShowLocationModal(true);
  }, []);
   
  const handleEditLocation = useCallback((row) => {
    setEditingLocation(row);
    setShowLocationModal(true);
  }, []);

  const confirmDeleteLocation = useCallback(async (row) => {
    MySwal.fire({
        title: 'Confirmer la suppression',
        text: `Êtes-vous sûr de vouloir supprimer le local ${row.nom_local} ?`,
        icon: 'warning',
        showCancelButton: true, ...swalButtons('danger'), confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteLocation(row.id_local);
                await fetchBothData();
                MySwal.fire('Supprimé!', 'Le local a été supprimé avec succès.', 'success');
            } catch (err) {
                setError("Erreur lors de la suppression du local.");
                MySwal.fire('Erreur', 'Erreur lors de la suppression du local.', 'error');
            }
        }
    });
  }, [fetchBothData]);

  const handleSaveLocation = useCallback(async (dataToSave) => {
    const formData = { ...dataToSave };
    const locationId = formData.id_local;
    delete formData.id_local;  // Retirer l'ID des données à envoyer
    try {
      if (locationId) {
          await updateLocation(locationId, formData);
      } else {
          await addLocation(formData);
      }
      setShowLocationModal(false);
      setEditingLocation(null);
      await fetchBothData();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du local:", err);
      setShowLocationModal(false);
      setEditingLocation(null);
      setError(`Erreur lors de la sauvegarde du local: ${err.message}`);
    }
  }, [fetchBothData]);


  // --- Définition des colonnes avec useMemo ---
  const columnsProducts = useMemo(() => [
      { name: 'Nom Produit', selector: row => row.nom_produit, sortable: true, grow: 3, width: '600px' },
      { name: 'Qté', selector: row => row.quantite_en_stock, sortable: true, grow: 1, width: '70px' },
      { name: 'Seuil', selector: row => row.seuil_alerte || '-', sortable: true, grow: 1, width: '100px'  },
      { name: 'Date arrivée', selector: row => row.last_date, sortable: true, cell: row => { if (!row.last_date) return '-'; const dateObj = new Date(row.last_date); return dateObj.toLocaleDateString('fr-FR'); }, grow: 2  },
      {
          name: 'Actions',
          cell: row => (
              <div className="d-flex gap-2" role="group" aria-label="Actions Produits">
                  <button type="button" onClick={() => handleEditProduct(row)} title="Modifier" aria-label="Modifier" className="btn-icon btn-icon--warning">
                      <FaEdit size={14} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => confirmDeleteProduct(row)} title="Supprimer" aria-label="Supprimer" className="btn-icon btn-icon--danger">
                      <FaTrash size={14} aria-hidden="true" />
                  </button>
              </div>
          ),
          ignoreRowClick: true, allowOverflow: true, button: true, width: '110px', grow: 1,
      },
  ], [handleEditProduct, confirmDeleteProduct]);

  const columnsLocations = useMemo(() => [
    { name: 'Nom Local', selector: row => row.nom_local, sortable: true, grow: 2 },
    { name: 'Description', selector: row => row.description || '-', sortable: true, grow: 3, width: '600px'  },
    {
        name: 'Actions',
        cell: row => (
            <div className="d-flex gap-2" role="group" aria-label="Actions Locaux">
                <button type="button" onClick={() => handleEditLocation(row)} title="Modifier" aria-label="Modifier" className="btn-icon btn-icon--warning">
                      <FaEdit size={14} aria-hidden="true" />
                  </button>
                <button type="button" onClick={() => confirmDeleteLocation(row)} title="Supprimer" aria-label="Supprimer" className="btn-icon btn-icon--danger">
                      <FaTrash size={14} aria-hidden="true" />
                  </button>
            </div>
        ),
        ignoreRowClick: true, allowOverflow: true, button: true, width: '110px', grow: 1,
    },
  ], [handleEditLocation, confirmDeleteLocation]);

  if (loading) return (
    <div className="prod-loading d-flex flex-column align-items-center justify-content-center p-5">
        <div className="spinner-border text-primary prod-loading-spinner" role="status">
            <span className="visually-hidden">Chargement...</span>
        </div>
        <div className="mt-3 text-muted">Chargement des données...</div>
    </div>
  );
  
  if (error) return (
    <div className="container-fluid py-5 px-4">
        <div className="alert alert-danger d-flex align-items-center" role="alert">
            <FaTrash className="me-2" />
            <div>
                <strong>Erreur:</strong> {error}
                <Button variant="link" size="sm" onClick={handleRefresh} className="ms-2">
                    <FaSync /> Réessayer
                </Button>
            </div>
        </div>
    </div>
  );

  const NoDataWithHeaderProducts = () => (
    <div>
      <div className="prod-nodata-head">
        {columnsProducts.map((col, idx) => (
          <div key={idx} className="prod-nodata-cell" style={{ flex: col.grow || 1, width: col.width || 'auto' }}>
            {col.name}
          </div>
        ))}
      </div>
      <div className="p-5 text-center text-muted d-flex flex-column align-items-center">
        <FaBox size={40} className="mb-2 text-primary opacity-75" />
        Aucun produit trouvé.
      </div>
    </div>
  );

  const NoDataWithHeaderLocations = () => (
    <div>
      <div className="prod-nodata-head">
        {columnsLocations.map((col, idx) => (
          <div key={idx} className="prod-nodata-cell" style={{ flex: col.grow || 1, width: col.width || 'auto' }}>
            {col.name}
          </div>
        ))}
      </div>
      <div className="p-5 text-center text-muted d-flex flex-column align-items-center">
        <FaMapMarkerAlt size={40} className="mb-2 text-success opacity-75" />
        Aucun emplacement trouvé.
      </div>
    </div>
  );

  return (
    <div className="prod-page container-fluid py-2 px-2">
      <PageHeader
        icon={<FaWarehouse />}
        title="Catalogue et Emplacements"
        subtitle="Gérez vos produits et localisations"
        actions={
          <button type="button" className="btn-refresh" onClick={handleRefresh} title="Actualiser toutes les données" aria-label="Actualiser toutes les données">
            <FaSync aria-hidden="true" />
          </button>
        }
      />

      <div className="row g-4">  
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header prod-card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className="prod-card-header-icon" aria-hidden="true">
                  <FaBox />
                </div>
                <h4 className="mb-0">Catalogue Produits</h4>
                <Badge bg="light" text="dark" className="prod-count-badge">
                  {filteredProducts.length} / {products.length}
                </Badge>
              </div>
            </div>
             <div className="card-body">
               <div className="prod-toolbar d-flex gap-3 align-items-center mb-3">
                 <div className="prod-search flex-grow-1 mb-0">
                   <FaSearch className="prod-search-icon" aria-hidden="true" />
                   <Form.Control type="text" placeholder="Rechercher..." className="prod-search-input" value={searchProducts} onChange={(e) => setSearchProducts(e.target.value)} />
                 </div>
                 <div className="d-flex gap-2">
                    <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcelProducts}>
                        <FaFileExcel size={15} aria-hidden="true" />
                        <span>Exporter</span>
                    </button>
                    <button type="button" className="btn-pill btn-pill-primary" onClick={handleOpenAddModalProduct}>
                        <FaPlus size={16} aria-hidden="true" />
                        <span>Ajouter Produit</span>
                    </button>
                </div>
               </div>

               <DataTable
                columns={columnsProducts}
                data={filteredProducts}
                pagination
                highlightOnHover
                responsive
                pointerOnHover
                customStyles={tableCustomStyles}
                noDataComponent={<NoDataWithHeaderProducts />}
                paginationComponentOptions={paginationOptions}
                paginationRowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header prod-card-header prod-card-header--success d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className="prod-card-header-icon" aria-hidden="true">
                  <FaMapMarkerAlt />
                </div>
                <h4 className="mb-0">Emplacements Locaux</h4>
                <Badge bg="light" text="dark" className="prod-count-badge">
                  {filteredLocations.length} / {locations.length}
                </Badge>
              </div>
            </div>
             <div className="card-body">
                <div className="prod-toolbar d-flex gap-3 align-items-center mb-3">
                  <div className="prod-search flex-grow-1 mb-0">
                    <FaSearch className="prod-search-icon" aria-hidden="true" />
                    <Form.Control
                      type="text" placeholder="Rechercher..." className="prod-search-input"
                      value={searchLocations} onChange={(e) => setSearchLocations(e.target.value)}
                    />
                  </div>
                  <div className="d-flex gap-2">
                      <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcelLocations}>
                          <FaFileExcel size={15} aria-hidden="true" />
                          <span>Exporter</span>
                      </button>
                      <button type="button" className="btn-pill btn-pill-success" onClick={handleOpenAddModalLocation}>
                          <FaPlus size={16} aria-hidden="true" />
                          <span>Ajouter Local</span>
                      </button>
                  </div>
                </div>

              <DataTable
                columns={columnsLocations}
                data={filteredLocations}
                pagination
                highlightOnHover
                responsive
                pointerOnHover
                customStyles={tableCustomStyles}
                noDataComponent={<NoDataWithHeaderLocations />}
                paginationComponentOptions={paginationOptions}
                paginationRowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              />
            </div>
          </div>
        </div>
      </div>
      
      <ProductModal
        show={showProductModal} handleClose={handleCloseProductModal} handleSave={handleSaveProduct} initialData={editingProduct}
      />
      <LocationModal 
        show={showLocationModal} handleClose={() => setShowLocationModal(false)} onSaveSuccess={handleSaveLocation} initialData={editingLocation} existingLocations={locations}
      />
    </div>
  );
};

export default ProduitLocaux;
