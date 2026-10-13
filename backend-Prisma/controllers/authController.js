// controllers/authController.js
import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { encryptSecret } from '../services/passMailCrypto.js';
import { TOKEN_EXPIRES_IN } from '../config/authToken.js';
import { getAuthCookieOptions } from '../middleware/authMiddleware.js';

const APP_URL = process.env.APP_URL || null;

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET is not configured or too weak.');
    return false;
  }
  return true;
};

const buildMailTransporter = async () => {
  const configQuotidien = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
  const configHebdo = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
  const configMensuel = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });

  let config = null;
  if (configQuotidien && configQuotidien.email_exp) {
    config = configQuotidien;
  } else if (configHebdo && configHebdo.email_exp) {
    config = configHebdo;
  } else if (configMensuel && configMensuel.email_exp) {
    config = configMensuel;
  }

  if (!config || !config.email_exp) {
    console.error('Configuration email manquante :', config ? { id: config.id, email_exp: config.email_exp, hasPass: !!config.email_pass } : 'aucune config trouvée (configEmailQuotidien, configEmailHebdomadaire, configEmailMensuel)');
    throw new Error('Configuration email manquante.');
  }

  console.log(`[email] Utilisation de la config email id=${config.id} email_exp=${config.email_exp} host=smtp.ionos.fr port=465`);

  const transporter = nodemailer.createTransport({
    host: 'smtp.ionos.fr',
    port: 465,
    secure: true,
    auth: {
      user: config.email_exp,
      pass: config.email_pass,
    },
  });

  try {
    await transporter.verify();
    console.log('[email] Connexion SMTP vérifiée avec succès');
  } catch (verifyError) {
    console.error('[email] Erreur de vérification SMTP:', verifyError.message);
  }

  return { transporter, config };
};

