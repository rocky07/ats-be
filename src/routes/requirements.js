import express from 'express';
import { getRequirements, createRequirement, editRequirement, shareRequirement } from '../controllers/requirements.js';
import { dbScan } from '../config/dynamodb.js';

const router = express.Router();

router.get('/departments', async (_req, res) => {
  const departments = await dbScan('BourntecATS-Departments');
  res.json(departments);
});
router.get('/', getRequirements);
router.post('/', createRequirement);
router.put('/:id', editRequirement);
router.post('/:id/share', shareRequirement);

export default router;
