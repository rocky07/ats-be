import { dbGet, dbPut, dbDelete, dbScan } from '../config/dynamodb.js';
import { parseResume } from './resumeParser.js';
import { uploadResume as uploadToS3 } from './s3Service.js';

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
    });
};
