import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { apiClient } from '../../services/api';

const MySwal = withReactContent(Swal);

const normalizeCell = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'non assigné') return null;
        return trimmed;
    }
    return val;
};

// parseExcelFile avec date_ecran
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

    const getByKeys = (obj, keys) => {
        for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== '') return obj[k];
        }
        return undefined;
    };

    const parseBool = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;
        if (typeof n === 'boolean') return n;
        const s = String(n).trim().toLowerCase();
        if (['true', '1', 'oui', 'y', 'yes'].includes(s)) return true;
        if (['false', '0', 'non', 'n', 'no'].includes(s)) return false;
        return null;
    };

    const parseIntOrNull = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;
        const num = typeof n === 'number' ? n : parseInt(String(n), 10);
        return Number.isFinite(num) ? num : null;
    };

    const excelSerialToDate = (serial) => {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const msPerDay = 24 * 60 * 60 * 1000;
        return new Date(excelEpoch.getTime() + (serial * msPerDay));
    };

    const parseDateOrNull = (v) => {
        const n = normalizeCell(v);
        if (n === null) return null;

        if (n instanceof Date && !isNaN(n.getTime())) {
            return n;
        }

        // Filet de sécurité : numéro de série Excel brut (cellule non reconnue
        // comme date par SheetJS malgré cellDates: true, ex. format de cellule
        // atypique dans le fichier source).
        if (typeof n === 'number' && n > 1 && n < 100000) {
            const date = excelSerialToDate(n);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        const s = String(n).trim();
        if (!s) return null;

        // Format DD/MM/YYYY
        const dateMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const year = parseInt(dateMatch[3], 10);

            const date = new Date(year, month, day);
            if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
                return date;
            }
        }

        // Format YYYY-MM-DD
        const dateMatch2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (dateMatch2) {
            const year = parseInt(dateMatch2[1], 10);
            const month = parseInt(dateMatch2[2], 10) - 1;
            const day = parseInt(dateMatch2[3], 10);

            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                return date;
            }
        }

        // Format MM/DD/YYYY (américain)
        const dateMatch3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch3) {
            const part1 = parseInt(dateMatch3[1], 10);
            const part2 = parseInt(dateMatch3[2], 10);
            const year = parseInt(dateMatch3[3], 10);

            if (part1 > 12) {
                const date = new Date(year, part2 - 1, part1);
                if (date.getDate() === part1 && date.getMonth() === part2 - 1 && date.getFullYear() === year) {
                    return date;
                }
            } else {
                const date = new Date(year, part1 - 1, part2);
                if (date.getDate() === part2 && date.getMonth() === part1 - 1 && date.getFullYear() === year) {
                    return date;
                }
            }
        }

        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }

        console.warn(`Format de date non supporté: ${s}`);
        return null;
    };

    const items = rawRows.map((r) => {
        const utilisateur = normalizeCell(getByKeys(r, [
            'Utilisateur', 'utilisateur', 'USER', 'Nom Utilisateur',
            'Nom', 'nom', 'NOM', 'Full Name', 'full_name'
        ]));

        const id_n = parseIntOrNull(getByKeys(r, [
            'N° Matricule', 'id_n', 'ID N', 'Matricule',
            'N°', 'Numero', 'numero', 'ID'
        ]));

        const equipe = normalizeCell(getByKeys(r, [
            'Équipe', 'equipe', 'Equipe', 'TEAM', 'team',
            'Service', 'service', 'Département', 'departement'
        ]));

        // Date PC
        const date_pc = parseDateOrNull(getByKeys(r, [
            'Date PC', 'date_pc', 'Date', 'date',
            'DATE_PC', 'Date PC'
        ]));

        // Date Écran
        const date_ecran = parseDateOrNull(getByKeys(r, [
            'Date Écran', 'date_ecran', 'DATE_ECRAN',
            'Date Ecran', 'date ecran', 'Date moniteur',
            'Date Monitor', 'date_monitor', 'Date Ecran'
        ]));

        const caracteristiques = normalizeCell(getByKeys(r, [
            'Caractéristiques', 'caracteristiques', 'Caracteristiques',
            'Config', 'config', 'Configuration', 'Specs', 'specs'
        ]));

        const code_pc = normalizeCell(getByKeys(r, [
            'Code PC', 'code_pc', 'CODE_PC', 'PC Code',
            'Code', 'code', 'Asset Tag', 'asset_tag'
        ]));

        const ecran = normalizeCell(getByKeys(r, [
            'Marque Écran', 'ecran', 'Ecran', 'Moniteur', 'moniteur',
            'Screen', 'screen', 'Display', 'display'
        ]));

        const code_ecran = normalizeCell(getByKeys(r, [
            'Code Écran', 'code_ecran', 'CODE_ECRAN',
            'Code Ecran', 'Screen Code', 'screen_code'
        ]));

        const hdmi = parseBool(getByKeys(r, ['HDMI', 'hdmi']));
        const clavier = parseBool(getByKeys(r, ['Clavier', 'clavier']));
        const lan = parseBool(getByKeys(r, ['LAN', 'lan']));
        const usb = parseBool(getByKeys(r, ['USB', 'usb']));

        const etat_pc = normalizeCell(getByKeys(r, [
            'État PC', 'etat_pc', 'Etat PC', 'Etat',
            'Status', 'status', 'État', 'etat'
        ]));

        const salle = normalizeCell(getByKeys(r, [
            'Salle', 'salle', 'Salle PC', 'Emplacement', 'emplacement'
        ]));

        const mdp_pc = normalizeCell(getByKeys(r, [
            'Password_Local', 'mdp_pc', 'Password Local',
            'Mot de passe local', 'password_local'
        ]));

        const mdp_admin = normalizeCell(getByKeys(r, [
            'Password_Admin', 'mdp_admin', 'Password Admin',
            'Mot de passe admin', 'password_admin'
        ]));

        const etat_batterie = normalizeCell(getByKeys(r, [
            'Etat de la batterie', 'etat_batterie', 'Batterie',
            'Battery', 'battery', 'État batterie'
        ]));

        const commentaire = normalizeCell(getByKeys(r, [
            'Commentaire', 'commentaire', 'Notes', 'notes',
            'Remarque', 'remarque', 'Observations', 'observations'
        ]));

        const id_local = normalizeCell(getByKeys(r, [
            'id_local', 'Id_local', 'ID_LOCAL', 'Local_id', 'local_id',
            'ID Local', 'ID local', 'local ID', 'Site', 'site', 'SITE', 'Local', 'local', 'LOCAL'
        ]));

        return {
            utilisateur, id_n, equipe, date_pc, date_ecran, caracteristiques, code_pc, ecran, code_ecran, hdmi, clavier, lan, usb, etat_pc, salle, mdp_pc, mdp_admin, etat_batterie, commentaire, id_local
        };
    });

    return items;
};

