import pino from 'pino';
import { env, isProd } from '../../config/env';

/**
 * Central structured logger. In development it pretty-prints; in
 * production it emits JSON lines for ingestion by a log pipeline.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'kurumi' },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,service',
        },
      },
});

/** Create a child logger tagged with a subsystem name. */
export function createLogger(scope: string) {
  return logger.child({ scope });
}

export type Logger = ReturnType<typeof createLogger>;
