// src/pages/Documents/Documents.js
// --- Importations React et Bibliothèques ---
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
// --- Importations Bootstrap et Icônes ---
import { Button, Form, InputGroup, Spinner, Card, Alert, Tabs, Tab } from 'react-bootstrap';
import {
  FaEye, FaEdit, FaTrash, FaSearch, FaSync, FaTimes,
  FaPlus, FaFileAlt, FaGlobe, FaLock, FaInbox, FaInfoCircle, FaFileUpload,
  FaTag, FaCodeBranch, FaUser, FaCalendarAlt, FaReceipt, FaFileContract,
  FaShieldAlt, FaBook, FaProjectDiagram, FaCertificate, FaTruck, FaClipboardCheck, FaFile,
  FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileImport
} from 'react-icons/fa';
import AddDocModal from './AddDocModal';
import DocumentDetailModal from './DocumentDetailModal';
import QuickPreviewModal from './QuickPreviewModal';
import { fetchDocuments, fetchMateriels, fetchAMarques, fetchProduits, getTickets, deleteDocument } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import './Documents.css';

const MySwal = withReactContent(Swal);

// ==========================================================
// --- Styles 2026 pour React-Data-Table-Component ---
// ==========================================================
const modernStyles = {
  table: {
    style: {
      backgroundColor: 'transparent',
      borderRadius: '16px',
    },
  },
  headRow: {
    style: {
      backgroundColor: '#f9fafb', border: 'none', minHeight: '52px', borderRadius: '12px 12px 0 0',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'sticky', top: 0, zIndex: 10
    },
  },
  headCells: {
    style: {
      fontSize: '0.75rem', fontWeight: '600', color: '#374151', letterSpacing: '0.02em',
      textTransform: 'uppercase', paddingLeft: '16px', paddingRight: '16px', paddingTop: '14px',
      paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f9fafb',
      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none'
    },
  },
  rows: {
    style: {
      fontSize: '0.85rem', fontWeight: '500', color: '#212529', minHeight: '52px',
      backgroundColor: '#ffffff', transition: 'all 0.2s ease', borderBottom: '1px solid #f3f4f6'
    },
    highlightOnHoverStyle: {
      backgroundColor: '#eef2ff', color: '#1e3a8a', cursor: 'pointer', transitionDuration: '0.2s'
    },
  },
  pagination: {
    style: {
      border: 'none', fontSize: '12px', color: '#6c757d', paddingTop: '16px', paddingBottom: '16px'
    },
  },
};

