import db from '../config/db.js';

// The fixed set of pipeline stages, in order.
export const STAGE_KEYS = ['ingested', 'ranked', 'l1', 'l2', 'l3'];

const emptyStages = () =>
    STAGE_KEYS.reduce((acc, key) => ({ ...acc, [key]: [] }), {});

// Ensure a stages object always has every known stage as an array.
const normalizeStages = (stages = {}) => {
    const normalized = emptyStages();
    for (const key of STAGE_KEYS) {
        if (Array.isArray(stages[key])) normalized[key] = stages[key];
    }
    return normalized;
};

// Return the persisted stages for a requirement (empty stages if none stored).
export const getPipeline = (requirementId) => {
    const entry = db.data.pipelines.find(
        (p) => String(p.requirementId) === String(requirementId),
    );
    return entry ? entry.stages : emptyStages();
};

// Replace the stored stages for a requirement (upsert).
export const savePipeline = async (requirementId, stages) => {
    const normalized = normalizeStages(stages);
    const entry = db.data.pipelines.find(
        (p) => String(p.requirementId) === String(requirementId),
    );
    if (entry) {
        entry.stages = normalized;
    } else {
        db.data.pipelines.push({ requirementId: String(requirementId), stages: normalized });
    }
    await db.write();
    return normalized;
};
