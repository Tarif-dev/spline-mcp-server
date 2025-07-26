import { Logger } from './logger';

export class SplineError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends SplineError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends SplineError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends SplineError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends SplineError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends SplineError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class SplineApiError extends SplineError {
  constructor(message: string, statusCode: number = 500) {
    super(`Spline API Error: ${message}`, statusCode, 'SPLINE_API_ERROR');
  }
}

export class ErrorHandler {
  static handle(error: Error): { statusCode: number; code: string; message: string } {
    Logger.error('Error occurred', error);

    if (error instanceof SplineError) {
      return {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      };
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: error.message,
      };
    }

    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token expired',
      };
    }

    // Default to internal server error
    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  static async handleAsync<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw error instanceof SplineError ? error : new SplineError(error.message);
    }
  }
}