// --- Configuration de la pagination ---
const paginationOptions = {
  rowsPerPageText: 'Lignes par page :', rangeSeparatorText: 'sur', selectAllRowsItem: true, selectAllRowsItemText: 'Tout'
};

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
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterPublic, setFilterPublic] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
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

  useEffect(() => {
    fetchDocs();
    loadRelationData();
  }, [fetchDocs]);

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
      const buildFileUrl = (path) => {
        if (!path) return null;
        const storagePath = path.startsWith('/') ? path : `/${path}`;
        return `${API_BASE_URL}${storagePath}`;
      };

      const mainFile = {
        url: buildFileUrl(row.chemin_stockage),
        type: row.type_mime,
        filename: row.nom_fichier,
      };

      const attachments = (row.pieces_jointes || [])
        .map((pj) => ({
          url: buildFileUrl(pj.chemin_stockage),
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
        <span style={{
          backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600',
          display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
        }}>
          <FaTag size={10} />
          {cfg.label}
        </span>
      );
    };

    const renderPublic = (row) => (
      <span style={{
        backgroundColor: row.est_public ? '#d1fae5' : '#f3f4f6',
        color: row.est_public ? '#065f46' : '#6b7280',
        border: `1px solid ${row.est_public ? '#a7f3d0' : '#e5e7eb'}`,
        padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        {row.est_public ? <FaGlobe size={10} /> : <FaLock size={10} />}
        {row.est_public ? 'Public' : 'Privé'}
      </span>
    );

    const renderFile = (row) => (
      <div className="d-flex align-items-center gap-2">
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FaFileAlt size={14} className="text-white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.nom_fichier}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
            {row.type_mime || 'Type inconnu'} · {formatSize(row.taille)}
          </div>
        </div>
      </div>
    );

    const renderActions = (row) => (
      <div className="d-flex gap-1" role="group" aria-label="Actions">
        <Button variant="light" className="shadow-sm border-0 p-2 rounded-circle doc-btn-action" onClick={() => handleView(row)} title="Voir détails">
          <FaEye size={14} className="text-info" />
        </Button>
        <Button 
          variant="light" 
          className="shadow-sm border-0 p-2 rounded-circle doc-btn-action" 
          onClick={() => openQuickPreview(row)} 
          title="Prévisualiser rapidement"
        >
          <FaFileAlt size={14} className="text-success" />
        </Button>
        <Button variant="light" className="shadow-sm border-0 p-2 rounded-circle doc-btn-action" onClick={() => handleEdit(row)} title="Modifier">
          <FaEdit size={14} className="text-warning" />
        </Button>
        <Button variant="light" className="shadow-sm border-0 p-2 rounded-circle doc-btn-action" onClick={() => confirmDelete(row)} title="Supprimer">
          <FaTrash size={14} className="text-danger" />
        </Button>
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
            <span key={i} style={{
              backgroundColor: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe',
              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600',
              whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span style={{
              backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600',
            }}>
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
            <span key={i} style={{
              backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600',
              whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          ))}
          {remaining > 0 && (
            <span style={{
              backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600',
            }}>
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
        <span style={{
          backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa',
          padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
      );
    };

    const renderFilesCount = (row) => {
      const piecesCount = (row.pieces_jointes && Array.isArray(row.pieces_jointes)) ? row.pieces_jointes.length : 0;
      const total = 1 + piecesCount;
      return (
        <span style={{
          backgroundColor: '#fdf2f8', color: '#9d174d', border: '1px solid #fbcfe8',
          padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600',
          display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
        }}>
          <FaFileAlt size={10} />
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
          <span className="d-inline-flex align-items-center gap-2" style={{ fontSize: '0.82rem', color: '#374151' }}>
            <FaUser size={11} className="text-muted" />
            {getUploaderName(row)}
          </span>
        ),
      },
      {
        name: 'Date d\'upload', selector: row => row.date_upload, sortable: true, grow: 1, width: '130px',
        cell: (row) => (
          <span className="d-inline-flex align-items-center gap-2" style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            <FaCalendarAlt size={11} className="text-muted" />
            {formatDate(row.date_upload)}
          </span>
        ),
      },
      { name: 'Actions', cell: renderActions, ignoreRowClick: true, allowOverflow: true, button: true, width: '110px', grow: 0, center: true },
    ];
  }, [handleView, handleEdit, confirmDelete, relationData, openQuickPreview]);

  const hasActiveFilters = searchTerm || activeTab || filterPublic;

  return (
    <div className="container-fluid py-2 px-2 doc-page" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded-3 doc-header">
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)', pointerEvents: 'none'
        }} />
        <div className="d-flex align-items-center gap-3 position-relative">
          <div className="d-flex align-items-center justify-content-center flex-shrink-0 doc-header-icon">
            <FaFileAlt className="text-white" style={{ fontSize: '1.25rem' }} />
          </div>
          <div>
            <h1 className="h5 fw-bold text-white mb-0">Gestion Documentaire (GED)</h1>
            <p className="text-white mb-0" style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              Consultez et gérez vos documents, factures, contrats et plus
            </p>
          </div>
        </div>

        <div className="d-flex gap-2 position-relative">
          <Button className="btn-pill btn-pill-ghost btn-refresh" onClick={fetchDocs} title="Rafraîchir">
            <FaSync />
          </Button>
          <Button className="btn-pill btn-pill-success" title="Importer">
            <FaFileImport size={14} />
            <span className="ms-2">Importer</span>
          </Button>
          <Button className="btn-pill btn-pill-warning" onClick={handleExportExcel} title="Exporter en Excel">
            <FaFileExcel size={14} />
            <span className="ms-2">Exporter</span>
          </Button>
          <Button className="btn-pill btn-pill-primary" onClick={handleOpenAdd} title="Ajouter un document">
            <FaPlus size={14} />
            <span className="ms-2">Ajouter</span>
          </Button>
        </div>
      </div>

      {/* Carte principale */}
      <Card className="border-0" style={{ borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Card.Body className="p-4 p-lg-5">
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

          {/* Filtres */}
          <div className="row mb-3 g-3">
            <div className="col-md-4">
              <InputGroup className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{ transition: 'all 0.2s ease' }}>
                <InputGroup.Text className="bg-transparent border-0">
                  <FaSearch className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  className="bg-transparent border-0 shadow-none p-0"
                  placeholder="Rechercher par nom, description, type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
                {searchTerm && (
                  <Button variant="link" className="text-muted p-0 ms-2" onClick={() => setSearchTerm('')}>
                    <FaTimes />
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
                className="rounded-pill border-0 shadow-sm"
                style={{
                  backgroundColor: filterPublic ? '#e0e7ff' : '#f8f9fa',
                  height: '38px', fontSize: '0.85rem',
                  color: filterPublic ? '#4338ca' : '#374151',
                  fontWeight: filterPublic ? '600' : '400', transition: 'all 0.2s ease',
                }}
              >
                <option value="">Tous les accès</option>
                <option value="public">Public</option>
                <option value="prive">Privé</option>
              </Form.Select>
            </div>

            <div className="col-md-auto">
              <div className="d-flex gap-2 align-items-center">
                <div className="bg-light rounded-pill px-3 py-2 border-0 shadow-sm" style={{
                  backgroundColor: hasActiveFilters ? '#fef3c7' : '#f8f9fa', transition: 'all 0.2s ease'
                }}>
                  <small className="text-muted">
                    <strong style={{ color: hasActiveFilters ? '#92400e' : '#374151' }}>{filteredDocuments.length}</strong> document{filteredDocuments.length > 1 ? 's' : ''}
                  </small>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline-warning" size="sm" className="border-0 rounded-pill"
                    onClick={handleResetFilters}
                    style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '600', fontSize: '0.8rem' }}>
                    <FaTimes size={14} className="me-1" />Réinitialiser
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
                      <span className="text-muted" style={{ fontSize: '0.9rem' }}>Chargement des documents...</span>
                    </div>
                  </div>
                }
                customStyles={modernStyles}
              />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="table-responsive">
              <table className="table table-sm" style={{ fontSize: '0.85rem', minWidth: '100%' }}>
                <thead>
                  <tr>
                    {columns.map((col, i) => (
                      <th key={i} style={{
                        fontSize: '0.75rem', fontWeight: '600', color: '#374151', paddingLeft: '16px', paddingRight: '16px',
                        paddingTop: '14px', paddingBottom: '14px', textAlign: 'left', backgroundColor: '#f9fafb',
                        borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none'
                      }}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={columns.length} className="text-center py-5">
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#6366f1' }}><FaInbox /></div>
                      <div style={{ color: '#6c757d', fontSize: '0.95rem', fontWeight: '500' }}>Aucun document trouvé</div>
                      <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>
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
                customStyles={modernStyles}
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
