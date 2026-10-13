import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DataTable from 'react-data-table-component';
import { Button, Alert, Spinner } from 'react-bootstrap';
import {
  FaList, FaCheckCircle,
  FaDownload, FaSyncAlt, FaPlus, FaSearch, FaTimes,
  FaClock, FaExclamationTriangle, FaPaperPlane,
  FaFlag, FaArchive, FaUser, FaLaptop,
  FaArrowRight, FaInfoCircle, FaStar, FaStarHalfAlt, FaTicketAlt, FaCommentDots
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MySwal } from '../../utils/swal';
import TicketModal from './TicketModal';
import TicketDetailsModal from './TicketDetailsModal';
import CloseTicketModal from './CloseTicketModal';
import './Tickets.css';
import AppModal from '../../components/AppModal/AppModal';
import PageHeader from '../../components/PageHeader/PageHeader';
import { tableStyles, paginationOptions } from '../../styles/dataTableTheme';
import { getTickets, deleteTicket, fetchAllMaterielsIt, assignTicket, fetchCommentaires, fetchCommentairesByTicket, addCommentaire, deleteCommentaire } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/api';

const STATUS_CONFIG = {
  NOUVEAU: { label: 'Nouveau', bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', icon: FaInfoCircle },
  EN_COURS: { label: 'En cours', bg: '#fed7aa', text: '#92400e', border: '#fbbf24', icon: FaClock },
  RESOLU: { label: 'Résolu', bg: '#c6f6d5', text: '#2f855a', border: '#9ae6b4', icon: FaCheckCircle },
  FERME: { label: 'Fermé', bg: '#edf2f7', text: '#4a5568', border: '#cbd5e0', icon: FaArchive },
};

const PRIORITY_CONFIG = {
  HAUTE: { label: 'Haute', color: '#e53e3e', icon: FaFlag },
  URGENTE: { label: 'Urgente', color: '#c53030', icon: FaExclamationTriangle },
  MOYENNE: { label: 'Moyenne', color: '#d69e2e', icon: FaStarHalfAlt },
  BASSE: { label: 'Basse', color: '#718096', icon: FaStar },
};

// Thème commun des tableaux + spécificités de la page
const tableCustomStyles = tableStyles({
  rows: { style: { fontSize: '13px', minHeight: '60px' } },
});

const ExpandableComments = ({ data }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const ticketId = data.idTicket;
  // IT_ADMIN/DIRECTION peuvent supprimer tout commentaire ; un USER seulement les siens
  // (l'auteur d'un commentaire est identifié par son id_n).
  const isTicketAdmin = hasPermission(user?.role, PERMISSIONS.TICKETS_CLOSE);
  const canDeleteComment = (c) => isTicketAdmin || (user?.id_n !== '' && String(c.idAuteur) === String(user?.id_n));

  const fetchComments = useCallback(async (id) => {
    setCommentsLoading(true);
    try {
      const data = await fetchCommentairesByTicket(id);
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur fetchCommentairesByTicket:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) fetchComments(ticketId);
  }, [ticketId, fetchComments]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    const contenu = newComment.trim();
    if (!contenu || !ticketId) return;
    setCommentSubmitting(true);
    try {
      // L'auteur est l'utilisateur connecté, déduit côté serveur
      await addCommentaire({ contenu, idTicket: ticketId });
      setNewComment('');
      await fetchComments(ticketId);
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de l\'ajout du commentaire.' });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (id) => {
    const result = await MySwal.fire({
      icon: 'question', title: 'Supprimer', text: 'Voulez-vous supprimer ce commentaire ?',
      showCancelButton: true, confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler',
      confirmButtonColor: '#e53e3e',
    });
    if (!result.isConfirmed) return;
    try {
      await deleteCommentaire(id);
      await fetchComments(ticketId);
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de la suppression.' });
    }
  };

  const isClosed = ['FERME', 'CLOS', 'CLOTURE', 'CLÔTURÉ', 'FERME', 'RESOLU'].includes(data?.statut) || data?.fermeture;

  return (
    <div className="tck-comments-section tck-comments-section--expanded">
      {commentsLoading ? (
        <div className="tck-loading-inline">
          <Spinner animation="border" size="sm" />
          <span>Chargement des commentaires...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="tck-comments-empty">Aucun commentaire pour ce ticket.</p>
      ) : (
        <div className="tck-comment-list">
          {comments.map((c) => {
            const auteurNom = c.auteur?.materiel?.utilisateur || c.auteur?.emails?.[0]?.email || 'Utilisateur';
            const auteurEquipe = c.auteur?.materiel?.equipe || '';
            return (
              <div key={c.idCommentaire} className="tck-comment-item">
                <div className="tck-comment-header">
                  <span className="tck-comment-avatar">{auteurNom.charAt(0).toUpperCase()}</span>
                  <span className="tck-comment-meta">
                    <span className="tck-comment-author">{auteurNom}</span>
                    {auteurEquipe && <span className="tck-comment-team">{auteurEquipe}</span>}
                    <span className="tck-comment-date">{c.datePubli ? new Date(c.datePubli).toLocaleString('fr-FR') : ''}</span>
                  </span>
                  {!isClosed && canDeleteComment(c) && (
                    <button type="button" className="tck-comment-delete-btn" onClick={() => handleDeleteComment(c.idCommentaire)} title="Supprimer" aria-label="Supprimer le commentaire">
                      <FaTimes size={11} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="tck-comment-content">{c.contenu}</p>
              </div>
            );
          })}
        </div>
      )}

      {!isClosed && (
        <form className="tck-comment-form" onSubmit={handleAddComment}>
          <textarea
            className="tck-comment-textarea"
            placeholder="Ajouter un commentaire..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="d-flex justify-content-end mt-2">
            <button type="submit" className="tck-comment-submit-btn" disabled={commentSubmitting || !newComment.trim()}>
              <FaPaperPlane size={12} className="tck-btn-icon" aria-hidden="true" />
              {commentSubmitting ? 'Envoi...' : 'Commenter'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const TicketList = () => {
  const { user } = useAuth();
  // Assigner, fermer et supprimer un ticket sont réservés à IT_ADMIN/DIRECTION
  const canManageTickets = hasPermission(user?.role, PERMISSIONS.TICKETS_CLOSE);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPriorite, setFilterPriorite] = useState('');

  const [showModal, setShowModal] = useState({ show: false, type: '', data: null });
  const [showDetailsModal, setShowDetailsModal] = useState({ show: false, ticketId: null });
  const [showCloseModal, setShowCloseModal] = useState({ show: false, ticketId: null });
  const [deleteId, setDeleteId] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTickets();
      const ticketsList = Array.isArray(data) ? data : (data.tickets || []);
      let commentCountMap = {};
      try {
        const allComments = await fetchCommentaires();
        const commentsList = Array.isArray(allComments) ? allComments : (allComments.commentaires || allComments.data || []);
        if (Array.isArray(commentsList)) {
          commentCountMap = commentsList.reduce((acc, c) => {
            const key = c.idTicket;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});
        }
      } catch (cErr) {
        console.error('Erreur fetchCommentaires:', cErr);
      }
      setTickets(ticketsList.map((t) => ({
        ...t,
        commentairesCount: commentCountMap[t.idTicket] || 0,
      })));
    } catch (err) {
      console.error('Erreur getTickets:', err);
      setError(err.message || 'Erreur lors du chargement des tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // --- Handlers des modales ---
  const handleOpenAdd = useCallback(() => setShowModal({ show: true, type: 'add', data: null }), []);
  const handleOpenEdit = useCallback((row) => setShowModal({ show: true, type: 'edit', data: row }), []);
  const handleCloseModal = useCallback(() => setShowModal({ show: false, type: '', data: null }), []);

  const handleOpenDetails = useCallback((row) => setShowDetailsModal({ show: true, ticketId: row.idTicket }), []);
  const handleCloseDetails = useCallback(() => setShowDetailsModal({ show: false, ticketId: null }), []);

  const handleOpenClose = useCallback((row) => setShowCloseModal({ show: true, ticketId: row.idTicket }), []);
  const handleCloseClose = useCallback(() => setShowCloseModal({ show: false, ticketId: null }), []);

  const handleSaveSuccess = useCallback(() => {
    fetchTickets();
    MySwal.fire({ icon: 'success', title: 'Succès', text: 'Ticket enregistré avec succès.', timer: 2000, showConfirmButton: false });
  }, [fetchTickets]);

  const handleSaveError = useCallback((err) => {
    MySwal.fire({ icon: 'error', title: 'Erreur', text: err?.message || 'Une erreur est survenue.' });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchTerm(''); setFilterStatut(''); setFilterPriorite('');
  }, []);

  // --- Suppression ---
  const confirmDelete = useCallback((id) => {
    setDeleteId(id);
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteId) return;
    setProcessing(true);
    try {
      await deleteTicket(deleteId);
      setTickets((prev) => prev.filter((t) => t.idTicket !== deleteId));
      MySwal.fire({ icon: 'success', title: 'Supprimé !', text: 'Le ticket a été supprimé.', timer: 2000, showConfirmButton: false });
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de la suppression.' });
    } finally {
      setProcessing(false);
      setDeleteId(null);
    }
  }, [deleteId]);

  // --- Assignation ---
  const handleAssign = useCallback(async (id) => {
    try {
      const techs = await fetchAllMaterielsIt();
      const unique = Array.from(new Map(techs.map(t => [t.id_n, t])).values());
      const options = unique.map(t => ({ value: String(t.id_n), text: `${t.utilisateur || 'N/A'} (${t.equipe || 'N/A'})` }));

      const { value: selected } = await MySwal.fire({
        title: 'Assigner le ticket',
        input: 'select',
        inputOptions: Object.fromEntries(options.map(o => [o.value, o.text])),
        inputPlaceholder: 'Choisir un technicien',
        showCancelButton: true,
        confirmButtonText: 'Assigner',
        cancelButtonText: 'Annuler',
        inputValidator: (v) => !v ? 'Veuillez choisir un technicien.' : undefined,
      });

      if (!selected) return;
      setProcessing(true);
      const tech = unique.find(t => String(t.id_n) === selected);
      const nomAssigneFormate = tech ? `N° ${tech.id_n} : ${tech.utilisateur || 'N/A'} (${tech.equipe || 'N/A'})` : '';
      await assignTicket(id, parseInt(selected, 10), nomAssigneFormate);
      await fetchTickets();
      MySwal.fire({ icon: 'success', title: 'Assigné !', text: `Ticket assigné à ${tech?.utilisateur || ''}.`, timer: 2000, showConfirmButton: false });
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Échec de l\'assignation.' });
    } finally {
      setProcessing(false);
    }
  }, [fetchTickets]);

  // --- Filtrage ---
  const filteredTickets = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tickets.filter((t) => {
      const searchMatch =
        !term ||
        (t.numeroTicket || '').toLowerCase().includes(term) ||
        (t.titre || '').toLowerCase().includes(term) ||
        (t.nomDemandeurFormate || t.nomDemandeur || '').toLowerCase().includes(term) ||
        (t.equipeDemandeur || t.demandeur?.materiel?.equipe || '').toLowerCase().includes(term) ||
        (t.nomAssigneFormate || t.nomAssigne || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term);

      const statutMatch = !filterStatut || t.statut === filterStatut;
      const prioriteMatch = !filterPriorite || t.priorite === filterPriorite;

      return searchMatch && statutMatch && prioriteMatch;
    });
  }, [tickets, searchTerm, filterStatut, filterPriorite]);

  // --- Export Excel ---
  const parseFormattedNameExport = (formatted) => {
    if (!formatted) return null;
    const match = formatted.match(/^N°\s*(\d+)\s*:\s*(.+?)\s*\(([^)]*)\)\s*$/);
    if (match) {
      return { id_n: match[1], nom: match[2].trim(), equipe: match[3].trim() };
    }
    return null;
  };

  const handleExportExcel = useCallback(() => {
    const dataToExport = filteredTickets.map((t) => {
      const parsedDemandeur = parseFormattedNameExport(t.nomDemandeurFormate);
      const parsedAssigne = parseFormattedNameExport(t.nomAssigneFormate);
      return {
        'N° Ticket': t.numeroTicket,
        'Titre': t.titre,
        'Description': t.description,
        'Statut': STATUS_CONFIG[t.statut]?.label || t.statut,
        'Priorité': PRIORITY_CONFIG[t.priorite]?.label || t.priorite,
        'Demandeur': parsedDemandeur?.nom || t.nomDemandeur || t.demandeur?.utilisateur || t.demandeur?.email_1 || '',
        'ID Demandeur': parsedDemandeur?.id_n || t.demandeur?.id_n || '',
        'Équipe demandeur': parsedDemandeur?.equipe || t.demandeur?.materiel?.equipe || t.equipeDemandeur || '',
        'Matériel': t.materiels?.caracteristiques || t.materiels?.nom_materiel || `ID: ${t.idMateriels}`,
        'Local': t.materiels?.local?.nom_local || '—',
        'Assigné à': parsedAssigne?.nom || t.nomAssigne || t.assigne?.utilisateur || t.assigne?.email_1 || '',
        'ID Assigné': parsedAssigne?.id_n || t.assigneA?.id_n || '',
        'Équipe assigné': parsedAssigne?.equipe || t.assigne?.materiel?.equipe || '',
        'Créé le': t.dateCreation ? new Date(t.dateCreation).toLocaleDateString('fr-FR') : '',
        'Mis à jour le': t.dateMaj ? new Date(t.dateMaj).toLocaleDateString('fr-FR') : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (worksheet[addr]) worksheet[addr].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' } } };
    }
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 30 }, { wch: 45 }, { wch: 12 }, { wch: 12 },
      { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 18 },
      { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const date = new Date().toISOString().slice(0, 10);
    saveAs(blob, `tickets_${date}.xlsx`);
  }, [filteredTickets]);

  // --- Colonnes ---
  const columns = useMemo(() => {
    const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—');

    const renderStatus = (row) => {
      const cfg = STATUS_CONFIG[row.statut] || STATUS_CONFIG.NOUVEAU;
      const Icon = cfg.icon;
      return (
        <span className="tck-status-badge" style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
          <Icon size={11} className="tck-badge-icon" aria-hidden="true" /> {cfg.label}
        </span>
      );
    };

    const renderPriority = (row) => {
      const cfg = PRIORITY_CONFIG[row.priorite] || PRIORITY_CONFIG.MOYENNE;
      const Icon = cfg.icon;
      return (
        <span className="tck-priority-badge" style={{ backgroundColor: cfg.color + '20', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
          <Icon size={11} className="tck-badge-icon" aria-hidden="true" /> {cfg.label}
        </span>
      );
    };

    const renderMateriel = (row) => {
      const materielLabel = row.materiels?.caracteristiques || row.materiels?.nom_materiel;
      const idMat = row.idMateriels ? `ID: ${row.idMateriels}` : null;
      const label = materielLabel || idMat || '—';
      return (
        <span className="tck-materiel">
          <FaLaptop size={12} className="tck-materiel-icon" aria-hidden="true" />
          {label}
        </span>
      );
    };

    const renderUserChip = ({ nom, equipe, isInconnu, unassignedLabel, color, icon }) => {
      if (isInconnu) {
        return (
          <span className="tck-unassigned" title={unassignedLabel}>
            {icon && <span className="tck-unassigned-icon" aria-hidden="true">{icon}</span>}
            {unassignedLabel}
          </span>
        );
      }

      return (
        <span
          className="tck-user"
          style={color ? { borderColor: `${color}40`, backgroundColor: `${color}0d` } : undefined}
          title={equipe ? `${nom} — ${equipe}` : nom}
        >
          <span className="tck-user-info">
            <span className="tck-user-name">{nom}</span>
            {equipe && <span className="tck-user-team">{equipe}</span>}
          </span>
        </span>
      );
    };

    const parseFormattedName = (formatted) => {
      if (!formatted) return null;
      const match = formatted.match(/^N°\s*(\d+)\s*:\s*(.+?)\s*\(([^)]*)\)\s*$/);
      if (match) {
        return { id_n: match[1], nom: match[2].trim(), equipe: match[3].trim() };
      }
      return null;
    };

    const renderDemandeur = (row) => {
      let nom = row.nomDemandeur || row.demandeur?.utilisateur || row.demandeur?.email_1 || '';
      let equipe = row.demandeur?.materiel?.equipe || '';
      let id_n = row.demandeur?.id_n;

      const parsed = parseFormattedName(row.nomDemandeurFormate);
      if (parsed) {
        id_n = parsed.id_n;
        nom = parsed.nom;
        equipe = parsed.equipe || equipe;
      }

      const formattedNom = id_n ? `N° ${id_n} : ${nom}` : nom;
      const isInconnu = !nom || nom === 'Inconnu' || nom === 'N/A' || nom === '—';
      return renderUserChip({ nom: formattedNom, equipe, isInconnu, unassignedLabel: 'Inconnu', color: '#4f46e5' });
    };

    const renderAssigne = (row) => {
      let nom = row.nomAssigne || row.assigne?.utilisateur || row.assigne?.email_1 || '';
      let equipe = row.assigne?.materiel?.equipe || '';
      let id_n = row.assigneA?.id_n;

      const parsed = parseFormattedName(row.nomAssigneFormate);
      if (parsed) {
        id_n = parsed.id_n;
        nom = parsed.nom;
        equipe = parsed.equipe || equipe;
      }

      const formattedNom = id_n ? `N° ${id_n} : ${nom}` : nom;
      const isInconnu = !nom || nom === 'Inconnu' || nom === 'N/A' || nom === '—';
      return renderUserChip({ nom: formattedNom, equipe, isInconnu, unassignedLabel: 'Non assigné', color: '#2563eb', icon: <FaUser size={12} /> });
    };


    const renderActions = (row) => {
      const isClosed = ['FERME', 'CLOS', 'CLOTURE', 'CLÔTURÉ', 'FERME', 'RESOLU'].includes(row.statut) || row.fermeture;
      return (
        <div className="d-flex align-items-center gap-2" role="group" aria-label="Actions">
          <button type="button" className="btn-icon btn-icon--info" onClick={() => handleOpenDetails(row)} title="Voir détails" aria-label="Voir détails">
            <FaInfoCircle size={14} aria-hidden="true" />
          </button>
          {isClosed && (
            <span className="tck-closed-pill">
              Fermé
            </span>
          )}
          {!isClosed && (
            <button type="button" className="btn-icon btn-icon--warning" onClick={() => handleOpenEdit(row)} title="Modifier" aria-label="Modifier">
              <FaPaperPlane size={14} className="tck-icon-tilt" aria-hidden="true" />
            </button>
          )}
          {canManageTickets && !isClosed && !row.idAssigne && (
            <button type="button" className="btn-icon btn-icon--primary" onClick={() => handleAssign(row.idTicket)} title="Assigner" aria-label="Assigner">
              <FaUser size={14} aria-hidden="true" />
            </button>
          )}
          {canManageTickets && !isClosed && (
            <button type="button" className="btn-icon btn-icon--success" onClick={() => handleOpenClose(row)} title="Résolu" aria-label="Résolu">
              <FaCheckCircle size={14} aria-hidden="true" />
            </button>
          )}
          {canManageTickets && (
            <button type="button" className="btn-icon btn-icon--danger" onClick={() => confirmDelete(row.idTicket)} title="Supprimer" aria-label="Supprimer">
              <FaTimes size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      );
    };

    return [
      { name: 'N° Ticket', selector: (row) => row.numeroTicket, sortable: true, minWidth: '130px', grow: 1 },
      { name: 'Titre', selector: (row) => row.titre, sortable: true, minWidth: '200px', grow: 2 },
      { name: 'Demandeur', cell: renderDemandeur, sortable: true, sortFunction: (a, b) => {
          const na = a.nomDemandeurFormate || a.nomDemandeur || a.demandeur?.utilisateur || a.demandeur?.email_1 || '';
          const nb = b.nomDemandeurFormate || b.nomDemandeur || b.demandeur?.utilisateur || b.demandeur?.email_1 || '';
          return na.localeCompare(nb, 'fr', { sensitivity: 'base' });
        }, minWidth: '200px', grow: 1 },
      { name: 'Matériel', cell: renderMateriel, sortable: true, minWidth: '180px', grow: 1.5 },
      { name: 'Local', cell: (row) => row.materiels?.local?.nom_local || '—', sortable: true, minWidth: '140px', grow: 1 },
      { name: 'Assigné à', cell: renderAssigne, sortable: true, minWidth: '160px', grow: 1 },
      { name: 'Statut', cell: renderStatus, sortable: true, minWidth: '120px', grow: 1, center: true },
      { name: 'Priorité', cell: renderPriority, sortable: true, minWidth: '120px', grow: 1, center: true },
      { name: 'Créé le', cell: (row) => formatDate(row.dateCreation), sortable: true, minWidth: '110px', grow: 0.8, center: true },
      { name: 'Actions', cell: renderActions, ignoreRowClick: true, allowOverflow: true, button: true, width: '200px', grow: 0, center: true },
    ];
  }, [handleOpenDetails, handleOpenEdit, handleAssign, handleOpenClose, confirmDelete, canManageTickets]);

  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.statut !== 'FERME' && t.statut !== 'CLOS' && t.statut !== 'RESOLU').length;
  const closedTickets = totalTickets - openTickets;
  const inProgressTickets = tickets.filter((t) => t.statut === 'EN_COURS').length;
  const resolvedTickets = tickets.filter((t) => t.statut === 'RESOLU').length;

  return (
    <div className="tck-page container-fluid py-2 px-2">
      <PageHeader
        icon={<FaTicketAlt />}
        title="Gestion des Tickets"
        subtitle="Suivez et traitez les demandes de support"
        background="var(--gradient-primary-dark)"
        actions={
          <>
            <button type="button" className="btn-refresh" onClick={fetchTickets} title="Rafraîchir" aria-label="Rafraîchir">
              <FaSyncAlt aria-hidden="true" />
            </button>
            <button type="button" className="btn-pill btn-pill-warning" onClick={handleExportExcel} disabled={loading || filteredTickets.length === 0}>
              <FaDownload size={15} aria-hidden="true" />
              <span>Exporter</span>
            </button>
            <button type="button" className="btn-pill btn-pill-primary" onClick={handleOpenAdd}>
              <FaPlus size={16} aria-hidden="true" />
              <span>Ajouter</span>
            </button>
          </>
        }
      />

      {/* Statistiques rapides */}
      <div className="tck-stats row g-3 mb-4">
        <div className="col-6 col-md">
          <div className="tck-stat-card">
            <div className="tck-stat-icon tck-stat-total" aria-hidden="true"><FaList /></div>
            <div>
              <div className="tck-stat-value">{totalTickets}</div>
              <div className="tck-stat-label">Total des tickets</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="tck-stat-card">
            <div className="tck-stat-icon tck-stat-open" aria-hidden="true"><FaClock /></div>
            <div>
              <div className="tck-stat-value">{openTickets}</div>
              <div className="tck-stat-label">Tickets ouverts</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="tck-stat-card">
            <div className="tck-stat-icon tck-stat-inprogress" aria-hidden="true"><FaSyncAlt /></div>
            <div>
              <div className="tck-stat-value">{inProgressTickets}</div>
              <div className="tck-stat-label">Tickets en cours</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="tck-stat-card">
            <div className="tck-stat-icon tck-stat-resolved" aria-hidden="true"><FaCheckCircle /></div>
            <div>
              <div className="tck-stat-value">{resolvedTickets}</div>
              <div className="tck-stat-label">Tickets résolus</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="tck-stat-card">
            <div className="tck-stat-icon tck-stat-closed" aria-hidden="true"><FaArchive /></div>
            <div>
              <div className="tck-stat-value">{closedTickets}</div>
              <div className="tck-stat-label">Tickets fermés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="tck-filters-card mb-3 p-3 rounded-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text tck-search-icon" aria-hidden="true"><FaSearch /></span>
              <input
                type="text"
                className="form-control tck-search-input"
                placeholder="Rechercher par n°, titre, demandeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button type="button" className="btn tck-clear-btn" onClick={() => setSearchTerm('')} title="Effacer" aria-label="Effacer la recherche">
                  <FaTimes aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="tck-select-wrapper">
              <select className="form-select tck-select" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="tck-select-wrapper">
              <select className="form-select tck-select" value={filterPriorite} onChange={(e) => setFilterPriorite(e.target.value)}>
                <option value="">Toutes les priorités</option>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="col-12 col-md-1 d-grid">
            <Button variant="light" className="tck-reset-btn" onClick={handleResetFilters} title="Réinitialiser" aria-label="Réinitialiser les filtres">
              <FaTimes aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="tck-table-card rounded-3 p-3">
        {error && (
          <Alert variant="danger" className="tck-alert mb-3">
            <FaTimes className="me-2" /> {error}
          </Alert>
        )}

        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" className="tck-spinner" />
            <span className="ms-3 text-muted">Chargement des tickets...</span>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredTickets}
            customStyles={tableCustomStyles}
            persistTableHead
            pagination
            paginationComponentOptions={paginationOptions}
            highlightOnHover
            pointerOnHover
            responsive
            expandableRows
            expandableRowsComponent={ExpandableComments}
            expandableRowIcon={<span className="tck-expand-icon"><FaArrowRight size={12} /><FaCommentDots size={12} className="tck-expand-icon__comments" /></span>}
            expandableRowCollapsedIcon={<span className="tck-expand-icon tck-expand-icon--open"><FaArrowRight size={12} className="tck-expand-icon__arrow" /><FaCommentDots size={12} className="tck-expand-icon__comments" /></span>}
            noDataComponent={
              <div className="tck-empty py-5 text-center">
                <div className="tck-empty-icon" aria-hidden="true">
                  <FaTicketAlt size={36} />
                </div>
                <div className="tck-empty-title fw-bold mb-1">Aucun ticket trouvé</div>
                <div className="tck-empty-text text-muted">Essayez avec d'autres filtres.</div>
              </div>
            }
          />
        )}
      </div>

      {/* Modals */}
      <TicketModal
        show={showModal.show}
        onClose={handleCloseModal}
        type={showModal.type}
        ticketData={showModal.data}
        onSaveSuccess={handleSaveSuccess}
        onError={handleSaveError}
      />

      <TicketDetailsModal
        show={showDetailsModal.show}
        handleClose={handleCloseDetails}
        ticketId={showDetailsModal.ticketId}
      />

      <CloseTicketModal
        show={showCloseModal.show}
        ticketId={showCloseModal.ticketId}
        onClose={handleCloseClose}
        onSuccess={fetchTickets}
      />

      {/* Confirmation suppression */}
      <AppModal
        show={deleteId !== null}
        onClose={() => setDeleteId(null)}
        hideHeader
        size="sm"
        closeOnBackdrop
        ariaLabel="Confirmer la suppression"
        contentClassName="tck-confirm-card"
        bodyClassName="tck-confirm-body"
      >
        <div className="tck-confirm-icon" aria-hidden="true"><FaTimes /></div>
        <h5 className="fw-bold mb-2">Confirmer la suppression</h5>
        <p className="text-muted mb-4">Voulez-vous vraiment supprimer ce ticket ? Cette action est irréversible.</p>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="add-modal-cancel-btn" onClick={() => setDeleteId(null)} disabled={processing}>Annuler</button>
          <button type="button" className="btn-pill btn-pill-danger" onClick={handleDeleteConfirmed} disabled={processing}>
            {processing ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </AppModal>
    </div>
  );
};

export default TicketList;
