import { dbGet, dbPut, dbDelete, dbScan } from '../config/dynamodb.js';
import { parseResume } from './resumeParser.js';
import { uploadResume as uploadToS3, getResumeBuffer } from './s3Service.js';

const EXT_MIME = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const TABLE = 'BourntecATS-Candidates';

export const fetchCandidates = () => dbScan(TABLE);

export const fetchCandidate = (id) => dbGet(TABLE, { id });

export const addCandidate = async (candidate) => {
    const newCandidate = {
        id: Date.now().toString(),
        name: candidate.name || 'Unknown Candidate',
        email: candidate.email || '',
        phone: candidate.phone || '',
        source: candidate.source || 'Manual',
        skills: candidate.skills || [],
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        ...candidate,
    };
    await dbPut(TABLE, newCandidate);
    return newCandidate;
};

export const deleteCandidate = async (id) => {
    const existing = await dbGet(TABLE, { id });
    if (!existing) return null;
    await dbDelete(TABLE, { id });
    return existing;
};

export class DuplicateCandidateError extends Error {
    constructor(candidate) {
        super('Candidate already exists with the same skill set');
        this.name = 'DuplicateCandidateError';
        this.candidate = candidate;
    }
}

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const normalizePhone = (phone = '') => phone.replace(/\D/g, '');
const normalizeSkills = (skills = []) =>
    [...new Set(skills.map((s) => s.trim().toLowerCase()))].sort();

const sameSkills = (a, b) => {
    const sa = normalizeSkills(a);
    const sb = normalizeSkills(b);
    return sa.length === sb.length && sa.every((s, i) => s === sb[i]);
};

export const addCandidateFromResume = async (file, useAI = false) => {
    const parsed = await parseResume(file.buffer, file.mimetype, file.originalname, useAI);

    const email = normalizeEmail(parsed.email);
    const phone = normalizePhone(parsed.phone);

    let existing = null;
    if (email && phone) {
        const all = await dbScan(TABLE);
        existing = all.find(
            (c) => normalizeEmail(c.email) === email && normalizePhone(c.phone) === phone,
        ) ?? null;
    }

    if (existing) {
        if (sameSkills(existing.skills, parsed.skills)) {
            throw new DuplicateCandidateError(existing);
        }
        existing.name = parsed.name || existing.name;
        existing.skills = parsed.skills;
        existing.resumeFile = file.originalname;
        existing.source = 'Upload';
        existing.date = new Date().toISOString().slice(0, 10);
        existing.aiParsed = useAI;
        try {
            existing.resumeS3Key = await uploadToS3(existing.id, file.buffer, file.mimetype, file.originalname);
        } catch (e) {
            console.error('S3 upload failed (non-fatal):', e.message);
        }
        await dbPut(TABLE, existing);
        return existing;
    }

    const candidateId = Date.now().toString();
    let resumeS3Key;
    try {
        resumeS3Key = await uploadToS3(candidateId, file.buffer, file.mimetype, file.originalname);
    } catch (e) {
        console.error('S3 upload failed (non-fatal):', e.message);
    }

    return addCandidate({
        id: candidateId,
        ...parsed,
        source: 'Upload',
        resumeFile: file.originalname,
        ...(resumeS3Key ? { resumeS3Key } : {}),
        aiParsed: useAI,
    });
};

export class NoResumeOnFileError extends Error {
    constructor() {
        super('No resume on file for this candidate');
        this.name = 'NoResumeOnFileError';
    }
}

// Re-parse a candidate's already-uploaded resume with Claude and merge the results in.
export const reparseCandidateWithAI = async (id) => {
    const candidate = await dbGet(TABLE, { id });
    if (!candidate) return null;
    if (!candidate.resumeS3Key) throw new NoResumeOnFileError();

    const buffer = await getResumeBuffer(candidate.resumeS3Key);
    const ext = candidate.resumeFile?.split('.').pop()?.toLowerCase();
    const mimetype = EXT_MIME[ext] ?? '';
    const parsed = await parseResume(buffer, mimetype, candidate.resumeFile ?? '', true);

    const updated = {
        ...candidate,
        ...parsed,
        name: parsed.name || candidate.name,
        email: parsed.email || candidate.email,
        phone: parsed.phone || candidate.phone,
        aiParsed: true,
        aiParsedAt: new Date().toISOString(),
    };
    await dbPut(TABLE, updated);
    return updated;
};
