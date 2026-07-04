import { dbScan } from '../config/dynamodb.js';

const STAGE_LABELS = {
  ingested: 'Ingested',
  ranked:   'Ranked',
  l1:       'L1 Exam',
  l2:       'L2 Interview',
  l3:       'L3 Interview',
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getDashboardStats(region = 'global') {
  const [allCandidates, allRequirements, allPipelines, allInterviews] = await Promise.all([
    dbScan('BourntecATS-Candidates'),
    dbScan('BourntecATS-Requirements'),
    dbScan('BourntecATS-Pipelines'),
    dbScan('BourntecATS-Interviews'),
  ]);

  const requirements = region === 'global'
    ? allRequirements
    : allRequirements.filter((r) => (r.regions ?? []).includes(region));

  const reqIds = new Set(requirements.map((r) => String(r.id)));

  const pipelines = region === 'global'
    ? allPipelines
    : allPipelines.filter((p) => reqIds.has(String(p.requirementId)));

  // Candidates/interviews are scoped to the requirements' pipelines (candidates
  // don't carry a region of their own, so we derive scope from which pipeline
  // stage lists they appear in).
  const candidateIdsInScope = new Set();
  for (const p of pipelines) {
    for (const key of Object.keys(STAGE_LABELS)) {
      for (const item of p.stages?.[key] ?? []) {
        candidateIdsInScope.add(String(item.id ?? item.candidateId ?? item));
      }
    }
  }

  const candidates = region === 'global'
    ? allCandidates
    : allCandidates.filter((c) => candidateIdsInScope.has(String(c.id)));

  const interviews = region === 'global'
    ? allInterviews
    : allInterviews.filter((i) => candidateIdsInScope.has(String(i.candidateId)));

  const now     = Date.now();
  const weekAgo = now - WEEK_MS;

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalCandidatesThisWeek = candidates.filter((c) => {
    const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return t >= weekAgo;
  }).length;

  const activeOpenings = requirements.filter((r) => (r.status ?? 'open') === 'open').length;

  let totalIngested = 0, totalL1 = 0, totalL2 = 0, totalL3 = 0;
  for (const p of pipelines) {
    const s = p.stages ?? {};
    totalIngested += (s.ingested ?? []).length;
    totalL1       += (s.l1        ?? []).length;
    totalL2       += (s.l2        ?? []).length;
    totalL3       += (s.l3        ?? []).length;
  }

  const offerAcceptRate = totalL3 > 0 && totalL2 > 0
    ? Math.round((totalL3 / totalL2) * 100)
    : 0;

  const screeningPassRate = totalIngested > 0
    ? Math.round((totalL1 / totalIngested) * 100)
    : 0;

  // ── Sourcing mix ──────────────────────────────────────────────────────────

  const sourceCounts = {};
  for (const c of candidates) {
    const src = c.source ?? 'Manual';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const sourcingData = Object.entries(sourceCounts).map(([type, value]) => ({ type, value }));

  // ── Recruitment funnel ────────────────────────────────────────────────────

  const stageTotals = { ingested: 0, ranked: 0, l1: 0, l2: 0, l3: 0 };
  for (const p of pipelines) {
    for (const key of Object.keys(stageTotals)) {
      stageTotals[key] += (p.stages?.[key] ?? []).length;
    }
  }
  const funnelData = Object.entries(stageTotals).map(([key, count]) => ({
    stage: STAGE_LABELS[key],
    count,
  }));

  // ── Source quality matrix ─────────────────────────────────────────────────

  const sourceMap = {};
  for (const c of candidates) sourceMap[String(c.id)] = c.source ?? 'Manual';

  const stageSourceCounts = {};
  for (const p of pipelines) {
    for (const [key, label] of Object.entries(STAGE_LABELS)) {
      const ids = p.stages?.[key] ?? [];
      for (const item of ids) {
        const cid = String(item.id ?? item.candidateId ?? item);
        const src = sourceMap[cid] ?? 'Manual';
        const k   = `${label}__${src}`;
        stageSourceCounts[k] = (stageSourceCounts[k] ?? 0) + 1;
      }
    }
  }
  const qualityData = Object.entries(stageSourceCounts).map(([key, value]) => {
    const [stage, source] = key.split('__');
    return { stage, source, value };
  });

  // ── Recent activity ───────────────────────────────────────────────────────

  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 5)
    .map((c) => ({
      type:   'candidate',
      label:  c.source ?? 'Upload',
      name:   c.name,
      detail: c.appliedFor ?? '',
      ts:     c.createdAt ?? null,
    }));

  const recentInterviews = [...interviews]
    .sort((a, b) => new Date(b.scheduledAt ?? 0) - new Date(a.scheduledAt ?? 0))
    .slice(0, 5)
    .map((i) => ({
      type:   'interview',
      label:  'Interview Scheduled',
      name:   i.candidateName ?? '',
      detail: i.jobTitle ?? '',
      ts:     i.scheduledAt ?? null,
    }));

  const recentActivity = [...recentCandidates, ...recentInterviews]
    .sort((a, b) => new Date(b.ts ?? 0) - new Date(a.ts ?? 0))
    .slice(0, 8);

  return {
    kpis: { totalCandidatesThisWeek, activeOpenings, offerAcceptRate, screeningPassRate },
    sourcingData,
    funnelData,
    qualityData,
    recentActivity,
  };
}
