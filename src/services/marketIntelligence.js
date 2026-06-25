import { searchJobs } from './mcp/diceClient.js';

// Skills we look for in job descriptions to surface market demand / gaps.
const SKILL_VOCAB = [
    'AWS', 'Azure', 'GCP', 'Kafka', 'Docker', 'Kubernetes', 'Terraform',
    'React', 'Angular', 'Vue', 'Node.js', 'Java', 'Spring', 'Python',
    'Go', 'Rust', 'GraphQL', 'PostgreSQL', 'MongoDB', 'Redis', 'CI/CD',
    'TypeScript', 'AWS Bedrock', 'LLM', 'Machine Learning', 'TensorFlow',
];

// Pull a representative dollar figure out of Dice's free-text salary string.
const parseSalary = (salary) => {
    if (!salary || typeof salary !== 'string') return null;
    // Capture numbers like 150,000 or 75 (with optional k), take the average of a range.
    const nums = [];
    const re = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi;
    let m;
    while ((m = re.exec(salary))) {
        let val = parseFloat(m[1].replace(/,/g, ''));
        if (m[2]) val *= 1000; // "k" suffix
        // Heuristic: treat small values as hourly (skip for annual median).
        if (val >= 1000) nums.push(val);
    }
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const median = (arr) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

// Build the four-widget market-intelligence payload the form renders.
export const getMarketIntelligence = async (criteria) => {
    const { jobs, meta } = await searchJobs(criteria);

    const totalResults = meta.totalResults ?? jobs.length;

    // --- Supply Index: how crowded the market is ---
    const supplyLevel =
        totalResults > 1000 ? 'High Competition' : totalResults > 300 ? 'Moderate Competition' : 'Low Competition';
    const supplyStatus = totalResults > 1000 ? 'error' : totalResults > 300 ? 'warning' : 'success';

    // --- Velocity Index: share of remote/hybrid postings ---
    const flexible = jobs.filter((j) =>
        (j.workplaceTypes ?? []).some((t) => /remote|hybrid/i.test(t)),
    ).length;
    const remotePct = jobs.length ? Math.round((flexible / jobs.length) * 100) : 0;

    // --- Salary Benchmark: median of parsed annual salaries ---
    const salaries = jobs.map((j) => parseSalary(j.salary)).filter((v) => v != null);
    const marketMedian = median(salaries) || 0;

    // --- Gaps Index: skills trending in postings vs the requirement's stack ---
    const requiredSkills = new Set((criteria.coreSkills ?? []).map((s) => s.toLowerCase()));
    const corpus = jobs
        .map((j) => `${j.title ?? ''} ${j.summary ?? ''}`)
        .join(' ')
        .toLowerCase();

    const skillCounts = SKILL_VOCAB.map((skill) => {
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = corpus.match(new RegExp(escaped.toLowerCase(), 'g'));
        return { skill, count: matches ? matches.length : 0 };
    }).filter((s) => s.count > 0);

    // Required skills that actually appear in the market → match strength.
    const matchedRequired = [...requiredSkills].filter((s) =>
        SKILL_VOCAB.some((v) => v.toLowerCase() === s && corpus.includes(s)),
    ).length;
    const matchPct = requiredSkills.size
        ? Math.round((matchedRequired / requiredSkills.size) * 100)
        : 0;

    // Top in-demand skills the requirement does NOT list → trending/missing.
    const trending = skillCounts
        .filter((s) => !requiredSkills.has(s.skill.toLowerCase()))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((s) => [s.skill, s.count]);

    return {
        supply: { count: totalResults, level: supplyLevel, status: supplyStatus },
        velocity: { remotePct, impact: Math.max(0, 100 - remotePct) },
        salary: { marketMedian, targetPercentile: 55 },
        gaps: { matchPct, trending },
        sampleSize: jobs.length,
    };
};
