import { prisma } from '../database/prisma';
import { redis } from '../database/redis';
import { createLogger } from '../logger/logger';
import type { ModuleDefinition } from '../structures/Module';
import type { ConfigManager } from './ConfigManager';

const log = createLogger('modules');
const CACHE_TTL = 120;
const cacheKey = (guildId: string, module: string) => `mod:${guildId}:${module}`;

/**
 * Registry + per-guild on/off state for feature modules.
 * Every command/event/component is gated by its module here, so any feature
 * can be disabled per guild without touching code.
 */
export class ModuleManager {
  private readonly registry = new Map<string, ModuleDefinition>();

  constructor(private readonly config: ConfigManager) {}

  /** Register a module definition and its default config. */
  register(module: ModuleDefinition): void {
    this.registry.set(module.key, module);
    if (module.defaultConfig) {
      this.config.registerDefaults(module.key, module.defaultConfig);
    }
    log.debug({ module: module.key }, 'module registered');
  }

  all(): ModuleDefinition[] {
    return [...this.registry.values()];
  }

  get(key: string): ModuleDefinition | undefined {
    return this.registry.get(key);
  }

  /** Whether a module is enabled for a guild (Redis-cached, DB-backed). */
  async isEnabled(guildId: string, moduleKey: string): Promise<boolean> {
    const def = this.registry.get(moduleKey);
    const fallback = def?.defaultEnabled ?? true;

    const rkey = cacheKey(guildId, moduleKey);
    try {
      const cached = await redis.get(rkey);
      if (cached !== null) return cached === '1';
    } catch {
      /* ignore */
    }

    const row = await prisma.guildModule.findUnique({
      where: { guildId_module: { guildId, module: moduleKey } },
    });
    const enabled = row?.enabled ?? fallback;
    await redis.set(rkey, enabled ? '1' : '0', 'EX', CACHE_TTL).catch(() => undefined);
    return enabled;
  }

  async setEnabled(guildId: string, moduleKey: string, enabled: boolean): Promise<void> {
    await prisma.guildModule.upsert({
      where: { guildId_module: { guildId, module: moduleKey } },
      create: { guildId, module: moduleKey, enabled },
      update: { enabled },
    });
    await redis.del(cacheKey(guildId, moduleKey)).catch(() => undefined);
    log.info({ guildId, module: moduleKey, enabled }, 'module toggled');
  }

  /** Return the enabled state of every registered module for a guild. */
  async statusFor(guildId: string): Promise<Record<string, boolean>> {
    const rows = await prisma.guildModule.findMany({ where: { guildId } });
    const overrides = new Map(rows.map((r) => [r.module, r.enabled]));
    const out: Record<string, boolean> = {};
    for (const def of this.registry.values()) {
      out[def.key] = overrides.get(def.key) ?? def.defaultEnabled;
    }
    return out;
  }
}
