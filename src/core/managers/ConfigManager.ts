import { prisma } from '../database/prisma';
import { redis } from '../database/redis';
import { createLogger } from '../logger/logger';

const log = createLogger('config');

const CACHE_TTL_SECONDS = 300;
const cacheKey = (guildId: string, ns: string, key: string) => `cfg:${guildId}:${ns}:${key}`;

/**
 * Database-driven, per-guild configuration with a Redis read-through cache.
 *
 * There are NO hardcoded gameplay values anywhere in the codebase. Modules
 * register their default config once (from `ModuleDefinition.defaultConfig`);
 * a guild's stored overrides take precedence over those defaults. This is the
 * single source of truth for XP rates, cooldowns, drop rates, boss HP, prices,
 * colors, emojis, prefixes and every other tunable.
 */
export class ConfigManager {
  /** namespace -> { key -> default value } registered by modules. */
  private readonly defaults = new Map<string, Record<string, unknown>>();

  /** Register a module's default config (namespace = module key). */
  registerDefaults(namespace: string, values: Record<string, unknown>): void {
    const existing = this.defaults.get(namespace) ?? {};
    this.defaults.set(namespace, { ...existing, ...values });
  }

  getDefault<T = unknown>(namespace: string, key: string): T | undefined {
    return this.defaults.get(namespace)?.[key] as T | undefined;
  }

  /**
   * Resolve a single config value: guild override → registered default →
   * provided fallback. Cached in Redis.
   */
  async get<T = unknown>(
    guildId: string,
    namespace: string,
    key: string,
    fallback?: T,
  ): Promise<T> {
    const rkey = cacheKey(guildId, namespace, key);
    try {
      const cached = await redis.get(rkey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (err) {
      log.warn({ err }, 'config cache read failed');
    }

    const row = await prisma.guildConfig.findUnique({
      where: { guildId_namespace_key: { guildId, namespace, key } },
    });

    const value = (row?.value ??
      this.getDefault<T>(namespace, key) ??
      fallback) as T;

    try {
      await redis.set(rkey, JSON.stringify(value ?? null), 'EX', CACHE_TTL_SECONDS);
    } catch {
      /* cache is best-effort */
    }
    return value;
  }

  /** Typed number getter (config values are stored as JSON). */
  async getNumber(guildId: string, ns: string, key: string, fallback = 0): Promise<number> {
    const v = await this.get<number>(guildId, ns, key, fallback);
    return typeof v === 'number' ? v : Number(v ?? fallback);
  }

  async getString(guildId: string, ns: string, key: string, fallback = ''): Promise<string> {
    const v = await this.get<string>(guildId, ns, key, fallback);
    return v == null ? fallback : String(v);
  }

  async getBool(guildId: string, ns: string, key: string, fallback = false): Promise<boolean> {
    const v = await this.get<boolean>(guildId, ns, key, fallback);
    return typeof v === 'boolean' ? v : Boolean(v ?? fallback);
  }

  /** All config for a namespace: registered defaults merged with overrides. */
  async getNamespace(guildId: string, namespace: string): Promise<Record<string, unknown>> {
    const rows = await prisma.guildConfig.findMany({ where: { guildId, namespace } });
    const merged: Record<string, unknown> = { ...(this.defaults.get(namespace) ?? {}) };
    for (const row of rows) merged[row.key] = row.value;
    return merged;
  }

  /** Upsert a config override and invalidate the cache. */
  async set(guildId: string, namespace: string, key: string, value: unknown): Promise<void> {
    await prisma.guildConfig.upsert({
      where: { guildId_namespace_key: { guildId, namespace, key } },
      create: { guildId, namespace, key, value: value as never },
      update: { value: value as never },
    });
    await this.invalidate(guildId, namespace, key);
    log.debug({ guildId, namespace, key }, 'config updated');
  }

  /** Remove a guild override so the value falls back to the module default. */
  async reset(guildId: string, namespace: string, key: string): Promise<void> {
    await prisma.guildConfig
      .delete({ where: { guildId_namespace_key: { guildId, namespace, key } } })
      .catch(() => undefined);
    await this.invalidate(guildId, namespace, key);
  }

  async invalidate(guildId: string, namespace: string, key: string): Promise<void> {
    try {
      await redis.del(cacheKey(guildId, namespace, key));
    } catch {
      /* ignore */
    }
  }
}
