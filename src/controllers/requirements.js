import * as requirementsService from '../services/requirements.js';
import { getUserSettings } from '../services/settingsService.js';
import { postJobToLinkedIn, FRONTEND_URL } from '../services/linkedinService.js';

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

        // Fire-and-forget: post to LinkedIn if the creating user has a connected account
        if (req.user?.id) {
            const settings = await getUserSettings(req.user.id);
            const li = settings?.personalLinkedin;
            if (li?.enabled && li?.accessToken && li?.linkedinUrn) {
                const tokenExpired = li.tokenExpiry && Date.now() > li.tokenExpiry;
                if (!tokenExpired) {
                    const applyUrl = `${FRONTEND_URL}/apply/${requirement.id}`;
                    postJobToLinkedIn({
                        accessToken: li.accessToken,
                        linkedinUrn: li.linkedinUrn,
                        requirement,
                        applyUrl,
                    }).then((post) => {
                        console.log(`LinkedIn post created: ${post.id} for requirement ${requirement.id}`);
                    }).catch((err) => {
                        console.error('LinkedIn auto-post failed:', err.message);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error creating requirement:', error);
        res.status(500).json({ error: 'Failed to create requirement' });
    }
};