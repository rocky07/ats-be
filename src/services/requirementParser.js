import Anthropic from '@anthropic-ai/sdk';
import { MissingApiKeyError } from './aiSummary.js';

const REGION_VALUES = ['global', 'india', 'middleeast', 'us'];

const TOOL_SCHEMA = {
    name: 'extract_requirement',
    description: 'Extract structured job requirement fields from pasted free-text.',
    input_schema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Job title, e.g. "Sr. Node.js Developer"' },
            department: { type: 'string', description: 'Department/practice area if mentioned, else best guess (e.g. Engineering)' },
            mustHaves: { type: 'array', items: { type: 'string' }, description: 'Required/must-have core skills' },
            niceToHaves: { type: 'array', items: { type: 'string' }, description: 'Nice-to-have / secondary skills, tools, infra' },
            location: { type: 'string', description: 'City/state or location text, e.g. "Reston, VA"' },
            workMode: { type: 'string', enum: ['Onsite', 'Hybrid', 'Remote'] },
            regions: { type: 'array', items: { type: 'string', enum: REGION_VALUES }, description: 'Applicable hiring regions' },
            jobType: { type: 'string', enum: ['Full-time', 'W2', 'C2C'] },
            salaryMin: { type: 'number', description: 'Annual salary minimum, USD, omit if not annual salary' },
            salaryMax: { type: 'number', description: 'Annual salary maximum, USD, omit if not annual salary' },
            hourlyRateMin: { type: 'number', description: 'Hourly rate minimum, USD, only for W2/C2C contract roles' },
            hourlyRateMax: { type: 'number', description: 'Hourly rate maximum, USD, only for W2/C2C contract roles' },
            description: {
                type: 'string',
                description:
                    'A polished job description summary as HTML (use <p>, <ul>/<li>, <strong> tags only, ' +
                    'no headings, no <html>/<body> wrapper) synthesized from the pasted text.',
            },
        },
        required: ['title'],
    },
};

// Parse a free-text pasted job requirement into structured form fields via Claude.
export const parseRequirementText = async (rawText) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new MissingApiKeyError();
    if (!rawText?.trim()) throw new Error('No text provided to parse');

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2000,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: 'extract_requirement' },
        system:
            'You are an expert technical recruiter. Extract structured job requirement fields from ' +
            'the pasted requirement text. Only include fields you can confidently infer; omit ones ' +
            'that are not present rather than guessing wildly. Also produce a clean HTML job ' +
            'description summary field.',
        messages: [
            { role: 'user', content: `Extract the requirement fields from this pasted text:\n\n${rawText}` },
        ],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse) throw new Error('Failed to parse requirement text');

    return toolUse.input;
};
