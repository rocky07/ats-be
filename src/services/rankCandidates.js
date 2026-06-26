import Anthropic from '@anthropic-ai/sdk';

// Ask Claude to score each candidate (0-100) against the job requirement.
export const rankCandidates = async (candidates, requirement) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server');

    const client = new Anthropic({ apiKey });

    const reqSummary = [
        `Title: ${requirement.title}`,
        requirement.department ? `Department: ${requirement.department}` : '',
        requirement.location ? `Location: ${requirement.location}` : '',
        requirement.workMode ? `Work mode: ${requirement.workMode}` : '',
        requirement.jobType ? `Job type: ${requirement.jobType}` : '',
        (requirement.mustHaves ?? []).length
            ? `Must-have skills: ${requirement.mustHaves.join(', ')}`
            : '',
        (requirement.niceToHaves ?? []).length
            ? `Nice-to-have skills: ${requirement.niceToHaves.join(', ')}`
            : '',
        requirement.description ? `Description: ${requirement.description}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const candSummary = candidates
        .map(
            (c, i) =>
                `Candidate ${i + 1} [id:${c.id}]: ${c.name} | Skills: ${(c.skills ?? []).join(', ')}`,
        )
        .join('\n');

    const prompt =
        `You are a technical recruiter. Score each candidate below (0–100) based on how well ` +
        `they match the job requirement. Return ONLY a valid JSON array — no prose, no markdown — ` +
        `where each element has: id (string), score (integer 0-100), summary (one sentence reason).\n\n` +
        `JOB REQUIREMENT:\n${reqSummary}\n\nCANDIDATES:\n${candSummary}`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.find((b) => b.type === 'text')?.text ?? '[]';

    // Strip any accidental markdown fences before parsing
    const json = raw.replace(/```(?:json)?/g, '').trim();
    return JSON.parse(json);
};
