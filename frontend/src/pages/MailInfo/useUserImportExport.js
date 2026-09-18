import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { apiClient } from '../../services/api';

const MySwal = withReactContent(Swal);

const ROLE_LABEL_TO_ENUM = { 'Admin IT': 'IT_ADMIN', 'Direction': 'DIRECTION', 'Utilisateur': 'USER' };

const normalizeCell = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'n/a') return null;
        return trimmed;
    }
    return val;
};

const getByKeys = (obj, keys) => {
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== '') return obj[k];
    }
    return undefined;
};

const parseIntOrNull = (v) => {
    const n = normalizeCell(v);
    if (n === null) return null;
    const num = typeof n === 'number' ? n : parseInt(String(n), 10);
    return Number.isFinite(num) ? num : null;
};

const normalizeRole = (v) => {
    const n = normalizeCell(v);
    if (!n) return 'USER';
    const s = String(n).trim();
    const upper = s.toUpperCase();
    if (['USER', 'IT_ADMIN', 'DIRECTION'].includes(upper)) return upper;
    return ROLE_LABEL_TO_ENUM[s] || 'USER';
};

const normalizeStatus = (v) => {
    const n = normalizeCell(v);
    if (n === null) return true;
    const s = String(n).trim().toLowerCase();
    return !['désactivé', 'desactive', 'désactive', 'inactif', 'false', '0', 'non', 'no'].includes(s);
};

// Reprend les colonnes de exportToExcel (MailInfo.js) pour permettre de
// réimporter directement un fichier précédemment exporté (édité entre-temps).
const parseExcelFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error('Fichier Excel invalide (aucune feuille trouvée).');

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error('Aucune donnée trouvée dans le fichier Excel.');
    }

    return rawRows.map((r) => {
        const id_n = parseIntOrNull(getByKeys(r, ['N°', 'id_n', 'ID', 'Matricule', 'N° Matricule']));
        const role = normalizeRole(getByKeys(r, ['Rôle', 'Role', 'role']));
        const is_active = normalizeStatus(getByKeys(r, ['Statut', 'Status', 'statut']));
        const email_1 = normalizeCell(getByKeys(r, ['Email Principal', 'email_1', 'Email principal']));
        const pass_mail_1 = normalizeCell(getByKeys(r, ['Mot de passe 1', 'pass_mail_1']));
        const email_2 = normalizeCell(getByKeys(r, ['Email Secondaire', 'email_2', 'Email secondaire']));
        const pass_mail_2 = normalizeCell(getByKeys(r, ['Mot de passe 2', 'pass_mail_2']));

        return { id_n, role, is_active, email_1, pass_mail_1, email_2, pass_mail_2 };
    }).filter(item => item.id_n !== null);
};

/**
 * Encapsule la logique d'import Excel des utilisateurs : parsing du fichier,
 * drag & drop, upload avec progression. Mêmes conventions que
 * useMaterielImportExport (page Matériels).
 */
export const useUserImportExport = ({ onImported }) => {
    const [showImportSection, setShowImportSection] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importProgress, setImportProgress] = useState(0);
    const [isImporting, setIsImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [importSuccessStats, setImportSuccessStats] = useState(null);
    const [importError, setImportError] = useState(null);
    const [importPreview, setImportPreview] = useState([]);
    const [importData, setImportData] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const resetImportState = useCallback(() => {
        setImportFile(null);
        setImportProgress(0);
        setIsImporting(false);
        setImportSuccess(false);
        setImportSuccessStats(null);
        setImportError(null);
        setImportPreview([]);
        setImportData([]);
        setIsDragging(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const toggleImportSection = useCallback(() => {
        if (!showImportSection) {
            resetImportState();
        }
        setShowImportSection(prev => !prev);
    }, [showImportSection, resetImportState]);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const previewFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                setImportPreview(jsonData.slice(0, 5));
                setImportData(jsonData);
            } catch (error) {
                console.error('Erreur lors de la lecture du fichier:', error);
                setImportError('Erreur lors de la lecture du fichier. Vérifiez le format.');
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            const selectedFile = droppedFiles[0];
            const validExtensions = ['.xlsx', '.xls', '.csv'];
            const fileExt = selectedFile.name.split('.').pop().toLowerCase();

            if (validExtensions.includes(`.${fileExt}`)) {
                setImportFile(selectedFile);
                setImportError(null);
                previewFile(selectedFile);
            } else {
                setImportError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
            }
        }
    }, [previewFile]);

    const handleFileSelect = useCallback((e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validExtensions = ['.xlsx', '.xls', '.csv'];
            const fileExt = selectedFile.name.split('.').pop().toLowerCase();

            if (validExtensions.includes(`.${fileExt}`)) {
                setImportFile(selectedFile);
                setImportError(null);
                previewFile(selectedFile);
            } else {
                setImportError('Format non supporté. Utilisez .xlsx, .xls ou .csv');
                e.target.value = '';
            }
        }
    }, [previewFile]);

    const handleRemoveFile = useCallback(() => {
        setImportFile(null);
        setImportPreview([]);
        setImportData([]);
        setImportError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const handleImportSubmit = useCallback(async () => {
        if (!importFile) {
            setImportError('Veuillez sélectionner un fichier à importer.');
            return;
        }

        if (!importData || importData.length === 0) {
            setImportError('Aucune donnée valide à importer.');
            return;
        }

        setIsImporting(true);
        setImportProgress(0);
        setImportError(null);

        try {
            setImportProgress(10);

            const items = await parseExcelFile(importFile);

            if (!items || items.length === 0) {
                throw new Error('Aucune donnée valide à importer (colonne N° manquante ou vide).');
            }

            setImportProgress(30);

            const response = await apiClient.post('/users/import', { items }, {
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const uploadPercent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        setImportProgress(Math.min(30 + Math.round(uploadPercent * 0.4), 95));
                    }
                }
            });

            setImportProgress(100);
            setImportSuccess(true);
            const stats = response.data.stats || {};
            setImportSuccessStats(stats);

            if (onImported) await onImported();

            const successCount = stats.success || 0;
            const failCount = stats.failed || 0;

            let title = 'Import terminé !';
            let successText = `${successCount} utilisateur(s) importé(s) avec succès.`;

            if (successCount === 0 && failCount === 0) {
                title = 'Import terminé';
                successText = 'L\'import a été traité. Vérifiez votre fichier.';
            } else if (failCount > 0) {
                successText += `\n${failCount} échec(s).`;
            }

            await MySwal.fire({
                icon: successCount > 0 ? 'success' : 'warning',
                title,
                text: successText,
                confirmButtonText: 'OK'
            });

            setShowImportSection(false);
            resetImportState();

        } catch (error) {
            console.error('Erreur import Excel utilisateurs:', error);

            const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de l\'import.';
            setImportError(errorMessage);

            await MySwal.fire({
                icon: 'error', title: 'Échec de l\'import', text: errorMessage, confirmButtonText: 'OK'
            });

        } finally {
            setIsImporting(false);
        }
    }, [importFile, importData, onImported, resetImportState]);

    return {
        showImportSection,
        importFile,
        importProgress,
        isImporting,
        importSuccess,
        importSuccessStats,
        importError,
        importPreview,
        importData,
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
    };
};
