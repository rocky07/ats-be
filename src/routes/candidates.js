import express from 'express';
import multer from 'multer';
import {
    getCandidates,
    getCandidate,
    createCandidate,
    uploadResume,
    removeCandidate,
} from '../controllers/candidates.js';
import { fetchCandidate } from '../services/candidates.js';
import { getResumeDownloadUrl } from '../services/s3Service.js';

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

// GET /api/candidates/:id/resume  — returns a presigned S3 download URL (1 hr expiry)
router.get('/:id/resume', async (req, res) => {
    const candidate = fetchCandidate(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (!candidate.resumeS3Key) return res.status(404).json({ error: 'No resume on file' });
    try {
        const url = await getResumeDownloadUrl(candidate.resumeS3Key);
        res.json({ url });
    } catch (e) {
        console.error('Presign error:', e.message);
        res.status(500).json({ error: 'Could not generate download link' });
    }
});

export default router;
