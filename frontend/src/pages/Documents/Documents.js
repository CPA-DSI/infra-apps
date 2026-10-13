// src/pages/Documents/Documents.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MySwal } from '../../utils/swal';
// --- Importations Bootstrap et Icônes ---
import { Button, Form, InputGroup, Spinner, Card, Alert, Tabs, Tab } from 'react-bootstrap';
import {
  FaEye, FaEdit, FaTrash, FaSearch, FaSync, FaTimes,
  FaPlus, FaFileAlt, FaGlobe, FaLock, FaInbox,
  FaTag, FaUser, FaCalendarAlt, FaReceipt, FaFileContract,
  FaShieldAlt, FaBook, FaProjectDiagram, FaCertificate, FaTruck, FaClipboardCheck, FaFile,
  FaFileExcel, FaFileImport
} from 'react-icons/fa';
import AddDocModal from './AddDocModal';
import DocumentDetailModal from './DocumentDetailModal';
import QuickPreviewModal from './QuickPreviewModal';
import { fetchDocuments, fetchMateriels, fetchAMarques, fetchProduits, getTickets, deleteDocument, getDocumentFileUrl, getPieceJointeFileUrl } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import { tableStyles, stickyHeadRow, paginationOptions } from '../../styles/dataTableTheme';
import './Documents.css';

// --- Thème commun des tableaux ---
// Pas de fixedHeader sur ce DataTable : il défile avec la page, l'en-tête
// colle donc juste sous la navbar fixe (stickyHeadRow, via --navbar-height).
const tableCustomStyles = tableStyles(stickyHeadRow);

// --- Catégories de documents (alignées sur le schéma Prisma) ---
const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',              color: '#065f46', bg: '#d1fae5', border: '#a7f3d0', icon: FaReceipt },
  CONTRAT_MAINTENANCE: { label: 'Contrat de maintenance', color: '#7c2d12', bg: '#ffedd5', border: '#fed7aa', icon: FaFileContract },
  GARANTIE:            { label: 'Garantie',             color: '#3730a3', bg: '#e0e7ff', border: '#c7d2fe', icon: FaShieldAlt },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',     color: '#155e75', bg: '#cffafe', border: '#a5f3fc', icon: FaBook },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',        color: '#4d7c0f', bg: '#ecfccb', border: '#bef264', icon: FaProjectDiagram },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',   color: '#831843', bg: '#fce7f3', border: '#fbcfe8', icon: FaCertificate },
  BON_LIVRAISON:       { label: 'Bon de livraison',     color: '#92400e', bg: '#fef3c7', border: '#fde68a', icon: FaTruck },
  RAPPORT_AUDIT:       { label: "Rapport d'audit",      color: '#9f1239', bg: '#ffe4e6', border: '#fecaca', icon: FaClipboardCheck },
  AUTRE:               { label: 'Autre',                color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb', icon: FaFile },
};

const DOCUMENT_CATEGORIES = Object.keys(CATEGORY_CONFIG).map(value => ({
  value,
  label: CATEGORY_CONFIG[value].label,
  icon: CATEGORY_CONFIG[value].icon,
}));

