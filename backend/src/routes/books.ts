import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { upload } from '../middleware/upload.js';
import * as bookController from '../controllers/bookController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.get('/', authenticate, asyncHandler(bookController.list));
router.get('/:id', authenticate, asyncHandler(bookController.getById));
router.post('/', authenticate, validate(schemas.createBook), auditLog('create_book', 'book'), asyncHandler(bookController.create));
router.post('/:id/upload', authenticate, upload.single('file'), auditLog('upload_book', 'book'), asyncHandler(bookController.uploadFile));
router.patch('/:id/status', authenticate, authorize('admin'), validate(schemas.updateBookStatus), auditLog('update_book_status', 'book'), asyncHandler(bookController.updateStatus));
router.delete('/:id', authenticate, auditLog('delete_book', 'book'), asyncHandler(bookController.remove));

export default router;
