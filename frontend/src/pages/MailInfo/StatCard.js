import React from 'react';
import './MailModals.css';

const StatCard = React.memo(({ icon: Icon, value, label, colorScheme, tooltip }) => {
    // Couleurs propres à chaque carte, exposées en variables CSS (cf. .mail-stat-tile)
    const colorVars = {
        '--stat-bg': colorScheme.bg,
        '--stat-accent': colorScheme.accent,
        '--stat-border': colorScheme.border,
        '--stat-icon-bg': colorScheme.iconBg,
        '--stat-text': colorScheme.text,
        '--stat-muted': colorScheme.muted,
        '--stat-icon-ring': `inset 0 0 0 1px ${colorScheme.accent}30`,
        '--stat-shadow-hover': `0 10px 28px ${colorScheme.accent}30, 0 0 0 1px ${colorScheme.accent}40`,
    };

    return (
        <div className="mail-stat-tile" role="group" aria-label={label} title={tooltip} style={colorVars}>
            <Icon className="mail-stat-watermark" aria-hidden="true" />
            <div className="mail-stat-content d-flex align-items-center gap-3">
                <div className="mail-stat-icon d-flex align-items-center justify-content-center rounded-circle flex-shrink-0">
                    <Icon aria-hidden="true" />
                </div>
                <div>
                    <div className="mail-stat-value fw-bold">
                        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
                    </div>
                    <div className="mail-stat-label fw-semibold text-uppercase">
                        {label}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default StatCard;
