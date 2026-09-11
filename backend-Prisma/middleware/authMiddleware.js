import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
import { hasPermission } from '../constants/roles.js';

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET is not configured or too weak.');
    return false;
  }
  return true;
};

export const authenticateToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
  }

  if (!ensureJwtSecret()) {
    return res.status(500).json({ error: 'Erreur de configuration serveur.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Token expiré.' });
      }
      return res.status(403).json({ error: 'Token invalide.' });
    }

    req.user = {
      userId: decoded.userId,
      id_n: decoded.id_n,
      email_1: decoded.email_1,
      email_2: decoded.email_2,
      role: decoded.role,
      must_change_password: decoded.must_change_password,
    };

    next();
  });
};

export const ensureActiveUser = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    const user = await prisma.users.findUnique({
      where: { id_user: userId },
      select: { is_active: true },
    });

    if (!user || !user.is_active) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return res.status(403).json({ error: 'Demandez à l\'administrateur d\'activer votre compte' });
    }

    next();
  } catch (error) {
    console.error('Erreur ensureActiveUser:', error);
    return res.status(500).json({ error: 'Une erreur est survenue côté serveur.' });
  }
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    next();
  };
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès interdit : rôle insuffisant.' });
    }
    next();
  };
};
