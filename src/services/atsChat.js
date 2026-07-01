import Anthropic from '@anthropic-ai/sdk';
import { dbScan } from '../config/dynamodb.js';
import { STAGE_KEYS, getPipeline } from './pipelines.js';

const STAGE_LABELS = {
  ingested: 'Ingested',
  ranked: 'Ranked',
  l1: 'L1 (Exam)',
  l2: 'L2 (Recruiter)',
  l3: 'L3 (Final)',
};

const buildContext = async () => {
  const [requirements, candidates, pipelines] = await Promise.all([
    dbScan('BourntecATS-Requirements'),
    dbScan('BourntecATS-Candidates'),
    dbScan('BourntecATS-Pipelines'),
  ]);

  const reqLines = await Promise.all(
    requirements.map(async (r) => {
      const stages = await getPipeline(r.id);
      const stageSummary = STAGE_KEYS.map(
        (k) => `${STAGE_LABELS[k]}: ${(stages[k] ?? []).length}`
      ).join(', ');
      return (
        `- [${r.id}] ${r.title} | ${r.department ?? ''} | ${r.location ?? ''} | ` +
        `${r.workMode ?? ''} | ${r.jobType ?? ''} | Status: ${r.status ?? 'open'} | ` +
        `Must-haves: ${(r.mustHaves ?? []).join(', ')} | ` +
        `Pipeline: ${stageSummary}`
      );
    }),
  );

  const candLines = candidates.map((c) =>
    `- [${c.id}] ${c.name} | ${c.email ?? ''} | Skills: ${(c.skills ?? []).join(', ')}`
  );

  return [
    '=== JOB REQUIREMENTS ===',
    reqLines.length ? reqLines.join('\n') : 'None.',
    '',
    '=== CANDIDATES ===',
    candLines.length ? candLines.join('\n') : 'None.',
    '',
    `Totals: ${requirements.length} requirements, ${candidates.length} candidates, ${pipelines.length} active pipelines.`,
  ].join('\n');
};

export const atsChatReply = async (history) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server');

  const client = new Anthropic({ apiKey });
  const context = await buildContext();

  const system =
    'You are an ATS (Applicant Tracking System) assistant embedded in Bourntec ATS. ' +
    'You have access to live recruitment data below. Answer questions about candidates, ' +
    'job requirements, pipeline stages, and hiring status. Be concise and actionable. ' +
    'When listing items, use short bullet points.\n\n' +
    'LIVE DATA (as of this request):\n' +
    context;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages: history,
  });

  return (
    response.content.find((b) => b.type === 'text')?.text ??
    "Sorry, I couldn't generate a response."
  );
};
