import express from 'express';
import { getPipeline, savePipeline } from '../controllers/pipelines.js';

const router = express.Router();

router.get('/:requirementId', getPipeline);
router.put('/:requirementId', savePipeline);

export default router;
