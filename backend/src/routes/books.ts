import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { upload } from '../middleware/upload.js';
import * as bookController from '../controllers/bookController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.get('/', authenticate, asyncHandler(bookController.list));
router.get('/stats', authenticate, asyncHandler(bookController.getStats));
router.get('/files/:id', authenticate, asyncHandler(bookController.getFile));
router.get('/:id', authenticate, asyncHandler(bookController.getById));
router.get('/:id/files', authenticate, asyncHandler(bookController.listPageFiles));
router.get('/:id/shops', authenticate, asyncHandler(bookController.listAssignedBookshops));
router.post('/', authenticate, authorize('admin'), upload.single('file'), validate(schemas.createBook), auditLog('create_book', 'book'), asyncHandler(bookController.create));
router.post('/bulk-status', authenticate, authorize('admin'), validate(schemas.bulkUpdateStatus), auditLog('bulk_update_book_status', 'book'), asyncHandler(bookController.bulkUpdateStatus));
router.post('/:id/upload', authenticate, authorize('admin'), upload.single('file'), auditLog('upload_book', 'book'), asyncHandler(bookController.uploadFile));
router.patch('/:id/status', authenticate, authorize('admin'), validate(schemas.updateBookStatus), auditLog('update_book_status', 'book'), asyncHandler(bookController.updateStatus));
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete_book', 'book'), asyncHandler(bookController.remove));
router.post('/:id/assign', authenticate, authorize('admin'), validate(schemas.assignBookshop), auditLog('assign_bookshop', 'book'), asyncHandler(bookController.assignBookshop));
router.delete('/:id/assign/:bookshopId', authenticate, authorize('admin'), auditLog('unassign_bookshop', 'book'), asyncHandler(bookController.unassignBookshop));

export default router;
