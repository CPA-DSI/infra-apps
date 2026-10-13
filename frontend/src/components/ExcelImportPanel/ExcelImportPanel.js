import React from 'react';
import { Spinner } from 'react-bootstrap';
import { FaFileExcel, FaTimes, FaFileImport, FaUpload, FaCheckCircle, FaFileUpload, FaInfoCircle, FaSearch } from 'react-icons/fa';
import '../../styles/ImportPanel.css';

const progressLabel = (progress) => {
    if (progress < 25) return 'Analyse du fichier Excel...';
    if (progress < 70) return 'Envoi des données au serveur...';
    if (progress < 100) return 'Traitement des données...';
    return 'Importation terminée !';
};

/**
 * Panneau d'import Excel (glisser-déposer, aperçu, progression, résultat).
 * Les props d'état et de gestion portent les mêmes noms que les valeurs
 * renvoyées par les hooks d'import (useMaterielImportExport, useUserImportExport) :
 * on peut donc les transmettre par décomposition.
 *
 *  - title : titre du panneau
 *  - variant : 'header' (défaut) | 'brand' (couleurs d'accent)
 *  - successLabel : libellé du compteur de succès, ex. « matériel(s) importé(s) »
 *  - successFallback : message affiché quand le serveur ne renvoie pas de statistiques
 *  - emptyResultMessage : message optionnel quand ni succès ni échec
 *  - showCloseOnFailure : bouton « Fermer » sous le résultat en cas d'échecs
 */
