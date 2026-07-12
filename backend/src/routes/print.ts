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

router.get('/sessions', authenticate, asyncHandler(printController.listSessions));
router.post('/sessions/log', authenticate, asyncHandler(printController.logPrintSession));
router.get('/:bookId/view', authenticate, asyncHandler(printController.viewWatermarked));
router.get('/:bookId/page/:pageNum', authenticate, asyncHandler(printController.getPage));
// PDF generation endpoints disabled — never send PDF to frontend
// router.get('/:bookId/session-pdf', authenticate, asyncHandler(printController.getSessionPdf));
// router.post('/:bookId/generate-print-pdf', authenticate, asyncHandler(printController.generatePrintPdf));
router.post('/:bookId/print', authenticate, validate(schemas.countPrint), auditLog('print_book', 'book'), asyncHandler(printController.countPrint));

export default router;
