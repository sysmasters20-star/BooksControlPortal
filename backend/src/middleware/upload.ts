import multer from 'multer';
import { env } from '../config/env.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});
