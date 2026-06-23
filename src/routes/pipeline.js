import express from 'express';
import { getPipelineCards } from '../controllers/pipeline.js';
const router = express.Router();

router.get('/',getPipelineCards);

export default router;