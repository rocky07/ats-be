import { getMarketIntelligence } from '../services/marketIntelligence.js';
import { generateJobSummary, MissingApiKeyError } from '../services/aiSummary.js';

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
