import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as printController from '../controllers/printController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(printController.listJobs));
router.post('/', authenticate, asyncHandler(printController.createJob));
router.patch('/:id/status', authenticate, authorize('admin'), asyncHandler(printController.updateJobStatus));

export default router;
