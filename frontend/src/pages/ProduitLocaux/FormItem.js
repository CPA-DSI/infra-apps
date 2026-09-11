// src/components/FormItem.js
import React from 'react';

// NOUVEAU style pour alignement horizontal
const formItemStyle = {
    display: 'flex',
    alignItems: 'center', // Centre verticalement le label et l'input
    marginBottom: '10px',
    width: '100%',
    gap: '15px', // Espace entre le label et l'input
};

const labelStyle = {
    // marginBottom: '5px', // Inutile maintenant que c'est horizontal
    fontWeight: 'bold',
    // Ajoutez une largeur fixe au label pour qu'ils soient tous alignés verticalement
    // Ajustez cette valeur (ex: '150px') selon vos besoins pour le meilleur rendu
    width: '150px', 
    flexShrink: 0, // Empêche le label de rétrécir si l'écran est petit
};

const inputStyle = {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    // width: '100%', // Ancien style
    flexGrow: 1, // Permet à l'input de prendre l'espace restant
    boxSizing: 'border-box',
};


const checkboxWrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
};


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
                    // Pas de labelStyle ici pour garder l'alignement horizontal dans checkboxContainerStyle
                    <div style={checkboxWrapperStyle}>
                        <input
                            type="checkbox"
                            name={name}
                            checked={formData[name] || false}
                            onChange={handleChange}
                        />
                         <label htmlFor={name}>{label}</label>
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

export default FormItem;
