import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as authController from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate, schemas } from '../utils/validate.js';

const router = Router();

router.post('/register', validate(schemas.register), auditLog('register'), asyncHandler(authController.register));
router.post('/login', validate(schemas.login), asyncHandler(authController.login));
router.post('/refresh', validate(schemas.refreshToken), asyncHandler(authController.refresh));
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
