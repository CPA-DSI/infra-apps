import React from 'react';
import FormItem from './FormItem';

// FormItem (mode modale) affiche lui-même son AppModal : pas de Modal Bootstrap
// autour, sinon deux fonds et deux flous se superposent.
const AddStockModal = ({ show, onClose, onSuccess }) => {
  if (!show) return null;
  return <FormItem onSave={onSuccess} onClose={onClose} />;
};

export default AddStockModal;
