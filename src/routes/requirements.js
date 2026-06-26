import express from 'express';
import { getRequirements, createRequirement, editRequirement } from '../controllers/requirements.js';
const router = express.Router();

router.get('/', getRequirements);
router.post('/', createRequirement);
router.put('/:id', editRequirement);

export default router;