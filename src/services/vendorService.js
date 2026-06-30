import db from '../config/db.js';
import { randomUUID } from 'crypto';

// ── Groups ────────────────────────────────────────────────────────────────────

export function getGroups() {
  return db.data.vendorGroups ?? [];
}

export function addGroup(name) {
  if (!db.data.vendorGroups) db.data.vendorGroups = [];
  if (db.data.vendorGroups.includes(name)) throw new Error(`Group "${name}" already exists`);
  db.data.vendorGroups.push(name);
  db.write();
  return db.data.vendorGroups;
}

export function renameGroup(oldName, newName) {
  if (!db.data.vendorGroups) db.data.vendorGroups = [];
  const idx = db.data.vendorGroups.indexOf(oldName);
  if (idx === -1) throw new Error(`Group "${oldName}" not found`);
  if (db.data.vendorGroups.includes(newName)) throw new Error(`Group "${newName}" already exists`);
  db.data.vendorGroups[idx] = newName;
  // Update vendors assigned to this group
  (db.data.vendors ?? []).forEach((v) => { if (v.group === oldName) v.group = newName; });
  db.write();
  return db.data.vendorGroups;
}

export function deleteGroup(name) {
  if (!db.data.vendorGroups) db.data.vendorGroups = [];
  const inUse = (db.data.vendors ?? []).some((v) => v.group === name);
  if (inUse) throw new Error(`Group "${name}" is in use`);
  db.data.vendorGroups = db.data.vendorGroups.filter((g) => g !== name);
  db.write();
  return db.data.vendorGroups;
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export function getVendors() {
  return db.data.vendors ?? [];
}

export function upsertVendor(data) {
  if (!db.data.vendors) db.data.vendors = [];
  if (data.id) {
    const idx = db.data.vendors.findIndex((v) => v.id === data.id);
    if (idx === -1) throw new Error('Vendor not found');
    db.data.vendors[idx] = { ...db.data.vendors[idx], ...data };
    db.write();
    return db.data.vendors[idx];
  }
  const vendor = { id: `v-${randomUUID()}`, status: 'Pending', group: null, ...data };
  db.data.vendors.push(vendor);
  db.write();
  return vendor;
}

export function bulkInsertVendors(list) {
  if (!db.data.vendors) db.data.vendors = [];
  const inserted = list.map((v) => ({ id: `v-${randomUUID()}`, status: 'Pending', group: null, ...v }));
  db.data.vendors.push(...inserted);
  db.write();
  return inserted;
}

export function deleteVendor(id) {
  if (!db.data.vendors) db.data.vendors = [];
  const idx = db.data.vendors.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error('Vendor not found');
  db.data.vendors.splice(idx, 1);
  db.write();
}