const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const { transporter, config } = await buildMailTransporter();

    if (!APP_URL) {
      console.error('[email] APP_URL n\'est pas définie dans .env. Le lien de réinitialisation ne pourra pas être généré correctement.');
    }

    const resetUrl = `${APP_URL || ''}/reset-password?token=${resetToken}`;
    // Ne jamais journaliser resetUrl : il contient le jeton de réinitialisation.
    console.log(`[email] Envoi d'un lien de réinitialisation depuis ${config.email_exp}`);

    const mailOptions = {
      from: `"Support IT" <${config.email_exp}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">Réinitialisation du mot de passe</h2>
          <p>Bonjour,</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p>Ce lien expire dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error.message || error);
    return false;
  }
};

const validatePasswordStrength = (password) => {
  if (!password || password.length < 7) {
    return 'Le mot de passe doit contenir au moins 7 caractères.';
  }
  return null;
};

export const login = async (req, res) => {
  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userEmail = await prisma.userEmail.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { user: { include: { materiel: true, emails: true } } },
    });

    if (!userEmail) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = userEmail.user;

    if (!userEmail.password) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const mustChangePassword = user.must_change_password;

    const isPasswordValid = await bcrypt.compare(password, userEmail.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Demandez à l\'administrateur d\'activer votre compte' });
    }

    const primaryEmail = user.emails?.find((e) => e.is_primary)?.email || normalizedEmail;
    const secondaryEmail = user.emails?.find((e) => !e.is_primary)?.email || null;

    const token = jwt.sign(
      {
        userId: user.id_user,
        id_n: user.id_n,
        email_1: primaryEmail,
        email_2: secondaryEmail,
        role: user.role,
        must_change_password: mustChangePassword,
      },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN },
    );

    res.cookie('token', token, getAuthCookieOptions());

    return res.status(200).json({
      message: 'Connexion réussie',
      user: {
        id_user: user.id_user,
        email_1: primaryEmail,
        email_2: secondaryEmail,
        role: user.role,
        must_change_password: mustChangePassword,
        details_materiel: {
          id_materiels: user.materiel?.id_materiels,
          utilisateur: user.materiel?.utilisateur,
          id_n: user.materiel?.id_n,
          equipe: user.materiel?.equipe,
        },
      },
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return res.status(500).json({ error: 'Une erreur est survenue côté serveur.' });
  }
};

export const updatePasswords = async (req, res) => {
  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  const { oldPassword, p1 } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  if (!oldPassword) {
    return res.status(400).json({ error: 'Veuillez saisir votre mot de passe actuel.' });
  }

  if (!p1) {
    return res.status(400).json({ error: 'Veuillez saisir un nouveau mot de passe.' });
  }

  try {
    const passwordError = validatePasswordStrength(p1);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const primaryEmail = await prisma.userEmail.findFirst({
      where: { user_id: userId, is_primary: true },
    });

    if (!primaryEmail) {
      return res.status(404).json({ error: 'Email principal introuvable.' });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, primaryEmail.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }

    await prisma.userEmail.update({
      where: { id_uEmail: primaryEmail.id_uEmail },
      data: { password: await bcrypt.hash(p1, 12), password_enc: encryptSecret(p1) },
    });

    await prisma.users.update({
      where: { id_user: userId },
      data: { must_change_password: false },
    });

    return res.status(200).json({
      message: 'Mise à jour réussie',
      details: 'Mots de passe mis à jour',
    });
  } catch (error) {
    console.error('Erreur updatePasswords:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour en base de données.' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    const userEmail = await prisma.userEmail.findFirst({
      where: { user_id: user.userId },
      include: { user: { include: { materiel: true, emails: true } } },
    });

    if (!userEmail) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const fullUser = userEmail.user;
    const primaryEmail = fullUser.emails?.find((e) => e.is_primary)?.email || user.email_1;
    const secondaryEmail = fullUser.emails?.find((e) => !e.is_primary)?.email || user.email_2;

    return res.status(200).json({
      id_user: fullUser.id_user,
      id_n: fullUser.id_n,
      email_1: primaryEmail,
      email_2: secondaryEmail,
      role: fullUser.role,
      must_change_password: fullUser.must_change_password,
      details_materiel: {
        id_materiels: fullUser.materiel?.id_materiels,
        utilisateur: fullUser.materiel?.utilisateur,
        id_n: fullUser.materiel?.id_n,
        equipe: fullUser.materiel?.equipe,
      },
    });
  } catch (error) {
    console.error('Erreur getMe:', error);
    return res.status(500).json({ error: 'Une erreur est survenue côté serveur.' });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie('token', getAuthCookieOptions({ withMaxAge: false }));

    return res.status(200).json({ message: 'Déconnexion réussie.' });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    return res.status(500).json({ error: 'Une erreur est survenue lors de la déconnexion.' });
  }
};

export const forgotPassword = async (req, res) => {
  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "L'email est requis." });
  }

  // Réponse identique que le compte existe ou non, pour ne pas révéler les adresses valides.
  const genericResponse = {
    message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
  };

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const userEmail = await prisma.userEmail.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!userEmail) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        email: userEmail.email,
        token: resetTokenHash,
        expiresAt,
      },
    });

    // Envoi non attendu : le temps de réponse ne doit pas trahir l'existence du compte.
    sendPasswordResetEmail(userEmail.email, resetToken)
      .then((sent) => {
        if (!sent) console.error('[forgotPassword] Échec de l\'envoi de l\'email de réinitialisation.');
      })
      .catch((err) => console.error('[forgotPassword] Erreur envoi email:', err?.message || err));

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Erreur forgotPassword:', error);
    return res.status(200).json(genericResponse);
  }
};

export const forceChangePassword = async (req, res) => {
  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  // Le nouveau mot de passe s'applique à tous les emails de l'utilisateur
  // (principal et secondaire). La confirmation est vérifiée côté frontend.
  const { password } = req.body;
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const userEmails = await prisma.userEmail.findMany({ where: { user_id: userId } });
    if (!userEmails.length) {
      return res.status(400).json({ error: "Aucun email associé à ce compte. Contactez l'administrateur." });
    }

    const hash = await bcrypt.hash(password, 12);
    const passwordEnc = encryptSecret(password);

    await prisma.$transaction([
      ...userEmails.map((e) =>
        prisma.userEmail.update({
          where: { id_uEmail: e.id_uEmail },
          data: { password: hash, password_enc: passwordEnc },
        }),
      ),
      prisma.users.update({
        where: { id_user: userId },
        data: { must_change_password: false },
      }),
    ]);

    return res.status(200).json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    console.error('Erreur forceChangePassword:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
};

export const resetPassword = async (req, res) => {
  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token et nouveau mot de passe requis.' });
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetTokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetTokenRecord) {
      return res.status(400).json({ message: 'Lien de réinitialisation invalide.' });
    }

    if (new Date() > resetTokenRecord.expiresAt) {
      return res.status(400).json({ message: 'Le lien de réinitialisation a expiré. Veuillez faire une nouvelle demande.' });
    }

    if (resetTokenRecord.usedAt) {
      return res.status(400).json({ message: 'Ce lien a déjà été utilisé. Veuillez faire une nouvelle demande.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const passwordEnc = encryptSecret(password);

    // Consommation atomique du jeton : seule la première requête concurrente
    // obtient count === 1 ; les autres n'appliquent aucune modification.
    const consumed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: resetTokenRecord.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (count !== 1) return false;

      await tx.userEmail.updateMany({
        where: { email: { equals: resetTokenRecord.email, mode: 'insensitive' } },
        data: { password: hashedPassword, password_enc: passwordEnc },
      });
      return true;
    });

    if (!consumed) {
      return res.status(400).json({ message: 'Ce lien a déjà été utilisé ou a expiré. Veuillez faire une nouvelle demande.' });
    }

    return res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    console.error('Erreur resetPassword:', error);
    return res.status(500).json({ message: 'Une erreur est survenue. Veuillez réessayer.' });
  }
};
