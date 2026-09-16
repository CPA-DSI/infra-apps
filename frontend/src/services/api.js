// Façade : centralise les imports `from '../../services/api'` utilisés dans toute
// l'application, tout en gardant les fonctions organisées par domaine dans ./api/*.
export { apiClient, apiClientUpload } from './api/client';
export * from './api/auth';
export * from './api/emailConfig';
export * from './api/users';
export * from './api/materiels';
export * from './api/marques';
export * from './api/locaux';
export * from './api/produits';
export * from './api/historique';
export * from './api/mouvements';
export * from './api/tickets';
export * from './api/documents';

export { apiClient as default } from './api/client';