// ==========================================================
// --- Composant principal Documents ---
// ==========================================================
function Documents() {
  // --- États ---
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublic, setFilterPublic] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [successMessage] = useState(null);
  const [error, setError] = useState(null);
  const [quickPreview, setQuickPreview] = useState({ show: false, files: [], selectedIndex: 0 });

  // --- États pour le modal d'ajout/édition ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editDocument, setEditDocument] = useState(null);
  const [relationData, setRelationData] = useState({ materiels: [], marques: [], produits: [], tickets: [] });

  // --- Récupération des données ---
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur lors de la récupération des documents:', err);
      setError(err.message || 'Erreur lors de la récupération des documents.');
      MySwal.fire({ icon: 'error', title: 'Erreur', text: 'Impossible de charger les documents.' });
    }
    setLoading(false);
  }, []);

  const loadRelationData = useCallback(async () => {
    try {
      const [materiels, marques, produits, tickets] = await Promise.all([
        fetchMateriels(),
        fetchAMarques(),
        fetchProduits(),
        getTickets(),
      ]);
      setRelationData({
        materiels: Array.isArray(materiels) ? materiels : [],
        marques: Array.isArray(marques) ? marques : [],
        produits: Array.isArray(produits) ? produits : [],
        tickets: Array.isArray(tickets) ? tickets : [],
      });
    } catch (e) {
      console.warn('Données de relations non disponibles pour le modal:', e);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    loadRelationData();
  }, [fetchDocs, loadRelationData]);

  // --- Helpers ---
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatSize = (bytes) => {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const getUploaderName = (doc) => {
    const u = doc?.uploader || doc?.upload_par_data;
    if (u) return u.utilisateur || u.nom || u.email || `Utilisateur #${doc.upload_par}`;
    return doc?.upload_par ? `Utilisateur #${doc.upload_par}` : '—';
  };

  const getRelatedName = (doc, key, list, idKey, nameKey) => {
    const id = doc[key];
    if (id === null || id === undefined) return null;
    const found = list.find(item => String(item[idKey]) === String(id));
    return found ? (found[nameKey] || found[idKey]) : null;
  };

  const getRelatedNames = (doc, relationKey, list, idKey, nameKey) => {
    const relations = doc[relationKey];
    if (!Array.isArray(relations) || relations.length === 0) return [];
    const ids = relations.map(rel => rel[idKey]).filter(Boolean);
    return ids.map(id => {
      const found = list.find(item => String(item[idKey]) === String(id));
      return found ? (found[nameKey] || found[idKey]) : null;
    }).filter(Boolean);
  };

  // --- Filtrage ---
  const filteredDocuments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return documents.filter(doc => {
      const searchMatch =
        !term ||
        (doc.nom_fichier || '').toLowerCase().includes(term) ||
        (doc.description || '').toLowerCase().includes(term) ||
        (doc.type_mime || '').toLowerCase().includes(term) ||
        (doc.chemin_stockage || '').toLowerCase().includes(term) ||
        getUploaderName(doc).toLowerCase().includes(term);

      const catMatch = !activeTab || doc.categorie === activeTab;
      const pubMatch =
        !filterPublic ||
        (filterPublic === 'public' && doc.est_public) ||
        (filterPublic === 'prive' && !doc.est_public);

      return searchMatch && catMatch && pubMatch;
    });
  }, [documents, searchTerm, activeTab, filterPublic]);

  // --- Gestion des modales ---
  const handleOpenAdd = useCallback(() => {
    setEditDocument(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditDocument(null);
  }, []);

  const handleEdit = useCallback(async (row) => {
    setEditDocument(row);
    setIsModalOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedDoc(null);
  }, []);

  const handleView = useCallback((row) => {
    setSelectedDoc(row);
  }, []);

  const handleDeleteConfirm = useCallback(async (row) => {
    try {
      await deleteDocument(row.id);
      setDocuments(prev => prev.filter(d => d.id !== row.id));
      MySwal.fire({ icon: 'success', title: 'Supprimé !', text: 'Le document a été supprimé.', timer: 2500, showConfirmButton: false });
    } catch (err) {
      console.error('Erreur de suppression:', err);
      MySwal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de la suppression.' });
    }
  }, []);

  const confirmDelete = useCallback((row) => {
    MySwal.fire({
      title: 'Confirmer la suppression',
      text: `Supprimer définitivement « ${row.nom_fichier} » ? Cette action est irréversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
    }).then((result) => {
      if (result.isConfirmed) handleDeleteConfirm(row);
    });
  }, [handleDeleteConfirm]);

  const handleResetFilters = useCallback(() => {
    setSearchTerm(''); setActiveTab(''); setFilterPublic('');
  }, []);

  // --- Export Excel ---
  const handleExportExcel = useCallback(() => {
    const dataToExport = filteredDocuments.map(doc => ({
      'ID': doc.id,
      'Nom du fichier': doc.nom_fichier,
      'Catégorie': CATEGORY_CONFIG[doc.categorie]?.label || doc.categorie,
      'Type MIME': doc.type_mime || '—',
      'Taille': formatSize(doc.taille),
      'Version': doc.version,
      'Public': doc.est_public ? 'Oui' : 'Non',
      'Description': doc.description || '—',
      'Matériel(s)': getRelatedNames(doc, 'materiels_lies', relationData.materiels, 'id_materiels', 'code_pc').join(', ') || '—',
      'Marque': getRelatedName(doc, 'id_marque', relationData.marques, 'id_marque', 'nom_marque') || '—',
      'Produit': getRelatedNames(doc, 'produits_lies', relationData.produits, 'id_produit', 'nom_produit').join(', ') || '—',
      'Ticket': getRelatedName(doc, 'id_ticket', relationData.tickets, 'id_ticket', 'titre') || '—',
      'Uploadé par': getUploaderName(doc),
      'Date d\'upload': formatDate(doc.date_upload),
      'Dernière modification': formatDate(doc.derniere_modif),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (!worksheet[cell]) continue;
      worksheet[cell].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' } } };
    }
    worksheet['!cols'] = Object.keys(dataToExport[0] || {}).map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Documents');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(blob, `ged_documents_${stamp}.xlsx`);
  }, [filteredDocuments, relationData]);

  const openQuickPreview = useCallback((row) => {
    const mime = (row.type_mime || '').toLowerCase();
    const ext = (row.nom_fichier || '').split('.').pop().toLowerCase();
    const isPreviewable = mime.includes('pdf') || mime.includes('image') ||
                          mime.includes('word') || mime.includes('docx') || mime.includes('msword') ||
                          mime.includes('excel') || mime.includes('xlsx') || mime.includes('xls') || mime.includes('spreadsheet') ||
                          mime.includes('csv') || mime.includes('text/plain') ||
                          ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ||
                          ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext);

    if (isPreviewable) {
      // Fichiers servis par les routes authentifiées de l'API :
      // url = téléchargement (pièce jointe), previewUrl = affichage inline (PDF/images)
      const mainFile = row.chemin_stockage ? {
        url: getDocumentFileUrl(row.id),
        previewUrl: getDocumentFileUrl(row.id, { inline: true }),
        type: row.type_mime,
        filename: row.nom_fichier,
      } : {};

      const attachments = (row.pieces_jointes || [])
        .map((pj) => ({
          url: getPieceJointeFileUrl(pj.id),
          previewUrl: getPieceJointeFileUrl(pj.id, { inline: true }),
          type: pj.type_mime,
          filename: pj.nom_fichier,
        }))
        .filter((f) => f.url);

      const allFiles = [mainFile, ...attachments].filter((f) => f.url);

      if (allFiles.length > 0) {
        setQuickPreview({ show: true, files: allFiles, selectedIndex: 0 });
      }
    }
  }, []);

  // --- Colonnes ---
  const columns = useMemo(() => {
    const renderCategorie = (row) => {
      const cfg = CATEGORY_CONFIG[row.categorie] || CATEGORY_CONFIG.AUTRE;
      return (
        <span className="doc-chip" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          <FaTag size={10} aria-hidden="true" />
          {cfg.label}
        </span>
      );
    };

    const renderPublic = (row) => (
      <span className={`doc-chip ${row.est_public ? 'doc-chip--public' : 'doc-chip--private'}`}>
        {row.est_public ? <FaGlobe size={10} aria-hidden="true" /> : <FaLock size={10} aria-hidden="true" />}
        {row.est_public ? 'Public' : 'Privé'}
      </span>
    );

    const renderFile = (row) => (
      <div className="d-flex align-items-center gap-2">
        <div className="doc-file-icon" aria-hidden="true">
          <FaFileAlt size={14} />
        </div>
        <div className="doc-file-info">
          <div className="doc-file-name">
            {row.nom_fichier}
          </div>
          <div className="doc-file-meta">
            {row.type_mime || 'Type inconnu'} · {formatSize(row.taille)}
          </div>
        </div>
      </div>
    );

    const renderActions = (row) => (
      <div className="d-flex gap-1" role="group" aria-label="Actions">
        <button type="button" className="btn-icon btn-icon--info" onClick={() => handleView(row)} title="Voir détails" aria-label="Voir détails">
          <FaEye size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon btn-icon--success" onClick={() => openQuickPreview(row)} title="Prévisualiser rapidement" aria-label="Prévisualiser rapidement">
          <FaFileAlt size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon btn-icon--warning" onClick={() => handleEdit(row)} title="Modifier" aria-label="Modifier">
          <FaEdit size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon btn-icon--danger" onClick={() => confirmDelete(row)} title="Supprimer" aria-label="Supprimer">
          <FaTrash size={14} aria-hidden="true" />
        </button>
      </div>
    );

    const renderMateriels = (row) => {
      const names = getRelatedNames(row, 'materiels_lies', relationData.materiels, 'id_materiels', 'code_pc');
      if (names.length === 0) return <span className="text-muted">N/A</span>;
      const maxVisible = 2;
      const visible = names.slice(0, maxVisible);
      const remaining = names.length - maxVisible;
      return (
        <div className="d-flex flex-wrap gap-1">
          {visible.map((name, i) => (
            <span key={i} className="doc-tag doc-tag--materiel">
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="doc-tag doc-tag--more">
              +{remaining}
            </span>
          )}
        </div>
      );
    };

    const renderProduit = (row) => {
      const names = getRelatedNames(row, 'produits_lies', relationData.produits, 'id_produit', 'nom_produit');
      if (names.length === 0) return <span className="text-muted">N/A</span>;
      const maxVisible = 2;
      const visible = names.slice(0, maxVisible);
      const remaining = names.length - maxVisible;
      return (
        <div className="d-flex flex-wrap gap-1">
          {visible.map((name, i) => (
            <span key={i} className="doc-tag doc-tag--produit">
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="doc-tag doc-tag--more">
              +{remaining}
            </span>
          )}
        </div>
      );
    };

    const renderTicket = (row) => {
      const name = getRelatedName(row, 'id_ticket', relationData.tickets, 'id_ticket', 'titre');
      if (!name) return <span className="text-muted">N/A</span>;
      return (
        <span className="doc-tag doc-tag--wide doc-tag--ticket">
          {name}
        </span>
      );
    };

    const renderFilesCount = (row) => {
      const piecesCount = (row.pieces_jointes && Array.isArray(row.pieces_jointes)) ? row.pieces_jointes.length : 0;
      const total = 1 + piecesCount;
      return (
        <span className="doc-tag doc-tag--wide doc-tag--files">
          <FaFileAlt size={10} aria-hidden="true" />
          {total}
        </span>
      );
    };

    return [
      { name: 'Document', cell: renderFile, sortable: true, grow: 2, minWidth: '260px' },
      { name: 'Catégorie', selector: row => row.categorie, sortable: true, grow: 1, cell: renderCategorie, width: '200px' },
      { name: 'Matériel(s)', cell: renderMateriels, sortable: false, grow: 1, minWidth: '140px'},
      { name: 'Produit', cell: renderProduit, sortable: false, grow: 1, minWidth: '120px'},
      { name: 'Ticket', cell: renderTicket, sortable: false, grow: 0.2, minWidth: '90px'},
      { name: 'PJ', cell: renderFilesCount, sortable: false, grow: 1, minWidth: '60', center: true },
      { name: 'Version', selector: row => row.version, sortable: true, grow: 1, width: '100px', center: true },
      { name: 'Visibilité', selector: row => row.est_public, sortable: true, grow: 1, cell: renderPublic, width: '110px', center: true },
      {
        name: 'Uploadé par', selector: row => getUploaderName(row), sortable: true, grow: 1, width: '150px',
        cell: (row) => (
          <span className="doc-cell-meta">
            <FaUser size={11} className="text-muted" aria-hidden="true" />
            {getUploaderName(row)}
          </span>
        ),
      },
      {
        name: 'Date d\'upload', selector: row => row.date_upload, sortable: true, grow: 1, width: '130px',
        cell: (row) => (
          <span className="doc-cell-meta doc-cell-meta--muted">
            <FaCalendarAlt size={11} className="text-muted" aria-hidden="true" />
            {formatDate(row.date_upload)}
          </span>
        ),
      },
      { name: 'Actions', cell: renderActions, ignoreRowClick: true, allowOverflow: true, button: true, width: '110px', grow: 0, center: true },
    ];
  }, [handleView, handleEdit, confirmDelete, relationData, openQuickPreview]);

  const hasActiveFilters = searchTerm || activeTab || filterPublic;

  return (
    <div className="container-fluid py-2 px-2 doc-page">
      <PageHeader
        icon={<FaFileAlt />}
        title="Gestion Documentaire (GED)"
        subtitle="Consultez et gérez vos documents, factures, contrats et plus"
        actions={
          <>
            <button type="button" className="btn-refresh" onClick={fetchDocs} title="Rafraîchir" aria-label="Rafraîchir">
              <FaSync aria-hidden="true" />
            </button>
            <button type="button" className="btn-pill btn-pill-success" title="Importer">
              <FaFileImport size={14} aria-hidden="true" />
              <span>Importer</span>
            </button>
            <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcel} title="Exporter en Excel">
              <FaFileExcel size={14} aria-hidden="true" />
              <span>Exporter</span>
            </button>
            <button type="button" className="btn-pill btn-pill-primary" onClick={handleOpenAdd} title="Ajouter un document">
              <FaPlus size={14} aria-hidden="true" />
              <span>Ajouter</span>
            </button>
          </>
        }
      />

      {/* Carte principale */}
      <Card className="doc-main-card border-0">
        <Card.Body className="p-4 p-lg-5">
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

          {/* Filtres */}
          <div className="row mb-3 g-3">
            <div className="col-md-4">
              <InputGroup className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm">
                <InputGroup.Text className="bg-transparent border-0" aria-hidden="true">
                  <FaSearch className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  className="doc-search-input bg-transparent border-0 shadow-none p-0"
                  placeholder="Rechercher par nom, description, type..."
                  aria-label="Rechercher un document"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button variant="link" className="text-muted p-0 ms-2" onClick={() => setSearchTerm('')} aria-label="Effacer la recherche">
                    <FaTimes aria-hidden="true" />
                  </Button>
                )}
              </InputGroup>
            </div>

            <div className="col-md-12">
              <Tabs
                activeKey={activeTab || 'all'}
                onSelect={(key) => setActiveTab(key === 'all' ? '' : key)}
                className="doc-category-tabs mb-0"
                fill
              >
                <Tab eventKey="all" title={<span className="d-inline-flex align-items-center gap-2"><FaFileAlt size={12} />Toutes</span>} />
                {DOCUMENT_CATEGORIES.map(c => (
                  <Tab key={c.value} eventKey={c.value} title={<span className="d-inline-flex align-items-center gap-2">{<c.icon size={12} />}{c.label}</span>} />
                ))}
              </Tabs>
            </div>

            <div className="col-md-2">
              <Form.Select
                value={filterPublic}
                onChange={(e) => setFilterPublic(e.target.value)}
                className={`filter-pill rounded-pill border-0 shadow-sm ${filterPublic ? 'is-active' : ''}`.trim()}
                aria-label="Filtrer par visibilité"
              >
                <option value="">Tous les accès</option>
                <option value="public">Public</option>
                <option value="prive">Privé</option>
              </Form.Select>
            </div>

            <div className="col-md-auto">
              <div className="d-flex gap-2 align-items-center">
                <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm">
                  <small className="text-muted">
                    <strong className={`doc-count-value ${hasActiveFilters ? 'is-active' : ''}`.trim()}>{filteredDocuments.length}</strong> document{filteredDocuments.length > 1 ? 's' : ''}
                  </small>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline-warning" size="sm" className="doc-reset-btn border-0 rounded-pill"
                    onClick={handleResetFilters}>
                    <FaTimes size={14} className="me-1" aria-hidden="true" />Réinitialiser
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tableau */}
          {loading ? (
            <div className="table-responsive">
              <DataTable
                columns={columns}
                data={[]}
                pagination={false}
                highlightOnHover={false}
                pointerOnHover={false}
                responsive
                progressPending
                progressComponent={
                  <div className="p-5 text-center">
                    <div className="d-flex flex-column align-items-center gap-3">
                      <Spinner animation="grow" variant="primary" size="sm" />
                      <span className="doc-loading-text text-muted">Chargement des documents...</span>
                    </div>
                  </div>
                }
                customStyles={tableCustomStyles}
              />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="table-responsive">
              <table className="doc-empty-table table table-sm">
                <thead>
                  <tr>
                    {columns.map((col, i) => (
                      <th key={i}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={columns.length} className="text-center py-5">
                      <div className="doc-empty-icon" aria-hidden="true"><FaInbox /></div>
                      <div className="doc-empty-title">Aucun document trouvé</div>
                      <div className="doc-empty-text">
                        {hasActiveFilters ? 'Essayez de modifier vos filtres de recherche' : 'Commencez par ajouter un document'}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <DataTable
                columns={columns}
                data={filteredDocuments}
                pagination
                paginationComponentOptions={paginationOptions}
                highlightOnHover
                pointerOnHover
                responsive
                customStyles={tableCustomStyles}
              />
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal Ajout / Édition */}
      <AddDocModal
        show={isModalOpen}
        onClose={handleCloseModal}
        onDocumentAdded={fetchDocs}
        editDocument={editDocument}
      />

      {/* Modal Détails */}
      <DocumentDetailModal
        show={!!selectedDoc}
        onClose={closeDetails}
        doc={selectedDoc}
        relationData={relationData}
        onEdit={handleEdit}
      />

      <QuickPreviewModal
        show={quickPreview.show}
        onHide={() => setQuickPreview({ show: false, files: [], selectedIndex: 0 })}
        files={quickPreview.files}
        selectedIndex={quickPreview.selectedIndex}
        onSelectIndex={(idx) => setQuickPreview((prev) => ({ ...prev, selectedIndex: idx }))}
      />
    </div>
  );
}

export default Documents;
