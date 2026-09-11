import React from 'react';
import { FaFileAlt, FaTag, FaFileUpload, FaCodeBranch, FaGlobe, FaUser, FaCalendarAlt, FaInfoCircle, FaEdit, FaTimes, FaLink, FaPaperclip } from 'react-icons/fa';
// --- Importations des icônes de type de fichier ---
import { FaFilePdf, FaFileWord, FaFileExcel, FaFileImage } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { API_BASE_URL } from '../../config/api';
import './Documents.css';

const CATEGORY_CONFIG = {
  FACTURE:             { label: 'Facture',              color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  CONTRAT_MAINTENANCE: { label: 'Contrat de maintenance', color: '#7c2d12', bg: '#ffedd5', border: '#fed7aa' },
  GARANTIE:            { label: 'Garantie',             color: '#3730a3', bg: '#e0e7ff', border: '#c7d2fe' },
  MANUEL_TECHNIQUE:    { label: 'Manuel technique',     color: '#155e75', bg: '#cffafe', border: '#a5f3fc' },
  SCHEMA_RESEAU:       { label: 'Schéma réseau',        color: '#4d7c0f', bg: '#ecfccb', border: '#bef264' },
  LICENCE_LOGICIELLE:  { label: 'Licence logicielle',   color: '#831843', bg: '#fce7f3', border: '#fbcfe8' },
  BON_LIVRAISON:       { label: 'Bon de livraison',     color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  RAPPORT_AUDIT:       { label: "Rapport d'audit",     color: '#9f1239', bg: '#ffe4e6', border: '#fecaca' },
  AUTRE:               { label: 'Autre',                color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
};

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

  const getDownloadUrl = (path) => {
    if (!path) return '#';
    return `${API_BASE_URL}${path}`;
  };

  const renderAttachmentIcon = (mime) => {
    const type = (mime || '').toLowerCase();
    if (type.includes('pdf')) return <FaFilePdf style={{ color: '#dc2626' }} />;
    if (type.includes('word') || type.includes('docx')) return <FaFileWord style={{ color: '#2563eb' }} />;
    if (type.includes('excel') || type.includes('xlsx') || type.includes('xls')) return <FaFileExcel style={{ color: '#16a34a' }} />;
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif')) return <FaFileImage style={{ color: '#ea580c' }} />;
    return <FaFileAlt style={{ color: '#6b7280' }} />;
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

  const InfoCard = ({ label, value, name }) => {
    let displayValue = value;
    return (
      <div className="doc-info-card">
        <div className="doc-info-icon">
          {getIcon(name)}
        </div>
        <div className="doc-info-content">
          <span className="doc-info-label">{label}</span>
          <span className="doc-info-value">
            {displayValue || '—'}
          </span>
        </div>
      </div>
    );
  };

  const SectionHeader = ({ section }) => (
    <div className="doc-section-header" style={{
      background: section.gradient,
      border: `1px solid ${section.border}`,
      borderRadius: '12px',
      padding: '10px 18px',
      marginBottom: '18px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: `0 2px 8px ${section.border}`
    }}>
      <div className="section-icon-wrapper" style={{
        background: 'rgba(255, 255, 255, 0.25)',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        color: 'white'
      }}>
        {section.icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 className="doc-section-title" style={{
          color: 'white',
          fontSize: '0.95rem',
          fontWeight: '600',
          margin: 0,
          letterSpacing: '0.5px',
          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          {section.title}
        </h3>
        <span style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.7rem',
          fontWeight: '400'
        }}>
          {section.subtitle}
        </span>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '20px',
          padding: '2px 12px',
          color: 'white',
          fontSize: '0.65rem',
          fontWeight: '500',
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          {section.id}
        </span>
      </div>
    </div>
  );

  const formatDocCategory = () => {
    const cat = CATEGORY_CONFIG[doc.categorie];
    if (!cat) return doc.categorie || '—';
    return (
      <span style={{
        backgroundColor: cat.bg,
        color: cat.color,
        border: `1px solid ${cat.border}`,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
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

  const sections = [
    {
      id: 'file',
      title: 'Fichier',
      icon: <FaFileAlt />,
      color: '#4F46E5',
      gradient: 'linear-gradient(135deg, #4F46E5, #6366F1)',
      bg: 'rgba(79, 70, 229, 0.08)',
      border: 'rgba(79, 70, 229, 0.2)',
      subtitle: 'Informations du fichier'
    },
    {
      id: 'classification',
      title: 'Classification',
      icon: <FaTag />,
      color: '#0EA5E9',
      gradient: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
      bg: 'rgba(14, 165, 233, 0.08)',
      border: 'rgba(14, 165, 233, 0.2)',
      subtitle: 'Métadonnées et visibilité'
    },
    {
      id: 'info',
      title: 'Informations',
      icon: <FaUser />,
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
      bg: 'rgba(139, 92, 246, 0.08)',
      border: 'rgba(139, 92, 246, 0.2)',
      subtitle: 'Dates et upload'
    },
    {
      id: 'relations',
      title: 'Relations',
      icon: <FaLink />,
      color: '#F59E0B',
      gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      subtitle: 'Éléments liés'
    },
    {
      id: 'pieces_jointes',
      title: 'Pièces jointes',
      icon: <FaPaperclip />,
      color: '#EC4899',
      gradient: 'linear-gradient(135deg, #EC4899, #F472B6)',
      bg: 'rgba(236, 72, 153, 0.08)',
      border: 'rgba(236, 72, 153, 0.2)',
      subtitle: 'Fichiers attachés'
    }
  ];

  return (
    <div className="doc-details-overlay" onClick={onClose}>
      <div className="doc-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-details-header" style={{
          background: 'linear-gradient(135deg, #1E293B, #0F172A)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '18px 18px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="doc-details-icon-wrapper" style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
            }}>
              <FaFileAlt style={{ color: 'white' }} />
            </div>
            <div>
              <h2 className="doc-details-title" style={{ color: 'white' }}>
                Détails du Document
              </h2>
              <p className="doc-details-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {doc.nom_fichier}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="doc-details-close" type="button">
            <FaTimes />
          </button>
        </div>

        <div className="doc-details-body" style={{
          padding: '24px',
          background: '#F8FAFC'
        }}>
          {/* Section: Fichier */}
          <div className="doc-details-section" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            <SectionHeader section={sections[0]} />
            <div className="doc-details-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <InfoCard label="Nom du fichier" value={doc.nom_fichier} name="nom_fichier" />
              <InfoCard label="Type / Taille" value={`${doc.type_mime || '—'} · ${formatSize(doc.taille)}`} name="type_mime" />
              <div className="doc-info-card" style={{ gridColumn: '1 / -1' }}>
                <div className="doc-info-icon">
                  <FaFileUpload />
                </div>
                <div className="doc-info-content">
                  <span className="doc-info-label">Accès</span>
                  <div style={{ marginTop: '6px' }}>
                    {doc.chemin_stockage ? (
                      <Button size="sm" href={getDownloadUrl(doc.chemin_stockage)} target="_blank" rel="noopener noreferrer" style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '0.8rem'
                      }}>
                        Ouvrir / Télécharger
                      </Button>
                    ) : (
                      <span className="text-muted">Aucun fichier</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Classification */}
          <div className="doc-details-section" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            <SectionHeader section={sections[1]} />
            <div className="doc-details-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <InfoCard label="Catégorie" value={formatDocCategory()} name="categorie" />
              <InfoCard label="Version" value={doc.version || 1} name="version" />
              <InfoCard label="Visibilité" value={doc.est_public ? 'Public' : 'Privé'} name="est_public" />
              <InfoCard label="Chemin" value={doc.chemin_stockage} name="chemin" />
            </div>
          </div>

          {/* Section: Informations */}
          <div className="doc-details-section" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            <SectionHeader section={sections[2]} />
            <div className="doc-details-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <InfoCard label="Uploadé par" value={getUploaderName(doc)} name="uploader" />
              <InfoCard label="Date d'upload" value={formatDate(doc.date_upload)} name="date_upload" />
              <InfoCard label="Dernière modification" value={formatDate(doc.derniere_modif)} name="derniere_modif" />
            </div>
          </div>

          {/* Section: Relations */}
          <div className="doc-details-section" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            <SectionHeader section={sections[3]} />
            <div className="doc-details-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              <div className="doc-info-card" style={{ gridColumn: produitNames.length > 1 ? '1 / -1' : undefined }}>
                <div className="doc-info-icon">
                  <FaLink />
                </div>
                <div className="doc-info-content" style={{ flex: 1 }}>
                  <span className="doc-info-label">Produit(s)</span>
                  {produitNames.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2" style={{ marginTop: '6px' }}>
                      {produitNames.map((name, i) => (
                        <span key={i} style={{
                          backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}>
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
              <div className="doc-info-card" style={{ gridColumn: '1 / -1' }}>
                <div className="doc-info-icon">
                  <FaLink />
                </div>
                <div className="doc-info-content" style={{ flex: 1 }}>
                  <span className="doc-info-label">Matériel(s)</span>
                  <div className="d-flex flex-wrap gap-2" style={{ marginTop: '6px' }}>
                    {materialDetails.length > 0 ? (
                      (showAllMaterials ? materialDetails : materialDetails.slice(0, 5)).map((item, i) => (
                        <span key={i} style={{
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {item.code}
                          {item.marque && (
                            <span style={{
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
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
                        onClick={() => setShowAllMaterials(true)}
                        style={{
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        +{materialDetails.length - 5}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Pièces jointes */}
          {Array.isArray(doc.pieces_jointes) && doc.pieces_jointes.length > 0 && (
            <div className="doc-details-section" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid #E2E8F0'
            }}>
              <SectionHeader section={sections[4]} />
              <div className="doc-details-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {doc.pieces_jointes.map((pj) => (
                  <div key={pj.id} className="doc-info-card">
                    <div className="doc-info-icon">
                      {renderAttachmentIcon(pj.type_mime)}
                    </div>
                    <div className="doc-info-content" style={{ flex: 1 }}>
                      <span className="doc-info-label">{pj.nom_fichier}</span>
                      <span className="doc-info-value" style={{ fontSize: '0.75rem' }}>
                        {formatSize(pj.taille)} · {pj.type_mime || '—'}
                      </span>
                      {pj.chemin_stockage && (
                        <div style={{ marginTop: '6px' }}>
                          <Button size="sm" href={getDownloadUrl(pj.chemin_stockage)} target="_blank" rel="noopener noreferrer" style={{
                            background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                            border: 'none',
                            color: 'white',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.75rem'
                          }}>
                            Ouvrir
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Description */}
          {doc.description && (
            <div className="doc-details-section" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid #E2E8F0'
            }}>
              <SectionHeader section={{
                id: 'desc',
                title: 'Description',
                icon: <FaInfoCircle />,
                color: '#10B981',
                gradient: 'linear-gradient(135deg, #10B981, #34D399)',
                bg: 'rgba(16, 185, 129, 0.08)',
                border: 'rgba(16, 185, 129, 0.2)',
                subtitle: 'Contenu détaillé'
              }} />
              <p className="doc-detail-description" style={{
                margin: 0,
                fontSize: '0.85rem',
                color: '#4b5563',
                lineHeight: '1.5',
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                width: '100%',
                whiteSpace: 'pre-wrap'
              }}>
                {doc.description}
              </p>
            </div>
          )}
        </div>

        <div className="doc-details-footer" style={{
          background: '#F1F5F9',
          borderTop: '1px solid #E2E8F0',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <Button variant="outline-secondary" onClick={onClose}>Fermer</Button>
          <Button className="doc-btn-add" onClick={() => { onClose(); onEdit(doc); }}>
            <FaEdit className="me-2" />Modifier
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;