import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as financeController from '../controllers/financeController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/pricing', asyncHandler(financeController.getPricing));
router.post('/pricing', asyncHandler(financeController.setPricing));
router.get('/summary', asyncHandler(financeController.getFinanceSummary));
router.get('/invoices', asyncHandler(financeController.listInvoices));
router.get('/invoices/:id', asyncHandler(financeController.getInvoiceDetail));
router.post('/invoices/generate', asyncHandler(financeController.generateInvoice));
router.patch('/invoices/:id/pay', asyncHandler(financeController.markInvoicePaid));

export default router;
