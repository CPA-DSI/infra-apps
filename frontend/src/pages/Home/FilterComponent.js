// src/pages/Home/FilterComponent.js
import React from 'react';

const FilterComponent = ({ filterText, onFilter, onClear }) => (
    <div className="filter-input-wrapper">
        <input
            type="text"
            placeholder="Rechercher une équipe ou un local..."
            aria-label="Rechercher dans l'inventaire"
            value={filterText}
            onChange={onFilter}
            className="filter-input"
        />
        {filterText && (
            <button
                type="button"
                className="filter-clear-btn"
                onClick={onClear}
                aria-label="Effacer la recherche"
                title="Effacer la recherche"
            >
                ✕
            </button>
        )}
    </div>
);

export default FilterComponent;
