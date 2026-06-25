import Anthropic from '@anthropic-ai/sdk';

// Thrown when the backend has no Anthropic API key configured.
export class MissingApiKeyError extends Error {
    constructor() {
        super('ANTHROPIC_API_KEY is not configured on the server');
        this.name = 'MissingApiKeyError';
    }
}

// Compose the requirement details into a readable brief for the model.
const buildDetails = (form = {}) => {
    const lines = [];
    if (form.title) lines.push(`Title: ${form.title}`);
    if (form.department) lines.push(`Department: ${form.department}`);
    if (form.location) lines.push(`Location: ${form.location}`);
    if (form.workMode) lines.push(`Work mode: ${form.workMode}`);
    if (form.jobType) lines.push(`Employment type: ${form.jobType}`);
    if (form.salaryMin || form.salaryMax) {
        lines.push(`Salary range: ${form.salaryMin ?? '?'} – ${form.salaryMax ?? '?'} per year`);
    }
    if (form.hourlyRateMin || form.hourlyRateMax) {
        lines.push(`Hourly rate: $${form.hourlyRateMin ?? '?'} – $${form.hourlyRateMax ?? '?'}/hr`);
    }
    if (form.mustHaves?.length) lines.push(`Must-have skills: ${form.mustHaves.join(', ')}`);
    if (form.niceToHaves?.length) lines.push(`Nice-to-have skills: ${form.niceToHaves.join(', ')}`);
    return lines.join('\n');
};

// Generate a polished job-description summary from the collected form fields.
export const generateJobSummary = async (form) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new MissingApiKeyError();

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2000,
        thinking: { type: 'adaptive' },
        system:
            'You are an expert technical recruiter. Write a concise, compelling job ' +
            'description summary (2-3 short paragraphs, no headings or bullet lists) from the ' +
            'structured requirement details provided. Naturally weave in the location, work mode, ' +
            'employment type, compensation, and the core technical stack. Write in the second ' +
            'person ("you will..."). Return only the description text, with no preamble.',
        messages: [
            {
                role: 'user',
                content: `Write the job description summary for this requirement:\n\n${buildDetails(form)}`,
            },
        ],
    });

    const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

    return text;
};
