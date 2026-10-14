import React from 'react';
import { FaFileAlt, FaTag, FaFileUpload, FaCodeBranch, FaGlobe, FaUser, FaCalendarAlt, FaInfoCircle, FaEdit, FaLink, FaPaperclip } from 'react-icons/fa';
// --- Importations des icônes de type de fichier ---
import { FaFilePdf, FaFileWord, FaFileExcel, FaFileImage } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import AppModal from '../../components/AppModal/AppModal';
import { getDocumentFileUrl, getPieceJointeFileUrl } from '../../services/api';
import { CATEGORY_CONFIG } from './documentCategories';
import { toneClass } from '../../utils/tones';
import './Documents.css';

// Sections de la modale : la couleur de chaque en-tête est portée par
// la classe .doc-section-header--{id} (Documents.css)
const SECTIONS = {
  file: { id: 'file', title: 'Fichier', icon: <FaFileAlt />, subtitle: 'Informations du fichier' },
  classification: { id: 'classification', title: 'Classification', icon: <FaTag />, subtitle: 'Métadonnées et visibilité' },
  info: { id: 'info', title: 'Informations', icon: <FaUser />, subtitle: 'Dates et upload' },
  relations: { id: 'relations', title: 'Relations', icon: <FaLink />, subtitle: 'Éléments liés' },
  pieces_jointes: { id: 'pieces_jointes', title: 'Pièces jointes', icon: <FaPaperclip />, subtitle: 'Fichiers attachés' },
  desc: { id: 'desc', title: 'Description', icon: <FaInfoCircle />, subtitle: 'Contenu détaillé' },
};

const getIcon = (name) => {
  switch(name) {
    case 'nom_fichier': return <FaFileAlt />;
    case 'categorie': return <FaTag />;
    case 'type_mime': return <FaFileUpload />;
    case 'version': return <FaCodeBranch />;
    case 'est_public': return <FaGlobe />;
    case 'uploader': return <FaUser />;
    case 'date_upload': return <FaCalendarAlt />;
    case 'derniere_modif': return <FaCalendarAlt />;
    case 'chemin': return <FaInfoCircle />;
    case 'materiels': return <FaLink />;
    case 'produit': return <FaLink />;
    case 'ticket': return <FaLink />;
    case 'description': return <FaInfoCircle />;
    default: return <FaFileAlt />;
  }
};

const InfoCard = ({ label, value, name }) => (
  <div className="doc-info-card">
    <div className="doc-info-icon" aria-hidden="true">
      {getIcon(name)}
    </div>
    <div className="doc-info-content">
      <span className="doc-info-label">{label}</span>
      <span className="doc-info-value">
        {value || '—'}
      </span>
    </div>
  </div>
);

const SectionHeader = ({ section }) => (
  <div className={`doc-section-header doc-section-header--${section.id}`}>
    <div className="doc-section-icon" aria-hidden="true">
      {section.icon}
    </div>
    <div className="doc-section-text">
      <h3 className="doc-section-title">{section.title}</h3>
      <span className="doc-section-subtitle">{section.subtitle}</span>
    </div>
    <span className="doc-section-badge">{section.id}</span>
  </div>
);

const DetailsSection = ({ section, children }) => (
  <div className="doc-details-section">
    <SectionHeader section={section} />
    {children}
  </div>
);

