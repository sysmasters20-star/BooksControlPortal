import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as printController from '../controllers/printController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.get('/', authenticate, asyncHandler(printController.listJobs));
router.post('/', authenticate, validate(schemas.createPrintJob), auditLog('create_print_job', 'print_job'), asyncHandler(printController.createJob));
router.patch('/:id/status', authenticate, authorize('admin'), validate(schemas.updatePrintStatus), auditLog('update_print_job', 'print_job'), asyncHandler(printController.updateJobStatus));

export default router;
