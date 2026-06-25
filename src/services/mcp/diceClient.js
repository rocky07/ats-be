// Reusable client for the Dice MCP server (job-market search).
// Refactored from the standalone mcp.js demo into a callable module.
const DICE_MCP_URL = 'https://mcp.dice.com/mcp';

// Map the app's work-mode values to Dice MCP workplace_types.
const WORKPLACE_MAP = {
    Onsite: 'On-Site',
    Hybrid: 'Hybrid',
    Remote: 'Remote',
};

// Map the app's job-type values to Dice MCP employment_types.
const EMPLOYMENT_MAP = {
    'Full-time': 'FULLTIME',
    W2: 'CONTRACTS', // W2 contract roles
    C2C: 'CONTRACTS',
};

async function mcpPost(id, method, params) {
    const res = await fetch(DICE_MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });

    const text = await res.text();
    // Responses come back as SSE-formatted text ("event: message\ndata: {...}").
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine) throw new Error(`No data in Dice MCP response: ${text.slice(0, 200)}`);
    return JSON.parse(dataLine.slice(5).trim());
}

// Search Dice for jobs matching the given criteria.
// Returns { jobs: [...], meta: {...} } parsed from the MCP tool response.
export const searchJobs = async ({
    jobTitle = '',
    coreSkills = [],
    location = '',
    radius = 25,
    workplaceType,
    employmentType,
    page = 1,
    perPage = 25,
} = {}) => {
    // 1. Initialize an MCP session.
    await mcpPost(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ats-market-intelligence', version: '1.0.0' },
    });

    // 2. Build search arguments, omitting empty filters.
    const args = {
        keyword: [jobTitle, ...coreSkills].filter(Boolean).join(' ').trim() || 'Software Engineer',
        jobs_per_page: perPage,
        page_number: page,
    };
    if (location) {
        args.location = location;
        args.radius = radius;
        args.radius_unit = 'mi';
    }
    if (workplaceType && WORKPLACE_MAP[workplaceType]) {
        args.workplace_types = [WORKPLACE_MAP[workplaceType]];
    }
    if (employmentType && EMPLOYMENT_MAP[employmentType]) {
        args.employment_types = [EMPLOYMENT_MAP[employmentType]];
    }

    // 3. Call the search_jobs tool.
    const searchResult = await mcpPost(2, 'tools/call', {
        name: 'search_jobs',
        arguments: args,
    });

    if (searchResult.error) {
        throw new Error(`Dice search error: ${JSON.stringify(searchResult.error)}`);
    }

    const content = searchResult.result?.content?.[0]?.text;
    if (!content) return { jobs: [], meta: {} };

    const parsed = JSON.parse(content);
    return { jobs: parsed.data ?? [], meta: parsed.meta ?? {} };
};
