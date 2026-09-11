import './QuickPreviewModal.css';
import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { FaTimes, FaDownload, FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage } from 'react-icons/fa';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// --- Helpers ---
const getExtension = (filename = '') => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const isPdf = (mime, ext) =>
  mime.includes('pdf') || ext === 'pdf';

const isImage = (mime, ext) =>
  mime.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);

const isWord = (mime, ext) =>
  mime.includes('word') || mime.includes('msword') || ext === 'doc' || ext === 'docx';

const isExcel = (mime, ext) =>
  mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx';

const getFileIcon = (mime, filename) => {
  const ext = getExtension(filename);
  if (isPdf(mime, ext)) return <FaFilePdf />;
  if (isImage(mime, ext)) return <FaFileImage />;
  if (isWord(mime, ext)) return <FaFileWord />;
  if (isExcel(mime, ext)) return <FaFileExcel />;
  return <FaFileAlt />;
};

const detectSeparator = (text) => {
  const firstLine = (text || '').split(/\r?\n/)[0] || '';
  const candidates = [
    { sep: ';', score: 0 },
    { sep: ',', score: 0 },
    { sep: '\t', score: 0 },
    { sep: '|', score: 0 },
  ];

  candidates.forEach(({ sep }) => {
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === sep) candidates.find(c => c.sep === sep).score++;
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].score > 0 ? candidates[0].sep : ';';
};

const parseCsvText = (text, separator = ';') => {
  const lines = (text || '').split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => parseLine(line)).filter(row => row.length > 0);

  return { headers, rows };
};

const serializeCsv = (headers, rows, separator = ';') => {
  const escape = (value = '') => {
    const str = String(value);
    if (str.includes('"') || str.includes(separator) || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escape).join(separator)];
  rows.forEach(row => {
    const line = headers.map((_, idx) => escape(row[idx] || '')).join(separator);
    lines.push(line);
  });

  return lines.join('\n');
};

