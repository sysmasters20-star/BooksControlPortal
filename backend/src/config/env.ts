import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  database: {
    url: process.env.DATABASE_URL || '',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiry: process.env.JWT_EXPIRY || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  encryption: {
    key: process.env.ENCRYPTION_MASTER_KEY || '',
    algorithm: (process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm') as 'aes-256-gcm',
  },

  frontendUrl: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || ''
    : process.env.FRONTEND_DEV_URL || 'http://localhost:5173',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10),
    dir: process.env.UPLOAD_DIR || '/tmp/uploads',
  },

  rateLimit: {
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10),
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  features: {
    enable2fa: process.env.ENABLE_2FA === 'true',
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    enableRateLimiting: process.env.ENABLE_API_RATE_LIMITING === 'true',
  },
};
