// src/pages/Documents/AddDocModal.js
// Composant modal d'ajout / édition de document (GED)
// Cohérent avec le modèle Prisma `Document` (backend-Prisma/prisma/schema.prisma)
//   - nom_fichier, categorie (enum DocumentCategory), description, version, est_public
//   - relations : id_marque, id_ticket, materiels_lies (n..n), produits_lies (n..n)
//   - upload_par est défini côté serveur via le token d'authentification
// Drag & drop : react-dropzone  |  Sélections multiples : react-select (multi + cases à cocher)

import React, { useState, useEffect, useCallback } from 'react';
import Select, { components } from 'react-select';
import { useDropzone } from 'react-dropzone';
import { MySwal } from '../../utils/swal';
import {
  FaFileUpload, FaTimes, FaCheck, FaCloudUploadAlt, FaPaperclip,
  FaTag, FaFileAlt, FaGlobe, FaLock, FaCodeBranch, FaLink,
  FaPlus, FaTrash, FaInfoCircle, FaSpinner
} from 'react-icons/fa';
import {
  fetchMateriels, fetchAMarques, fetchProduits, getTickets,
  createDocumentWithFile, updateDocumentWithFile, uploadPieceJointe,
  getPiecesJointes, deletePieceJointe
} from '../../services/api';
import AppModal from '../../components/AppModal/AppModal';
import './AddDocModal.css';

// --- Formats acceptés : alignés sur la liste blanche de l'API (routes/documentRoutes.js) ---
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
};
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo, comme l'API

// Message lisible pour les fichiers refusés par le dropzone (type ou taille)
const describeRejections = (rejections = []) => rejections.map(({ file, errors }) => {
  const tooLarge = errors.some(err => err.code === 'file-too-large');
  return `${file.name} : ${tooLarge ? 'fichier trop volumineux (20 Mo max)' : 'format non autorisé'}`;
}).join(' — ');

// --- Catégories alignées sur l'enum Prisma DocumentCategory ---
const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',              color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  CONTRAT_MAINTENANCE: { label: 'Contrat de maintenance', color: '#7c2d12', bg: '#ffedd5', border: '#fed7aa' },
  GARANTIE:            { label: 'Garantie',             color: '#3730a3', bg: '#e0e7ff', border: '#c7d2fe' },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',     color: '#155e75', bg: '#cffafe', border: '#a5f3fc' },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',        color: '#4d7c0f', bg: '#ecfccb', border: '#bef264' },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',   color: '#831843', bg: '#fce7f3', border: '#fbcfe8' },
  BON_LIVRAISON:       { label: 'Bon de livraison',     color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  RAPPORT_AUDIT:       { label: 'Rapport d\'audit',     color: '#9f1239', bg: '#ffe4e6', border: '#fecaca' },
  AUTRE:               { label: 'Autre',                color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_CONFIG).map(value => ({
  value,
  label: CATEGORY_CONFIG[value].label,
}));

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// --- Composant Option avec case à cocher pour les sélections multiples ---
const CheckboxOption = (props) => (
  <components.Option {...props}>
    <div className={`add-doc-check-option ${props.isSelected ? 'is-selected' : ''}`}>
      <span className={`add-doc-check-box ${props.isSelected ? 'checked' : ''}`}>
        {props.isSelected && <FaCheck size={11} />}
      </span>
      <span className="add-doc-check-label">{props.label}</span>
    </div>
  </components.Option>
);

// --- Styles partagés pour react-select ---
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '44px',
    borderRadius: '12px',
    borderColor: state.isFocused ? 'var(--color-primary)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
    backgroundColor: 'var(--color-bg)',
    fontSize: '0.88rem',
    transition: 'all 0.2s ease',
    '&:hover': { borderColor: 'var(--color-primary)' },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
    zIndex: 20,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 'var(--z-popover)' }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'var(--color-primary-soft)',
    color: 'var(--color-primary-darker)',
    borderRadius: '8px',
    fontWeight: 600,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? 'var(--color-primary-soft)' : state.isFocused ? 'var(--color-bg-alt)' : 'var(--color-bg)',
    color: 'var(--color-text-main)',
    cursor: 'pointer',
  }),
  placeholder: (base) => ({ ...base, color: 'var(--color-text-muted)' }),
};

