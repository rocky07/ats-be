import * as requirementsService from '../services/requirements.js';

export const editRequirement = async (req, res) => {
    try {
        const updated = await requirementsService.updateRequirement(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Requirement not found' });
        res.json(updated);
    } catch (error) {
        console.error('Error updating requirement:', error);
        res.status(500).json({ error: 'Failed to update requirement' });
    }
};

export const getRequirements = async (req, res) => {
    try {
        const requirements = await requirementsService.fetchRequirements();
        res.json(requirements);
    } catch (error) {
        console.error('Error fetching requirements:', error);
        res.status(500).json({ error: 'Failed to retrieve requirements' });
    }
};

export const createRequirement = async (req, res) => {
    try {
        const requirement = await requirementsService.addRequirement(req.body);
        res.status(201).json(requirement);
    } catch (error) {
        console.error('Error creating requirement:', error);
        res.status(500).json({ error: 'Failed to create requirement' });
    }
};