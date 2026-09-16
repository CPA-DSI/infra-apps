import React, { useState, useEffect, useRef } from 'react';

// Select avec recherche intégrée, conserve exactement le même style visuel
// que les Form.Select existants (rounded-pill, border-0, shadow-sm, 38px).
const SearchableSelect = ({ value, onChange, options, placeholder, style }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);

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
        o.label.toLowerCase().includes(query.toLowerCase())
    );

    const selectedOption = normalizedOptions.find(o => o.value === value);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                onClick={() => { setOpen(!open); setQuery(''); }}
                className="rounded-pill border-0 shadow-sm"
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <span style={{
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '0.65rem', opacity: 0.5 }}>▼</span>
            </div>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 1000,
                    overflow: 'hidden',
                }}>
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
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        <div
                            onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                            style={{
                                padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                                color: '#6b7280', backgroundColor: !value ? '#e0e7ff' : '#fff',
                            }}
                        >
                            {placeholder}
                        </div>
                        {filteredOptions.map(o => (
                            <div
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                                style={{
                                    padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                                    backgroundColor: value === o.value ? '#e0e7ff' : '#fff',
                                    color: value === o.value ? '#4338ca' : '#374151',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = value === o.value ? '#e0e7ff' : '#f3f4f6'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = value === o.value ? '#e0e7ff' : '#fff'; }}
                            >
                                {o.label}
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div style={{ padding: '9px 14px', fontSize: '0.85rem', color: '#9ca3af' }}>
                                Aucun résultat
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
