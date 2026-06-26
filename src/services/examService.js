import Anthropic from '@anthropic-ai/sdk';
import db from '../config/db.js';

// ── Generation ────────────────────────────────────────────────────────────────

export const generateExam = async (requirement) => {
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
        `You are a senior technical recruiter. Generate exactly 20 multiple-choice questions to ` +
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

    // Persist to db
    const exam = {
        id: Date.now().toString(),
        requirementId: String(requirement.id),
        title: parsed.title ?? `${requirement.title} — L1 Exam`,
        questions: parsed.questions ?? [],
        generatedAt: new Date().toISOString(),
    };

    // Upsert: replace any existing exam for this requirement
    const idx = (db.data.exams ?? []).findIndex(
        (e) => String(e.requirementId) === String(requirement.id),
    );
    if (idx >= 0) {
        db.data.exams[idx] = exam;
    } else {
        db.data.exams.push(exam);
    }
    await db.write();
    return exam;
};

// ── Fetch (public — strip correct answers) ───────────────────────────────────

export const getExamPublic = (examId) => {
    const exam = (db.data.exams ?? []).find((e) => e.id === examId);
    if (!exam) return null;
    return {
        ...exam,
        questions: exam.questions.map(({ correctAnswer: _a, ...rest }) => rest),
    };
};

export const getExamByRequirement = (requirementId) => {
    return (db.data.exams ?? []).find(
        (e) => String(e.requirementId) === String(requirementId),
    ) ?? null;
};

// ── Submit ────────────────────────────────────────────────────────────────────

export const submitExam = async ({ examId, candidateId, candidateName, answers, timeTaken }) => {
    const exam = (db.data.exams ?? []).find((e) => e.id === examId);
    if (!exam) throw new Error('Exam not found');

    // Grade: compare submitted answers to correct answers
    let correct = 0;
    for (const q of exam.questions) {
        if (answers[q.id] && answers[q.id] === q.correctAnswer) correct++;
    }
    const total = exam.questions.length;
    const score = Math.round((correct / total) * 100);

    const submission = {
        id: Date.now().toString(),
        examId,
        requirementId: exam.requirementId,
        candidateId: String(candidateId),
        candidateName,
        answers,
        correct,
        total,
        score,
        timeTaken, // seconds
        submittedAt: new Date().toISOString(),
    };

    if (!db.data.examSubmissions) db.data.examSubmissions = [];
    // Upsert per candidate per exam
    const sidx = db.data.examSubmissions.findIndex(
        (s) => s.examId === examId && String(s.candidateId) === String(candidateId),
    );
    if (sidx >= 0) {
        db.data.examSubmissions[sidx] = submission;
    } else {
        db.data.examSubmissions.push(submission);
    }
    await db.write();
    return submission;
};

export const getSubmission = (examId, candidateId) => {
    return (db.data.examSubmissions ?? []).find(
        (s) => s.examId === examId && String(s.candidateId) === String(candidateId),
    ) ?? null;
};
