import { redis } from '../database/redis';

/**
 * Redis-backed cooldowns. Durations are never hardcoded — callers resolve the
 * number of seconds from the ConfigManager and pass it in.
 */
export class CooldownManager {
  private key(guildId: string, userId: string, action: string): string {
    return `cd:${guildId}:${userId}:${action}`;
  }

  /** Remaining cooldown in milliseconds, or 0 if ready. */
  async remaining(guildId: string, userId: string, action: string): Promise<number> {
    const pttl = await redis.pttl(this.key(guildId, userId, action));
    return pttl > 0 ? pttl : 0;
  }

  async isOnCooldown(guildId: string, userId: string, action: string): Promise<boolean> {
    return (await this.remaining(guildId, userId, action)) > 0;
  }

  /** Start a cooldown for `seconds`. No-op when seconds <= 0. */
  async set(guildId: string, userId: string, action: string, seconds: number): Promise<void> {
    if (seconds <= 0) return;
    await redis.set(this.key(guildId, userId, action), '1', 'EX', Math.ceil(seconds));
  }

  async clear(guildId: string, userId: string, action: string): Promise<void> {
    await redis.del(this.key(guildId, userId, action));
  }
}
