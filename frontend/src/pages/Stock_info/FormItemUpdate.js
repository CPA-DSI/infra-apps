// FormItemUpdate.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { fetchProduits, fetchLocaux, fetchMateriels, updateMouvement } from '../../services/api';
import './HomeStockUpdate.css';
// Import des icônes valides
import { FaBox, FaExchangeAlt, FaBuilding, FaMapMarkerAlt, FaCalendarAlt, FaSortAmountUp, FaMicrochip, FaUser, FaFileAlt } from 'react-icons/fa';

const FormItemUpdate = ({ initialData = {}, onSave, onClose }) => {
  const [produits, setProduits] = useState([]);
  const [locaux, setLocaux] = useState([]);
  const [materiels, setMateriels] = useState([]);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [errorInitialData, setErrorInitialData] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // --- Fonction utilitaire pour obtenir les données initiales ---
  const getInitialFormData = (data) => {
    if (data.id_mouvement) {
      return {
        ...data,
        date_mouvement: data.date_mouvement ? new Date(data.date_mouvement).toISOString().split('T')[0] : '',
        id_produit: data.id_produit ? Number(data.id_produit) : '',
        id_local_source: data.id_local_source ? Number(data.id_local_source) : '',
        id_local_destination: data.id_local_destination ? Number(data.id_local_destination) : '',
        id_materiels: data.id_materiels ? Number(data.id_materiels) : '',
      };
    }
    return {
      id_produit: '', id_local_source: '', id_local_destination: '', id_materiels: '', nom_utilisateur: '',
      date_mouvement: new Date().toISOString().split('T')[0],
      type_mouvement: '', quantite: 1, motif: '',
    };
  };

  const [formData, setFormData] = useState(getInitialFormData(initialData));

  useEffect(() => {
    setFormData(getInitialFormData(initialData));
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedFormData = { ...formData, [name]: value };

    if (name === 'id_materiels') {
      const selectedMaterial = materiels.find(m => String(m.id_n) === String(value));
      if (selectedMaterial) {
        updatedFormData.nom_utilisateur = `${selectedMaterial.utilisateur || ''}`;
      } else {
        updatedFormData.nom_utilisateur = '';
      }
    }
    setFormData(updatedFormData);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [produitsResponse, locauxResponse, materielsResponse] = await Promise.all([
          fetchProduits(),
          fetchLocaux(),
          fetchMateriels()
        ]);

        setProduits(Array.isArray(produitsResponse) ? produitsResponse : (produitsResponse?.data || []));
        setLocaux(Array.isArray(locauxResponse) ? locauxResponse : (locauxResponse?.data || []));
        setMateriels(Array.isArray(materielsResponse) ? materielsResponse : (materielsResponse?.data || []));
        setLoadingInitialData(false);
      } catch (err) {
        setErrorInitialData(err.message);
        setLoadingInitialData(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id_mouvement) {
      setSubmitError("Erreur: ID du mouvement manquant.");
      return;
    }
    if (!formData.id_produit || !formData.type_mouvement || formData.quantite <= 0) {
      setSubmitError("Veuillez remplir tous les champs obligatoires correctement.");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const dataToSend = {
        id_produit: formData.id_produit ? Number(formData.id_produit) : null,
        id_local_source: formData.id_local_source ? Number(formData.id_local_source) : null,
        id_local_destination: formData.id_local_destination ? Number(formData.id_local_destination) : null,
        id_materiels: formData.id_materiels ? Number(formData.id_materiels) : null,
        nom_utilisateur: formData.nom_utilisateur || null,
        date_mouvement: formData.date_mouvement || null,
        type_mouvement: formData.type_mouvement || null,
        quantite: formData.quantite ? Number(formData.quantite) : 0,
        motif: formData.motif || null,
      };

      const response = await updateMouvement(formData.id_mouvement, dataToSend);
      console.log('Réponse API:', response);
      setSubmitSuccess(true);
      setIsSubmitting(false);
      if (onSave) onSave(response);
    } catch (err) {
      console.error("Erreur de mise à jour:", err.response ? err.response.data : err.message);
      setSubmitError("Erreur lors de la mise à jour du mouvement. " + (err.response?.data?.error || err.message));
      setIsSubmitting(false);
    }
  };

  if (loadingInitialData) {
    return <Spinner animation="border" role="status"><span className="visually-hidden">Chargement...</span></Spinner>;
  }

  if (errorInitialData) {
    return <Alert variant="danger">Erreur : {errorInitialData}</Alert>;
  }

  return (
    <Form onSubmit={handleSubmit} className="stock-form-modern">
      {submitError && <Alert variant="danger" className="mb-2">{submitError}</Alert>}
      {submitSuccess && <Alert variant="success" className="mb-2">Mouvement mis à jour avec succès !</Alert>}

      <Row className="mb-2 g-2">
        <Col md={6}>
          <Form.Group controlId="id_produit" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaBox className="me-1" /> Produit <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select name="id_produit" value={formData.id_produit || ''} onChange={handleChange} required size="sm" className="rounded-3 shadow-sm">
              <option value="">Sélectionnez un produit</option>
              {produits.map((produit) => (
                <option key={produit.id_produit} value={produit.id_produit}>
                  {produit.nom_produit}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="type_mouvement" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaExchangeAlt className="me-1" /> Type de mouvement <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select name="type_mouvement" value={formData.type_mouvement || ''} onChange={handleChange} required size="sm" className="rounded-3 shadow-sm">
              <option value="">-- Sélectionnez --</option>
              <option value="ENTREE">📥 Entrée Matériel Unitaire DSI</option>
              <option value="ENTREE_QUANTITE">📦 Entrée Quantité Produit</option>
              <option value="SORTIE">📤 Sortie Produit</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-2 g-2">
        <Col md={6}>
          <Form.Group controlId="id_local_source" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaBuilding className="me-1" /> Local source
            </Form.Label>
            <Form.Select name="id_local_source" value={formData.id_local_source || ''} onChange={handleChange} size="sm" className="rounded-3 shadow-sm">
              <option value="">Sélectionnez le local source</option>
              {locaux.map((local) => (
                <option key={local.id_local} value={local.id_local}>
                  {local.nom_local}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="id_local_destination" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaMapMarkerAlt className="me-1" /> Local destination
            </Form.Label>
            <Form.Select name="id_local_destination" value={formData.id_local_destination || ''} onChange={handleChange} size="sm" className="rounded-3 shadow-sm">
              <option value="">Sélectionnez la destination</option>
              {locaux.map((local) => (
                <option key={local.id_local} value={local.id_local}>
                  {local.nom_local}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-2 g-2">
        <Col md={6}>
          <Form.Group controlId="date_mouvement" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaCalendarAlt className="me-1" /> Date du mouvement <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control type="date" name="date_mouvement" value={formData.date_mouvement || ''} onChange={handleChange} required size="sm" className="rounded-3 shadow-sm" />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="quantite" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaSortAmountUp className="me-1" /> Quantité <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control type="number" name="quantite" value={formData.quantite || ''} onChange={handleChange} min="1" required size="sm" className="rounded-3 shadow-sm" />
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-2 g-2">
        <Col md={6}>
          <Form.Group controlId="id_materiels" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaMicrochip className="me-1" /> Matériel (ID unique)
            </Form.Label>
            <Form.Select name="id_materiels" value={formData.id_materiels || ''} onChange={handleChange} size="sm" className="rounded-3 shadow-sm">
              <option value="">Sélectionnez le matériel</option>
              {materiels.map((materiel) => (
                <option key={materiel.id_n} value={materiel.id_n}>
                  {materiel.id_n} - {materiel.utilisateur}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="nom_utilisateur" className="mb-2">
            <Form.Label className="fw-semibold small">
              <FaUser className="me-1" /> Utilisateur / Matricule
            </Form.Label>
            <Form.Control type="text" name="nom_utilisateur" value={formData.nom_utilisateur || ''} readOnly size="sm" className="rounded-3 shadow-sm bg-light" />
          </Form.Group>
        </Col>
      </Row>

      <Form.Group controlId="motif" className="mb-3">
        <Form.Label className="fw-semibold small">
          <FaFileAlt className="me-1" /> Motif
        </Form.Label>
        <Form.Control as="textarea" name="motif" value={formData.motif || ''} onChange={handleChange} rows={2} size="sm" className="rounded-3 shadow-sm" />
      </Form.Group>

      <div className="d-flex justify-content-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} size="sm" className="px-4 rounded-pill">
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={isSubmitting} size="sm" className="px-4 rounded-pill">
          {isSubmitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
              Mise à jour...
            </>
          ) : 'Mettre à jour le mouvement'}
        </Button>
      </div>
    </Form>
  );
};

export default FormItemUpdate;