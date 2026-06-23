import express from 'express';
import { getRequirements,createRequirement } from '../controllers/requirements.js';
const router = express.Router();

router.get('/',getRequirements);
router.post('/', createRequirement);

export default router;