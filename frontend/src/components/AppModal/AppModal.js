import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Pile des modales ouvertes : seule la plus haute réagit à Échap et à Tab
// (cas d'une modale ouverte depuis une autre).
const openModals = [];

// Une alerte SweetAlert ouverte par-dessus la modale gère elle-même Échap et le focus.
const isSwalOpen = () => document.body.classList.contains('swal2-shown');

/**
 * Modale partagée, habillée par styles/ModalSystem.css (classes .add-modal-*).
 *
 * Accessibilité : role="dialog", aria-modal, aria-labelledby, fermeture par
 * Échap, focus piégé dans la modale et restitué à la fermeture.
 *
 * Props principales :
 *  - show, onClose
 *  - title, subtitle, icon : en-tête standard (ou `header` pour un en-tête libre,
 *    ou `hideHeader`)
 *  - headerBg : fond de l'en-tête (couleur ou dégradé), sinon --gradient-primary
 *  - footer : contenu du pied de modale (.add-modal-footer)
 *  - size : 'sm' | 'md' | 'lg' (défaut) | 'xl'
 *  - nested : modale ouverte depuis une autre modale (z-index supérieur)
 *  - as="form" + onSubmit : le conteneur devient un <form>
 *  - closeOnBackdrop : ferme au clic sur le fond (défaut : false)
 *  - portal : rend la modale dans document.body (défaut : false, pour garder
 *    les sélecteurs CSS scopés par page, ex. `.page-materiels ...`)
 */
const AppModal = ({
  show,
  onClose,
  title,
  subtitle,
  icon,
  header,
  hideHeader = false,
  headerBg,
  footer,
  children,
  size = 'lg',
  nested = false,
  as = 'div',
  onSubmit,
  closeOnBackdrop = false,
  closeOnEscape = true,
  portal = false,
  ariaLabel,
  overlayClassName = '',
  contentClassName = '',
  contentStyle,
  bodyClassName = '',
  bodyStyle,
}) => {
  const contentRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!show) return undefined;

    const token = {};
    openModals.push(token);
    const previouslyFocused = document.activeElement;
    const content = contentRef.current;

    // Focus initial : premier champ du corps, sinon le conteneur lui-même.
    const firstField = content?.querySelector(
      '.add-modal-body input:not([disabled]), .add-modal-body select:not([disabled]), .add-modal-body textarea:not([disabled])'
    );
    (firstField || content)?.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (openModals[openModals.length - 1] !== token || isSwalOpen()) return;

      if (event.key === 'Escape' && closeOnEscape) {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !content) return;
      const focusables = Array.from(content.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        event.preventDefault();
        content.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // On ne piège que si le focus est dans la modale (un menu porté par
      // react-select ou une alerte peut légitimement le détenir).
      if (!content.contains(active) && active !== document.body) return;
      if (event.shiftKey && (active === first || active === content)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = openModals.indexOf(token);
      if (index !== -1) openModals.splice(index, 1);
      if (openModals.length === 0) document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [show, closeOnEscape]);

  if (!show) return null;

  const handleOverlayMouseDown = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
  };

  const Container = as;
  const hasTitle = !hideHeader && !header && title;
  const headerStyle = headerBg ? { '--modal-header-bg': headerBg } : undefined;

  const modal = (
    <div
      className={`add-modal-overlay ${nested ? 'add-modal-overlay--nested' : ''} ${overlayClassName}`.trim()}
      onMouseDown={handleOverlayMouseDown}
    >
      <Container
        ref={contentRef}
        className={`add-modal-content add-modal--${size} ${contentClassName}`.trim()}
        style={contentStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={hasTitle ? undefined : ariaLabel}
        tabIndex={-1}
        onSubmit={as === 'form' ? onSubmit : undefined}
      >
        {!hideHeader && (header || (
          <div className="add-modal-header" style={headerStyle}>
            <div className="d-flex align-items-center gap-3">
              {icon && <div className="add-modal-icon-wrapper" aria-hidden="true">{icon}</div>}
              <div>
                <h2 id={titleId} className="add-modal-title">{title}</h2>
                {subtitle && <p className="add-modal-subtitle">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button type="button" className="add-modal-close-btn" onClick={onClose} aria-label="Fermer">
                <FaTimes />
              </button>
            )}
          </div>
        ))}

        <div className={`add-modal-body ${bodyClassName}`.trim()} style={bodyStyle}>
          {children}
        </div>

        {footer && <div className="add-modal-footer">{footer}</div>}
      </Container>
    </div>
  );

  return portal ? createPortal(modal, document.body) : modal;
};

export default AppModal;
