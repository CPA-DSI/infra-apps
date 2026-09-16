// src/pages/ProduitLocaux/LocationModal.js

import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FaBuilding, FaAlignLeft, FaExclamationTriangle, FaTimes, FaPlus, FaSave } from "react-icons/fa";
import FormItem from "../../components/FormItem/FormItem";
import "./ProductModal.css";

const MySwal = withReactContent(Swal);

const LocationModal = ({ show, handleClose, onSaveSuccess, initialData, existingLocations = [], existingProducts = [] }) => {
  const [formData, setFormData] = useState({
    nom_local: "",
    description: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uniqueNameError, setUniqueNameError] = useState("");
  const [productNameError, setProductNameError] = useState("");

  const showNotification = (message, type = "success") => {
    MySwal.fire({
      icon: type,
      title: type === "success" ? "Succès" : "Erreur",
      text: message,
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: "top-end",
      background: type === "success" ? "#10b981" : "#ef4444",
      color: "#ffffff",
      iconColor: "#ffffff",
    });
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        nom_local: initialData.nom_local || "",
        description: initialData.description || "",
      });
    } else {
      setFormData({ nom_local: "", description: "" });
    }
    setUniqueNameError("");
    setProductNameError("");
  }, [initialData, show]);

  const checkUniqueName = useCallback((name, excludeId = null) => {
    const normalizedName = name.trim().toLowerCase();
    const locationExists = existingLocations.some((loc) =>
      loc.nom_local?.trim().toLowerCase() === normalizedName &&
      loc.id_local !== excludeId
    );
    
    if (locationExists) {
      throw new Error("Erreur : Ce local existe déjà. Veuillez saisir un nouveau nom de local.");
    }

    // Vérifier si le nom existe déjà dans les produits
    const productExists = existingProducts.some((prod) =>
      prod.nom_produit?.trim().toLowerCase() === normalizedName
    );
    if (productExists) throw new Error("Erreur : Ce nom existe déjà comme nom de produit. Veuillez choisir un autre nom.");
  }, [existingLocations, existingProducts]);

  const handleChange = useCallback((e) => {
    const { name: fieldName, value: fieldValue } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [fieldName]: fieldValue,
    }));
    if (fieldName === "nom_local") {
      setUniqueNameError("");
      setProductNameError("");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      checkUniqueName(formData.nom_local, initialData?.id_local);
      
      // Créer un objet avec les données et l'ID (si modification)
      const dataToSave = {
        ...formData,
        id_local: initialData?.id_local || null
      };
      
      await onSaveSuccess(dataToSave);
      showNotification(initialData ? "Local modifié avec succès !" : "Local ajouté avec succès !", "success");
      handleClose(); // Fermer la modale après un enregistrement réussi

    } catch (err) {
      console.error("Error saving location:", err.response ? err.response.data : err.message);
      showNotification(err.message || "Erreur lors de l'enregistrement.", "error");
      handleClose(); // Fermer la modale en cas d'erreur aussi
    } finally {
      setIsLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="add-modal-overlay">
      <form onSubmit={handleSubmit} className="add-modal-content">
        <div className="add-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div className="add-modal-icon-wrapper">{initialData ? <FaBuilding /> : <FaPlus />}</div>
            <div>
              <h2 className="add-modal-title">{initialData ? "Modifier le Local" : "Ajouter un Local"}</h2>
              <p className="add-modal-subtitle">Remplissez les informations ci-dessous</p>
            </div>
          </div>
          <button onClick={handleClose} className="add-modal-close-btn" type="button">
            <FaTimes />
          </button>
        </div>

        <div className="add-modal-body">
          {(uniqueNameError || productNameError) && (
            <p
              className="add-modal-error"
              style={{ marginBottom: "16px", padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaExclamationTriangle /> {uniqueNameError || productNameError}
            </p>
          )}

          <div className="add-modal-form-grid">
            <FormItem label="Nom du local" name="nom_local" type="text" formData={formData} handleChange={handleChange} icon={FaBuilding} />
            <FormItem label="Description" name="description" type="textarea" formData={formData} handleChange={handleChange} icon={FaAlignLeft} />
          </div>
        </div>

        <div className="add-modal-footer">
          <button type="button" onClick={handleClose} className="add-modal-cancel-btn" disabled={isLoading} >
            Annuler
          </button>
          <button type="submit" className="add-modal-submit-btn" disabled={isLoading} >
            <FaSave /> {isLoading ? "Enregistrement..." : initialData ? "Modifier le Local" : "Ajouter le Local"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LocationModal;
