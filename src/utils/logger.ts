import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/config';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const developmentFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
});

const productionTransports = [
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    maxSize: '20m',
  }),
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
  }),
];

const developmentTransports = [
  new winston.transports.Console({
    format: combine(colorize(), developmentFormat),
  }),
];

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'spline-mcp-server' },
  transports: config.env === 'production' ? productionTransports : developmentTransports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

export class Logger {
  static info(message: string, meta?: any) {
    logger.info(message, meta);
  }

  static error(message: string, error?: Error | any) {
    logger.error(message, { error: error?.stack || error });
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, meta);
  }

  static debug(message: string, meta?: any) {
    logger.debug(message, meta);
  }

  static child(meta: any) {
    return logger.child(meta);
  }
}