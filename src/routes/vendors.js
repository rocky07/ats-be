import { Router } from 'express';
import * as ctrl from '../controllers/vendors.js';

const router = Router();

router.get('/',              ctrl.listVendors);
router.post('/',             ctrl.createVendor);
router.put('/:id',           ctrl.updateVendor);
router.delete('/:id',        ctrl.removeVendor);
router.post('/bulk-import',  ctrl.bulkImport);

router.get('/groups',        ctrl.listGroups);
router.post('/groups',       ctrl.createGroup);
router.put('/groups/:name',  ctrl.updateGroup);
router.delete('/groups/:name', ctrl.removeGroup);

export default router;
