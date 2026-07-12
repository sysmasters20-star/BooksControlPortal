import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as authController from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.post('/register', authenticate, authorize('admin'), validate(schemas.register), auditLog('register'), asyncHandler(authController.register));
router.post('/login', validate(schemas.login), asyncHandler(authController.login));
router.post('/refresh', validate(schemas.refreshToken), asyncHandler(authController.refresh));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/forgot-password', validate(schemas.forgotPassword), asyncHandler(authController.forgotPassword));
router.post('/reset-password', validate(schemas.resetPassword), asyncHandler(authController.resetPassword));
router.post('/verify-email', asyncHandler(authController.verifyEmail));

export default router;
