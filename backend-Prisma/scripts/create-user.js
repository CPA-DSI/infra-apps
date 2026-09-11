// create-user.js - Version ES Module
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET doit être défini et contenir au moins 32 caractères.');
  }
};

const validateUserPayload = (userData) => {
  if (!userData.id_n || userData.id_n <= 0) {
    throw new Error('id_n est requis et doit être supérieur à 0.');
  }

  if (!userData.emails || !Array.isArray(userData.emails) || userData.emails.length === 0) {
    throw new Error('Au moins un email est requis pour créer un utilisateur.');
  }

  for (const emailData of userData.emails) {
    if (!emailData.email || !emailData.password) {
      throw new Error('Chaque email doit avoir un email et un mot de passe.');
    }
  }
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    throw new Error('Email invalide.');
  }
  return email.trim().toLowerCase();
};

const buildUserPayload = (userData) => {
  const normalizedEmails = userData.emails.map((emailData) => ({
    email: normalizeEmail(emailData.email),
    password: emailData.password,
    pass_mail: emailData.pass_mail || null,
    is_primary: emailData.is_primary ?? true,
    is_verified: emailData.is_verified ?? false,
  }));

  return {
    id_n: userData.id_n,
    role: userData.role || 'USER',
    is_active: userData.is_active ?? true,
    // 👇 Nouvelle propriété : l'utilisateur n'aura pas à changer son mot de passe
    must_change_password: userData.must_change_password ?? false,
    emails: {
      create: normalizedEmails,
    },
  };
};

const hashEmailPasswords = async (emails) => {
  const hashedEmails = await Promise.all(
    emails.map(async (emailData) => ({
      ...emailData,
      password: await bcrypt.hash(emailData.password, BCRYPT_ROUNDS),
    })),
  );

  return hashedEmails;
};

const createUserWithEmails = async (userData) => {
  validateUserPayload(userData);

  const payload = buildUserPayload(userData);
  const hashedEmails = await hashEmailPasswords(payload.emails.create);

  payload.emails.create = hashedEmails;

  const user = await prisma.users.create({
    data: payload,
    include: {
      emails: true,
    },
  });

  return user;
};

const sanitizeUserResponse = (user) => {
  const { emails, ...userWithoutEmails } = user;
  const sanitizedEmails = emails.map(({ password, pass_mail, ...emailWithoutPasswords }) => emailWithoutPasswords);

  return {
    user: userWithoutEmails,
    emails: sanitizedEmails,
  };
};

const createUser = async () => {
  ensureJwtSecret();

  const userData = {
    id_n: 1,
    role: 'IT_ADMIN',
    is_active: true,
    // 👇 On impose false pour éviter le changement de mot de passe
    must_change_password: false,
    emails: [
      {
        email: 'dsi@experts-cpa.com',
        password: 'Admin*2026*IT',
        pass_mail: 'Cpa_maintenance1*',
        is_primary: true,
        is_verified: true,
      },
      {
        email: 'dsi@rfc-production.com',
        password: 'Admin2*2026*IT',
        pass_mail: 'Rfc_maintenance1*',
        is_primary: false,
        is_verified: true,
      },
    ],
  };

  try {
    const user = await createUserWithEmails(userData);
    const { user: sanitizedUser, emails } = sanitizeUserResponse(user);

    console.log('✅ Utilisateur créé avec succès !');
    console.log('📋 Détails utilisateur :', sanitizedUser);
    console.log('📧 Emails créés :', emails);

    return user;
  } catch (error) {
    console.error('❌ Erreur lors de la création :', error.message);

    if (error.code === 'P2002') {
      console.error('⚠️ Un utilisateur avec cet email ou ID existe déjà');
      console.error('🔍 Champs concernés :', error.meta?.target);
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

createUser()
  .then(() => {
    console.log('🎉 Création terminée avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale :', error);
    process.exit(1);
  });