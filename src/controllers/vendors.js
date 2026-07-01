import * as svc from '../services/vendorService.js';

// ── Groups ────────────────────────────────────────────────────────────────────

export const listGroups = async (req, res) => {
  res.json(await svc.getGroups());
};

export const createGroup = async (req, res) => {
  try   { res.status(201).json(await svc.addGroup(req.body.name?.trim())); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateGroup = async (req, res) => {
  try   { res.json(await svc.renameGroup(req.params.name, req.body.name?.trim())); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const removeGroup = async (req, res) => {
  try   { res.json(await svc.deleteGroup(req.params.name)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

// ── Vendors ───────────────────────────────────────────────────────────────────

export const listVendors = async (req, res) => {
  res.json(await svc.getVendors());
};

export const createVendor = async (req, res) => {
  try   { res.status(201).json(await svc.upsertVendor(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateVendor = async (req, res) => {
  try   { res.json(await svc.upsertVendor({ ...req.body, id: req.params.id })); }
  catch (e) { res.status(404).json({ error: e.message }); }
};

export const removeVendor = async (req, res) => {
  try   { await svc.deleteVendor(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(404).json({ error: e.message }); }
};

export const bulkImport = async (req, res) => {
  const list = req.body.vendors;
  if (!Array.isArray(list) || !list.length) return res.status(400).json({ error: 'vendors array required' });
  res.status(201).json(await svc.bulkInsertVendors(list));
};
