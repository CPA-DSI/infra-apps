// services/ticketService.js

// Libellé « N° <matricule> : <nom> (<équipe>) » d'un demandeur/assigné, ou à
// défaut le nom sauvegardé sur le ticket (personne supprimée ou sans matériel).
const formatPersonne = (personne, nomSauvegarde) =>
    personne?.materiel?.utilisateur
        ? `N° ${personne.id_n} : ${personne.materiel.utilisateur} (${personne.materiel.equipe || 'N/A'})`
        : (nomSauvegarde || null);

/**
 * Ajoute au ticket les champs d'affichage attendus par le frontend.
 * Le ticket doit inclure demandeur/assigneA avec leur materiel pour obtenir
 * les libellés complets.
 */
export const formatTicket = (ticket) => ({
    ...ticket,
    nomDemandeurFormate: formatPersonne(ticket.demandeur, ticket.nomDemandeur),
    equipeDemandeur: ticket.demandeur?.materiel?.equipe ?? null,
    nomAssigneFormate: formatPersonne(ticket.assigneA, ticket.nomAssigne),
    equipeAssigne: ticket.assigneA?.materiel?.equipe ?? null,
});
