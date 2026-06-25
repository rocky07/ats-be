import db from '../config/db.js';
import { parseResume } from './resumeParser.js';

export const fetchCandidates = () => {
    return db.data.candidates;
};

export const fetchCandidate = (id) => {
    return db.data.candidates.find((c) => c.id === id);
};

export const addCandidate = async (candidate) => {
    const newCandidate = {
        id: Date.now().toString(),
        name: candidate.name || 'Unknown Candidate',
        email: candidate.email || '',
        phone: candidate.phone || '',
        source: candidate.source || 'Manual',
        skills: candidate.skills || [],
        date: new Date().toISOString().slice(0, 10),
        ...candidate,
    };
    db.data.candidates.push(newCandidate);
    await db.write();
    return newCandidate;
};

export const deleteCandidate = async (id) => {
    const index = db.data.candidates.findIndex((c) => c.id === id);
    if (index === -1) return null;
    const [removed] = db.data.candidates.splice(index, 1);
    await db.write();
    return removed;
};

// Thrown when an uploaded resume duplicates an existing candidate with no new skills.
export class DuplicateCandidateError extends Error {
    constructor(candidate) {
        super('Candidate already exists with the same skill set');
        this.name = 'DuplicateCandidateError';
        this.candidate = candidate;
    }
}

// Normalize values so trivial formatting differences don't break matching.
const normalizeEmail = (email = '') => email.trim().toLowerCase();
const normalizePhone = (phone = '') => phone.replace(/\D/g, ''); // digits only
const normalizeSkills = (skills = []) =>
    [...new Set(skills.map((s) => s.trim().toLowerCase()))].sort();

// True when the two skill arrays contain exactly the same skills.
const sameSkills = (a, b) => {
    const sa = normalizeSkills(a);
    const sb = normalizeSkills(b);
    return sa.length === sb.length && sa.every((s, i) => s === sb[i]);
};

// Parse an uploaded resume file and persist it as a candidate.
// If a candidate with the same email AND phone already exists, override it when
// the skill set has changed; otherwise reject the upload as a duplicate.
export const addCandidateFromResume = async (file) => {
    const parsed = await parseResume(file.buffer, file.mimetype, file.originalname);

    const email = normalizeEmail(parsed.email);
    const phone = normalizePhone(parsed.phone);

    // Only attempt matching when we have both identifiers to match on.
    const existing = email && phone
        ? db.data.candidates.find(
            (c) => normalizeEmail(c.email) === email && normalizePhone(c.phone) === phone,
        )
        : null;

    if (existing) {
        if (sameSkills(existing.skills, parsed.skills)) {
            // Same person, same skills — nothing new to record.
            throw new DuplicateCandidateError(existing);
        }
        // Same person, updated skills — override the existing record in place.
        existing.name = parsed.name || existing.name;
        existing.skills = parsed.skills;
        existing.resumeFile = file.originalname;
        existing.source = 'Upload';
        existing.date = new Date().toISOString().slice(0, 10);
        await db.write();
        return existing;
    }

    return addCandidate({
        ...parsed,
        source: 'Upload',
        resumeFile: file.originalname,
    });
};
