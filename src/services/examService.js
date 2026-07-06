import Anthropic from '@anthropic-ai/sdk';
import { dbGet, dbPut } from '../config/dynamodb.js';
import { getSystemSettings } from './settingsService.js';

const EXAMS_TABLE = 'BourntecATS-Exams';
const SUBMISSIONS_TABLE = 'BourntecATS-ExamSubmissions';
const REQUIREMENTS_TABLE = 'BourntecATS-Requirements';

// ── Generation ────────────────────────────────────────────────────────────────

export const generateExam = async (requirement, questionCount = 20) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server');

    const client = new Anthropic({ apiKey });

    const reqSummary = [
        `Title: ${requirement.title}`,
        requirement.department ? `Department: ${requirement.department}` : '',
        (requirement.mustHaves ?? []).length
            ? `Must-have skills: ${requirement.mustHaves.join(', ')}`
            : '',
        (requirement.niceToHaves ?? []).length
            ? `Nice-to-have skills: ${requirement.niceToHaves.join(', ')}`
            : '',
        requirement.description ? `Description: ${requirement.description}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const prompt =
        `You are a senior technical recruiter. Generate exactly ${questionCount} multiple-choice questions to ` +
        `assess a candidate for the following role. Each question must have 4 options (A, B, C, D) ` +
        `and exactly one correct answer. Return ONLY valid JSON — no prose, no markdown fences — ` +
        `matching this schema:\n` +
        `{\n` +
        `  "title": "<exam title>",\n` +
        `  "questions": [\n` +
        `    { "id": 1, "question": "...", "options": {"A":"...","B":"...","C":"...","D":"..."}, "correctAnswer": "A" }\n` +
        `  ]\n` +
        `}\n\n` +
        `JOB REQUIREMENT:\n${reqSummary}`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const json = raw.replace(/```(?:json)?/g, '').trim();
    const parsed = JSON.parse(json);

    // PK is requirementId — PutItem naturally upserts (replaces existing exam for this requirement)
    const exam = {
        requirementId: String(requirement.id),
        id: Date.now().toString(),
        title: parsed.title ?? `${requirement.title} — L1 Exam`,
        questions: parsed.questions ?? [],
        generatedAt: new Date().toISOString(),
    };

    await dbPut(EXAMS_TABLE, exam);
    return exam;
};

// ── Fetch (public — strip correct answers) ───────────────────────────────────

export const getExamByRequirement = async (requirementId) => {
    return dbGet(EXAMS_TABLE, { requirementId: String(requirementId) });
};

export const getExamPublic = async (requirementId) => {
    const exam = await dbGet(EXAMS_TABLE, { requirementId: String(requirementId) });
    if (!exam) return null;
    // Verification requirement and time limit are read live from system settings,
    // overridden per-job by the requirement's own examConfig when set (not baked in
    // at generation time) so admins/recruiters can retoggle without regenerating exams.
    const [{ examSettings }, requirement] = await Promise.all([
        getSystemSettings(),
        dbGet(REQUIREMENTS_TABLE, { id: String(requirementId) }),
    ]);
    const override = requirement?.examConfig ?? {};
    return {
        ...exam,
        questions: exam.questions.map(({ correctAnswer: _a, ...rest }) => rest),
        requireIdVerification: override.requireIdVerification ?? examSettings.requireIdVerification,
        timeLimitMinutes: override.timeLimitMinutes ?? examSettings.timeLimitMinutes,
    };
};

// ── Submit ────────────────────────────────────────────────────────────────────

export const submitExam = async ({ examId, candidateId, candidateName, answers, timeTaken }) => {
    // examId is the requirementId (PK of exams table)
    const exam = await dbGet(EXAMS_TABLE, { requirementId: examId });
    if (!exam) throw new Error('Exam not found');

    let correct = 0;
    for (const q of exam.questions) {
        if (answers[q.id] && answers[q.id] === q.correctAnswer) correct++;
    }
    const total = exam.questions.length;
    const score = Math.round((correct / total) * 100);

    const submission = {
        examId,
        candidateId: String(candidateId),
        requirementId: examId,
        candidateName,
        answers,
        correct,
        total,
        score,
        timeTaken,
        submittedAt: new Date().toISOString(),
    };

    await dbPut(SUBMISSIONS_TABLE, submission);
    return submission;
};

export const getSubmission = (examId, candidateId) => {
    return dbGet(SUBMISSIONS_TABLE, { examId, candidateId: String(candidateId) });
};