const MATERIEL_EXPORT_COLUMNS = [
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 30 },
];

const toExportRow = (item) => ({
    "Site": item.nom_local,
    "Utilisateur": item.utilisateur,
    "N° Matricule": item.id_n,
    "Équipe": item.equipe,
    "Date PC": item.date_pc ? new Date(item.date_pc).toLocaleDateString('fr-FR') : 'N/A',
    "Date Écran": item.date_ecran ? new Date(item.date_ecran).toLocaleDateString('fr-FR') : 'N/A',
    "Caractéristiques": item.caracteristiques,
    "Code PC": item.code_pc,
    "Marque Écran": item.ecran,
    "Code Écran": item.code_ecran,
    "HDMI": item.hdmi ? 'Oui' : 'Non',
    "Clavier": item.clavier ? 'Oui' : 'Non',
    "LAN": item.lan ? 'Oui' : 'Non',
    "USB": item.usb ? 'Oui' : 'Non',
    "État PC": item.etat_pc,
    "salle": item.salle,
    "Password_Local": item.mdp_pc,
    "Password_Admin": item.mdp_admin,
    "Etat de la batterie": item.etat_batterie,
    "Commentaire": item.commentaire,
    "Est Actif": item.est_actif,
});

const exportRowsToExcel = (dataToExport, filename) => {
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
        if (!worksheet[cellAddress]) continue;
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F46E5" } }
        };
    }

    worksheet['!cols'] = MATERIEL_EXPORT_COLUMNS;

    const filterRange = { s: { c: 0, r: 0 }, e: { c: range.e.c, r: 0 } };
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(filterRange) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Materiels");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    saveAs(blob, filename);
};

