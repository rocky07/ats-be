const DICE_MCP_URL = "https://mcp.dice.com/mcp";

const searchCriteria = {
    jobTitle: "Senior Software Engineer",
    coreSkills: ["Java 21", "Spring Boot", "AWS Lambda"],
    goodToHave: ["Node.js", "React.js", "LLM integration"],
    location: "Reston, VA",
    radius: 25,
    workplaceType: "Hybrid"
};

async function mcpPost(id, method, params) {
    const res = await fetch(DICE_MCP_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
    });

    const text = await res.text();

    // Response comes back as SSE-formatted text: "event: message\ndata: {...}"
    // Extract just the JSON from the data line
    const dataLine = text.split("\n").find(line => line.startsWith("data:"));
    if (!dataLine) throw new Error(`No data in response: ${text}`);
    return JSON.parse(dataLine.slice(5).trim());
}

async function runDiceSearch() {
    // 1. Initialize
    console.log("Initializing MCP session...");
    const initResult = await mcpPost(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "custom-job-search-agent", version: "1.0.0" }
    });
    console.log("Server:", initResult.result.serverInfo.name, initResult.result.serverInfo.version);

    // 2. Call search_jobs
    console.log("\nSearching for jobs...\n");
    const searchResult = await mcpPost(2, "tools/call", {
        name: "search_jobs",
        arguments: {
            keyword: `${searchCriteria.jobTitle} ${searchCriteria.coreSkills.join(" ")}`,
            location: searchCriteria.location,
            radius: searchCriteria.radius,
            radius_unit: "mi",
            workplace_types: [searchCriteria.workplaceType],
            employment_types: ["FULLTIME"],
            jobs_per_page: 10,
            page_number: 1,
        }
    });

    if (searchResult.error) {
        console.error("Search error:", searchResult.error);
        return;
    }

    // 3. Parse and display results
    const content = searchResult.result?.content?.[0]?.text;
    if (!content) {
        console.log("No results returned.");
        return;
    }

    const parsed = JSON.parse(content);
    const jobs = parsed.data ?? [];
    const meta = parsed.meta ?? {};

    console.log(`Found ${meta.totalResults ?? 0} total jobs (showing ${jobs.length}):\n`);
    console.log("NOTE: These job listings were found using AI-powered search. Please review all job details carefully and verify information directly with employers before applying.\n");
    console.log("=".repeat(80));

    jobs.forEach((job, i) => {
        console.log(`\n[${i + 1}] ${job.title ?? "N/A"}`);
        console.log(`    Company:    ${job.companyName ?? "N/A"}`);
        console.log(`    Location:   ${job.jobLocation?.displayName ?? "N/A"}`);
        console.log(`    Type:       ${job.employmentType ?? "N/A"} | ${job.workplaceTypes?.join(", ") ?? "N/A"}`);
        console.log(`    Salary:     ${job.salary ?? "Not listed"}`);
        console.log(`    Posted:     ${job.postedDate ? new Date(job.postedDate).toLocaleDateString() : "N/A"}`);
        console.log(`    Easy Apply: ${job.easyApply ? "Yes" : "No"}`);
        console.log(`    Job URL:    ${job.detailsPageUrl ?? "N/A"}`);
        console.log(`    Company:    ${job.companyPageUrl ?? "N/A"}`);
        if (job.summary) {
            console.log(`    Summary:    ${job.summary.slice(0, 1000)}...`);
        }
        console.log("-".repeat(80));
    });

    if (meta.pageCount > 1) {
        console.log(`\nPage 1 of ${meta.pageCount}. Re-run with page_number: 2, 3... for more results.`);
    }
}

runDiceSearch().catch(console.error);