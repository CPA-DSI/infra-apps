// src/pages/ProduitLocaux/ProductModal.js

import React, { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/swal";
import { FaBox, FaExclamationTriangle, FaCalendarAlt, FaPlus, FaSave } from "react-icons/fa";
import FormItem from "../../components/FormItem/FormItem";
import AppModal from "../../components/AppModal/AppModal";

const ProductModal = ({ show, handleClose, handleSave, initialData, errorMessage }) => {
  const [formData, setFormData] = useState({
    nom_produit: "", quantite_en_stock: "", seuil_alerte: "", last_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const showNotification = (message, type = "success") => {
    notify(message, type);
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

  return (
    <AppModal
      show={show}
      onClose={handleClose}
      as="form"
      onSubmit={handleSubmit}
      icon={initialData ? <FaBox /> : <FaPlus />}
      title={initialData ? "Modifier le Produit" : "Ajouter un Produit"}
      subtitle="Remplissez les informations ci-dessous"
      footer={
        <>
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
        </>
      }
    >
      {errorMessage && (
        <p className="add-modal-error prod-modal-error">
          <FaExclamationTriangle aria-hidden="true" /> {errorMessage}
        </p>
      )}

      <div className="add-modal-form-grid">
        <FormItem label="Nom du produit" name="nom_produit" type="text" formData={formData} handleChange={handleChange} icon={FaBox} />
        <FormItem label="Quantité en stock" name="quantite_en_stock" type="number" formData={formData} handleChange={handleChange} icon={FaBox} />
        <FormItem label="Seuil d'alerte" name="seuil_alerte" type="number" formData={formData} handleChange={handleChange} icon={FaExclamationTriangle} />
        <FormItem label="Date d'arrivée" name="last_date" type="date" formData={formData} handleChange={handleChange} icon={FaCalendarAlt} />
      </div>
    </AppModal>
  );
};

export default ProductModal;
