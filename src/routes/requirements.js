import express from 'express';
import { getRequirements, createRequirement, editRequirement } from '../controllers/requirements.js';
import db from '../config/db.js';
const router = express.Router();

router.get('/departments', (_req, res) => res.json(db.data.departments ?? []));
router.get('/', getRequirements);
router.post('/', createRequirement);
router.put('/:id', editRequirement);

export default router;