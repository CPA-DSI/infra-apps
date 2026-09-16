import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

// COMPOSANT SELECT RECHERCHABLE (visuel identique à un form-select)
const SearchableSelect = ({ value, onChange, options, allLabel, styleClass = 'form-select rounded-pill border-0 shadow-sm', style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                className={styleClass}
                style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setIsOpen(!isOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
            >
                <span style={{ color: value ? 'inherit' : '#6c757d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || allLabel}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#6c757d', marginLeft: '8px', flexShrink: 0 }}>▼</span>
            </div>
            {isOpen && (
                <div
                    style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
                        marginTop: '4px', backgroundColor: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '260px', overflowY: 'auto'
                    }}
                >
                    <div style={{ padding: '8px' }}>
                        <div className="bg-light rounded-pill px-3 py-2 border-0" style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#6c757d', marginRight: '8px' }}><FaSearch /></span>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Rechercher..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px' }}
                            />
                            {search && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>
                    </div>
                    <div
                        onClick={() => { onChange(''); setSearch(''); setIsOpen(false); }}
                        style={{
                            padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem', color: '#6c757d',
                            backgroundColor: value === '' ? '#eef2ff' : 'transparent'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = value === '' ? '#eef2ff' : 'transparent'; }}
                    >
                        {allLabel}
                    </div>
                    {filteredOptions.map(opt => (
                        <div
                            key={opt}
                            onClick={() => { onChange(opt); setSearch(''); setIsOpen(false); }}
                            style={{
                                padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                backgroundColor: opt === value ? '#eef2ff' : 'transparent', color: '#4f46e5', fontWeight: opt === value ? 600 : 400
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = opt === value ? '#eef2ff' : 'transparent'; }}
                        >
                            {opt}
                        </div>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div style={{ padding: '9px 14px', fontSize: '0.85rem', color: '#adb5bd' }}>Aucun résultat</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