const AddDocModal = ({ show, onClose, onDocumentAdded, onDocumentUpdated, editDocument }) => {
  // --- États du formulaire (cohérents avec le schéma Document) ---
  const [file, setFile] = useState(null);
  const [existingFileName, setExistingFileName] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [nomFichier, setNomFichier] = useState('');
  const [categorie, setCategorie] = useState(CATEGORY_OPTIONS[8]); // AUTRE par défaut
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState(1);
  const [estPublic, setEstPublic] = useState(false);
  const [marque, setMarque] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [materiels, setMateriels] = useState([]);
  const [produits, setProduits] = useState([]);

  const [options, setOptions] = useState({ materiels: [], marques: [], produits: [], tickets: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [existingPieces, setExistingPieces] = useState([]);
  const [loadingPieces, setLoadingPieces] = useState(false);

  const isEdit = Boolean(editDocument);

  // --- Réinitialisation du formulaire à l'ouverture ---
  const resetForm = useCallback(() => {
    setFile(null);
    setAttachments([]);
    setExistingPieces([]);
    setDescription('');
    setVersion(1);
    setEstPublic(false);
    setMarque(null);
    setTicket(null);
    setMateriels([]);
    setProduits([]);
    setError(null);

    if (editDocument) {
      setNomFichier(editDocument.nom_fichier || '');
      setExistingFileName(editDocument.nom_fichier || '');
      setDescription(editDocument.description || '');
      setCategorie(CATEGORY_OPTIONS.find(c => c.value === editDocument.categorie) || CATEGORY_OPTIONS[8]);
      setVersion(editDocument.version || 1);
      setEstPublic(Boolean(editDocument.est_public));
      setMarque(editDocument.marque ? { value: editDocument.marque.id_marque, label: editDocument.marque.nom_marque } : null);
      setTicket(editDocument.ticket ? { value: editDocument.ticket.idTicket, label: `${editDocument.ticket.numeroTicket} — ${editDocument.ticket.titre}` } : null);
      const mats = (editDocument.materiels_lies || []).map(rel => ({
        value: rel.id_materiels,
        label: rel.materiel?.code_pc || `Matériel #${rel.id_materiels}`,
      }));
      const prods = (editDocument.produits_lies || []).map(rel => ({
        value: rel.id_produit,
        label: rel.produit?.nom_produit || `Produit #${rel.id_produit}`,
      }));
      setMateriels(mats);
      setProduits(prods);
    } else {
      setNomFichier('');
      setExistingFileName('');
      setCategorie(CATEGORY_OPTIONS[8]);
    }
  }, [editDocument]);

  useEffect(() => {
    if (show) resetForm();
  }, [show, resetForm]);

  // --- Chargement des données de relations (matériels, marques, produits, tickets) ---
  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    (async () => {
      try {
        const [materielsData, marquesData, produitsData, ticketsData] = await Promise.all([
          fetchMateriels(), fetchAMarques(), fetchProduits(), getTickets(),
        ]);
        if (!active) return;
        setOptions({
          materiels: (materielsData || []).map(m => ({ value: m.id_materiels, label: m.code_pc || `Matériel #${m.id_materiels}` })),
          marques: (marquesData || []).map(m => ({ value: m.id_marque, label: m.nom_marque })),
          produits: (produitsData || []).map(p => ({ value: p.id_produit, label: p.nom_produit || `Produit #${p.id_produit}` })),
          tickets: (ticketsData || []).map(t => ({ value: t.idTicket, label: `${t.numeroTicket} — ${t.titre}` })),
        });
      } catch (e) {
        console.warn('Données de relations indisponibles:', e);
      }
    })();
    return () => { active = false; };
  }, [show]);

  useEffect(() => {
    if (!show || !isEdit || !editDocument?.id) return undefined;
    let active = true;
    setLoadingPieces(true);
    (async () => {
      try {
        const data = await getPiecesJointes(editDocument.id);
        if (!active) return;
        setExistingPieces(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        console.warn('Pièces jointes indisponibles:', e);
        setExistingPieces([]);
      } finally {
        if (active) setLoadingPieces(false);
      }
    })();
    return () => { active = false; };
  }, [show, isEdit, editDocument?.id]);

  // --- Drag & drop : fichier principal ---
  const onDropMain = useCallback((accepted) => {
    if (accepted && accepted.length > 0) {
      const f = accepted[0];
      setFile(f);
      setNomFichier(prev => prev && prev.trim() ? prev : f.name);
      setError(null);
    }
  }, []);
  const onDropRejected = useCallback((rejections) => {
    setError(describeRejections(rejections));
  }, []);
  const mainDropzone = useDropzone({
    onDrop: onDropMain, onDropRejected, multiple: false, accept: ACCEPTED_FILE_TYPES, maxSize: MAX_FILE_SIZE,
  });

  // --- Drag & drop : pièces jointes (optionnelles) ---
  const onDropAtt = useCallback((accepted) => {
    if (accepted && accepted.length > 0) {
      setAttachments(prev => [...prev, ...accepted]);
    }
  }, []);
  const attDropzone = useDropzone({
    onDrop: onDropAtt, onDropRejected, multiple: true, accept: ACCEPTED_FILE_TYPES, maxSize: MAX_FILE_SIZE,
  });

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const removeExistingPiece = async (pj) => {
    if (!pj?.id) return;
    try {
      await deletePieceJointe(pj.id);
      setExistingPieces(prev => prev.filter(p => p.id !== pj.id));
    } catch (err) {
      console.warn('Suppression pièce jointe impossible :', err);
    }
  };

  // --- Soumission du formulaire ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !file) {
      setError('Veuillez sélectionner un fichier pour le document.');
      return;
    }
    if (!nomFichier.trim()) {
      setError('Le nom du fichier est obligatoire.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      if (file) fd.append('fichier', file);
      fd.append('nom_fichier', nomFichier.trim());
      fd.append('categorie', categorie ? categorie.value : 'AUTRE');
      fd.append('description', description);
      fd.append('est_public', estPublic ? 'true' : 'false');
      fd.append('version', String(version));
      if (marque) fd.append('id_marque', String(marque.value));
      if (ticket) fd.append('id_ticket', String(ticket.value));
      fd.append('id_materiels', JSON.stringify(materiels.map(m => m.value)));
      fd.append('id_produits', JSON.stringify(produits.map(p => p.value)));

      let result;
      if (isEdit) {
        result = await updateDocumentWithFile(editDocument.id, fd);
      } else {
        result = await createDocumentWithFile(fd);
      }

      // Pièces jointes uploadées après la création / mise à jour (endpoint dédié)
      const failedAttachments = [];
      if (result && result.id && attachments.length > 0) {
        for (const att of attachments) {
          try { await uploadPieceJointe(result.id, att); }
          catch (err) {
            console.warn('Pièce jointe non uploadée :', err);
            failedAttachments.push(`${att.name} (${err.message})`);
          }
        }
      }

      MySwal.fire({
        icon: failedAttachments.length > 0 ? 'warning' : 'success',
        title: isEdit ? 'Document mis à jour' : 'Document ajouté',
        text: failedAttachments.length > 0
          ? `Pièce(s) jointe(s) non enregistrée(s) : ${failedAttachments.join(', ')}`
          : 'L\'opération a été effectuée avec succès.',
        timer: failedAttachments.length > 0 ? undefined : 2000,
        showConfirmButton: failedAttachments.length > 0,
      });
      if (onDocumentUpdated) onDocumentUpdated();
      if (onDocumentAdded) onDocumentAdded();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <AppModal
      show={show}
      onClose={onClose}
      as="form"
      onSubmit={handleSubmit}
      closeOnBackdrop
      icon={<FaFileUpload />}
      title={isEdit ? 'Modifier le document' : 'Ajouter un document'}
      subtitle={isEdit ? 'Mettez à jour les métadonnées et le fichier' : 'Importez et classifiez un nouveau document'}
      headerBg="var(--gradient-primary-dark)"
      contentClassName="add-doc-modal"
      bodyClassName="add-doc-body"
      footer={
        <>
          <button type="button" className="add-doc-btn add-doc-btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="add-doc-btn add-doc-btn-primary" disabled={loading}>
            {loading
              ? <><FaSpinner className="fa-spin me-2" aria-hidden="true" />Enregistrement…</>
              : <><FaPlus className="me-2" aria-hidden="true" />{isEdit ? 'Enregistrer' : 'Ajouter le document'}</>}
          </button>
        </>
      }
    >
      {error && (
        <div className="add-doc-alert" role="alert">
          <FaInfoCircle className="me-2" />{error}
        </div>
      )}

      {/* Section : Fichier */}
      <section className="add-doc-section">
        <div className="add-doc-section-head">
          <span className="add-doc-section-badge add-doc-section-badge--file" aria-hidden="true"><FaFileAlt /></span>
          <div>
            <h3 className="add-doc-section-title">Fichier</h3>
            <span className="add-doc-section-sub">Document principal (obligatoire)</span>
          </div>
        </div>

        {!file ? (
          <div
            {...mainDropzone.getRootProps()}
            className={`add-doc-dropzone ${mainDropzone.isDragActive ? 'is-drag' : ''}`}
          >
            <input {...mainDropzone.getInputProps()} />
            <div className="add-doc-dropzone-icon"><FaCloudUploadAlt /></div>
            <p className="add-doc-dropzone-title">
              {mainDropzone.isDragActive ? 'Déposez le fichier ici…' : (isEdit ? 'Remplacer le fichier' : 'Glissez-déposez votre document')}
            </p>
            {isEdit && existingFileName && !mainDropzone.isDragActive && (
              <p className="add-doc-dropzone-sub">Fichier actuel : <strong>{existingFileName}</strong></p>
            )}
            <p className="add-doc-dropzone-sub">ou <span className="add-doc-dropzone-link">parcourez vos fichiers</span></p>
          </div>
        ) : (
          <div className="add-doc-file-chip">
            <span className="add-doc-file-ico"><FaFileAlt /></span>
            <div className="add-doc-file-meta">
              <span className="add-doc-file-name">{file.name}</span>
              <span className="add-doc-file-size">{formatSize(file.size)}</span>
            </div>
            <button type="button" className="add-doc-file-remove" onClick={() => setFile(null)} aria-label="Retirer">
              <FaTimes />
            </button>
          </div>
        )}

        <div className="add-doc-field mt-3">
          <label className="add-doc-label" htmlFor="nom_fichier">Nom du fichier <span className="add-doc-req">*</span></label>
          <input
            id="nom_fichier"
            type="text"
            className="add-doc-input"
            placeholder="Ex : Facture_2026_04.pdf"
            value={nomFichier}
            onChange={(e) => setNomFichier(e.target.value)}
          />
        </div>
      </section>

      {/* Section : Classification */}
      <section className="add-doc-section">
        <div className="add-doc-section-head">
          <span className="add-doc-section-badge add-doc-section-badge--classification" aria-hidden="true"><FaTag /></span>
          <div>
            <h3 className="add-doc-section-title">Classification</h3>
            <span className="add-doc-section-sub">Catégorie et visibilité</span>
          </div>
        </div>

        <div className="add-doc-row">
          <div className="add-doc-field">
            <label className="add-doc-label">Catégorie</label>
            <Select
              options={CATEGORY_OPTIONS}
              value={categorie}
              onChange={setCategorie}
              styles={selectStyles}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              classNamePrefix="add-doc-select"
            />
          </div>
          <div className="add-doc-field">
            <label className="add-doc-label">Version</label>
            <div className="add-doc-input-icon">
              <FaCodeBranch className="add-doc-input-ico" />
              <input
                type="number"
                min="1"
                className="add-doc-input with-icon"
                value={version}
                onChange={(e) => setVersion(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          </div>
        </div>

        <div className="add-doc-field">
          <label className="add-doc-label" htmlFor="description">Description</label>
          <textarea
            id="description"
            className="add-doc-textarea"
            rows={3}
            placeholder="Description, contexte, remarques utiles…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <label className="add-doc-switch">
          <input
            type="checkbox"
            checked={estPublic}
            onChange={(e) => setEstPublic(e.target.checked)}
          />
          <span className="add-doc-switch-track"><span className="add-doc-switch-thumb" /></span>
          <span className="add-doc-switch-text">
            {estPublic ? <><FaGlobe className="me-1" />Document public</> : <><FaLock className="me-1" />Document privé</>}
          </span>
        </label>
      </section>

      {/* Section : Relations */}
      <section className="add-doc-section">
        <div className="add-doc-section-head">
          <span className="add-doc-section-badge add-doc-section-badge--relations" aria-hidden="true"><FaLink /></span>
          <div>
            <h3 className="add-doc-section-title">Relations</h3>
            <span className="add-doc-section-sub">Liez le document à d'autres entités</span>
          </div>
        </div>

        <div className="add-doc-row">
          <div className="add-doc-field">
            <label className="add-doc-label">Marque</label>
            <Select
              options={options.marques}
              value={marque}
              onChange={setMarque}
              isClearable
              placeholder="Sélectionner une marque…"
              styles={selectStyles}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              classNamePrefix="add-doc-select"
            />
          </div>
          <div className="add-doc-field">
            <label className="add-doc-label">Ticket</label>
            <Select
              options={options.tickets}
              value={ticket}
              onChange={setTicket}
              isClearable
              placeholder="Sélectionner un ticket…"
              styles={selectStyles}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              classNamePrefix="add-doc-select"
            />
          </div>
        </div>

        <div className="add-doc-field">
          <label className="add-doc-label">
            <FaCheck className="add-doc-label-check me-1" aria-hidden="true" />Matériels associés
          </label>
          <Select
            isMulti
            options={options.materiels}
            value={materiels}
            onChange={setMateriels}
            components={{ Option: CheckboxOption }}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            placeholder="Cochez un ou plusieurs matériels…"
            styles={selectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            classNamePrefix="add-doc-select"
          />
        </div>

        <div className="add-doc-field mt-3">
          <label className="add-doc-label">
            <FaCheck className="add-doc-label-check me-1" aria-hidden="true" />Produits associés
          </label>
          <Select
            isMulti
            options={options.produits}
            value={produits}
            onChange={setProduits}
            components={{ Option: CheckboxOption }}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            placeholder="Cochez un ou plusieurs produits…"
            styles={selectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            classNamePrefix="add-doc-select"
          />
        </div>
      </section>

      {/* Section : Pièces jointes */}
      <section className="add-doc-section">
        <div className="add-doc-section-head">
          <span className="add-doc-section-badge add-doc-section-badge--attachments" aria-hidden="true"><FaPaperclip /></span>
          <div>
            <h3 className="add-doc-section-title">Pièces jointes</h3>
            <span className="add-doc-section-sub">Fichiers complémentaires (optionnel)</span>
          </div>
        </div>

        {isEdit && (
          <div className="add-doc-att-existing">
            {loadingPieces ? (
              <div className="add-doc-att-loading"><FaSpinner className="fa-spin me-2" />Chargement…</div>
            ) : existingPieces.length === 0 ? (
              <div className="add-doc-att-empty">Aucune pièce jointe existante</div>
            ) : (
              <ul className="add-doc-att-list">
                {existingPieces.map(pj => (
                  <li key={pj.id} className="add-doc-att-item">
                    <span className="add-doc-att-ico"><FaFileAlt /></span>
                    <div className="add-doc-att-meta">
                      <span className="add-doc-att-name">{pj.nom_fichier || pj.fichier_original || `Pièce #${pj.id}`}</span>
                      <span className="add-doc-att-size">{formatSize(pj.taille)}</span>
                    </div>
                    <button type="button" className="add-doc-file-remove" onClick={() => removeExistingPiece(pj)} aria-label="Supprimer">
                      <FaTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div
          {...attDropzone.getRootProps()}
          className={`add-doc-dropzone add-doc-dropzone-sm ${attDropzone.isDragActive ? 'is-drag' : ''}`}
        >
          <input {...attDropzone.getInputProps()} />
          <div className="add-doc-dropzone-icon"><FaPaperclip /></div>
          <p className="add-doc-dropzone-title">
            {attDropzone.isDragActive ? 'Déposez les fichiers ici…' : 'Ajoutez des pièces jointes'}
          </p>
        </div>

        {attachments.length > 0 && (
          <ul className="add-doc-att-list">
            {attachments.map((att, idx) => (
              <li key={`${att.name}-${idx}`} className="add-doc-att-item">
                <span className="add-doc-att-ico"><FaFileAlt /></span>
                <div className="add-doc-att-meta">
                  <span className="add-doc-att-name">{att.name}</span>
                  <span className="add-doc-att-size">{formatSize(att.size)}</span>
                </div>
                <button type="button" className="add-doc-file-remove" onClick={() => removeAttachment(idx)} aria-label="Retirer">
                  <FaTimes />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppModal>
  );
};

export default AddDocModal;
