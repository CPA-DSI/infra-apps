import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { cssVar } from '../styles/cssVar';

// Instance SweetAlert2 partagée (avec support du contenu React) : à importer
// partout au lieu de redéclarer `withReactContent(Swal)` dans chaque fichier.
export const MySwal = withReactContent(Swal);

// Couleur du bouton de confirmation selon l'intention de l'action.
const CONFIRM_TOKENS = {
  primary: '--color-primary',
  brand: '--color-brand-start',
  danger: '--color-danger',
  success: '--color-success',
  info: '--color-sky',
};

/**
 * Couleurs des boutons d'une alerte, lues dans le thème :
 * `MySwal.fire({ ...swalButtons('danger'), title: … })`.
 * Annuler / Refuser restent neutres.
 */
export const swalButtons = (intent = 'primary') => ({
  confirmButtonColor: cssVar(CONFIRM_TOKENS[intent] || CONFIRM_TOKENS.primary),
  cancelButtonColor: cssVar('--color-text-sub'),
  denyButtonColor: cssVar('--color-text-sub'),
});

// Mixin créé au premier usage (pas d'appel SweetAlert à l'import du module).
let toastMixin;
const getToastMixin = () => (toastMixin ??= MySwal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
}));

/** Toast discret en haut à droite, en pause au survol : `Toast.fire({ icon, title })`. */
export const Toast = {
  fire: (options) => getToastMixin().fire(options),
};

/** Toast plein, vert (succès) ou rouge (erreur). */
export const notify = (message, type = 'success') => {
  const isSuccess = type === 'success';
  const white = cssVar('--color-white');
  return Toast.fire({
    icon: type,
    title: isSuccess ? 'Succès' : 'Erreur',
    text: message,
    background: cssVar(isSuccess ? '--color-success' : '--color-danger'),
    color: white,
    iconColor: white,
  });
};

export default MySwal;
