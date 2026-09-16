import React, { memo } from 'react';
import Select from 'react-select';

const defaultSelectStyles = {
  control: (provided) => ({
    ...provided,
    fontSize: '0.85rem',
    minHeight: '38px',
  }),
  menu: (provided) => ({
    ...provided,
    fontSize: '0.85rem',
  }),
  input: (provided) => ({
    ...provided,
    fontSize: '0.85rem',
  }),
  option: (provided) => ({
    ...provided,
    fontSize: '0.85rem',
  }),
  singleValue: (provided) => ({
    ...provided,
    fontSize: '0.85rem',
  }),
};

/**
 * Champ de formulaire générique partagé par les modales Add/Edit (Matériels, ProduitLocaux).
 * `useNativeSelect` bascule entre un <select> natif et react-select ; `onSelectChange`
 * permet aux appelants qui gèrent leur select séparément (name, option) de s'y brancher.
 */
const FormItem = memo(
  ({
    label,
    name,
    type = 'text',
    options = [],
    formData,
    handleChange,
    onSelectChange,
    disabled = false,
    required = false,
    icon: Icon,
    useNativeSelect = false,
    selectStyles = defaultSelectStyles,
    isClearable = false,
    noOptionsMessage,
  }) => {
    const renderInput = () => {
      if (type === 'select') {
        if (useNativeSelect) {
          return (
            <select name={name} value={formData[name] || ''} onChange={handleChange} className="add-modal-select" disabled={disabled}>
              <option value="">Sélectionner...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }

        const normalizedOptions = options.map((opt) => ({
          ...opt,
          isDisabled: opt.isDisabled || opt.disabled || false,
        }));
        const selectedOption = formData[name]
          ? normalizedOptions.find((opt) => String(opt.value) === String(formData[name])) || null
          : null;

        return (
          <Select
            name={name}
            value={selectedOption}
            onChange={(selected) =>
              onSelectChange
                ? onSelectChange(name, selected)
                : handleChange({ target: { name, value: selected ? selected.value : '' } })
            }
            options={normalizedOptions}
            isDisabled={disabled}
            isClearable={isClearable}
            isSearchable
            placeholder="Sélectionner..."
            styles={selectStyles}
            classNamePrefix="add-modal-select"
            noOptionsMessage={noOptionsMessage}
          />
        );
      }

      if (type === 'textarea') {
        return (
          <textarea
            name={name}
            value={formData[name] || ''}
            onChange={handleChange}
            className="add-modal-textarea"
            placeholder={`Entrez ${label.toLowerCase()}`}
          />
        );
      }

      if (type === 'checkbox') {
        return (
          <div className="add-modal-checkbox-wrapper">
            <input type="checkbox" name={name} checked={formData[name] || false} onChange={handleChange} className="add-modal-checkbox" />
            <span className="add-modal-checkbox-label">{label}</span>
          </div>
        );
      }

      return (
        <input
          type={type}
          name={name}
          value={formData[name] || ''}
          onChange={handleChange}
          className="add-modal-input"
          placeholder={`Entrez ${label.toLowerCase()}`}
        />
      );
    };

    if (type === 'checkbox') {
      return renderInput();
    }

    return (
      <div className="add-modal-form-group">
        <label className="add-modal-label">
          {Icon && <Icon />} {label}
          {required && <span style={{ color: '#EF4444', marginLeft: '4px' }}>*</span>}
        </label>
        {renderInput()}
      </div>
    );
  }
);

export default FormItem;
