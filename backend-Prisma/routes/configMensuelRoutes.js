// routes/configMensuelRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken, ensureActiveUser);

// ⚠️ Important : Les chemins ici sont relatifs à /api/config
// Donc /mensuel sera accessible via /api/config/mensuel

// GET - Récupérer la configuration mensuelle
// URL: /api/config/mensuel
router.get('/mensuel', requirePermission(PERMISSIONS.CONFIG_READ), async (req, res) => {
  try {
    let config = await prisma.configEmailMensuel.findUnique({
      where: { id: 1 }
    });
    
    if (!config) {
      // Retourner une configuration par défaut
      const today = new Date();
      const month = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      config = {
        id: 1,
        email_dest: '',
        email_exp: '',
        email_pass: '',
        objet_mail: `Rapport Mensuel des Stocks - ${month}`,
        message_mail: `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks du ${month}.`,
        heure_envoi: '17:15',
        jour_envoi: 1,
        cron_actif: false,
        filtre_equipe: null,
        include_materiels: true,
        include_produits: true,
        created_at: new Date(),
        updated_at: new Date()
      };
    }
    
    res.json(config);
  } catch (error) {
    console.error('Erreur GET /mensuel:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration mensuelle' });
  }
});

// POST - Mettre à jour ou créer la configuration mensuelle
// URL: /api/config/mensuel
router.post('/mensuel', requirePermission(PERMISSIONS.CONFIG_WRITE), async (req, res) => {
  try {
    const { 
      email_dest, 
      email_exp, 
      email_pass, 
      objet_mail, 
      message_mail, 
      heure_envoi, 
      jour_envoi, 
      cron_actif,
      filtre_equipe,
      include_materiels,
      include_produits
    } = req.body;
    
    // Vérifier si une config existe déjà
    const existingConfig = await prisma.configEmailMensuel.findUnique({
      where: { id: 1 }
    });
    
    let config;
    if (existingConfig) {
      // Mettre à jour
      config = await prisma.configEmailMensuel.update({
        where: { id: 1 },
        data: {
          email_dest,
          email_exp,
          email_pass,
          objet_mail,
          message_mail,
          heure_envoi,
          jour_envoi: parseInt(jour_envoi) || 1,
          cron_actif: cron_actif || false,
          filtre_equipe: filtre_equipe || null,
          include_materiels: include_materiels !== undefined ? include_materiels : true,
          include_produits: include_produits !== undefined ? include_produits : true,
          updated_at: new Date()
        }
      });
    } else {
      // Créer
      config = await prisma.configEmailMensuel.create({
        data: {
          id: 1,
          email_dest,
          email_exp,
          email_pass,
          objet_mail,
          message_mail,
          heure_envoi,
          jour_envoi: parseInt(jour_envoi) || 1,
          cron_actif: cron_actif || false,
          filtre_equipe: filtre_equipe || null,
          include_materiels: include_materiels !== undefined ? include_materiels : true,
          include_produits: include_produits !== undefined ? include_produits : true
        }
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Erreur POST /mensuel:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration mensuelle' });
  }
});

// DELETE - Supprimer la configuration mensuelle
// URL: /api/config/mensuel
router.delete('/mensuel', requirePermission(PERMISSIONS.CONFIG_WRITE), async (req, res) => {
  try {
    const config = await prisma.configEmailMensuel.findUnique({
      where: { id: 1 }
    });
    
    if (config) {
      await prisma.configEmailMensuel.delete({
        where: { id: 1 }
      });
    }
    res.json({ message: 'Configuration mensuelle supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /mensuel:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// GET - Vérifier le statut du robot mensuel
// URL: /api/config/mensuel/status
router.get('/mensuel/status', requirePermission(PERMISSIONS.CONFIG_READ), async (req, res) => {
  try {
    const config = await prisma.configEmailMensuel.findUnique({
      where: { id: 1 }
    });
    res.json({ 
      running: config ? config.cron_actif : false,
      config: config
    });
  } catch (error) {
    console.error('Erreur GET /mensuel/status:', error);
    res.status(500).json({ error: 'Erreur lors du check du statut' });
  }
});

// POST - Envoyer un email de test mensuel
// URL: /api/config/mensuel/test
router.post('/mensuel/test', requirePermission(PERMISSIONS.CONFIG_WRITE), async (req, res) => {
  try {
    const config = await prisma.configEmailMensuel.findUnique({
      where: { id: 1 }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Aucune configuration mensuelle trouvée' });
    }
    
    // Vérifier que les champs requis sont présents
    if (!config.email_exp || !config.email_pass || !config.email_dest) {
      return res.status(400).json({ error: 'Configuration email incomplète' });
    }
    
    // Importer les services nécessaires
    const { generateExcelReport } = await import('../services/excelService.js');
    const { sendEmailWithExcel } = await import('../services/emailService.js');
    
    // Générer le rapport Excel
    const excelBuffer = await generateExcelReport(prisma);
    
    const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // Envoyer l'email
    await sendEmailWithExcel({
      to: config.email_dest.split(',').map(email => email.trim()),
      subject: `[TEST] ${config.objet_mail || `Rapport Mensuel - ${monthName}`}`,
      text: config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks.`,
      html: `<p>${config.message_mail || `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks.`}</p><p><strong>Ceci est un email de test</strong></p>`,
      from: config.email_exp,
      password: config.email_pass,
      attachments: [{
        filename: `rapport_mensuel_test_${new Date().toISOString().slice(0,10)}.xlsx`,
        content: excelBuffer
      }]
    });
    
    res.json({ message: 'Email de test mensuel envoyé avec succès' });
  } catch (error) {
    console.error('Erreur envoi test mensuel:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ EXPORT CORRECT
export default router;