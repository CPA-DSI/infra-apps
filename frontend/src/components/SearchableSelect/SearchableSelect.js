import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './SearchableSelect.css';

// Select avec recherche intégrée, partagé par les pages Matériels et Utilisateurs.
//
// Props :
//   - value / onChange : valeur sélectionnée ('' = aucune) et callback de sélection.
//   - options          : tableau de chaînes ou d'objets { value, label }, avec en option :
//                          description (texte secondaire, affiché et pris en compte par la
//                          recherche), group / groupClassName (titre de groupe, affiché au
//                          changement de groupe ; options d'un même groupe à la suite) et
//                          display (contenu affiché dans le déclencheur une fois choisie).
//   - placeholder      : libellé de l'entrée « aucune sélection » (alias : allLabel).
//   - style            : styles additionnels du déclencheur.
//   - variant          : 'compact' (défaut, visuel des Form.Select rounded-pill de
//                        la page Matériels) ou 'filter' (visuel form-select de la
//                        page Utilisateurs, avec loupe et bouton d'effacement).
//   - styleClass       : classes CSS du déclencheur (par défaut selon la variante).
//   - allowEmpty       : false retire l'entrée « aucune sélection » de la liste (champ obligatoire).
//   - ariaLabelledBy   : id du libellé du champ (accessibilité).
//   - searchPlaceholder: texte de la recherche (défaut « Rechercher... »).
// Recherche insensible à la casse et aux accents.
// Styles : SearchableSelect.css (.ss--compact / .ss--filter).

// Minuscules sans accents ni tirets : « reseau » trouve « Réseau », « wifi » trouve « Wi-Fi ».
const normaliser = (texte) => String(texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, '').toLowerCase();

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
    allowEmpty = true,
    ariaLabelledBy,
    searchPlaceholder = 'Rechercher...',
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

    const q = normaliser(query.trim());
    const filteredOptions = normalizedOptions.filter(o =>
        normaliser(`${o.label} ${o.description || ''} ${o.group || ''}`).includes(q)
    );

    const selectedOption = normalizedOptions.find(o => o.value === value);
    // Variante « filter » : une valeur absente des options reste affichée telle quelle.
    const displayLabel = selectedOption
        ? (selectedOption.display ?? selectedOption.label)
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
                    placeholder={searchPlaceholder}
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
            placeholder={searchPlaceholder}
        />
    );

    const emptySelected = isFilter ? value === '' : !value;

    const items = (
        <>
            {allowEmpty && (
                <div
                    className={`ss-item ss-item--empty ${emptySelected ? 'is-selected' : ''}`}
                    onClick={() => select('')}
                >
                    {emptyLabel}
                </div>
            )}
            {filteredOptions.map((o, i) => (
                <React.Fragment key={o.value}>
                    {o.group && o.group !== filteredOptions[i - 1]?.group && (
                        <div className="ss-group" role="presentation">
                            <span className={o.groupClassName || ''}>{o.group}</span>
                        </div>
                    )}
                    <div
                        role="option"
                        aria-selected={value === o.value}
                        className={`ss-item ${o.group ? 'ss-item--grouped' : ''} ${value === o.value ? 'is-selected' : ''}`}
                        onClick={() => select(o.value)}
                    >
                        {o.label}
                        {o.description && <small className="ss-item-desc">{o.description}</small>}
                    </div>
                </React.Fragment>
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
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-labelledby={ariaLabelledBy}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            >
                <span className={`ss-label ${selectedOption || (isFilter && value) ? '' : 'is-placeholder'}`}>
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
