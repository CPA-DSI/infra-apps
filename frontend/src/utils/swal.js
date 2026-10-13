import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Instance SweetAlert2 partagée (avec support du contenu React) : à importer
// partout au lieu de redéclarer `withReactContent(Swal)` dans chaque fichier.
export const MySwal = withReactContent(Swal);

export default MySwal;
