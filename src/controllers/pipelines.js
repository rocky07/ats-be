import * as pipelinesService from '../services/pipelines.js';

export const getPipeline = async (req, res) => {
    try {
        const stages = await pipelinesService.getPipeline(req.params.requirementId);
        res.json(stages);
    } catch (error) {
        console.error('Error fetching pipeline:', error);
        res.status(500).json({ error: 'Failed to retrieve pipeline' });
    }
};

export const savePipeline = async (req, res) => {
    try {
        const stages = await pipelinesService.savePipeline(
            req.params.requirementId,
            req.body.stages ?? req.body,
        );
        res.json(stages);
    } catch (error) {
        console.error('Error saving pipeline:', error);
        res.status(500).json({ error: 'Failed to save pipeline' });
    }
};
