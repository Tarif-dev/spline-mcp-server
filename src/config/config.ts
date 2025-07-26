import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  
  // Spline API Configuration
  SPLINE_API_BASE_URL: Joi.string().uri().default('https://api.spline.design'),
  SPLINE_API_KEY: Joi.string().required(),
  SPLINE_API_VERSION: Joi.string().default('v1'),
  SPLINE_TIMEOUT: Joi.number().default(30000),
  
  // Authentication
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  BCRYPT_ROUNDS: Joi.number().default(12),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // Redis Configuration
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000),
  
  // Security
  CORS_ORIGINS: Joi.string().default('*'),
  ENABLE_HELMET: Joi.boolean().default(true),
  TRUST_PROXY: Joi.boolean().default(false),
}).unknown();

const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  logLevel: envVars.LOG_LEVEL,
  
  spline: {
    apiBaseUrl: envVars.SPLINE_API_BASE_URL,
    apiKey: envVars.SPLINE_API_KEY,
    apiVersion: envVars.SPLINE_API_VERSION,
    timeout: envVars.SPLINE_TIMEOUT,
  },
  
  auth: {
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN,
    bcryptRounds: envVars.BCRYPT_ROUNDS,
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
  },
  
  monitoring: {
    enableMetrics: envVars.ENABLE_METRICS,
    healthCheckInterval: envVars.HEALTH_CHECK_INTERVAL,
  },
  
  security: {
    corsOrigins: envVars.CORS_ORIGINS.split(','),
    enableHelmet: envVars.ENABLE_HELMET,
    trustProxy: envVars.TRUST_PROXY,
  },
};