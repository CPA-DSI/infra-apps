// seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

// ================================================
// 1. UTILITAIRES
// ================================================

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function parseBoolean(value) {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v === 'VRAI') return true;
  if (v === 'FAUX') return false;
  return null;
}

function generateToken() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// ================================================
// 2. DONNÉES DE BASE (enrichies)
// ================================================

// --- Utilisateurs ---
const usersData = [
  { id_n: 901, role: 'IT_ADMIN', email: 'admin.dsi@company.com', must_change_password: false },
  { id_n: 902, role: 'USER', email: 'user902@company.com', must_change_password: true },
  { id_n: 903, role: 'USER', email: 'miarantsirabe@company.com', must_change_password: false },
  { id_n: 904, role: 'DIRECTION', email: 'dina.bni@company.com', must_change_password: false },
  { id_n: 905, role: 'USER', email: 'jean.dupont@company.com', must_change_password: true },
  { id_n: 906, role: 'USER', email: 'marie.curie@company.com', must_change_password: false },
  { id_n: 907, role: 'IT_ADMIN', email: 'tech.lead@company.com', must_change_password: false },
];

// --- Matériels (enrichis) ---
const materielsData = [
  {
    utilisateur: 'ANTSIRABE Miarasitraka',
    id_n: 903,
    equipe: 'TIIME',
    date_pc: '06/09/2025',
    date_ecran: '06/09/2025',
    caracteristiques: 'Dell Latitude 3590 / i5 8ème / 8 Go RAM / 250Go SSD',
    code_pc: 'PCP-DE-0903-BIR1',
    ecran: 'IO DATA',
    code_ecran: 'ECR-IO-0903-BIR1',
    hdmi: 'VRAI',
    clavier: 'FAUX',
    lan: 'FAUX',
    usb: 'FAUX',
    etat_pc: 'Bon',
    salle: 'BIR1',
    mdp_pc: 'User156/Centre156',
    mdp_admin: '',
    etat_batterie: '0H',
    commentaire: 'Batterie provisoire installée',
    est_actif: 'VRAI',
  },
  {
    utilisateur: 'BNI Dina',
    id_n: 904,
    equipe: 'RECCI / Lalaina',
    date_pc: '19/01/2026',
    date_ecran: '19/01/2026',
    caracteristiques: 'HP Probook 450 G5 / i5 8eme / 8Go RAM / 120Go SSD',
    code_pc: 'PCP-HP-0904-BNI2',
    ecran: 'VIEW SONIC',
    code_ecran: 'ECR-HP-0904-BNI2',
    hdmi: 'FAUX',
    clavier: 'FAUX',
    lan: 'FAUX',
    usb: 'FAUX',
    etat_pc: 'Très Bon',
    salle: 'BUREAU 3',
    mdp_pc: 'azerty',
    mdp_admin: 'PROM9$25',
    etat_batterie: 'Plus de 3H',
    commentaire: '',
    est_actif: 'VRAI',
  },
  {
    utilisateur: 'RANDRIANASOLO Jean',
    id_n: 902,
    equipe: 'DSI',
    date_pc: '01/12/2025',
    date_ecran: '01/12/2025',
    caracteristiques: 'Lenovo ThinkPad E14 / i7 10ème / 16Go RAM / 512Go SSD',
    code_pc: 'PCP-LN-0902-DSI3',
    ecran: 'SAMSUNG',
    code_ecran: 'ECR-SM-0902-DSI3',
    hdmi: 'VRAI',
    clavier: 'VRAI',
    lan: 'VRAI',
    usb: 'VRAI',
    etat_pc: 'Neuf',
    salle: 'DSI_SERV',
    mdp_pc: 'Think@2025',
    mdp_admin: 'Admin@2025',
    etat_batterie: 'Plus de 4H',
    commentaire: 'Nouveau PC affecté à la DSI',
    est_actif: 'VRAI',
  },
  {
    utilisateur: 'Jean Dupont',
    id_n: 905,
    equipe: 'RH',
    date_pc: '10/02/2026',
    date_ecran: '10/02/2026',
    caracteristiques: 'ASUS VivoBook 15 / i3 11ème / 8Go RAM / 256Go SSD',
    code_pc: 'PCP-AS-0905-RH4',
    ecran: 'AOC',
    code_ecran: 'ECR-AO-0905-RH4',
    hdmi: 'VRAI',
    clavier: 'VRAI',
    lan: 'FAUX',
    usb: 'VRAI',
    etat_pc: 'Bon',
    salle: 'RH_1',
    mdp_pc: 'Asus@2026',
    mdp_admin: 'AdminRH',
    etat_batterie: '2H',
    commentaire: '',
    est_actif: 'VRAI',
  },
  {
    utilisateur: 'Marie Curie',
    id_n: 906,
    equipe: 'R&D',
    date_pc: '05/01/2026',
    date_ecran: '05/01/2026',
    caracteristiques: 'Apple MacBook Pro 13 / M1 / 16Go RAM / 512Go SSD',
    code_pc: 'PCP-AP-0906-RD5',
    ecran: 'LG UltraFine',
    code_ecran: 'ECR-LG-0906-RD5',
    hdmi: 'VRAI',
    clavier: 'VRAI',
    lan: 'VRAI',
    usb: 'VRAI',
    etat_pc: 'Neuf',
    salle: 'LABO_RD',
    mdp_pc: 'Mac@2026',
    mdp_admin: 'AdminMac',
    etat_batterie: 'Plus de 6H',
    commentaire: 'Poste pour développement iOS',
    est_actif: 'VRAI',
  },
  {
    utilisateur: 'Tech Lead',
    id_n: 907,
    equipe: 'DSI',
    date_pc: '15/12/2025',
    date_ecran: '15/12/2025',
    caracteristiques: 'Dell XPS 15 / i9 11ème / 32Go RAM / 1To SSD',
    code_pc: 'PCP-DE-0907-DSI6',
    ecran: 'Dell UltraSharp',
    code_ecran: 'ECR-DE-0907-DSI6',
    hdmi: 'VRAI',
    clavier: 'VRAI',
    lan: 'VRAI',
    usb: 'VRAI',
    etat_pc: 'Neuf',
    salle: 'DSI_SERV',
    mdp_pc: 'DellXPS@2025',
    mdp_admin: 'AdminXPS',
    etat_batterie: 'Plus de 5H',
    commentaire: 'Poste de chef de projet DSI',
    est_actif: 'VRAI',
  },
];

