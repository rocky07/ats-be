import { Router } from 'express';
import { getDashboardStats } from '../services/dashboardService.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    res.json(getDashboardStats());
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: 'Failed to compute dashboard stats' });
  }
});

export default router;
