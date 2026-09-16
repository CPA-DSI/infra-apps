import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Badge, Spinner, Alert, Accordion } from 'react-bootstrap';
import { getMouvementById } from '../../services/api';
import { FaCalendarAlt, FaExchangeAlt, FaBox, FaHashtag, FaUser, FaUsers, FaLaptop, FaMapMarkerAlt, FaArrowRight, FaTag, FaExclamationTriangle, FaClipboardList, FaHistory, FaCogs } from 'react-icons/fa';
import './DetailsStockModal.css';

const DetailsStockModal = ({ show, handleClose, selectedItemId }) => {
  const [itemDetails, setItemDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetails = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMouvementById(id);
      if (data && typeof data === 'object' && data.id_mouvement) {
          setItemDetails(data);
      } else {
          setError("L'API a répondu, mais n'a pas renvoyé de détails valides pour cet ID.");
          setItemDetails(null);
      }
    } catch (err) {
      setError("Impossible de charger les détails du mouvement. Détails: " + err.message);
      setItemDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && selectedItemId) {
      fetchDetails(selectedItemId);
    } else if (!show) {
      setItemDetails(null);
      setError(null);
      setLoading(false);
    }
  }, [show, selectedItemId]);

  const getTypeVariant = (type) => {
    switch (type) {
        case 'ENTREE': 
            return 'success';
        case 'ENTREE_QUANTITE':
            return 'info'; 
        case 'SORTIE':
            return 'danger';  
        default:
            return 'secondary';
    }
  };

  // Nouvelle fonction pour le gradient selon le type
  const getHeaderGradient = (type) => {
    switch (type) {
      case 'ENTREE':
        return 'linear-gradient(135deg, #059669 0%, #047857 100%)'; // Vert émeraude
      case 'ENTREE_QUANTITE':
        return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'; // Bleu océan
      case 'SORTIE':
        return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'; // Rouge intense
      default:
        return 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'; // Gris foncé
    }
  };

  if (loading) {
    return (
        <Modal show={show} onHide={handleClose} size="lg" centered className="profile-modal-modern">
            <Modal.Body className="text-center p-5 modal-body-modern">
                <Spinner animation="border" role="status" className="mb-3" />
                <p>Chargement des détails...</p>
            </Modal.Body>
        </Modal>
    );
  }

  if (error || !itemDetails) {
    return (
        <Modal show={show} onHide={handleClose} size="lg" centered className="profile-modal-modern">
            <Modal.Header closeButton className="modal-header-modern">
                <Modal.Title>Erreur</Modal.Title>
            </Modal.Header>
            <Modal.Body className="modal-body-modern">
                <Alert variant="danger" className="alert-modern">{error || "Aucune donnée disponible."}</Alert>
            </Modal.Body>
            <Modal.Footer className="modal-footer-modern">
                <Button variant="secondary" onClick={handleClose} className="btn-secondary-modern">Fermer</Button>
            </Modal.Footer>
        </Modal>
    );
  }
  
  const item = itemDetails;
  const equipeNom = item.materiels?.equipe || 'N/A';
  const marqueUrl = item.materiels?.marque?.url;
  const nom_marque = item.materiels?.marque?.nom_marque || 'N/A';
  const codePc = item.materiels?.code_pc || 'N/A';
  
  const formattedDate = item.date_mouvement ? new Date(item.date_mouvement).toLocaleDateString('fr-FR') : 'N/A';

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered className="profile-modal-modern" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} >
      <Modal.Header closeButton className="modal-header-modern" style={{ background: getHeaderGradient(item.type_mouvement) }} >
        <div className="modal-header-content">
          <div className="modal-icon-wrapper">
            <FaBox />
          </div>
          <div>
            <Modal.Title className="modal-title-modern">Détails du Mouvement</Modal.Title>
            <p className="modal-subtitle">Mouvement #{item.id_mouvement} • {formattedDate}</p>
          </div>
        </div>
        <Badge bg={getTypeVariant(item.type_mouvement)} className="type-badge-header">
          {item.type_mouvement || 'N/A'}
        </Badge>
      </Modal.Header>

      <Modal.Body className="modal-body-modern compact">
        <Row>
          <Col md={6}>
            <div className="profile-info-cards">
              <div className="info-card">
                <div className="info-icon"><FaCalendarAlt /></div>
                <div className="info-content">
                  <span className="info-label">Date du mouvement</span>
                  <span className="info-value">{formattedDate}</span>
                </div>
              </div>
              <div className="info-card">
                <div className="info-icon"><FaExchangeAlt /></div>
                <div className="info-content">
                  <span className="info-label">Type de mouvement</span>
                  <Badge bg={getTypeVariant(item.type_mouvement)} className="badge-role">
                      {item.type_mouvement || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div className="info-card">
                <div className="info-icon"><FaBox /></div>
                <div className="info-content">
                  <span className="info-label">Produit concerné</span>
                  <span className="info-value">{item.produits?.nom_produit || 'N/A'}</span>
                </div>
              </div>
              <div className="info-card">
                <div className="info-icon"><FaHashtag /></div>
                <div className="info-content">
                  <span className="info-label">Quantité</span>
                  <span className="info-value text-primary">{item.quantite || 'N/A'}</span>
                </div>
              </div>
              {item.produits?.quantite_en_stock !== undefined && item.produits?.quantite_en_stock !== null && (
                <div className="info-card">
                  <div className="info-icon"><FaExclamationTriangle /></div>
                  <div className="info-content">
                    <span className="info-label">Stock actuel du produit</span>
                    <span className="info-value">
                      {item.produits.quantite_en_stock}
                      {item.produits?.seuil_alerte !== undefined && item.produits?.seuil_alerte !== null && (
                        <>
                          {' '}<Badge bg={item.produits.quantite_en_stock <= item.produits.seuil_alerte ? 'danger' : 'success'} className="ms-2">
                            {item.produits.quantite_en_stock <= item.produits.seuil_alerte ? 'Stock bas' : 'Stock OK'}
                          </Badge>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Col>

          <Col md={6}>
            <div className="password-section">
              <h5 className="section-title"><FaMapMarkerAlt /> Localisation et Personnel</h5>
              <div className="profile-info-cards" style={{ gap: '8px' }}>
                <div className="info-card" style={{ padding: '12px' }}>
                  <div className="info-icon" style={{ width: '36px', height: '36px', fontSize: '1rem' }}><FaUser /></div>
                  <div className="info-content">
                    <span className="info-label">Utilisateur</span>
                    <span className="info-value">{item.materiels?.utilisateur || item.nom_utilisateur || 'N/A'}</span>
                  </div>
                </div>
                <div className="info-card" style={{ padding: '12px' }}>
                  <div className="info-icon" style={{ width: '36px', height: '36px', fontSize: '1rem' }}><FaUsers /></div>
                  <div className="info-content">
                    <span className="info-label">Équipe</span>
                    <span className="info-value">{equipeNom}</span>
                  </div>
                </div>
                <div className="info-card" style={{ padding: '12px' }}>
                  <div className="info-icon" style={{ width: '36px', height: '36px', fontSize: '1rem' }}><FaLaptop /></div>
                  <div className="info-content">
                    <span className="info-label">Laptop / Marque</span>
                    <div className="d-flex align-items-center gap-2">
                      {marqueUrl ? (
                        <a href={marqueUrl} target="_blank" rel="noopener noreferrer">
                          <img src={marqueUrl} alt={nom_marque} style={{ maxWidth: '50px', height: 'auto', borderRadius: '8px' }} />
                        </a>
                      ) : (
                        <span className="info-value">{nom_marque}</span>
                      )}
                      {codePc && <span className="text-muted small">({codePc})</span>}
                    </div>
                  </div>
                </div>
                <div className="info-card" style={{ padding: '12px' }}>
                  <div className="info-icon" style={{ width: '36px', height: '36px', fontSize: '1rem' }}><FaMapMarkerAlt /></div>
                  <div className="info-content">
                    <span className="info-label">Source → Destination</span>
                    <span className="info-value">
                      {item.localSource?.nom_local || 'N/A'} <FaArrowRight className="mx-1" style={{ fontSize: '0.8rem' }} /> {item.localDestination?.nom_local || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {(item.motif && item.motif !== 'Aucun motif fourni') && (
          <>
            <hr className="modal-divider" />
            <div className="password-section">
              <h5 className="section-title"><FaTag /> Motif / Notes</h5>
              <div className="info-card" style={{ cursor: 'default' }}>
                <div className="info-content">
                  <span className="info-label">Description</span>
                  <span className="info-value">{item.motif}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {item.remarque && (
          <>
            <hr className="modal-divider" />
            <div className="password-section">
              <h5 className="section-title"><FaClipboardList /> Remarque</h5>
              <div className="info-card" style={{ cursor: 'default' }}>
                <div className="info-content">
                  <span className="info-value">{item.remarque}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {item.materiels && (
          <>
            <hr className="modal-divider" />
            <Accordion className="modal-accordion-modern">
              <Accordion.Item eventKey="0">
                <Accordion.Header><FaCogs className="me-2" /> Détails techniques du matériel</Accordion.Header>
                <Accordion.Body>
                  <Row>
                    <Col md={6}><span className="info-label">Code PC</span><div className="info-value">{item.materiels.code_pc || 'N/A'}</div></Col>
                    <Col md={6}><span className="info-label">État PC</span><div className="info-value">{item.materiels.etat_pc || 'N/A'}</div></Col>
                    <Col md={6}><span className="info-label">État batterie</span><div className="info-value">{item.materiels.etat_batterie || 'N/A'}</div></Col>
                    <Col md={6}><span className="info-label">Salle</span><div className="info-value">{item.materiels.salle || 'N/A'}</div></Col>
                    <Col md={6}><span className="info-label">Écran</span><div className="info-value">{item.materiels.ecran || 'N/A'} {item.materiels.code_ecran ? `(${item.materiels.code_ecran})` : ''}</div></Col>
                    <Col md={6}>
                      <span className="info-label">Ports / Périphériques</span>
                      <div className="info-value">
                        HDMI: {item.materiels.hdmi ? 'Oui' : 'Non'} • Clavier: {item.materiels.clavier ? 'Oui' : 'Non'} • LAN: {item.materiels.lan ? 'Oui' : 'Non'} • USB: {item.materiels.usb ? 'Oui' : 'Non'}
                      </div>
                    </Col>
                    {item.materiels.caracteristiques && (
                      <Col md={12} className="mt-2">
                        <span className="info-label">Caractéristiques</span>
                        <div className="info-value">{item.materiels.caracteristiques}</div>
                      </Col>
                    )}
                    {item.materiels.commentaire && (
                      <Col md={12} className="mt-2">
                        <span className="info-label">Commentaire</span>
                        <div className="info-value">{item.materiels.commentaire}</div>
                      </Col>
                    )}
                  </Row>
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </>
        )}

        <hr className="modal-divider" />
        <div className="tracability-footer">
          <FaHistory className="me-1" />
          Enregistré le {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : 'N/A'}
          {item.updated_at && item.updated_at !== item.created_at && (
            <> • Modifié le {new Date(item.updated_at).toLocaleString('fr-FR')}</>
          )}
          {item.nom_utilisateur && <> • par {item.nom_utilisateur}</>}
        </div>
      </Modal.Body>

      <Modal.Footer className="modal-footer-modern compact">
        <Button variant="secondary" onClick={handleClose} className="btn-secondary-modern">Fermer</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetailsStockModal;