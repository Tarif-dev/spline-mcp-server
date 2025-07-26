import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { config } from '../config/config';
import { Logger } from './logger';
import { RateLimitError } from './error-handler';

let redisClient: any = null;

if (config.redis.url) {
  redisClient = createClient({
    url: config.redis.url,
    password: config.redis.password,
  });

  redisClient.on('error', (err: Error) => {
    Logger.error('Redis connection error', err);
  });

  redisClient.connect().catch((err: Error) => {
    Logger.error('Failed to connect to Redis', err);
  });
}

export class RateLimiter {
  private static store = redisClient ? {
    async get(key: string) {
      try {
        const result = await redisClient.get(key);
        return result ? JSON.parse(result) : null;
      } catch (error) {
        Logger.error('Redis get error', error);
        return null;
      }
    },

    async set(key: string, value: any, ttl: number) {
      try {
        await redisClient.setEx(key, ttl, JSON.stringify(value));
      } catch (error) {
        Logger.error('Redis set error', error);
      }
    },

    async increment(key: string, ttl: number) {
      try {
        const current = await redisClient.incr(key);
        if (current === 1) {
          await redisClient.expire(key, ttl);
        }
        return current;
      } catch (error) {
        Logger.error('Redis increment error', error);
        return 1;
      }
    },
  } : null;

  static createLimiter(windowMs: number = config.rateLimit.windowMs, max: number = config.rateLimit.maxRequests) {
    return rateLimit({
      windowMs,
      max,
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      store: this.store ? {
        async get(key: string) {
          const data = await RateLimiter.store!.get(`rl:${key}`);
          return data ? { totalHits: data.count, resetTime: new Date(data.resetTime) } : null;
        },

        async increment(key: string) {
          const ttl = Math.ceil(windowMs / 1000);
          const count = await RateLimiter.store!.increment(`rl:${key}`, ttl);
          const resetTime = new Date(Date.now() + windowMs);
          
          return {
            totalHits: count,
            resetTime,
          };
        },

        async decrement() {
          // Not implemented for Redis store
        },

        async resetKey() {
          // Not implemented for Redis store
        },
      } : undefined,
      handler: (req, res) => {
        const error = new RateLimitError();
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date(),
        });
      },
    });
  }

  static async checkCustomLimit(identifier: string, limit: number, windowMs: number): Promise<boolean> {
    if (!this.store) {
      return true; // Allow if no Redis store
    }

    const key = `custom:${identifier}`;
    const ttl = Math.ceil(windowMs / 1000);
    const count = await this.store.increment(key, ttl);
    
    return count <= limit;
  }
}