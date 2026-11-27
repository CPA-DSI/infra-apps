import React, { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { FaCalendarAlt } from 'react-icons/fa';
import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import './DateRangeFilter.css';

// Filtre de période : raccourcis (cette année, ce trimestre, 12 derniers mois…)
// + période fixe (deux dates ou sélection de plage dans le calendrier),
// validée par « Appliquer ».
//
// Props :
//   - value / onChange : période sélectionnée ({ key, debut, fin }, voir EMPTY_RANGE).
//   - years            : années proposées en raccourci (ex. années présentes dans les données).
//   - placeholder      : libellé quand aucune période n'est choisie.
//   - styleClass       : classes CSS du déclencheur (ex. filter-pill).
//   - presets          : raccourcis proposés (par défaut PRESETS : année, trimestre, mois).
//   - allowEmpty       : propose « Toutes les dates » et « Sans date » (true par défaut).
//                        À false, une période a toujours deux bornes : une seule date
//                        saisie vaut pour un jour.
//   - formatLabel      : libellé du déclencheur (range => texte), à la place du libellé par défaut.
//
// key : '' (toutes), 'none' (sans date), 'custom' (période fixe),
//       un raccourci (PRESETS) ou 'year:AAAA'. debut / fin : 'YYYY-MM-DD' ou ''.

export const EMPTY_RANGE = { key: '', debut: '', fin: '' };

const FMT = 'YYYY-MM-DD';
const iso = (d) => d.format(FMT);

const startOfQuarter = (d) => d.month(Math.floor(d.month() / 3) * 3).startOf('month');

export const PRESETS = [
    {
        group: 'Année',
        items: [
            { key: 'this-year', label: 'Cette année', range: (t) => [t.startOf('year'), t.endOf('year')] },
            { key: 'last-year', label: 'Année dernière', range: (t) => [t.subtract(1, 'year').startOf('year'), t.subtract(1, 'year').endOf('year')] },
        ],
    },
    {
        group: 'Trimestre',
        items: [
            { key: 'this-quarter', label: 'Ce trimestre', range: (t) => [startOfQuarter(t), startOfQuarter(t).add(2, 'month').endOf('month')] },
            { key: 'last-quarter', label: 'Trimestre dernier', range: (t) => { const s = startOfQuarter(t).subtract(3, 'month'); return [s, s.add(2, 'month').endOf('month')]; } },
        ],
    },
    {
        group: 'Mois',
        items: [
            { key: 'this-month', label: 'Ce mois', range: (t) => [t.startOf('month'), t.endOf('month')] },
            { key: 'last-month', label: 'Mois dernier', range: (t) => [t.subtract(1, 'month').startOf('month'), t.subtract(1, 'month').endOf('month')] },
            { key: 'last-12-months', label: '12 derniers mois', range: (t) => [t.subtract(12, 'month').add(1, 'day'), t] },
        ],
    },
];

const indexPresets = (presets) => Object.fromEntries(presets.flatMap(g => g.items).map(p => [p.key, p]));
const PRESET_BY_KEY = indexPresets(PRESETS);

export const buildRange = (key, presetByKey = PRESET_BY_KEY) => {
    const today = dayjs();
    if (key.startsWith('year:')) {
        const y = dayjs(`${key.slice(5)}-01-01`);
        return { key, debut: iso(y.startOf('year')), fin: iso(y.endOf('year')) };
    }
    const [debut, fin] = presetByKey[key].range(today);
    return { key, debut: iso(debut), fin: iso(fin) };
};

const formatFr = (s) => dayjs(s).format('DD/MM/YYYY');

export const isRangeActive = (range) => Boolean(range && range.key);

// Indique si une date (chaîne ISO, Date ou vide) appartient à la période.
// Les bornes sont incluses et comparées au jour près.
export const matchesDateRange = (dateValue, range) => {
    if (!isRangeActive(range)) return true;
    if (range.key === 'none') return !dateValue;
    if (!dateValue) return false;
    const day = dayjs(dateValue).format(FMT);
    if (range.debut && day < range.debut) return false;
    if (range.fin && day > range.fin) return false;
    return true;
};

const rangeLabel = (range, placeholder, presetByKey = PRESET_BY_KEY) => {
    if (!isRangeActive(range)) return placeholder;
    if (range.key === 'none') return 'Sans date';
    if (range.key.startsWith('year:')) return range.key.slice(5);
    if (presetByKey[range.key]) return presetByKey[range.key].label;
    if (range.debut && range.fin) return `${formatFr(range.debut)} – ${formatFr(range.fin)}`;
    if (range.debut) return `Depuis le ${formatFr(range.debut)}`;
    if (range.fin) return `Jusqu'au ${formatFr(range.fin)}`;
    return placeholder;
};

const toDate = (s) => (s ? dayjs(s).toDate() : undefined);

// Mois affiché à l'ouverture : début de la période, sinon fin, sinon aujourd'hui.
const monthOf = (range) => dayjs(range.debut || range.fin || undefined).startOf('month').toDate();

const DateRangeFilter = ({
    value = EMPTY_RANGE, onChange, years = [], placeholder = 'Période', styleClass,
    presets = PRESETS, allowEmpty = true, formatLabel,
}) => {
    const presetByKey = useMemo(() => indexPresets(presets), [presets]);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [month, setMonth] = useState(() => monthOf(value));
    const containerRef = useRef(null);

    // Bornes de navigation du calendrier (listes mois / année)
    const firstYear = years.length ? Math.min(...years, dayjs().year() - 10) : dayjs().year() - 10;
    const startMonth = new Date(firstYear, 0);
    const endMonth = new Date(dayjs().year() + 1, 11);

    useEffect(() => {
        if (!open) return undefined;
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    const toggle = () => {
        if (!open) { setDraft(value); setMonth(monthOf(value)); }
        setOpen(!open);
    };

    const pickPreset = (key) => {
        const next = key === '' || key === 'none' ? { ...EMPTY_RANGE, key } : buildRange(key, presetByKey);
        setDraft(next);
        if (next.debut) setMonth(monthOf(next));
    };

    const setDate = (field, val) => {
        const next = { ...draft, key: 'custom', [field]: val };
        if (!next.debut && !next.fin) next.key = '';
        setDraft(next);
        if (val) setMonth(dayjs(val).startOf('month').toDate());
    };

    const selectFromCalendar = (r) => {
        const debut = r?.from ? iso(dayjs(r.from)) : '';
        const fin = r?.to ? iso(dayjs(r.to)) : '';
        setDraft({ key: debut || fin ? 'custom' : '', debut, fin });
    };

    const selected = draft.key && draft.key !== 'none' && (draft.debut || draft.fin)
        ? { from: toDate(draft.debut || draft.fin), to: toDate(draft.fin) }
        : undefined;

    const invalid = Boolean(draft.debut && draft.fin && draft.debut > draft.fin);

    // Sans période vide possible, il faut au moins une date pour appliquer
    const incomplete = !allowEmpty && !(draft.debut || draft.fin);

    const apply = () => {
        if (invalid || incomplete) return;
        if (!allowEmpty) {
            // Une seule date saisie : la période couvre ce jour-là
            onChange({ ...draft, debut: draft.debut || draft.fin, fin: draft.fin || draft.debut });
        } else {
            onChange(draft.key ? draft : EMPTY_RANGE);
        }
        setOpen(false);
    };

    const item = (key, label) => (
        <button
            key={key}
            type="button"
            className={`drf-preset ${draft.key === key ? 'is-selected' : ''}`}
            onClick={() => pickPreset(key)}
        >
            {label}
        </button>
    );

    const yearGroup = years.length > 0 && (
        <div className="drf-group">
            <div className="drf-group-title">Années</div>
            <div className="drf-years">
                {years.map(y => item(`year:${y}`, String(y)))}
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="drf">
            <div
                className={`drf-trigger ${styleClass || ''}`}
                onClick={toggle}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="Filtrer par période"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            >
                <FaCalendarAlt className="drf-icon" aria-hidden="true" />
                <span className="drf-label">{formatLabel ? formatLabel(value) : rangeLabel(value, placeholder, presetByKey)}</span>
                <span className="drf-arrow">▼</span>
            </div>

            {open && (
                <div className="drf-popover" role="dialog" aria-label="Choisir une période">
                    <div className="drf-body">
                        <div className="drf-presets">
                            {allowEmpty && (
                                <>
                                    <div className="drf-group">
                                        {item('', 'Toutes les dates')}
                                        {item('none', 'Sans date')}
                                    </div>
                                    <div className="drf-group-title drf-group-title--section">Relative</div>
                                </>
                            )}
                            {presets.map(g => (
                                <div key={g.group} className="drf-group">
                                    <div className="drf-group-title">{g.group}</div>
                                    {g.items.map(p => item(p.key, p.label))}
                                </div>
                            ))}
                            {yearGroup}
                        </div>

                        <div className="drf-fixed">
                            <div className="drf-group-title">Période fixe</div>
                            <div className="drf-dates">
                                <input
                                    type="date"
                                    className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`}
                                    value={draft.key === 'none' ? '' : draft.debut}
                                    max={draft.fin || undefined}
                                    onChange={(e) => setDate('debut', e.target.value)}
                                    aria-label="Date de début"
                                />
                                <span className="drf-sep">–</span>
                                <input
                                    type="date"
                                    className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`}
                                    value={draft.key === 'none' ? '' : draft.fin}
                                    min={draft.debut || undefined}
                                    onChange={(e) => setDate('fin', e.target.value)}
                                    aria-label="Date de fin"
                                />
                            </div>
                            {invalid && <div className="drf-error">La date de début doit précéder la date de fin.</div>}

                            <DayPicker
                                className="drf-calendar"
                                mode="range"
                                locale={fr}
                                selected={selected}
                                onSelect={selectFromCalendar}
                                month={month}
                                onMonthChange={setMonth}
                                captionLayout="dropdown"
                                startMonth={startMonth}
                                endMonth={endMonth}
                                showOutsideDays
                            />
                        </div>
                    </div>

                    <div className="drf-footer">
                        <button type="button" className="btn btn-sm btn-light" onClick={() => setOpen(false)}>Annuler</button>
                        <button type="button" className="btn btn-sm btn-primary" onClick={apply} disabled={invalid || incomplete}>Appliquer</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
