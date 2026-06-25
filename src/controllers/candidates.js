import * as candidatesService from '../services/candidates.js';
import { DuplicateCandidateError } from '../services/candidates.js';

export const getCandidates = async (req, res) => {
    try {
        const candidates = await candidatesService.fetchCandidates();
        res.json(candidates);
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ error: 'Failed to retrieve candidates' });
    }
};

export const getCandidate = async (req, res) => {
    try {
        const candidate = await candidatesService.fetchCandidate(req.params.id);
        if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        console.error('Error fetching candidate:', error);
        res.status(500).json({ error: 'Failed to retrieve candidate' });
    }
};

export const createCandidate = async (req, res) => {
    try {
        const candidate = await candidatesService.addCandidate(req.body);
        res.status(201).json(candidate);
    } catch (error) {
        console.error('Error creating candidate:', error);
        res.status(500).json({ error: 'Failed to create candidate' });
    }
};

export const uploadResume = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No resume file uploaded' });
        const candidate = await candidatesService.addCandidateFromResume(req.file);
        res.status(201).json(candidate);
    } catch (error) {
        if (error instanceof DuplicateCandidateError) {
            return res.status(409).json({ error: error.message, candidate: error.candidate });
        }
        console.error('Error parsing resume:', error);
        res.status(500).json({ error: 'Failed to parse resume' });
    }
};

export const removeCandidate = async (req, res) => {
    try {
        const removed = await candidatesService.deleteCandidate(req.params.id);
        if (!removed) return res.status(404).json({ error: 'Candidate not found' });
        res.json(removed);
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({ error: 'Failed to delete candidate' });
    }
};
