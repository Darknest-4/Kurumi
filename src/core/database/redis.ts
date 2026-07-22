import { Redis } from 'ioredis';
import { env } from '../../config/env';
import { createLogger } from '../logger/logger';

const log = createLogger('redis');

/**
 * Shared Redis connection used for caching, cooldowns, event state and
 * cross-shard pub/sub. A separate duplicated connection is exposed for
 * blocking/subscribe usage.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => log.error({ err }, 'Redis error'));
redis.on('ready', () => log.info('Redis connected'));

let subscriber: Redis | null = null;

/** Lazily create a dedicated connection for pub/sub subscriptions. */
export function getSubscriber(): Redis {
  if (!subscriber) subscriber = redis.duplicate();
  return subscriber;
}

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  if (subscriber) await subscriber.quit();
  log.info('Redis disconnected');
}
