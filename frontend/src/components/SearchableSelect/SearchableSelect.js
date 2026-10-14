import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './SearchableSelect.css';

// Select avec recherche intégrée, partagé par les pages Matériels et Utilisateurs.
//
// Props :
//   - value / onChange : valeur sélectionnée ('' = aucune) et callback de sélection.
//   - options          : tableau de chaînes ou d'objets { value, label }.
//   - placeholder      : libellé de l'entrée « aucune sélection » (alias : allLabel).
//   - style            : styles additionnels du déclencheur.
//   - variant          : 'compact' (défaut, visuel des Form.Select rounded-pill de
//                        la page Matériels) ou 'filter' (visuel form-select de la
//                        page Utilisateurs, avec loupe et bouton d'effacement).
//   - styleClass       : classes CSS du déclencheur (par défaut selon la variante).
// Styles : SearchableSelect.css (.ss--compact / .ss--filter).

const TRIGGER_CLASSES = {
    compact: 'rounded-pill border-0 shadow-sm',
    filter: 'form-select rounded-pill border-0 shadow-sm',
};

const SearchableSelect = ({
    value,
    onChange,
    options = [],
    placeholder,
    allLabel,
    style,
    styleClass,
    variant = 'compact',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);

    const isFilter = variant === 'filter';
    const variantKey = isFilter ? 'filter' : 'compact';
    const emptyLabel = placeholder ?? allLabel;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedOptions = options.map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
    );

    const filteredOptions = normalizedOptions.filter(o =>
        String(o.label).toLowerCase().includes(query.toLowerCase())
    );

    const selectedOption = normalizedOptions.find(o => o.value === value);
    // Variante « filter » : une valeur absente des options reste affichée telle quelle.
    const displayLabel = selectedOption
        ? selectedOption.label
        : (isFilter && value) ? value : emptyLabel;

    const toggle = () => { setOpen(!open); setQuery(''); };
    const select = (newValue) => { onChange(newValue); setOpen(false); setQuery(''); };

    const searchInput = isFilter ? (
        <div className="ss-search-wrap">
            <div className="ss-search-pill bg-light rounded-pill px-3 py-2 border-0">
                <span className="ss-search-icon"><FaSearch /></span>
                <input
                    autoFocus
                    type="text"
                    placeholder="Rechercher..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                    <button
                        type="button"
                        className="ss-search-clear"
                        onClick={(e) => { e.stopPropagation(); setQuery(''); }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>
        </div>
    ) : (
        <input
            autoFocus
            className="ss-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
        />
    );

    const emptySelected = isFilter ? value === '' : !value;

    const items = (
        <>
            <div
                className={`ss-item ss-item--empty ${emptySelected ? 'is-selected' : ''}`}
                onClick={() => select('')}
            >
                {emptyLabel}
            </div>
            {filteredOptions.map(o => (
                <div
                    key={o.value}
                    className={`ss-item ${value === o.value ? 'is-selected' : ''}`}
                    onClick={() => select(o.value)}
                >
                    {o.label}
                </div>
            ))}
            {filteredOptions.length === 0 && (
                <div className="ss-no-result">Aucun résultat</div>
            )}
        </>
    );

    return (
        <div ref={containerRef} className={`ss ss--${variantKey}`}>
            <div
                className={`ss-trigger ${styleClass || TRIGGER_CLASSES[variantKey]}`}
                style={style}
                onClick={toggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            >
                <span className={`ss-label ${value ? '' : 'is-placeholder'}`}>
                    {displayLabel}
                </span>
                <span className="ss-arrow">▼</span>
            </div>
            {open && (
                <div className="ss-dropdown">
                    {searchInput}
                    {isFilter ? items : <div className="ss-list">{items}</div>}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
