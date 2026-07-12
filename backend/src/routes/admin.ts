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

router.get('/export/print-sessions', asyncHandler(adminController.exportPrintSessions));

router.get('/notifications', asyncHandler(adminController.listNotifications));
router.patch('/notifications/:id/read', asyncHandler(adminController.markNotificationRead));

router.get('/users', asyncHandler(adminController.listUsers));
router.patch('/users/:id', auditLog('update_user', 'user'), asyncHandler(adminController.updateUserStatus));
router.delete('/users/:id', auditLog('delete_user', 'user'), asyncHandler(adminController.deleteUser));

export default router;