const ExcelImportPanel = ({
    title,
    variant = 'header',
    successLabel,
    successFallback,
    emptyResultMessage,
    showCloseOnFailure = false,
    importFile,
    importProgress,
    isImporting,
    importSuccess,
    importSuccessStats,
    importError,
    importPreview = [],
    importData = [],
    importWarnings = [],
    importErrors = [],
    isDragging,
    fileInputRef,
    toggleImportSection,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handleRemoveFile,
    handleImportSubmit,
}) => {
    const successCount = importSuccessStats?.success || 0;
    const failedCount = importSuccessStats?.failed || 0;
    const warningCount = importSuccessStats?.warnings || 0;
    const isDone = importProgress === 100;

    return (
        <section className={`import-panel ${variant === 'brand' ? 'import-panel--brand' : ''}`.trim()} aria-label={title}>
            <div className="import-panel-header">
                <h2 className="import-panel-title">
                    <span className="import-panel-title-icon" aria-hidden="true">
                        <FaFileImport size={14} />
                    </span>
                    {title}
                </h2>
                <button
                    type="button"
                    className="import-panel-close"
                    onClick={toggleImportSection}
                    disabled={isImporting}
                    title="Fermer"
                    aria-label="Fermer"
                >
                    <FaTimes size={14} />
                </button>
            </div>

            {!importSuccess ? (
                <>
                    <div
                        className={`import-panel-drop-zone ${isDragging ? 'dragover' : ''} ${importFile ? 'has-file' : ''}`}
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="d-none" disabled={isImporting}
                        />

                        {importFile ? (
                            <div className="d-flex align-items-center justify-content-center gap-4">
                                <div className="import-panel-file-icon" aria-hidden="true">
                                    <FaFileExcel />
                                </div>
                                <div className="text-start flex-grow-1">
                                    <div className="import-panel-file-name">{importFile.name}</div>
                                    <div className="import-panel-file-size">
                                        {(importFile.size / 1024).toFixed(1)} Ko
                                    </div>
                                    <div className="import-panel-file-ready">
                                        <FaCheckCircle className="me-1" size={12} aria-hidden="true" /> Fichier prêt à importer
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="import-panel-remove-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFile();
                                    }}
                                    disabled={isImporting}
                                    aria-label="Retirer le fichier"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="import-panel-drop-icon" aria-hidden="true">
                                    <FaFileUpload />
                                </div>
                                <div className="import-panel-drop-title">
                                    Glissez-déposez votre fichier Excel ici
                                </div>
                                <div className="import-panel-drop-hint">
                                    ou <span className="import-panel-browse-link">parcourez vos fichiers</span>
                                </div>
                                <div className="import-panel-formats">
                                    Formats acceptés : <strong>.xlsx, .xls</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {importPreview.length > 0 && !isImporting && (
                        <div className="import-panel-preview">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h3 className="import-panel-preview-title">
                                    <FaSearch aria-hidden="true" />
                                    Aperçu des données
                                </h3>
                                <span className="import-panel-count-badge">
                                    {importData.length} lignes au total
                                </span>
                            </div>
                            <div className="import-panel-table-wrapper">
                                <table className="table table-sm table-hover import-panel-table">
                                    <thead>
                                        <tr>
                                            {Object.keys(importPreview[0] || {}).map((key, index) => (
                                                <th key={index}>{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importPreview.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {Object.values(row).map((value, cellIndex) => (
                                                    <td key={cellIndex}>{String(value || '')}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <small className="import-panel-note">
                                <FaInfoCircle aria-hidden="true" />
                                Aperçu des 5 premières lignes
                            </small>
                        </div>
                    )}

                    {importWarnings.length > 0 && !isImporting && (
                        <div className="import-panel-message import-panel-message--warning">
                            <div className="d-flex align-items-center gap-2 fw-semibold mb-1">
                                <FaInfoCircle aria-hidden="true" />
                                <span>{importWarnings.length} doublon(s) détecté(s) dans le fichier</span>
                            </div>
                            <ul className="ps-4">
                                {importWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                            </ul>
                            <div className="import-panel-message-note">
                                Ces lignes seront ignorées lors de l'import.
                            </div>
                        </div>
                    )}

                    {isImporting && (
                        <div className="import-panel-progress">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <Spinner animation="border" size="sm" />
                                    <span className="import-panel-progress-label">{progressLabel(importProgress)}</span>
                                </div>
                                <span className={`import-panel-progress-value ${isDone ? 'is-done' : ''}`}>
                                    {importProgress}%
                                </span>
                            </div>
                            <div
                                className="import-panel-progress-track"
                                role="progressbar"
                                aria-valuenow={importProgress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <div
                                    className={`import-panel-progress-fill ${isDone ? 'is-done' : ''}`}
                                    style={{ width: `${importProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {importError && (
                        <div className="import-panel-message import-panel-message--danger" role="alert">
                            <div className="d-flex align-items-center gap-2">
                                <FaTimes aria-hidden="true" />
                                <span>{importError}</span>
                            </div>
                        </div>
                    )}

                    {!isImporting && (
                        <div className="import-panel-actions">
                            <button
                                type="button"
                                className="import-panel-btn import-panel-btn--cancel"
                                onClick={toggleImportSection}
                            >
                                <FaTimes size={12} aria-hidden="true" />
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="import-panel-btn import-panel-btn--submit"
                                onClick={handleImportSubmit}
                                disabled={!importFile}
                            >
                                <FaUpload size={12} aria-hidden="true" />
                                Importer
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="import-panel-result">
                    <div className="import-panel-result-icon" aria-hidden="true">
                        <FaCheckCircle />
                    </div>
                    <div className="import-panel-result-title">
                        {successCount > 0 ? 'Importation réussie !' : 'Import terminé'}
                    </div>
                    <div className="import-panel-result-body">
                        {importSuccessStats ? (
                            <div className="d-flex flex-column gap-2 mt-3">
                                {successCount > 0 && (
                                    <div className="import-panel-stat import-panel-stat--success">
                                        <span className="import-panel-stat-icon" aria-hidden="true"><FaCheckCircle /></span>
                                        <span>{importSuccessStats.success} {successLabel}</span>
                                    </div>
                                )}
                                {failedCount > 0 && (
                                    <div className="import-panel-stat import-panel-stat--failed">
                                        <span className="import-panel-stat-icon" aria-hidden="true"><FaTimes /></span>
                                        <span>{importSuccessStats.failed} échec(s)</span>
                                    </div>
                                )}
                                {warningCount > 0 && (
                                    <div className="import-panel-stat import-panel-stat--warning">
                                        <span className="import-panel-stat-icon" aria-hidden="true"><FaInfoCircle /></span>
                                        <span>{importSuccessStats.warnings} avertissement(s)</span>
                                    </div>
                                )}
                                {emptyResultMessage && successCount === 0 && failedCount === 0 && (
                                    <div className="import-panel-result-note import-panel-result-note--warning">
                                        {emptyResultMessage}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="import-panel-result-note import-panel-result-note--success">
                                {successFallback}
                            </div>
                        )}
                    </div>

                    {importErrors.length > 0 && (
                        <div className="import-panel-message import-panel-message--danger import-panel-errors">
                            <div className="fw-semibold mb-2">
                                Détail des lignes ignorées :
                            </div>
                            <ul className="ps-3">
                                {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
                        </div>
                    )}

                    {showCloseOnFailure && failedCount > 0 && (
                        <div className="text-center mt-4">
                            <button
                                type="button"
                                className="import-panel-btn import-panel-btn--cancel"
                                onClick={toggleImportSection}
                            >
                                Fermer
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default ExcelImportPanel;
