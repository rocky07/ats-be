import { getMarketIntelligence } from '../services/marketIntelligence.js';
import { generateJobSummary, MissingApiKeyError } from '../services/aiSummary.js';
import { atsChatReply } from '../services/atsChat.js';
import { rankCandidates } from '../services/rankCandidates.js';

// POST /api/intelligence/market — live Dice market intelligence for a requirement.
export const marketIntelligence = async (req, res) => {
    try {
        const data = await getMarketIntelligence({
            jobTitle: req.body.title,
            coreSkills: req.body.mustHaves ?? [],
            location: req.body.location,
            workplaceType: req.body.workMode,
            employmentType: req.body.jobType,
        });
        res.json(data);
    } catch (error) {
        console.error('Market intelligence error:', error);
        res.status(502).json({ error: 'Failed to fetch market intelligence from Dice' });
    }
};

// POST /api/intelligence/rank — rank a list of candidates against a job requirement.
export const rankCandidatesHandler = async (req, res) => {
    try {
        const { candidates, requirement } = req.body;
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ error: 'candidates array is required' });
        }
        if (!requirement) {
            return res.status(400).json({ error: 'requirement is required' });
        }
        const results = await rankCandidates(candidates, requirement);
        res.json({ results });
    } catch (error) {
        if (error.message?.includes('ANTHROPIC_API_KEY')) {
            return res.status(503).json({ error: error.message });
        }
        console.error('Ranking error:', error);
        res.status(500).json({ error: 'Failed to rank candidates' });
    }
};

// POST /api/intelligence/chat — ATS assistant chat with live data context.
export const atsChat = async (req, res) => {
    try {
        const { history } = req.body;
        if (!Array.isArray(history) || history.length === 0) {
            return res.status(400).json({ error: 'history array is required' });
        }
        const reply = await atsChatReply(history);
        res.json({ reply });
    } catch (error) {
        if (error.message?.includes('ANTHROPIC_API_KEY')) {
            return res.status(503).json({ error: error.message });
        }
        console.error('ATS chat error:', error);
        res.status(500).json({ error: 'Failed to get chat response' });
    }
};

// POST /api/intelligence/job-summary — AI-generated job description.
export const jobSummary = async (req, res) => {
    try {
        const summary = await generateJobSummary(req.body);
        res.json({ summary });
    } catch (error) {
        if (error instanceof MissingApiKeyError) {
            return res.status(503).json({ error: error.message });
        }
        console.error('AI job summary error:', error);
        res.status(500).json({ error: 'Failed to generate job summary' });
    }
};
