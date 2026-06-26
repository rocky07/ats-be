import db from '../config/db.js';

export const fetchRequirements = () => {
    return db.data.requirements;
}

export const addRequirement = (requirement) => {
    const newRequirement = {
        id: Date.now().toString(),
        ...requirement
    };
    db.data.requirements.push(newRequirement);
    db.write();
    return newRequirement;
}

export const updateRequirement = (id, updates) => {
    const index = db.data.requirements.findIndex((r) => r.id === id);
    if (index === -1) return null;
    db.data.requirements[index] = { ...db.data.requirements[index], ...updates };
    db.write();
    return db.data.requirements[index];
}
