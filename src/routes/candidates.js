import express from 'express';
import multer from 'multer';
import {
    getCandidates,
    getCandidate,
    createCandidate,
    uploadResume,
    removeCandidate,
} from '../controllers/candidates.js';

const router = express.Router();

// Keep uploaded files in memory; resumes are small and parsed immediately.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.get('/', getCandidates);
router.get('/:id', getCandidate);
router.post('/', createCandidate);
router.post('/upload', upload.single('resume'), uploadResume);
router.delete('/:id', removeCandidate);

export default router;
