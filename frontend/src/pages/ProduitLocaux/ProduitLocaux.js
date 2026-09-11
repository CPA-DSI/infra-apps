// src/pages/ProduitLocaux/ProduitLocaux.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ProduitLocaux.css';
import DataTable from 'react-data-table-component';
import { Button, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { FaEdit, FaSync, FaFileExcel, FaWarehouse, FaTrash, FaSearch, FaBox, FaMapMarkerAlt, FaPlus } from 'react-icons/fa';
import { fetchProduits, fetchLocaux, addProduct, updateProduct, deleteProduct, addLocation, updateLocation, deleteLocation } from '../../services/api';
import ProductModal from './ProductModal';
import LocationModal from './LocationModal';

const MySwal = withReactContent(Swal);

// --- Styles modernes ---
const modernStyles = {
    table: {
        style: {
            backgroundColor: 'transparent', borderRadius: '20px',
        },
    },
    headRow: {
        style: {
            backgroundColor: '#f8f9fa', border: 'none', minHeight: '56px', borderRadius: '10px 10px 0 0',
        },
    },
    headCells: {
            style: {
                fontSize: '0.75rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none',
            },
        },
    rows: {
        style: {
            fontSize: '14px', fontWeight: '500', color: '#495057', minHeight: '65px', '&:not(:last-of-type)': { borderBottom: '1px solid #f1f1f1', },
        },
        highlightOnHoverStyle: {
            backgroundColor: '#EBF4FF', color: '#0056b3', cursor: 'pointer', transitionDuration: '0.2s',
        },
    },
    pagination: {
        style: {
            border: 'none', fontSize: '13px', color: '#6c757d', paddingTop: '20px',
        },
    },
};


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
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
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
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Oui, supprimer', cancelButtonText: 'Annuler'
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
                  <Button variant="light" size="sm" onClick={() => handleEditProduct(row)} title="Modifier" className="shadow-sm border-0 p-2 rounded-circle">
                      <FaEdit size={14} className="text-warning" />
                  </Button>
                  <Button variant="light" size="sm" onClick={() => confirmDeleteProduct(row)} title="Supprimer" className="shadow-sm border-0 p-2 rounded-circle">
                      <FaTrash size={14} className="text-danger" />
                  </Button>
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
                <Button variant="light" size="sm" onClick={() => handleEditLocation(row)} title="Modifier" className="shadow-sm border-0 p-2 rounded-circle">
                    <FaEdit size={14} className="text-warning" />
                </Button>
                <Button variant="light" size="sm" onClick={() => confirmDeleteLocation(row)} title="Supprimer" className="shadow-sm border-0 p-2 rounded-circle">
                    <FaTrash size={14} className="text-danger" />
                </Button>
            </div>
        ),
        ignoreRowClick: true, allowOverflow: true, button: true, width: '110px', grow: 1,
    },
  ], [handleEditLocation, confirmDeleteLocation]);

  if (loading) return (
    <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
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
      <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', minHeight: '56px', borderRadius: '10px 10px 0 0' }}>
        {columnsProducts.map((col, idx) => (
          <div key={idx} style={{ flex: col.grow || 1, width: col.width || 'auto', padding: '16px', fontSize: '0.75rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', verticalAlign: 'middle', textAlign: 'left', userSelect: 'none' }}>
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
      <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb', minHeight: '56px', borderRadius: '10px 10px 0 0' }}>
        {columnsLocations.map((col, idx) => (
          <div key={idx} style={{ flex: col.grow || 1, width: col.width || 'auto', padding: '16px', fontSize: '0.75rem', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', textTransform: 'capitalize', verticalAlign: 'middle', textAlign: 'left', userSelect: 'none' }}>
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
    <div className="container-fluid py-2 px-2" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div className="modern-header">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <div className="header-icon-wrapper me-3">
              <FaWarehouse size={24} />
            </div>
            <div>
              <h2 className="mb-0">Catalogue et Emplacements</h2>
              <p className="mb-0 opacity-75">Gérez vos produits et localisations</p>
            </div>
          </div>
          <Button className="btn-prod-refresh shadow-sm" onClick={handleRefresh} title="Actualiser toutes les données">
            <FaSync />
          </Button>
        </div>
      </div>

      <div className="row g-4">  
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header modern-card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className="header-icon-box">
                  <FaBox />
                </div>
                <h4 className="mb-0">Catalogue Produits</h4>
                <Badge bg="light" text="dark" className="count-badge">
                  {filteredProducts.length} / {products.length}
                </Badge>
              </div>
            </div>
             <div className="card-body">
               <div className="d-flex gap-3 align-items-center mb-3">
                 <div className="search-pill-wrapper flex-grow-1 mb-0">
                   <FaSearch className="search-pill-icon" />
                   <Form.Control type="text" placeholder="Rechercher..." className="search-pill-input" value={searchProducts} onChange={(e) => setSearchProducts(e.target.value)} />
                 </div>
                 <div className="d-flex gap-2">
                    <Button className="btn-prod-export shadow-sm" onClick={handleExportExcelProducts}>
                        <FaFileExcel size={15} />
                        <span>Exporter</span>
                    </Button>
                    <Button className="btn-prod-add shadow-sm" onClick={handleOpenAddModalProduct}>
                        <FaPlus size={16} />
                        <span>Ajouter Produit</span>
                    </Button>
                </div>
               </div>

               <DataTable
                columns={columnsProducts}
                data={filteredProducts}
                pagination
                highlightOnHover
                responsive
                pointerOnHover
                customStyles={modernStyles}
                noDataComponent={<NoDataWithHeaderProducts />}
                rowsPerPageText="Lignes par page :"
                rowsPerPageOptions={[
                  { label: '5 lignes', value: 5 },
                  { label: '10 lignes', value: 10 },
                  { label: '20 lignes', value: 20 },
                  { label: '50 lignes', value: 50 },
                  { label: '100 lignes', value: 100 }
                ]}
                rangeSeparatorText="à"
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header modern-card-header-success d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className="header-icon-box">
                  <FaMapMarkerAlt />
                </div>
                <h4 className="mb-0">Emplacements Locaux</h4>
                <Badge bg="light" text="dark" className="count-badge">
                  {filteredLocations.length} / {locations.length}
                </Badge>
              </div>
            </div>
             <div className="card-body">
                <div className="d-flex gap-3 align-items-center mb-3">
                  <div className="search-pill-wrapper flex-grow-1 mb-0">
                    <FaSearch className="search-pill-icon" />
                    <Form.Control
                      type="text" placeholder="Rechercher..." className="search-pill-input"
                      value={searchLocations} onChange={(e) => setSearchLocations(e.target.value)}
                    />
                  </div>
                  <div className="d-flex gap-2">
                      <Button className="btn-prod-export shadow-sm" onClick={handleExportExcelLocations}>
                          <FaFileExcel size={15} />
                          <span>Exporter</span>
                      </Button>
                      <Button className="btn-prod-add-location shadow-sm" onClick={handleOpenAddModalLocation}>
                          <FaPlus size={16} />
                          <span>Ajouter Local</span>
                      </Button>
                  </div>
                </div>

              <DataTable
                columns={columnsLocations}
                data={filteredLocations}
                pagination
                highlightOnHover
                responsive
                pointerOnHover
                customStyles={modernStyles}
                noDataComponent={<NoDataWithHeaderLocations />}
                rowsPerPageText="Lignes par page :"
                rowsPerPageOptions={[
                  { label: '5 lignes', value: 5 },
                  { label: '10 lignes', value: 10 },
                  { label: '20 lignes', value: 20 },
                  { label: '50 lignes', value: 50 },
                  { label: '100 lignes', value: 100 }
                ]}
                rangeSeparatorText="à"
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
