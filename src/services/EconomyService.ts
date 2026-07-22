import type { ConfigManager } from '../core/managers/ConfigManager';
import type { CooldownManager } from '../core/managers/CooldownManager';
import type { XpService } from './XpService';

export interface EarnResult {
  amount: bigint;
  balance: bigint;
  level: number;
  leveledUp: boolean;
}

export interface CooldownResult {
  ok: false;
  remainingMs: number;
}

/**
 * Economy actions (work, daily) that reward XP. Amounts, ranges and cooldowns
 * are all resolved from config per guild — nothing is hardcoded.
 */
export class EconomyService {
  constructor(
    private readonly config: ConfigManager,
    private readonly cooldowns: CooldownManager,
    private readonly xp: XpService,
  ) {}

  private randomInRange(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async run(
    guildId: string,
    userId: string,
    action: 'work' | 'daily',
    username?: string,
  ): Promise<EarnResult | CooldownResult> {
    const remainingMs = await this.cooldowns.remaining(guildId, userId, action);
    if (remainingMs > 0) return { ok: false, remainingMs };

    const min = await this.config.getNumber(guildId, 'economy', `${action}.min`, action === 'daily' ? 500 : 50);
    const max = await this.config.getNumber(guildId, 'economy', `${action}.max`, action === 'daily' ? 1000 : 150);
    const cooldownSecs = await this.config.getNumber(
      guildId,
      'cooldown',
      action,
      action === 'daily' ? 86_400 : 3_600,
    );

    const amount = this.randomInRange(min, max);
    const award = await this.xp.award(guildId, userId, amount, action, username);
    await this.cooldowns.set(guildId, userId, action, cooldownSecs);

    return {
      amount: award.gained,
      balance: award.balance,
      level: award.level,
      leveledUp: award.leveledUp,
    };
  }

  work(guildId: string, userId: string, username?: string) {
    return this.run(guildId, userId, 'work', username);
  }

  daily(guildId: string, userId: string, username?: string) {
    return this.run(guildId, userId, 'daily', username);
  }

  /** Transfer spendable XP between two members (pay). */
  async pay(
    guildId: string,
    fromId: string,
    toId: string,
    amount: bigint,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (amount <= 0n) return { ok: false, reason: 'Amount must be positive.' };
    if (fromId === toId) return { ok: false, reason: 'You cannot pay yourself.' };

    const taxPct = await this.config.getNumber(guildId, 'economy', 'pay.taxPct', 0);
    const spent = await this.xp.spend(guildId, fromId, amount);
    if (!spent) return { ok: false, reason: 'Insufficient XP.' };

    const received = (amount * BigInt(Math.round((100 - taxPct) * 100))) / 10_000n;
    await this.xp.grantBalance(guildId, toId, received);
    return { ok: true };
  }
}
