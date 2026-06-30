import * as svc from '../services/vendorService.js';

// ── Groups ────────────────────────────────────────────────────────────────────

export const listGroups    = (req, res) => res.json(svc.getGroups());

export const createGroup   = (req, res) => {
  try   { res.status(201).json(svc.addGroup(req.body.name?.trim())); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateGroup   = (req, res) => {
  try   { res.json(svc.renameGroup(req.params.name, req.body.name?.trim())); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const removeGroup   = (req, res) => {
  try   { res.json(svc.deleteGroup(req.params.name)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

// ── Vendors ───────────────────────────────────────────────────────────────────

export const listVendors   = (req, res) => res.json(svc.getVendors());

export const createVendor  = (req, res) => {
  try   { res.status(201).json(svc.upsertVendor(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateVendor  = (req, res) => {
  try   { res.json(svc.upsertVendor({ ...req.body, id: req.params.id })); }
  catch (e) { res.status(404).json({ error: e.message }); }
};

export const removeVendor  = (req, res) => {
  try   { svc.deleteVendor(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(404).json({ error: e.message }); }
};

export const bulkImport    = (req, res) => {
  const list = req.body.vendors;
  if (!Array.isArray(list) || !list.length) return res.status(400).json({ error: 'vendors array required' });
  res.status(201).json(svc.bulkInsertVendors(list));
};
