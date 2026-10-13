import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

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

const VARIANTS = {
    compact: {
        triggerClass: 'rounded-pill border-0 shadow-sm',
        triggerStyle: { paddingLeft: '14px', paddingRight: '14px', userSelect: 'none' },
        labelStyle: () => ({}),
        arrowStyle: { marginLeft: '8px', fontSize: '0.65rem', opacity: 0.5 },
        dropdownStyle: {
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            backgroundColor: '#fff', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden',
        },
        listStyle: { maxHeight: '220px', overflowY: 'auto' },
        emptyItemStyle: (selected) => ({
            padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
            color: '#6b7280', backgroundColor: selected ? '#e0e7ff' : '#fff',
        }),
        emptyItemHover: null,
        itemStyle: (selected) => ({
            padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
            backgroundColor: selected ? '#e0e7ff' : '#fff',
            color: selected ? '#4338ca' : '#374151',
        }),
        itemHoverBg: (selected) => (selected ? '#e0e7ff' : '#f3f4f6'),
        itemBg: (selected) => (selected ? '#e0e7ff' : '#fff'),
        noResultStyle: { padding: '9px 14px', fontSize: '0.85rem', color: '#9ca3af' },
    },
    filter: {
        triggerClass: 'form-select rounded-pill border-0 shadow-sm',
        triggerStyle: {},
        labelStyle: (hasValue) => ({ color: hasValue ? 'inherit' : '#6c757d' }),
        arrowStyle: { fontSize: '0.7rem', color: '#6c757d', marginLeft: '8px', flexShrink: 0 },
        dropdownStyle: {
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
            marginTop: '4px', backgroundColor: '#fff', border: '1px solid #e2e8f0',
            borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '260px', overflowY: 'auto',
        },
        listStyle: null,
        emptyItemStyle: (selected) => ({
            padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem', color: '#6c757d',
            backgroundColor: selected ? '#eef2ff' : 'transparent',
        }),
        emptyItemHover: { hover: '#f1f5f9', selected: '#eef2ff', idle: 'transparent' },
        itemStyle: (selected) => ({
            padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem',
            backgroundColor: selected ? '#eef2ff' : 'transparent', color: '#4f46e5', fontWeight: selected ? 600 : 400,
        }),
        itemHoverBg: () => '#f1f5f9',
        itemBg: (selected) => (selected ? '#eef2ff' : 'transparent'),
        noResultStyle: { padding: '9px 14px', fontSize: '0.85rem', color: '#adb5bd' },
    },
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

    const theme = VARIANTS[variant] || VARIANTS.compact;
    const isFilter = variant === 'filter';
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
        <div style={{ padding: '8px' }}>
            <div className="bg-light rounded-pill px-3 py-2 border-0" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#6c757d', marginRight: '8px' }}><FaSearch /></span>
                <input
                    autoFocus
                    type="text"
                    placeholder="Rechercher..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px' }}
                />
                {query && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setQuery(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>
        </div>
    ) : (
        <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid #e5e7eb',
                padding: '10px 14px',
                fontSize: '0.85rem',
                outline: 'none',
                backgroundColor: '#fff',
            }}
        />
    );

    const emptySelected = isFilter ? value === '' : !value;
    const hover = theme.emptyItemHover;

    const items = (
        <>
            <div
                onClick={() => select('')}
                style={theme.emptyItemStyle(emptySelected)}
                onMouseEnter={hover ? (e) => { e.currentTarget.style.backgroundColor = hover.hover; } : undefined}
                onMouseLeave={hover ? (e) => { e.currentTarget.style.backgroundColor = emptySelected ? hover.selected : hover.idle; } : undefined}
            >
                {emptyLabel}
            </div>
            {filteredOptions.map(o => {
                const selected = value === o.value;
                return (
                    <div
                        key={o.value}
                        onClick={() => select(o.value)}
                        style={theme.itemStyle(selected)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.itemHoverBg(selected); }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.itemBg(selected); }}
                    >
                        {o.label}
                    </div>
                );
            })}
            {filteredOptions.length === 0 && (
                <div style={theme.noResultStyle}>Aucun résultat</div>
            )}
        </>
    );

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                className={styleClass || theme.triggerClass}
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    ...theme.triggerStyle,
                }}
                onClick={toggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            >
                <span style={{ ...theme.labelStyle(Boolean(value)), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayLabel}
                </span>
                <span style={theme.arrowStyle}>▼</span>
            </div>
            {open && (
                <div style={theme.dropdownStyle}>
                    {searchInput}
                    {theme.listStyle ? <div style={theme.listStyle}>{items}</div> : items}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
