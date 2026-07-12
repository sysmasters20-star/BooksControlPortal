import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as adminController from '../controllers/adminController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/stats', asyncHandler(adminController.getPlatformStats));
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs));

router.get('/bookshops', asyncHandler(adminController.listBookshops));
router.get('/bookshops/:id', asyncHandler(adminController.getBookshop));
router.post('/bookshops', validate(schemas.createBookshop), auditLog('create_bookshop', 'bookshop'), asyncHandler(adminController.createBookshop));
router.put('/bookshops/:id', validate(schemas.updateBookshop), auditLog('update_bookshop', 'bookshop'), asyncHandler(adminController.updateBookshop));
router.delete('/bookshops/:id', auditLog('delete_bookshop', 'bookshop'), asyncHandler(adminController.deleteBookshop));
router.get('/bookshops/:id/analytics', asyncHandler(adminController.getBookshopAnalytics));

export default router;