// --- Produits (enrichis) ---
const produitsData = [
  { nom: 'Cartouche Encre Noire HP 950', qte: 50, seuil: 10 },
  { nom: 'Tonner Samsung MLT-D101S', qte: 20, seuil: 5 },
  { nom: 'Papier A4 80g (Ramette 500)', qte: 100, seuil: 20 },
  { nom: 'Souris USB Logitech B100', qte: 30, seuil: 10 },
  { nom: 'Clavier USB Dell KB216', qte: 15, seuil: 5 },
  { nom: 'Câble HDMI 2m', qte: 25, seuil: 8 },
  { nom: 'Disque SSD externe 1To', qte: 12, seuil: 3 },
  { nom: 'Hub USB-C 7 ports', qte: 8, seuil: 2 },
  { nom: 'Webcam HD 1080p', qte: 18, seuil: 6 },
  { nom: 'Casque audio USB', qte: 22, seuil: 7 },
];

// ================================================
// 3. SCRIPT PRINCIPAL
// ================================================

async function main() {
  console.log('🌱 Début du seed complet...');

  // ----------------------------------------------------
  // A. UTILISATEURS & EMAILS
  // ----------------------------------------------------
  console.log('📦 Création des utilisateurs...');
  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.users.upsert({
      where: { id_n: u.id_n },
      update: {},
      create: {
        id_n: u.id_n,
        role: u.role,
        is_active: true,
        must_change_password: u.must_change_password,
      },
    });
    createdUsers[u.id_n] = user;

    await prisma.userEmail.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: await bcrypt.hash('default123', 12),
        pass_mail: 'smtp_password',
        is_primary: true,
        is_verified: true,
        user_id: user.id_user,
      },
    });
    console.log(`  ✅ Utilisateur ${u.id_n} (${u.email}) créé`);
  }

  // ----------------------------------------------------
  // B. MARQUES, LOCAUX, MATÉRIELS
  // ----------------------------------------------------
  console.log('📦 Création des marques, locaux et matériels...');
  const createdMateriels = {};
  const allLocaux = new Set();

  for (const item of materielsData) {
    const brand = item.caracteristiques.split(' ')[0];
    const marque = await prisma.marques.upsert({
      where: { nom_marque: brand },
      update: {},
      create: { nom_marque: brand },
    });

    let local = await prisma.locaux.findFirst({
      where: { nom_local: item.salle },
    });
    if (!local) {
      local = await prisma.locaux.create({
        data: { nom_local: item.salle },
      });
    }
    allLocaux.add(item.salle);

    const user = createdUsers[item.id_n];
    if (!user) {
      console.warn(`⚠️  Utilisateur ${item.id_n} non trouvé, création ignorée`);
      continue;
    }

    const materiel = await prisma.materiels.create({
      data: {
        utilisateur: item.utilisateur,
        equipe: item.equipe,
        date_pc: parseDate(item.date_pc),
        date_ecran: parseDate(item.date_ecran),
        caracteristiques: item.caracteristiques,
        code_pc: item.code_pc,
        ecran: item.ecran,
        code_ecran: item.code_ecran,
        hdmi: parseBoolean(item.hdmi),
        clavier: parseBoolean(item.clavier),
        lan: parseBoolean(item.lan),
        usb: parseBoolean(item.usb),
        etat_pc: item.etat_pc,
        salle: item.salle,
        mdp_pc: item.mdp_pc || null,
        mdp_admin: item.mdp_admin || null,
        etat_batterie: item.etat_batterie,
        commentaire: item.commentaire || null,
        est_actif: parseBoolean(item.est_actif) ?? true,
        marque: { connect: { id_marque: marque.id_marque } },
        local: { connect: { id_local: local.id_local } },
        user: { connect: { id_n: user.id_n } },
      },
    });
    createdMateriels[item.id_n] = materiel;
    console.log(`  ✅ Matériel ${materiel.code_pc} créé (id: ${materiel.id_materiels})`);
  }

  // ----------------------------------------------------
  // C. PRODUITS
  // ----------------------------------------------------
  console.log('📦 Création des produits...');
  const createdProduits = {};
  for (const p of produitsData) {
    const existing = await prisma.produits.findFirst({
      where: { nom_produit: p.nom },
    });
    if (existing) {
      createdProduits[p.nom] = existing;
      console.log(`  ⏩ Produit "${p.nom}" existe déjà, ignoré`);
      continue;
    }
    const produit = await prisma.produits.create({
      data: {
        nom_produit: p.nom,
        quantite_en_stock: p.qte,
        seuil_alerte: p.seuil,
        last_date: new Date(),
      },
    });
    createdProduits[p.nom] = produit;
    console.log(`  ✅ Produit "${p.nom}" créé (id: ${produit.id_produit})`);
  }

  // ----------------------------------------------------
  // D. TICKETS (enrichis)
  // ----------------------------------------------------
  console.log('📦 Création des tickets...');
  const mat903 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-DE-0903-BIR1' } });
  const mat904 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-HP-0904-BNI2' } });
  const mat902 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-LN-0902-DSI3' } });
  const mat905 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-AS-0905-RH4' } });
  const mat906 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-AP-0906-RD5' } });
  const mat907 = await prisma.materiels.findFirst({ where: { code_pc: 'PCP-DE-0907-DSI6' } });

  const tickets = [
    {
      numero: 'TICKET-001',
      titre: 'Problème d’imprimante',
      desc: 'L’imprimante réseau ne répond plus, impossibilité d’imprimer depuis le poste.',
      statut: 'EN_COURS',
      priorite: 'HAUTE',
      materiel: mat903,
      demandeur: 903,
      assigne: 904,
    },
    {
      numero: 'TICKET-002',
      titre: 'Lenteur du système',
      desc: 'Le PC rame depuis la mise à jour Windows. Très lent au démarrage.',
      statut: 'NOUVEAU',
      priorite: 'MOYENNE',
      materiel: mat904,
      demandeur: 904,
      assigne: 901,
    },
    {
      numero: 'TICKET-003',
      titre: 'Périphérique non reconnu',
      desc: 'La souris USB n’est pas reconnue sur le port gauche.',
      statut: 'RESOLU',
      priorite: 'BASSE',
      materiel: mat903,
      demandeur: 902,
      assigne: 903,
    },
    {
      numero: 'TICKET-004',
      titre: 'Mot de passe oublié',
      desc: 'Je ne peux plus me connecter à mon compte, besoin de réinitialisation.',
      statut: 'FERME',
      priorite: 'MOYENNE',
      materiel: mat905,
      demandeur: 905,
      assigne: 901,
    },
    {
      numero: 'TICKET-005',
      titre: 'Écran noir intermittent',
      desc: 'L’écran devient noir quelques secondes puis revient, plusieurs fois par heure.',
      statut: 'EN_COURS',
      priorite: 'URGENTE',
      materiel: mat906,
      demandeur: 906,
      assigne: 907,
    },
    {
      numero: 'TICKET-006',
      titre: 'Installation logiciel spécifique',
      desc: 'Besoin d’installer MATLAB sur le poste de développement.',
      statut: 'NOUVEAU',
      priorite: 'BASSE',
      materiel: mat907,
      demandeur: 907,
      assigne: 901,
    },
  ];

  const createdTickets = {};
  for (const t of tickets) {
    if (!t.materiel) {
      console.warn(`  ⚠️  Ticket ${t.numero} ignoré car le matériel associé n'existe pas`);
      continue;
    }
    const ticket = await prisma.ticket.upsert({
      where: { numeroTicket: t.numero },
      update: {},
      create: {
        numeroTicket: t.numero,
        titre: t.titre,
        description: t.desc,
        statut: t.statut,
        priorite: t.priorite,
        idMateriels: t.materiel.id_materiels,
        idDemandeur: t.demandeur,
        nomDemandeur: usersData.find(u => u.id_n === t.demandeur)?.email || null,
        idAssigne: t.assigne,
        nomAssigne: usersData.find(u => u.id_n === t.assigne)?.email || null,
      },
    });
    createdTickets[t.numero] = ticket;
    console.log(`  ✅ Ticket ${t.numero} créé`);
  }

  // ----------------------------------------------------
  // E. COMMENTAIRES (enrichis)
  // ----------------------------------------------------
  console.log('📦 Création des commentaires...');
  const commentData = [
    { ticket: 'TICKET-001', auteur: 904, contenu: 'J’ai redémarré le serveur d’impression, toujours pareil.' },
    { ticket: 'TICKET-001', auteur: 903, contenu: 'J’ai vérifié les câbles réseau, tout est branché. Je vais tester un autre câble.' },
    { ticket: 'TICKET-003', auteur: 903, contenu: 'Problème résolu : j’ai changé le port USB et réinstallé le driver.' },
    { ticket: 'TICKET-004', auteur: 901, contenu: 'Réinitialisation du mot de passe effectuée, l’utilisateur peut se reconnecter.' },
    { ticket: 'TICKET-005', auteur: 907, contenu: 'J’ai mis à jour le pilote graphique, je surveille si le problème persiste.' },
    { ticket: 'TICKET-005', auteur: 906, contenu: 'Depuis la mise à jour, plus de problème constaté.' },
    { ticket: 'TICKET-002', auteur: 901, contenu: 'Vérification des ressources : le disque est presque plein, nettoyage en cours.' },
  ];

  for (const c of commentData) {
    const ticket = await prisma.ticket.findUnique({ where: { numeroTicket: c.ticket } });
    if (!ticket) continue;
    await prisma.historiqueCommentaire.create({
      data: {
        contenu: c.contenu,
        idTicket: ticket.idTicket,
        idAuteur: c.auteur,
      },
    });
  }
  console.log(`  ✅ ${commentData.length} commentaires ajoutés`);

  // ----------------------------------------------------
  // F. FERMETURES DE TICKETS (enrichies)
  // ----------------------------------------------------
  console.log('📦 Création des fermetures de tickets...');
  const ticket3 = await prisma.ticket.findUnique({ where: { numeroTicket: 'TICKET-003' } });
  if (ticket3) {
    await prisma.ticketFermeture.upsert({
      where: { ticketId: ticket3.idTicket },
      update: {},
      create: {
        ticketId: ticket3.idTicket,
        solution: 'Réinstallation du driver USB et changement de port. Fonctionne désormais.',
        dateFermeture: new Date(),
        fermePar: 903,
        motif: 'Périphérique défectueux sur le port.',
        dureeResolution: 45,
      },
    });
    console.log('  ✅ Fermeture créée pour TICKET-003');
  }

  const ticket4 = await prisma.ticket.findUnique({ where: { numeroTicket: 'TICKET-004' } });
  if (ticket4) {
    await prisma.ticketFermeture.upsert({
      where: { ticketId: ticket4.idTicket },
      update: {},
      create: {
        ticketId: ticket4.idTicket,
        solution: 'Réinitialisation du mot de passe via l’outil d’admin.',
        dateFermeture: new Date(),
        fermePar: 901,
        motif: 'Demande utilisateur traitée.',
        dureeResolution: 15,
      },
    });
    console.log('  ✅ Fermeture créée pour TICKET-004');
  }

  // ----------------------------------------------------
  // G. MOUVEMENTS DE STOCK (enrichis)
  // ----------------------------------------------------
  console.log('📦 Création des mouvements de stock...');
  const produitCartouche = createdProduits['Cartouche Encre Noire HP 950'];
  const produitPapier = createdProduits['Papier A4 80g (Ramette 500)'];
  const produitSouris = createdProduits['Souris USB Logitech B100'];
  const produitCable = createdProduits['Câble HDMI 2m'];

  const localBIR1 = await prisma.locaux.findFirst({ where: { nom_local: 'BIR1' } });
  const localBureau3 = await prisma.locaux.findFirst({ where: { nom_local: 'BUREAU 3' } });
  const localRH1 = await prisma.locaux.findFirst({ where: { nom_local: 'RH_1' } });
  const localLabo = await prisma.locaux.findFirst({ where: { nom_local: 'LABO_RD' } });

  if (produitCartouche && localBIR1 && localBureau3) {
    await prisma.mouvement.create({
      data: {
        id_produit: produitCartouche.id_produit,
        date_mouvement: new Date(),
        type_mouvement: 'SORTIE',
        quantite: 5,
        id_local_source: localBIR1.id_local,
        id_local_destination: localBureau3.id_local,
        motif: 'Consommation courante',
        remarque: 'Pour le bureau de la direction',
        nom_utilisateur: 'admin.dsi@company.com',
      },
    });
    console.log('  ✅ Mouvement de sortie (cartouches) créé');
  }

  if (produitPapier && localBIR1) {
    await prisma.mouvement.create({
      data: {
        id_produit: produitPapier.id_produit,
        date_mouvement: new Date(),
        type_mouvement: 'ENTREE',
        quantite: 20,
        id_local_destination: localBIR1.id_local,
        motif: 'Réapprovisionnement mensuel',
        remarque: 'Commande fournisseur',
        nom_utilisateur: 'user902@company.com',
      },
    });
    console.log('  ✅ Mouvement d’entrée (papier) créé');
  }

  if (produitSouris && localBIR1 && localRH1) {
    await prisma.mouvement.create({
      data: {
        id_produit: produitSouris.id_produit,
        date_mouvement: new Date(),
        type_mouvement: 'SORTIE',
        quantite: 3,
        id_local_source: localBIR1.id_local,
        id_local_destination: localRH1.id_local,
        motif: 'Attribution aux nouveaux employés RH',
        remarque: 'Souris logitech',
        nom_utilisateur: 'admin.dsi@company.com',
      },
    });
    console.log('  ✅ Mouvement de sortie (souris) créé');
  }

  if (produitCable && localLabo) {
    await prisma.mouvement.create({
      data: {
        id_produit: produitCable.id_produit,
        date_mouvement: new Date(),
        type_mouvement: 'ENTREE',
        quantite: 10,
        id_local_destination: localLabo.id_local,
        motif: 'Approvisionnement laboratoire R&D',
        remarque: 'Câbles HDMI pour les nouveaux écrans',
        nom_utilisateur: 'marie.curie@company.com',
      },
    });
    console.log('  ✅ Mouvement d’entrée (câbles HDMI) créé');
  }

  // ----------------------------------------------------
  // H. HISTORIQUE MATÉRIEL
  // ----------------------------------------------------
  console.log('📦 Création d’historiques pour les matériels...');
  if (mat903) {
    await prisma.historiqueMateriel.create({
      data: {
        id_materiels: mat903.id_materiels,
        ancienne_valeur: 'Bon',
        nouvelle_valeur: 'Moyen (batterie faible)',
        date_modification: new Date(),
        nom_utilisateur: 'admin.dsi@company.com',
      },
    });
    console.log('  ✅ Historique matériel pour PCP-DE-0903-BIR1 ajouté');
  }
  if (mat906) {
    await prisma.historiqueMateriel.create({
      data: {
        id_materiels: mat906.id_materiels,
        ancienne_valeur: 'Neuf',
        nouvelle_valeur: 'Bon (après 2 mois d’utilisation)',
        date_modification: new Date(),
        nom_utilisateur: 'tech.lead@company.com',
      },
    });
    console.log('  ✅ Historique matériel pour PCP-AP-0906-RD5 ajouté');
  }

  // ----------------------------------------------------
  // I. HISTORIQUE ARRIVAGE (enrichi)
  // ----------------------------------------------------
  console.log('📦 Création des historiques d’arrivage...');
  const produitTonner = createdProduits['Tonner Samsung MLT-D101S'];
  const produitDisque = createdProduits['Disque SSD externe 1To'];

  if (produitTonner) {
    await prisma.historiqueArrive.create({
      data: {
        id_produit: produitTonner.id_produit,
        quantite_arrivee: 10,
        date_arrivee: new Date(),
        ancienne_quantite_stock: 20,
        ancienne_date_stock: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        remarque: 'Réception fournisseur Samsung',
      },
    });
    console.log('  ✅ Historique arrivage tonner créé');
  }
  if (produitDisque) {
    await prisma.historiqueArrive.create({
      data: {
        id_produit: produitDisque.id_produit,
        quantite_arrivee: 5,
        date_arrivee: new Date(),
        ancienne_quantite_stock: 7,
        ancienne_date_stock: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        remarque: 'Réapprovisionnement SSD pour les développeurs',
      },
    });
    console.log('  ✅ Historique arrivage SSD créé');
  }

  // ----------------------------------------------------
  // J. CONFIGURATIONS EMAIL
  // ----------------------------------------------------
  console.log('📦 Création des configurations email...');
  await prisma.configEmailQuotidien.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email_dest: 'destinataire@company.com',
      email_exp: 'no-reply@company.com',
      email_pass: 'smtp_password',
      heure_envoi: '08:30',
      cron_actif: false,
    },
  });
  await prisma.configEmailHebdomadaire.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email_dest: 'destinataire@company.com',
      email_exp: 'no-reply@company.com',
      email_pass: 'smtp_password',
      jour_envoi: 1,
      heure_envoi: '09:00',
      cron_actif_hebdo: false,
      include_materiels: true,
      include_produits: true,
    },
  });
  await prisma.configEmailMensuel.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email_dest: 'destinataire@company.com',
      email_exp: 'no-reply@company.com',
      email_pass: 'smtp_password',
      jour_envoi: 1,
      heure_envoi: '10:00',
      cron_actif: false,
      include_materiels: true,
      include_produits: true,
    },
  });
  console.log('  ✅ Configs email créées');

  // ----------------------------------------------------
  // K. PASSWORD RESET TOKENS
  // ----------------------------------------------------
  console.log('📦 Création de tokens de réinitialisation...');
  await prisma.passwordResetToken.createMany({
    data: [
      {
        email: 'user902@company.com',
        token: generateToken(),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
      {
        email: 'dina.bni@company.com',
        token: generateToken(),
        expiresAt: new Date(Date.now() - 3600 * 1000),
      },
      {
        email: 'jean.dupont@company.com',
        token: generateToken(),
        expiresAt: new Date(Date.now() + 7200 * 1000),
      },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ Tokens créés');

  // ----------------------------------------------------
  // L. DOCUMENTS (avec tables de liaison pour produits et matériels)
  // ----------------------------------------------------
  console.log('📦 Création des documents et liaisons...');

  const marqueDell = await prisma.marques.findUnique({ where: { nom_marque: 'Dell' } });

  const doc1 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/facture_pc_903.pdf' },
    update: {},
    create: {
      nom_fichier: 'facture_pc_903.pdf',
      chemin_stockage: '/uploads/facture_pc_903.pdf',
      taille: 2048,
      type_mime: 'application/pdf',
      categorie: 'FACTURE',
      description: 'Facture d’achat du PC Dell',
      version: 1,
      est_public: false,
      upload_par: 903,
    },
  });

  if (mat903) {
    await prisma.materielDocument.upsert({
      where: {
        id_materiels_id_document: {
          id_materiels: mat903.id_materiels,
          id_document: doc1.id,
        },
      },
      update: {},
      create: {
        id_materiels: mat903.id_materiels,
        id_document: doc1.id,
      },
    });
    console.log('  ✅ Liaison document-matériel créée pour la facture (mat903)');
  }

  const produitDocSouris = createdProduits['Souris USB Logitech B100'];
  const doc2 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/notice_souris_logitech.pdf' },
    update: {},
    create: {
      nom_fichier: 'notice_souris_logitech.pdf',
      chemin_stockage: '/uploads/notice_souris_logitech.pdf',
      taille: 1024,
      type_mime: 'application/pdf',
      categorie: 'MANUEL_TECHNIQUE',
      description: 'Notice d’utilisation souris',
      version: 1,
      est_public: true,
      upload_par: 901,
    },
  });
  if (produitDocSouris) {
    await prisma.produitDocument.upsert({
      where: {
        id_produit_id_document: {
          id_produit: produitDocSouris.id_produit,
          id_document: doc2.id,
        },
      },
      update: {},
      create: {
        id_produit: produitDocSouris.id_produit,
        id_document: doc2.id,
      },
    });
    console.log('  ✅ Liaison document-produit créée pour la notice souris');
  }
  console.log('  ✅ Document notice souris créé');

  const ticket1 = await prisma.ticket.findUnique({ where: { numeroTicket: 'TICKET-001' } });
  const doc3 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/contrat_maintenance_imprimante.pdf' },
    update: {},
    create: {
      nom_fichier: 'contrat_maintenance_imprimante.pdf',
      chemin_stockage: '/uploads/contrat_maintenance_imprimante.pdf',
      taille: 3072,
      type_mime: 'application/pdf',
      categorie: 'CONTRAT_MAINTENANCE',
      description: 'Contrat de maintenance de l’imprimante réseau',
      version: 1,
      est_public: false,
      id_ticket: ticket1?.idTicket || null,
      upload_par: 904,
    },
  });
  console.log('  ✅ Document contrat maintenance créé');

  const doc4 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/schema_reseau_dell.pdf' },
    update: {},
    create: {
      nom_fichier: 'schema_reseau_dell.pdf',
      chemin_stockage: '/uploads/schema_reseau_dell.pdf',
      taille: 4096,
      type_mime: 'application/pdf',
      categorie: 'SCHEMA_RESEAU',
      description: 'Schéma d’intégration réseau des postes Dell',
      version: 1,
      est_public: true,
      id_marque: marqueDell?.id_marque || null,
      upload_par: 901,
    },
  });
  console.log('  ✅ Document schéma réseau créé');

  const produitDisqueDoc = createdProduits['Disque SSD externe 1To'];
  const doc5 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/licence_ssd_encryption.pdf' },
    update: {},
    create: {
      nom_fichier: 'licence_ssd_encryption.pdf',
      chemin_stockage: '/uploads/licence_ssd_encryption.pdf',
      taille: 512,
      type_mime: 'application/pdf',
      categorie: 'LICENCE_LOGICIELLE',
      description: 'Licence pour le logiciel de chiffrement des SSD',
      version: 1,
      est_public: false,
      upload_par: 907,
    },
  });
  if (produitDisqueDoc) {
    await prisma.produitDocument.upsert({
      where: {
        id_produit_id_document: {
          id_produit: produitDisqueDoc.id_produit,
          id_document: doc5.id,
        },
      },
      update: {},
      create: {
        id_produit: produitDisqueDoc.id_produit,
        id_document: doc5.id,
      },
    });
    console.log('  ✅ Liaison document-produit créée pour la licence SSD');
  }
  console.log('  ✅ Document licence logicielle créé');

  const doc6 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/bon_livraison_macbook.pdf' },
    update: {},
    create: {
      nom_fichier: 'bon_livraison_macbook.pdf',
      chemin_stockage: '/uploads/bon_livraison_macbook.pdf',
      taille: 1500,
      type_mime: 'application/pdf',
      categorie: 'BON_LIVRAISON',
      description: 'Bon de livraison du MacBook Pro pour R&D',
      version: 1,
      est_public: false,
      upload_par: 906,
    },
  });
  if (mat906) {
    await prisma.materielDocument.upsert({
      where: {
        id_materiels_id_document: {
          id_materiels: mat906.id_materiels,
          id_document: doc6.id,
        },
      },
      update: {},
      create: {
        id_materiels: mat906.id_materiels,
        id_document: doc6.id,
      },
    });
    console.log('  ✅ Liaison document-matériel créée pour le bon de livraison (mat906)');
  }

  const doc7 = await prisma.document.upsert({
    where: { chemin_stockage: '/uploads/rapport_audit_securite.pdf' },
    update: {},
    create: {
      nom_fichier: 'rapport_audit_securite.pdf',
      chemin_stockage: '/uploads/rapport_audit_securite.pdf',
      taille: 8192,
      type_mime: 'application/pdf',
      categorie: 'RAPPORT_AUDIT',
      description: 'Rapport d’audit de sécurité du parc informatique',
      version: 1,
      est_public: true,
      upload_par: 901,
    },
  });
  console.log('  ✅ Document rapport audit créé');

  // ----------------------------------------------------
  // M. ACCÈS AUX DOCUMENTS (enrichis)
  // ----------------------------------------------------
  console.log('📦 Création des accès aux documents...');
  await prisma.documentAcces.createMany({
    data: [
      { id_document: doc1.id, id_utilisateur: 902, action: 'CONSULTATION' },
      { id_document: doc1.id, id_utilisateur: 903, action: 'TELECHARGEMENT' },
      { id_document: doc2.id, id_utilisateur: 901, action: 'CONSULTATION' },
      { id_document: doc2.id, id_utilisateur: 905, action: 'TELECHARGEMENT' },
      { id_document: doc3.id, id_utilisateur: 904, action: 'CONSULTATION' },
      { id_document: doc4.id, id_utilisateur: 907, action: 'TELECHARGEMENT' },
      { id_document: doc5.id, id_utilisateur: 906, action: 'CONSULTATION' },
      { id_document: doc6.id, id_utilisateur: 906, action: 'CONSULTATION' },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ Accès aux documents créés');

  // ----------------------------------------------------
  // N. VÉRIFICATION FINALE
  // ----------------------------------------------------
  console.log('🎉 Seed terminé avec succès pour TOUS les modèles !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
