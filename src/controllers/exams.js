import {
    generateExam,
    getExamPublic,
    getExamByRequirement,
    submitExam,
    getSubmission,
} from '../services/examService.js';
import { sendExamInvite } from '../services/emailService.js';
import { verifyIdentity } from '../services/verificationService.js';
import { getSystemSettings } from '../services/settingsService.js';
import { dbGet } from '../config/dynamodb.js';

// POST /api/exams/generate — generate & persist exam for a requirement
export const generate = async (req, res) => {
    try {
        const { requirementId } = req.body;
        const requirement = await dbGet('BourntecATS-Requirements', { id: String(requirementId) });
        if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

        const { examSettings } = await getSystemSettings();
        const questionCount = requirement.examConfig?.questionCount ?? examSettings.questionCount;
        const exam = await generateExam(requirement, questionCount);
        res.json(exam);
    } catch (err) {
        if (err.message?.includes('ANTHROPIC_API_KEY')) {
            return res.status(503).json({ error: err.message });
        }
        console.error('Exam generation error:', err);
        res.status(500).json({ error: 'Failed to generate exam' });
    }
};

// GET /api/exams/by-requirement/:reqId — get exam for a requirement (internal)
export const byRequirement = async (req, res) => {
    const exam = await getExamByRequirement(req.params.reqId);
    if (!exam) return res.status(404).json({ error: 'No exam for this requirement' });
    res.json(exam);
};

// GET /api/exams/:examId — public: fetch exam without correct answers
// examId param is the requirementId (PK of BourntecATS-Exams)
export const fetchPublic = async (req, res) => {
    const exam = await getExamPublic(req.params.examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
};

// POST /api/exams/:examId/submit — public: submit answers & get score
export const submit = async (req, res) => {
    try {
        const { candidateId, candidateName, answers, timeTaken } = req.body;
        const submission = await submitExam({
            examId: req.params.examId,
            candidateId,
            candidateName,
            answers,
            timeTaken,
        });
        res.json(submission);
    } catch (err) {
        console.error('Exam submit error:', err);
        res.status(500).json({ error: err.message ?? 'Failed to submit exam' });
    }
};

// GET /api/exams/:examId/submission/:candidateId — get a candidate's result
export const submission = async (req, res) => {
    const s = await getSubmission(req.params.examId, req.params.candidateId);
    if (!s) return res.status(404).json({ error: 'Submission not found' });
    res.json(s);
};

// POST /api/exams/:examId/verify-identity — public: verify candidate face + name before starting the timed exam
export const verifyExamIdentity = async (req, res) => {
    try {
        const { selfieImageBase64, idImageBase64, candidateName } = req.body;
        const result = await verifyIdentity({ selfieImageBase64, idImageBase64, candidateName });
        res.json(result);
    } catch (err) {
        console.error('Identity verification error:', err);
        res.status(err.message?.includes('required') ? 400 : 500).json({ error: err.message ?? 'Verification failed' });
    }
};

// POST /api/exams/send-invite — send exam link to candidate via email
export const sendInvite = async (req, res) => {
    try {
        const { candidateId, candidateName, candidateEmail, examId, jobTitle } = req.body;
        const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        const examUrl = `${baseUrl}/exam/${examId}?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`;

        const result = await sendExamInvite({ candidateName, candidateEmail, examId, jobTitle, examUrl });
        res.json({ ...result, examUrl });
    } catch (err) {
        console.error('Send invite error:', err);
        res.status(500).json({ error: 'Failed to send exam invite' });
    }
};
