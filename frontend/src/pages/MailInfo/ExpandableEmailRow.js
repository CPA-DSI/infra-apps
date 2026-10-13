import React from 'react';
import Swal from 'sweetalert2';
import { FaEnvelope } from 'react-icons/fa';
import './MailModals.css';

const ExpandableEmailRow = ({ data: user }) => {
    const emails = user?.emails || [];
    const primary = emails.find(e => e.is_primary) || emails[0];
    const otherEmails = emails.filter(e => e !== primary);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            Swal.fire({
                icon: 'success',
                title: 'Copié !',
                text: 'L\'adresse email a été copiée.',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }).catch(err => console.error('Erreur de copie:', err));
    };

    return (
        <div className="mail-expand-row">
            <div className="mail-expand-title">
                <FaEnvelope className="mail-expand-title-icon" aria-hidden="true" />
                <span className="mail-expand-title-text">
                    Toutes les adresses email ({emails.length})
                </span>
            </div>

            <div className="row g-3">
                {primary && (
                    <div className="col-md-6">
                        <div className="email-cell email-primary mail-expand-email" onClick={() => copyToClipboard(primary.email || '')} title="Cliquez pour copier">
                            <span>{primary.email || 'N/A'}</span>
                            <span className="email-badge-primary">PRINCIPAL</span>
                            {primary.is_verified ? (
                                <span className="email-badge-verified">✓ Vérifié</span>
                            ) : (
                                <span className="email-badge-unverified">Non vérifié</span>
                            )}
                        </div>
                    </div>
                )}

                {otherEmails.map((email, idx) => (
                    <div key={email.id_uEmail || idx} className="col-md-6">
                        <div className="email-cell email-secondary mail-expand-email" onClick={() => copyToClipboard(email.email || '')} title="Cliquez pour copier">
                            <span>{email.email || 'N/A'}</span>
                            <span className="email-badge-secondary">SECONDAIRE {idx + 1}</span>
                            {email.is_verified ? (
                                <span className="email-badge-verified">✓ Vérifié</span>
                            ) : (
                                <span className="email-badge-unverified">Non vérifié</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExpandableEmailRow;
