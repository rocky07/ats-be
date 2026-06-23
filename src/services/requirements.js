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
