import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as bookController from '../controllers/bookController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(bookController.list));
router.get('/:id', authenticate, asyncHandler(bookController.getById));
router.post('/', authenticate, asyncHandler(bookController.create));
router.patch('/:id/status', authenticate, authorize('admin'), asyncHandler(bookController.updateStatus));
router.delete('/:id', authenticate, asyncHandler(bookController.remove));

export default router;
