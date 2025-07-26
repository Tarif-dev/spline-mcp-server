import { SplineMcpServer } from './server';
import { Logger } from './utils/logger';
import { config } from './config/config';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

async function main() {
  try {
    Logger.info('Starting Spline MCP Server', {
      version: '1.0.0',
      environment: config.env,
      logLevel: config.logLevel,
    });

    const server = new SplineMcpServer();
    await server.run();

    // Handle graceful shutdown
    const shutdown = async () => {
      await server.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error('Main process error', error);
  process.exit(1);
});