const buildTimestampedFilename = (prefix, suffix = '') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    const formattedTime = `${hours}h${minutes}m${seconds}s`;
    return `${prefix}${suffix}_${formattedDate}_${formattedTime}.xlsx`;
};

/**
 * Encapsule toute la logique d'import/export Excel de la page Matériels :
 * parsing du fichier, drag & drop, upload avec progression, et génération
 * des exports (global et par local).
 */
export const useMaterielImportExport = ({ materiels, filteredMateriels, filterNomLocal, fetchMateriels, setFilterMarque }) => {
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

                const excelDateToJSDate = (excelDate) => {
                    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                    const msPerDay = 24 * 60 * 60 * 1000;
                    return new Date(excelEpoch.getTime() + (excelDate * msPerDay));
                };

                jsonData.forEach(row => {
                    Object.keys(row).forEach(key => {
                        const val = row[key];
                        if (typeof val === 'number' && key.toLowerCase().includes('date')) {
                            const date = excelDateToJSDate(val);
                            if (!isNaN(date.getTime())) {
                                row[key] = date.toLocaleDateString('fr-FR');
                            }
                        }
                    });
                });

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
                throw new Error('Aucune donnée valide à importer');
            }

            setImportProgress(30);

            const updateProgress = (percent) => {
                setImportProgress(Math.min(percent, 95));
            };

            const response = await apiClient.post('/import', { items }, {
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const uploaded = progressEvent.loaded;
                        const total = progressEvent.total;
                        const uploadPercent = Math.round((uploaded / total) * 100);
                        const overall = 30 + Math.round(uploadPercent * 0.4);
                        updateProgress(overall);
                    }
                }
            });

            setImportProgress(100);
            setImportSuccess(true);
            const stats = response.data.stats || {};
            setImportSuccessStats(stats);

            fetchMateriels();
            setFilterMarque('');

            const successCount = stats.success || 0;
            const failCount = stats.failed || 0;
            const warningCount = stats.warnings || 0;

            let title = 'Import terminé !';
            let successText = `${successCount} matériel(s) importé(s) avec succès.`;

            if (successCount === 0 && failCount === 0) {
                title = 'Import terminé';
                successText = 'L\'import a été traité. Vérifiez votre fichier.';
            } else if (failCount > 0) {
                successText += `\n${failCount} échec(s).`;
            }
            if (warningCount > 0) {
                successText += `\n${warningCount} avertissement(s).`;
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
            console.error('Erreur import Excel:', error);

            const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de l\'import.';
            setImportError(errorMessage);

            await MySwal.fire({
                icon: 'error', title: 'Échec de l\'import', text: errorMessage, confirmButtonText: 'OK'
            });

        } finally {
            setIsImporting(false);
        }
    }, [importFile, importData, fetchMateriels, setFilterMarque, resetImportState]);

    const handleExportExcel = useCallback(() => {
        const dataToExport = filteredMateriels.map(toExportRow);
        exportRowsToExcel(dataToExport, buildTimestampedFilename('inventaire_materiels'));
    }, [filteredMateriels]);

    const handleExportByLocal = useCallback(() => {
        if (!filterNomLocal) return;

        const dataToExport = materiels
            .filter(item => item.nom_local === filterNomLocal)
            .map(toExportRow);

        if (dataToExport.length === 0) {
            MySwal.fire({
                icon: 'info',
                title: 'Aucune donnée',
                text: `Aucun matériel trouvé pour le local "${filterNomLocal}".`
            });
            return;
        }

        const safeName = filterNomLocal.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
        exportRowsToExcel(dataToExport, buildTimestampedFilename('inventaire_materiels_', safeName));
    }, [materiels, filterNomLocal]);

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
        handleExportExcel,
        handleExportByLocal,
    };
};
