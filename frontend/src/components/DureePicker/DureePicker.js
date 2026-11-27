import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaClock } from 'react-icons/fa';
import { formatDuree, parseDuree } from '../../utils/duree';
import './DureePicker.css';

const ITEM_H = 40;   // hauteur d'une ligne (doit suivre --dp-item-h du CSS)
const VISIBLES = 5;  // lignes visibles ; la ligne du milieu est la sélection

/**
 * Roulette verticale (une colonne du sélecteur).
 *  - valeurs : nombres affichés
 *  - index / onIndex : ligne sélectionnée
 */
const Roulette = ({ id, label, valeurs, index, onIndex, ouvert }) => {
  const ref = useRef(null);
  const timer = useRef(null);

  // Position initiale à l'ouverture, sans animation
  useLayoutEffect(() => {
    if (ouvert && ref.current) ref.current.scrollTop = index * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const allerA = (i, smooth = true) => {
    const cible = Math.min(valeurs.length - 1, Math.max(0, i));
    onIndex(cible);
    ref.current?.scrollTo?.({ top: cible * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Sélection à la fin du défilement (molette, tactile, glisser)
  const handleScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const i = Math.round(ref.current.scrollTop / ITEM_H);
      if (i !== index) onIndex(Math.min(valeurs.length - 1, Math.max(0, i)));
    }, 80);
  };

  const handleKeyDown = (e) => {
    const pas = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (pas) { e.preventDefault(); allerA(index + pas); }
    else if (e.key === 'Home') { e.preventDefault(); allerA(0); }
    else if (e.key === 'End') { e.preventDefault(); allerA(valeurs.length - 1); }
  };

  return (
    <div
      ref={ref}
      className="dp-roulette"
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${id}-${index}`}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      {valeurs.map((v, i) => (
        <div
          key={v}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === index}
          className={`dp-item ${i === index ? 'is-selected' : ''}`}
          onClick={() => allerA(i)}
        >
          {String(v).padStart(2, '0')}
        </div>
      ))}
    </div>
  );
};

/**
 * Sélecteur de durée à roulettes Heures / Minutes.
 *  - value    : "hh:mm" ou '' (non renseignée)
 *  - onChange : reçoit "hh:mm" ou ''
 *  - maxMinutes : durée maximale acceptée (défaut 7 jours, comme le backend)
 */
const DureePicker = ({ id, value, onChange, disabled, maxMinutes = 7 * 24 * 60, placeholder = 'hh:mm' }) => {
  const [ouvert, setOuvert] = useState(false);
  const [heures, setHeures] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const conteneur = useRef(null);

  const maxHeures = Math.floor(maxMinutes / 60);
  const listeHeures = useRef(Array.from({ length: maxHeures + 1 }, (_, i) => i)).current;
  const listeMinutes = useRef(Array.from({ length: 60 }, (_, i) => i)).current;

  const ouvrir = () => {
    if (disabled) return;
    const total = parseDuree(value);
    const ok = total !== null && !Number.isNaN(total);
    setHeures(ok ? Math.min(maxHeures, Math.floor(total / 60)) : 0);
    setMinutes(ok ? total % 60 : 0);
    setOuvert(true);
  };

  const fermer = useCallback(() => setOuvert(false), []);

  // Fermeture au clic extérieur et à Échap
  useEffect(() => {
    if (!ouvert) return undefined;
    const clic = (e) => { if (!conteneur.current?.contains(e.target)) fermer(); };
    const touche = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche, true);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche, true);
    };
  }, [ouvert, fermer]);

  const valider = () => {
    onChange(formatDuree(Math.min(maxMinutes, heures * 60 + minutes)));
    fermer();
  };

  const effacer = () => {
    onChange('');
    fermer();
  };

  return (
    <div className="dp" ref={conteneur}>
      <button
        id={id}
        type="button"
        className="add-modal-input dp-trigger"
        onClick={() => (ouvert ? fermer() : ouvrir())}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
      >
        <span className={value ? '' : 'dp-placeholder'}>{value || placeholder}</span>
        <FaClock className="dp-trigger-icon" aria-hidden="true" />
      </button>

      {ouvert && (
        <div className="dp-popover" role="dialog" aria-label="Choisir une durée">
          <div className="dp-header">Durée</div>
          <div className="dp-labels"><span>Heures</span><span>Minutes</span></div>
          <div className="dp-corps" style={{ '--dp-item-h': `${ITEM_H}px`, '--dp-visibles': VISIBLES }}>
            <div className="dp-bande" aria-hidden="true" />
            <Roulette id={`${id}-h`} label="Heures" valeurs={listeHeures} index={heures} onIndex={setHeures} ouvert={ouvert} />
            <Roulette id={`${id}-m`} label="Minutes" valeurs={listeMinutes} index={minutes} onIndex={setMinutes} ouvert={ouvert} />
          </div>
          <div className="dp-footer">
            <button type="button" className="dp-btn dp-btn--ghost" onClick={effacer}>Effacer</button>
            <button type="button" className="dp-btn dp-btn--primary" onClick={valider}>
              Valider {formatDuree(Math.min(maxMinutes, heures * 60 + minutes))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DureePicker;
