import { dbScan, dbPut, dbGet } from '../config/dynamodb.js';

const TABLE = 'BourntecATS-Requirements';

export const fetchRequirements = () => dbScan(TABLE);

export const addRequirement = async (requirement) => {
    const newRequirement = {
        id: Date.now().toString(),
        ...requirement,
    };
    await dbPut(TABLE, newRequirement);
    return newRequirement;
};

export const updateRequirement = async (id, updates) => {
    const existing = await dbGet(TABLE, { id });
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await dbPut(TABLE, updated);
    return updated;
};
