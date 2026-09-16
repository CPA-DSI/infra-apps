import React from 'react';
import Swal from 'sweetalert2';
import { FaEnvelope } from 'react-icons/fa';

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
        <div style={{
            padding: '20px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px'
            }}>
                <FaEnvelope style={{ color: '#6366f1', fontSize: '0.85rem' }} />
                <span style={{
                    fontWeight: '700', color: '#374151', fontSize: '0.9rem', letterSpacing: '0.3px'
                }}>
                    Toutes les adresses email ({emails.length})
                </span>
            </div>

            <div className="row g-3">
                {primary && (
                    <div className="col-md-6">
                        <div className="email-cell email-primary" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(primary.email || '')} title="Cliquez pour copier">
                            <span style={{ fontWeight: '600' }}>{primary.email || 'N/A'}</span>
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
                        <div className="email-cell email-secondary" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(email.email || '')} title="Cliquez pour copier">
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
