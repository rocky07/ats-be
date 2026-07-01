import { dbGet, dbPut } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Pipelines';

export const STAGE_KEYS = ['ingested', 'ranked', 'l1', 'l2', 'l3'];

const emptyStages = () =>
    STAGE_KEYS.reduce((acc, key) => ({ ...acc, [key]: [] }), {});

const normalizeStages = (stages = {}) => {
    const normalized = emptyStages();
    for (const key of STAGE_KEYS) {
        if (Array.isArray(stages[key])) normalized[key] = stages[key];
    }
    return normalized;
};

export const getPipeline = async (requirementId) => {
    const entry = await dbGet(TABLE, { requirementId: String(requirementId) });
    return entry ? entry.stages : emptyStages();
};

export const savePipeline = async (requirementId, stages) => {
    const normalized = normalizeStages(stages);
    await dbPut(TABLE, { requirementId: String(requirementId), stages: normalized });
    return normalized;
};
