// utils/asyncHandler.js
// Transmet à next() les erreurs d'un handler async : elles aboutissent dans
// middleware/errorHandler.js au lieu de laisser la requête sans réponse.
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
