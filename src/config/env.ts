import 'dotenv/config';
import { z } from 'zod';

/**
 * Bootstrap environment. This is the ONLY place raw env is read.
 * It contains infrastructure/secrets only — never gameplay values.
 * Everything gameplay-related lives in the database (see ConfigManager).
 */
const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DEV_GUILD_ID: z.string().optional().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // NOTE: do NOT add a SHARD_COUNT var — discord.js reserves the
  // `SHARD_COUNT` / `SHARDS` / `SHARDING_MANAGER` env names for its own
  // ShardingManager, and setting them here breaks `new Client()`.

  BOOTSTRAP_OWNER_IDS: z
    .string()
    .optional()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
