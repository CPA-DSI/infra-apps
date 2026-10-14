import React from 'react';
import { toneClass } from '../../utils/tones';
import './MailModals.css';

const StatCard = React.memo(({ icon: Icon, value, label, tone, tooltip }) => {
    return (
        <div className={`mail-stat-tile ${toneClass(tone)}`} role="group" aria-label={label} title={tooltip}>
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