const QuickPreviewModal = ({ show, onHide, files = [], selectedIndex: externalIndex = 0, onSelectIndex }) => {
  const [internalIndex, setInternalIndex] = useState(externalIndex);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedIndex = onSelectIndex ? externalIndex : internalIndex;
  const currentFile = files[selectedIndex] || {};

  const mime = (currentFile.type || '').toLowerCase();
  const ext = getExtension(currentFile.filename);
  const hasPreview = Boolean(currentFile.url);

  const isCsv = mime.includes('csv') || mime.includes('text/plain') || ext === 'csv' || ext === 'txt';
  const [csvContent, setCsvContent] = useState('');
  const [csvError, setCsvError] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvSeparator, setCsvSeparator] = useState(';');
  const [editedRows, setEditedRows] = useState([]);
  const [csvPage, setCsvPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const CSV_PAGE_SIZE = 200;

  const [docxHtml, setDocxHtml] = useState('');
  const [docxError, setDocxError] = useState(false);
  const [xlsxHeaders, setXlsxHeaders] = useState([]);
  const [xlsxRows, setXlsxRows] = useState([]);
  const [xlsxError, setXlsxError] = useState(false);
  const [xlsxPage, setXlsxPage] = useState(0);
  const XLSX_PAGE_SIZE = 200;

  useEffect(() => {
    if (show && isCsv && currentFile.url) {
      setCsvContent('');
      setCsvError(false);
      setCsvHeaders([]);
      setCsvRows([]);
      setEditedRows([]);
      setCsvPage(0);
      setIsEditing(false);
      fetch(currentFile.url)
        .then(res => {
          if (!res.ok) throw new Error('Erreur réseau');
          return res.text();
        })
        .then(text => {
          setCsvContent(text);
          const separator = detectSeparator(text);
          setCsvSeparator(separator);
          const parsed = parseCsvText(text, separator);
          setCsvHeaders(parsed.headers);
          setCsvRows(parsed.rows);
          setEditedRows(parsed.rows);
        })
        .catch(() => setCsvError(true));
    }
  }, [show, isCsv, currentFile.url]);

  useEffect(() => {
    if (!show || !currentFile.url) return;
    const isWordFile = isWord(mime, ext);
    const isExcelFile = isExcel(mime, ext);
    if (!isWordFile && !isExcelFile) return;

    setDocxHtml('');
    setDocxError(false);
    setXlsxHeaders([]);
    setXlsxRows([]);
    setXlsxError(false);
    setXlsxPage(0);
    setIsLoading(true);

    fetch(currentFile.url)
      .then(res => {
        if (!res.ok) throw new Error('Erreur réseau');
        return res.arrayBuffer();
      })
      .then(buffer => {
        if (isWordFile) {
          mammoth.convertToHtml({ arrayBuffer: buffer })
            .then(result => setDocxHtml(result.value))
            .catch(() => setDocxError(true))
            .finally(() => setIsLoading(false));
        }
        if (isExcelFile) {
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (json.length > 0) {
            const headers = Object.keys(json[0]);
            setXlsxHeaders(headers);
            setXlsxRows(json);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isWordFile) setDocxError(true);
        if (isExcelFile) setXlsxError(true);
        setIsLoading(false);
      });
  }, [show, currentFile.url, mime, ext]);

  const handleCellChange = (rowIndex, colIndex, value) => {
    setEditedRows(prev => {
      const next = [...prev];
      next[rowIndex] = [...next[rowIndex]];
      next[rowIndex][colIndex] = value;
      return next;
    });
  };

  const totalCsvPages = Math.max(1, Math.ceil(editedRows.length / CSV_PAGE_SIZE));
  const paginatedRows = editedRows.slice(csvPage * CSV_PAGE_SIZE, (csvPage + 1) * CSV_PAGE_SIZE);

  const handleDownloadModified = () => {
    const data = serializeCsv(csvHeaders, editedRows, csvSeparator);
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = currentFile.filename ? currentFile.filename.replace(/\.[^/.]+$/, '') : 'fichier';
    link.download = `${baseName}_modifie.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (show) {
      setLoadError(false);
      setIsLoading(true);
    }
  }, [show]);

  useEffect(() => {
    if (!onSelectIndex) {
      setInternalIndex(externalIndex);
    }
  }, [externalIndex, onSelectIndex]);

  const handleIframeLoad = () => setIsLoading(false);
  const handleIframeError = () => { setIsLoading(false); setLoadError(true); };
  const handleImgLoad = () => setIsLoading(false);
  const handleImgError = () => { setIsLoading(false); setLoadError(true); };

  const handleExited = () => {
    setLoadError(false);
    setIsLoading(true);
    setDocxHtml('');
    setDocxError(false);
    setXlsxHeaders([]);
    setXlsxRows([]);
    setXlsxError(false);
    setXlsxPage(0);
  };

  const handleTabClick = (idx) => {
    if (onSelectIndex) {
      onSelectIndex(idx);
    } else {
      setInternalIndex(idx);
    }
    setLoadError(false);
    setIsLoading(true);
  };

  const renderPreview = () => {
    if (!hasPreview) {
      return (
        <div className="text-center py-5">
          <div style={{ fontSize: '4rem', marginBottom: '1rem', color: '#9ca3af' }}>
            <FaFileAlt />
          </div>
          <div style={{ color: '#6c757d', fontSize: '1.1rem', fontWeight: '500' }}>
            Aucun fichier à prévisualiser
          </div>
        </div>
      );
    }

    // --- PDF ---
    if (isPdf(mime, ext)) {
      return (
        <div className="preview-section">
          <div className="preview-frame-wrapper">
            {isLoading && !loadError && (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement du PDF…</span>
              </div>
            )}
            {loadError ? (
              <div className="preview-error">
                <FaFilePdf size={48} style={{ color: '#dc2626' }} />
                <p className="mt-3 mb-1">Impossible d'afficher le PDF</p>
                <small className="text-muted">Le fichier n'est peut-être pas accessible directement.</small>
              </div>
            ) : (
              <iframe
                src={currentFile.url}
                width="100%"
                height="600px"
                style={{ border: 'none', borderRadius: '8px' }}
                title="Prévisualisation PDF"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}
          </div>
          <div className="preview-footer">
            <span className="text-muted"><FaFilePdf className="me-1" /> PDF — Document portable</span>
            <Button variant="primary" size="sm" href={currentFile.url} target="_blank" rel="noopener noreferrer">
              <FaDownload className="me-1" /> Télécharger
            </Button>
          </div>
        </div>
      );
    }

    // --- Image ---
    if (isImage(mime, ext)) {
      return (
        <div className="preview-section">
          <div className="preview-frame-wrapper">
            {isLoading && !loadError && (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement de l'image…</span>
              </div>
            )}
            {loadError ? (
              <div className="preview-error">
                <FaFileImage size={48} style={{ color: '#ea580c' }} />
                <p className="mt-3 mb-1">Impossible d'afficher l'image</p>
                <small className="text-muted">Le fichier n'est peut-être pas accessible directement.</small>
              </div>
            ) : (
              <img
                src={currentFile.url}
                alt="Aperçu de l'image"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
                onLoad={handleImgLoad}
                onError={handleImgError}
              />
            )}
          </div>
          <div className="preview-footer">
            <span className="text-muted"><FaFileImage className="me-1" /> Image</span>
            <Button variant="primary" size="sm" href={currentFile.url} target="_blank" rel="noopener noreferrer">
              <FaDownload className="me-1" /> Télécharger
            </Button>
          </div>
        </div>
      );
    }

    // --- Word ---
    if (isWord(mime, ext)) {
      return (
        <div className="preview-section">
          <div className="preview-frame-wrapper">
            {isLoading && !loadError && (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement du document Word…</span>
              </div>
            )}
            {docxError ? (
              <div className="preview-error">
                <FaFileWord size={48} style={{ color: '#2563eb' }} />
                <p className="mt-3 mb-1">Impossible d'afficher le document</p>
                <small className="text-muted">La conversion du fichier DOCX a échoué.</small>
              </div>
            ) : docxHtml ? (
              <div
                className="preview-docx-content"
                style={{
                  width: '100%',
                  maxHeight: '65vh',
                  overflow: 'auto',
                  padding: '1rem',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            ) : (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement du document Word…</span>
              </div>
            )}
          </div>
          <div className="preview-footer">
            <span className="text-muted"><FaFileWord className="me-1" /> Document Word</span>
            <Button variant="primary" size="sm" href={currentFile.url} target="_blank" rel="noopener noreferrer">
              <FaDownload className="me-1" /> Télécharger
            </Button>
          </div>
        </div>
      );
    }

    // --- Excel ---
    if (isExcel(mime, ext)) {
      const totalXlsxPages = Math.max(1, Math.ceil(xlsxRows.length / XLSX_PAGE_SIZE));
      const paginatedXlsxRows = xlsxRows.slice(xlsxPage * XLSX_PAGE_SIZE, (xlsxPage + 1) * XLSX_PAGE_SIZE);
      const hasXlsxTableData = xlsxHeaders.length > 0 && paginatedXlsxRows.length > 0;
      return (
        <div className="preview-section">
          <div className="preview-frame-wrapper" style={{ alignItems: 'stretch' }}>
            {isLoading && !loadError && (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement du tableur…</span>
              </div>
            )}
            {xlsxError ? (
              <div className="preview-error">
                <FaFileExcel size={48} style={{ color: '#16a34a' }} />
                <p className="mt-3 mb-1">Impossible d'afficher le tableur</p>
                <small className="text-muted">La lecture du fichier Excel a échoué.</small>
              </div>
            ) : hasXlsxTableData ? (
              <div style={{ width: '100%', overflow: 'auto', maxHeight: '65vh', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <table className="preview-csv-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {xlsxHeaders.map((header, idx) => (
                        <th key={idx}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedXlsxRows.map((row, rIdx) => {
                      const globalIdx = xlsxPage * XLSX_PAGE_SIZE + rIdx;
                      return (
                        <tr key={rIdx}>
                          <td className="preview-csv-cell-index">{globalIdx + 1}</td>
                          {xlsxHeaders.map((_, cIdx) => (
                            <td key={cIdx}>
                              <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block' }}>{row[xlsxHeaders[cIdx]] ?? ''}</span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="preview-loading">
                <Spinner animation="border" variant="primary" size="sm" />
                <span className="ms-2">Chargement du tableur…</span>
              </div>
            )}
          </div>
          <div className="preview-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <span className="text-muted">
              <FaFileExcel className="me-1" /> Tableur Excel
              <span className="ms-2" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {xlsxRows.length} ligne{xlsxRows.length > 1 ? 's' : ''}
              </span>
            </span>
            <div className="d-flex gap-2 flex-wrap">
              <Button variant="outline-primary" size="sm" href={currentFile.url} target="_blank" rel="noopener noreferrer">
                <FaDownload className="me-1" /> Ouvrir le fichier original
              </Button>
            </div>
          </div>
          {hasXlsxTableData && totalXlsxPages > 1 && (
            <div className="preview-csv-pagination">
              <span>
                Page {xlsxPage + 1} / {totalXlsxPages} · {xlsxRows.length} ligne{xlsxRows.length > 1 ? 's' : ''} au total
              </span>
              <div className="btn-group">
                <Button variant="outline-secondary" size="sm" disabled={xlsxPage === 0} onClick={() => setXlsxPage(prev => Math.max(0, prev - 1))}>
                  Précédent
                </Button>
                <Button variant="outline-secondary" size="sm" disabled={xlsxPage >= totalXlsxPages - 1} onClick={() => setXlsxPage(prev => Math.min(totalXlsxPages - 1, prev + 1))}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // --- CSV / Texte ---
    if (isCsv) {
      const hasTableData = csvHeaders.length > 0 && paginatedRows.length > 0;

      return (
        <div className="preview-section">
          <div className="preview-frame-wrapper" style={{ alignItems: 'stretch' }}>
            {csvError ? (
              <div className="preview-error">
                <FaFileAlt size={48} style={{ color: '#6366f1' }} />
                <p className="mt-3 mb-1">Impossible d'afficher le fichier texte</p>
                <small className="text-muted">Le fichier n'est peut-être pas accessible directement.</small>
              </div>
            ) : hasTableData ? (
              <div style={{ width: '100%', overflow: 'auto', maxHeight: '65vh', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <table className="preview-csv-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {csvHeaders.map((header, idx) => (
                        <th key={idx}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, rIdx) => {
                      const globalIdx = csvPage * CSV_PAGE_SIZE + rIdx;
                      return (
                        <tr key={rIdx}>
                          <td className="preview-csv-cell-index">{globalIdx + 1}</td>
                          {csvHeaders.map((_, cIdx) => {
                            const value = row[cIdx] || '';
                            return (
                              <td key={cIdx}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="preview-csv-input"
                                    value={value}
                                    onChange={(e) => handleCellChange(globalIdx, cIdx, e.target.value)}
                                  />
                                ) : (
                                  <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block' }}>{value}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre style={{
                margin: 0,
                padding: '1rem',
                width: '100%',
                maxHeight: '60vh',
                overflow: 'auto',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: '#1f2937',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {csvContent || 'Chargement du fichier...'}
              </pre>
            )}
          </div>
          {hasTableData && (
            <div className="preview-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <span className="text-muted">
                <FaFileAlt className="me-1" />
                {ext === 'csv' ? 'CSV — Tableau éditable' : 'Texte'}
                <span className="ms-2" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {editedRows.length} ligne{editedRows.length > 1 ? 's' : ''} · séparateur : « {csvSeparator === '\t' ? 'tabulation' : csvSeparator} »
                </span>
              </span>
              <div className="d-flex gap-2 flex-wrap">
                <Button variant="outline-secondary" size="sm" onClick={() => setIsEditing(prev => !prev)}>
                  {isEditing ? 'Terminer l’édition' : 'Modifier le CSV'}
                </Button>
                {isEditing && (
                  <Button variant="primary" size="sm" onClick={handleDownloadModified}>
                    <FaDownload className="me-1" /> Télécharger la version modifiée
                  </Button>
                )}
                <Button variant="outline-primary" size="sm" href={currentFile.url} target="_blank" rel="noopener noreferrer">
                  <FaDownload className="me-1" /> Ouvrir le fichier original
                </Button>
              </div>
            </div>
          )}
          {hasTableData && totalCsvPages > 1 && (
            <div className="preview-csv-pagination">
              <span>
                Page {csvPage + 1} / {totalCsvPages} · {editedRows.length} ligne{editedRows.length > 1 ? 's' : ''} au total
              </span>
              <div className="btn-group">
                <Button variant="outline-secondary" size="sm" disabled={csvPage === 0} onClick={() => setCsvPage(prev => Math.max(0, prev - 1))}>
                  Précédent
                </Button>
                <Button variant="outline-secondary" size="sm" disabled={csvPage >= totalCsvPages - 1} onClick={() => setCsvPage(prev => Math.min(totalCsvPages - 1, prev + 1))}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // --- Fallback ---
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem', marginBottom: '1rem', color: '#6366f1' }}>
          <FaFileAlt />
        </div>
        <div style={{ color: '#6c757d', fontSize: '1.2rem', fontWeight: '500' }}>
          Aucun aperçu disponible
        </div>
        <div style={{ color: '#9ca3af', fontSize: '1rem', marginTop: '0.5rem' }}>
          Type « {mime || ext || 'inconnu' } » non pris en charge
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Button variant="outline-primary" href={currentFile.url} target="_blank" rel="noopener noreferrer">
            <FaDownload className="me-1" /> Télécharger le fichier
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      onExited={handleExited}
      size="xl"
      centered
      className="quick-preview-modal"
      keyboard={true}
    >
      <Modal.Header closeButton style={{ borderBottom: '1px solid #e5e7eb' }}>
        <Modal.Title style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaFileAlt style={{ color: '#6366f1' }} />
          Prévisualisation rapide
          {currentFile.filename && (
            <small className="text-muted ms-2" style={{ fontWeight: '400' }}>
              — {currentFile.filename}
            </small>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ padding: '24px' }}>
        {files.length > 1 && (
          <div className="preview-tabs" style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}>
            {files.map((file, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTabClick(idx)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: idx === selectedIndex ? '#6366f1' : '#e5e7eb',
                  backgroundColor: idx === selectedIndex ? '#eef2ff' : '#fff',
                  color: idx === selectedIndex ? '#4f46e5' : '#374151',
                  fontSize: '0.85rem',
                  fontWeight: idx === selectedIndex ? '600' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {getFileIcon(file.type, file.filename)}
                {file.filename}
              </button>
            ))}
          </div>
        )}
        {renderPreview()}
      </Modal.Body>

      <Modal.Footer style={{ borderTop: '1px solid #e5e7eb', justifyContent: 'flex-end' }}>
        <Button variant="outline-secondary" onClick={onHide}>
          <FaTimes className="me-1" /> Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuickPreviewModal;
