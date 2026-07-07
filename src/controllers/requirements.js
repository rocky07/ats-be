import * as requirementsService from '../services/requirements.js';
import { getUserSettings } from '../services/settingsService.js';
import { postTextToLinkedIn, postJobToLinkedIn, FRONTEND_URL } from '../services/linkedinService.js';
import { sendJdShare } from '../services/emailService.js';
import { getVendors } from '../services/vendorService.js';
import { htmlToPlainText } from '../utils/htmlToPlainText.js';

const MAX_SHARE_RECIPIENTS = 20;

export const shareRequirement = async (req, res) => {
    try {
        const {
            channel = 'vendors',
            vendorEmails = [],
            includeJd = true,
            includeUploadLink = true,
            jdText,
            message = '',
        } = req.body;

        const requirement = await requirementsService.fetchRequirements().then((list) => list.find((r) => String(r.id) === String(req.params.id)));
        if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

        const applyUrl = `${FRONTEND_URL}/apply/${requirement.id}`;
        const resolvedJdText = includeJd ? (jdText ?? requirement.description) : '';

        if (channel === 'linkedin') {
            const settings = await getUserSettings(req.user?.id);
            const li = settings?.personalLinkedin;
            if (!li?.enabled || !li?.accessToken || !li?.linkedinUrn) {
                return res.status(400).json({ error: 'Connect your LinkedIn account in Settings before sharing to LinkedIn' });
            }
            if (li.tokenExpiry && Date.now() > li.tokenExpiry) {
                return res.status(400).json({ error: 'Your LinkedIn connection has expired. Please reconnect it in Settings' });
            }

            const text =
                `${message ? `${message}\n\n` : ''}` +
                `${htmlToPlainText(resolvedJdText)}` +
                `${includeUploadLink ? `\n\nApply here 👉 ${applyUrl}` : ''}`;

            const post = await postTextToLinkedIn({ accessToken: li.accessToken, linkedinUrn: li.linkedinUrn, text });
            return res.json({ sent: true, postId: post.id, applyUrl });
        }

        if (!Array.isArray(vendorEmails) || vendorEmails.length === 0) {
            return res.status(400).json({ error: 'Select at least one vendor to share with' });
        }
        if (vendorEmails.length > MAX_SHARE_RECIPIENTS) {
            return res.status(400).json({ error: `You can share with at most ${MAX_SHARE_RECIPIENTS} vendors at a time to avoid being flagged as spam` });
        }

        // Validate emails belong to known vendors to prevent arbitrary bulk emailing
        const vendors = await getVendors();
        const knownEmails = new Set(vendors.map((v) => v.email?.toLowerCase()).filter(Boolean));
        const invalid = vendorEmails.filter((e) => !knownEmails.has(String(e).toLowerCase()));
        if (invalid.length) {
            return res.status(400).json({ error: `Unknown vendor email(s): ${invalid.join(', ')}` });
        }

        const result = await sendJdShare({
            toEmails: vendorEmails,
            jobTitle: requirement.title,
            jdText: resolvedJdText,
            applyUrl,
            includeJd,
            includeUploadLink,
            message,
            senderName: req.user?.name,
        });

        res.json({ ...result, applyUrl });
    } catch (error) {
        console.error('Error sharing requirement:', error);
        res.status(500).json({ error: 'Failed to share requirement' });
    }
};

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
            const autoPostOnCreate = li?.autoPostOnCreate ?? true;
            if (li?.enabled && li?.accessToken && li?.linkedinUrn && autoPostOnCreate) {
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