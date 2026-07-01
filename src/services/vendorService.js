import { dbScan, dbPut, dbDelete, dbGet } from '../config/dynamodb.js';
import { randomUUID } from 'crypto';

const VENDORS_TABLE = 'BourntecATS-Vendors';
const GROUPS_TABLE = 'BourntecATS-VendorGroups';

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getGroups() {
  const rows = await dbScan(GROUPS_TABLE);
  return rows.map((r) => r.name);
}

export async function addGroup(name) {
  const existing = await dbGet(GROUPS_TABLE, { name });
  if (existing) throw new Error(`Group "${name}" already exists`);
  await dbPut(GROUPS_TABLE, { name });
  return getGroups();
}

export async function renameGroup(oldName, newName) {
  const old = await dbGet(GROUPS_TABLE, { name: oldName });
  if (!old) throw new Error(`Group "${oldName}" not found`);
  const conflict = await dbGet(GROUPS_TABLE, { name: newName });
  if (conflict) throw new Error(`Group "${newName}" already exists`);

  await dbDelete(GROUPS_TABLE, { name: oldName });
  await dbPut(GROUPS_TABLE, { name: newName });

  // Update vendors that reference the old group name
  const vendors = await dbScan(VENDORS_TABLE);
  await Promise.all(
    vendors
      .filter((v) => v.group === oldName)
      .map((v) => dbPut(VENDORS_TABLE, { ...v, group: newName })),
  );

  return getGroups();
}

export async function deleteGroup(name) {
  const vendors = await dbScan(VENDORS_TABLE);
  if (vendors.some((v) => v.group === name)) throw new Error(`Group "${name}" is in use`);
  await dbDelete(GROUPS_TABLE, { name });
  return getGroups();
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export const getVendors = () => dbScan(VENDORS_TABLE);

export async function upsertVendor(data) {
  if (data.id) {
    const existing = await dbGet(VENDORS_TABLE, { id: data.id });
    if (!existing) throw new Error('Vendor not found');
    const updated = { ...existing, ...data };
    await dbPut(VENDORS_TABLE, updated);
    return updated;
  }
  const vendor = { id: `v-${randomUUID()}`, status: 'Pending', group: null, ...data };
  await dbPut(VENDORS_TABLE, vendor);
  return vendor;
}

export async function bulkInsertVendors(list) {
  const inserted = list.map((v) => ({ id: `v-${randomUUID()}`, status: 'Pending', group: null, ...v }));
  await Promise.all(inserted.map((v) => dbPut(VENDORS_TABLE, v)));
  return inserted;
}

export async function deleteVendor(id) {
  const existing = await dbGet(VENDORS_TABLE, { id });
  if (!existing) throw new Error('Vendor not found');
  await dbDelete(VENDORS_TABLE, { id });
}
