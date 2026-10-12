import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id_n;

    let where = { date_suppression: null };
    if (userRole === 'USER') {
      where.id_n = userId;
    }

    const materiels = await prisma.Materiels.findMany({ where });
    res.json(materiels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
