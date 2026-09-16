import React, { useState } from 'react';

const StatCard = React.memo(({ icon: Icon, value, label, colorScheme, tooltip }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="stat-card" role="group" aria-label={label} title={tooltip}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(160deg, ${colorScheme.bg} 0%, #0f172a 100%)`,
                borderLeft: `4px solid ${colorScheme.accent}`,
                borderTop: `1px solid ${colorScheme.border}`,
                borderRight: `1px solid ${colorScheme.border}`,
                borderBottom: `1px solid ${colorScheme.border}`,
                borderRadius: '14px',
                transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: isHovered
                    ? `0 10px 28px ${colorScheme.accent}30, 0 0 0 1px ${colorScheme.accent}40`
                    : '0 2px 8px rgba(0,0,0,0.25)',
                minWidth: '120px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <Icon
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    right: '-10px',
                    bottom: '-16px',
                    fontSize: '4.5rem',
                    color: colorScheme.accent,
                    opacity: isHovered ? 0.1 : 0.05,
                    transform: isHovered ? 'scale(1.1) rotate(-6deg)' : 'scale(1)',
                    transition: 'all 0.4s ease',
                    pointerEvents: 'none'
                }}
            />
            <div className="d-flex align-items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
                <div
                    className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                    style={{
                        backgroundColor: colorScheme.iconBg,
                        width: '42px',
                        height: '42px',
                        boxShadow: `inset 0 0 0 1px ${colorScheme.accent}30`,
                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <Icon style={{ fontSize: '1.1rem', color: colorScheme.accent }} />
                </div>
                <div>
                    <div
                        className="fw-bold"
                        style={{
                            fontSize: '1.4rem',
                            color: colorScheme.text,
                            lineHeight: 1.15,
                            letterSpacing: '-0.3px',
                            fontVariantNumeric: 'tabular-nums',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
                    </div>
                    <div
                        className="fw-semibold text-uppercase"
                        style={{
                            fontSize: '0.68rem',
                            color: colorScheme.muted,
                            letterSpacing: '0.6px'
                        }}
                    >
                        {label}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default StatCard;