const DocumentDetailModal = ({ show, onClose, doc, relationData, onEdit }) => {
  const [showAllMaterials, setShowAllMaterials] = React.useState(false);

  if (!show || !doc) return null;

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

  const renderAttachmentIcon = (mime) => {
    const type = (mime || '').toLowerCase();
    if (type.includes('pdf')) return <FaFilePdf className="doc-file-type doc-file-type--pdf" />;
    if (type.includes('word') || type.includes('docx')) return <FaFileWord className="doc-file-type doc-file-type--word" />;
    if (type.includes('excel') || type.includes('xlsx') || type.includes('xls')) return <FaFileExcel className="doc-file-type doc-file-type--excel" />;
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif')) return <FaFileImage className="doc-file-type doc-file-type--image" />;
    return <FaFileAlt className="doc-file-type" />;
  };

  const formatDocCategory = () => {
    const cat = CATEGORY_CONFIG[doc.categorie];
    if (!cat) return doc.categorie || '—';
    return (
      <span className={`doc-chip doc-chip--lg tone-chip ${toneClass(cat.tone)}`}>
        {cat.label}
      </span>
    );
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

  const getMaterialDetails = () => {
    if (!Array.isArray(doc.materiels_lies) || doc.materiels_lies.length === 0) return [];
    return doc.materiels_lies
      .map(rel => {
        const material = relationData.materiels.find(m => String(m.id_materiels) === String(rel.id_materiels));
        if (!material) return null;
        const marque = material.id_marque
          ? relationData.marques.find(m => String(m.id_marque) === String(material.id_marque))
          : null;
        return {
          code: material.code_pc || `#${material.id_materiels}`,
          marque: marque ? marque.nom_marque : null,
        };
      })
      .filter(Boolean);
  };

  const materialDetails = getMaterialDetails();
  const produitNames = getRelatedNames(doc, 'produits_lies', relationData.produits, 'id_produit', 'nom_produit');
  const ticketName = getRelatedName(doc, 'id_ticket', relationData.tickets, 'id_ticket', 'titre');

  return (
    <AppModal
      show={show}
      onClose={onClose}
      closeOnBackdrop
      icon={<FaFileAlt />}
      title="Détails du Document"
      subtitle={doc.nom_fichier}
      contentClassName="doc-details-modal"
      footer={
        <>
          <Button variant="outline-secondary" onClick={onClose}>Fermer</Button>
          <Button onClick={() => { onClose(); onEdit(doc); }}>
            <FaEdit className="me-2" aria-hidden="true" />Modifier
          </Button>
        </>
      }
    >
      {/* Section: Fichier */}
      <DetailsSection section={SECTIONS.file}>
        <div className="doc-details-grid">
          <InfoCard label="Nom du fichier" value={doc.nom_fichier} name="nom_fichier" />
          <InfoCard label="Type / Taille" value={`${doc.type_mime || '—'} · ${formatSize(doc.taille)}`} name="type_mime" />
          <div className="doc-info-card doc-info-card--full">
            <div className="doc-info-icon" aria-hidden="true">
              <FaFileUpload />
            </div>
            <div className="doc-info-content">
              <span className="doc-info-label">Accès</span>
              <div className="doc-info-extra">
                {doc.chemin_stockage ? (
                  <Button size="sm" className="doc-open-btn" href={getDocumentFileUrl(doc.id, { inline: true })} target="_blank" rel="noopener noreferrer">
                    Ouvrir / Télécharger
                  </Button>
                ) : (
                  <span className="text-muted">Aucun fichier</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DetailsSection>

      {/* Section: Classification */}
      <DetailsSection section={SECTIONS.classification}>
        <div className="doc-details-grid">
          <InfoCard label="Catégorie" value={formatDocCategory()} name="categorie" />
          <InfoCard label="Version" value={doc.version || 1} name="version" />
          <InfoCard label="Visibilité" value={doc.est_public ? 'Public' : 'Privé'} name="est_public" />
          <InfoCard label="Chemin" value={doc.chemin_stockage} name="chemin" />
        </div>
      </DetailsSection>

      {/* Section: Informations */}
      <DetailsSection section={SECTIONS.info}>
        <div className="doc-details-grid">
          <InfoCard label="Uploadé par" value={getUploaderName(doc)} name="uploader" />
          <InfoCard label="Date d'upload" value={formatDate(doc.date_upload)} name="date_upload" />
          <InfoCard label="Dernière modification" value={formatDate(doc.derniere_modif)} name="derniere_modif" />
        </div>
      </DetailsSection>

      {/* Section: Relations */}
      <DetailsSection section={SECTIONS.relations}>
        <div className="doc-details-grid">
          <div className={`doc-info-card ${produitNames.length > 1 ? 'doc-info-card--full' : ''}`.trim()}>
            <div className="doc-info-icon" aria-hidden="true">
              <FaLink />
            </div>
            <div className="doc-info-content">
              <span className="doc-info-label">Produit(s)</span>
              {produitNames.length > 0 ? (
                <div className="doc-info-extra d-flex flex-wrap gap-2">
                  {produitNames.map((name, i) => (
                    <span key={i} className="doc-tag doc-tag--lg doc-tag--produit">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="doc-info-value">—</span>
              )}
            </div>
          </div>
          <InfoCard label="Ticket" value={ticketName || '—'} name="ticket" />
          <div className="doc-info-card doc-info-card--full">
            <div className="doc-info-icon" aria-hidden="true">
              <FaLink />
            </div>
            <div className="doc-info-content">
              <span className="doc-info-label">Matériel(s)</span>
              <div className="doc-info-extra d-flex flex-wrap gap-2">
                {materialDetails.length > 0 ? (
                  (showAllMaterials ? materialDetails : materialDetails.slice(0, 5)).map((item, i) => (
                    <span key={i} className="doc-tag doc-tag--lg doc-tag--materiel">
                      {item.code}
                      {item.marque && (
                        <span className="doc-tag-marque">
                          {item.marque}
                        </span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="doc-info-value">Aucun matériel lié</span>
                )}
                {!showAllMaterials && materialDetails.length > 5 && (
                  <button
                    type="button"
                    className="doc-tag doc-tag--lg doc-tag--more doc-tag--button"
                    onClick={() => setShowAllMaterials(true)}
                    aria-label={`Afficher les ${materialDetails.length - 5} autres matériels`}
                  >
                    +{materialDetails.length - 5}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DetailsSection>

      {/* Section: Pièces jointes */}
      {Array.isArray(doc.pieces_jointes) && doc.pieces_jointes.length > 0 && (
        <DetailsSection section={SECTIONS.pieces_jointes}>
          <div className="doc-details-grid">
            {doc.pieces_jointes.map((pj) => (
              <div key={pj.id} className="doc-info-card">
                <div className="doc-info-icon" aria-hidden="true">
                  {renderAttachmentIcon(pj.type_mime)}
                </div>
                <div className="doc-info-content">
                  <span className="doc-info-label">{pj.nom_fichier}</span>
                  <span className="doc-info-value doc-info-value--sm">
                    {formatSize(pj.taille)} · {pj.type_mime || '—'}
                  </span>
                  {pj.chemin_stockage && (
                    <div className="doc-info-extra">
                      <Button size="sm" className="doc-open-btn doc-open-btn--attachment" href={getPieceJointeFileUrl(pj.id, { inline: true })} target="_blank" rel="noopener noreferrer">
                        Ouvrir
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DetailsSection>
      )}

      {/* Section: Description */}
      {doc.description && (
        <DetailsSection section={SECTIONS.desc}>
          <p className="doc-detail-description">
            {doc.description}
          </p>
        </DetailsSection>
      )}
    </AppModal>
  );
};

export default DocumentDetailModal;
