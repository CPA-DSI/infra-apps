// FormItem.js - Définition des styles inline
import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';

// Le reste de votre composant FormItem
const FormItem = ({ label, name, type = 'text', options = [], formData, handleChange }) => {
    
    // Gère le rendu des différents types d'input
    const renderInput = () => {
        switch (type) {
            case 'select':
                return (
                    <select
                        name={name}
                        value={formData[name] || ''}
                        onChange={handleChange}
                        style={inputStyle}
                    >
                        <option value="">Sélectionnez...</option> {/* Ajout d'une option par défaut */}
                        {options.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            case 'textarea':
                return (
                    <textarea
                        name={name}
                        value={formData[name] || ''}
                        onChange={handleChange}
                        style={{ ...inputStyle, height: '80px' }} // Hauteur spécifique pour textarea
                    />
                );
            case 'checkbox':
                return (
                    <div style={checkboxWrapperStyle}>
                        <input
                            type="checkbox"
                            name={name}
                            checked={formData[name] || false}
                            onChange={handleChange}
                            style={{ marginRight: '10px' }} // Espace entre la case et le label
                        />
                         <label htmlFor={name} style={{ margin: 0 }}>{label}</label>
                    </div>
                );
            case 'date':
                return (
                    <input
                        type="date"
                        name={name}
                        value={formData[name] || ''}
                        onChange={handleChange}
                        style={inputStyle}
                    />
                );
            default:
                return (
                    <input
                        type={type}
                        name={name}
                        value={formData[name] || ''}
                        onChange={handleChange}
                        style={inputStyle}
                    />
                );
        }
    };

    // Pour les checkboxes, le label est rendu à l'intérieur du wrapper
    if (type === 'checkbox') {
        return <>{renderInput()}</>;
    }

    return (
        <div style={formItemStyle}>
            <label style={labelStyle} htmlFor={name}>{label}</label>
            {renderInput()}
        </div>
    );
};

const formItemStyle = {
    display: 'flex',
    justifyContent: 'space-between', // Aligne le label à gauche, l'input à droite
    alignItems: 'center', // Centre verticalement les éléments
    marginBottom: '15px', // Espace entre chaque ligne de formulaire
};

const labelStyle = {
    flex: '0 0 30%', // Le label prend 30% de la largeur totale et ne grandit pas
    marginRight: '20px', // Espace entre le label et l'input
    textAlign: 'right', // Optionnel : aligne le texte du label à droite
    // paddingRight: '10px', 
};

const inputStyle = {
    flex: '1 1 65%', // L'input prend le reste de l'espace disponible (environ 65%)
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    width: 'auto', // Important pour que flex gère la largeur
};

// Styles spécifiques pour les checkboxes
const checkboxWrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '15px',
    justifyContent: 'flex-start', // Aligne le groupe checkbox/label à gauche
};

export default FormItem;
