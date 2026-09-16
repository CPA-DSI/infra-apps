// src/pages/ProduitLocaux/ProductModal.js

import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FaBox, FaExclamationTriangle, FaCalendarAlt, FaTimes, FaPlus, FaSave } from "react-icons/fa";
import FormItem from "../../components/FormItem/FormItem";
import "./ProductModal.css";

const MySwal = withReactContent(Swal);

const ProductModal = ({ show, handleClose, handleSave, initialData, errorMessage }) => {
  const [formData, setFormData] = useState({
    nom_produit: "", quantite_en_stock: "", seuil_alerte: "", last_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);

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
      const formattedDate = initialData.last_date ? new Date(initialData.last_date).toISOString().split("T")[0] : "";
      setFormData({
        nom_produit: initialData.nom_produit || "",
        quantite_en_stock: initialData.quantite_en_stock || "",
        seuil_alerte: initialData.seuil_alerte || "",
        last_date: formattedDate,
      });
    } else {
      setFormData({ nom_produit: "", quantite_en_stock: "", seuil_alerte: "", last_date: "" });
    }
  }, [initialData, show]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await handleSave(formData);
      showNotification(initialData ? "Produit modifié avec succès !" : "Produit ajouté avec succès !", "success");
    } catch (err) {
      showNotification(err.message || "Une erreur est survenue.", "error");
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="add-modal-overlay">
      <form
        onSubmit={handleSubmit}
        className="add-modal-content">
        <div className="add-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div className="add-modal-icon-wrapper">{initialData ? <FaBox /> : <FaPlus />}</div>
            <div>
              <h2 className="add-modal-title">{initialData ? "Modifier le Produit" : "Ajouter un Produit"}</h2>
              <p className="add-modal-subtitle">Remplissez les informations ci-dessous</p>
            </div>
          </div>
          <button onClick={handleClose} className="add-modal-close-btn" type="button">
            <FaTimes />
          </button>
        </div>

        <div className="add-modal-body">
          {errorMessage && (
            <p
              className="add-modal-error"
              style={{ marginBottom: "16px", padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaExclamationTriangle /> {errorMessage}
            </p>
          )}

          <div className="add-modal-form-grid">
            <FormItem label="Nom du produit" name="nom_produit" type="text" formData={formData} handleChange={handleChange} icon={FaBox} />
            <FormItem label="Quantité en stock" name="quantite_en_stock" type="number" formData={formData} handleChange={handleChange} icon={FaBox} />
            <FormItem label="Seuil d'alerte" name="seuil_alerte" type="number" formData={formData} handleChange={handleChange} icon={FaExclamationTriangle} />
            <FormItem label="Date d'arrivée" name="last_date" type="date" formData={formData} handleChange={handleChange} icon={FaCalendarAlt} />
          </div>
        </div>

        <div className="add-modal-footer">
          <button 
            type="button" onClick={handleClose} className="add-modal-cancel-btn" disabled={isLoading}> 
            Annuler 
          </button>
          <button
            type="submit"
            className="add-modal-submit-btn"
            disabled={isLoading}>
            <FaSave /> {isLoading ? "Enregistrement..." : initialData ? "Modifier le Produit" : "Ajouter le Produit"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductModal;
