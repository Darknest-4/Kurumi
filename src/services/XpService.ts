import { prisma } from '../core/database/prisma';
import type { ConfigManager } from '../core/managers/ConfigManager';
import { LevelService } from './LevelService';
import type { LogService } from './LogService';
import { EntityRepository } from '../repositories/EntityRepository';

export type XpSource =
  | 'message'
  | 'voice'
  | 'boss'
  | 'raid'
  | 'dungeon'
  | 'quiz'
  | 'daily'
  | 'work'
  | 'vault'
  | 'bomb'
  | 'achievement'
  | 'clan'
  | 'event'
  | 'admin'
  | 'gamble';

export interface XpAward {
  balance: bigint;
  total: bigint;
  level: number;
  previousLevel: number;
  leveledUp: boolean;
  gained: bigint;
}

/**
 * The heart of Kurumi's economy: XP is the ONLY currency. Every earn/spend
 * path funnels through here so multipliers, level recalculation and logging
 * are consistent. All rates and multipliers are DB-driven per guild.
 */
export class XpService {
  private readonly level: LevelService;
  private readonly entities = new EntityRepository();

  constructor(
    private readonly config: ConfigManager,
    private readonly logs: LogService,
  ) {
    this.level = new LevelService(config);
  }

  get levels(): LevelService {
    return this.level;
  }

  /** Combined multiplier: guild global × active boosts × source weight. */
  private async effectiveMultiplier(
    guildId: string,
    memberId: string,
    source: XpSource,
  ): Promise<number> {
    const global = await this.config.getNumber(guildId, 'xp', 'globalMultiplier', 1);
    const sourceWeight = await this.config.getNumber(guildId, 'xp', `weight.${source}`, 1);

    const now = new Date();
    const boosts = await prisma.xpBoost.findMany({
      where: { memberId, expiresAt: { gt: now } },
    });
    const boost = boosts.reduce((acc, b) => acc * b.multiplier, 1);

    return global * sourceWeight * boost;
  }

  /** Award XP for a source. Increases both spendable balance and lifetime total. */
  async award(
    guildId: string,
    userId: string,
    amount: number | bigint,
    source: XpSource,
    username?: string,
  ): Promise<XpAward> {
    const member = await this.entities.ensureMember(guildId, userId, username);
    const multiplier = await this.effectiveMultiplier(guildId, member.id, source);
    const gained = BigInt(Math.max(0, Math.round(Number(amount) * multiplier)));

    const curve = await this.level.getCurve(guildId);
    const previousLevel = this.level.resolve(member.totalXp, curve).level;
    const newTotal = member.totalXp + gained;
    const newLevel = this.level.resolve(newTotal, curve).level;

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: {
        xp: { increment: gained },
        totalXp: { increment: gained },
        level: newLevel,
      },
    });

    await this.logs.record(guildId, 'xp', {
      targetId: userId,
      data: { source, gained: gained.toString(), level: newLevel },
    });

    return {
      balance: updated.xp,
      total: updated.totalXp,
      level: newLevel,
      previousLevel,
      leveledUp: newLevel > previousLevel,
      gained,
    };
  }

  /**
   * Spend XP (currency). Atomic: only succeeds if the balance is sufficient.
   * Does NOT reduce lifetime total, so spending never lowers your level.
   */
  async spend(guildId: string, userId: string, amount: number | bigint): Promise<boolean> {
    const cost = BigInt(amount);
    if (cost <= 0n) return true;
    const member = await this.entities.ensureMember(guildId, userId);
    const res = await prisma.member.updateMany({
      where: { id: member.id, xp: { gte: cost } },
      data: { xp: { decrement: cost } },
    });
    return res.count > 0;
  }

  /** Grant spendable XP without touching lifetime total (e.g. winnings). */
  async grantBalance(guildId: string, userId: string, amount: number | bigint): Promise<void> {
    const gain = BigInt(amount);
    if (gain <= 0n) return;
    const member = await this.entities.ensureMember(guildId, userId);
    await prisma.member.update({ where: { id: member.id }, data: { xp: { increment: gain } } });
  }

  async getBalance(guildId: string, userId: string): Promise<bigint> {
    const member = await this.entities.getMember(guildId, userId);
    return member?.xp ?? 0n;
  }

  /** Developer op: set an exact lifetime total and recompute level. */
  async adminSetTotal(guildId: string, userId: string, total: bigint): Promise<void> {
    const member = await this.entities.ensureMember(guildId, userId);
    const level = await this.level.levelFromTotal(guildId, total);
    await prisma.member.update({
      where: { id: member.id },
      data: { xp: total, totalXp: total, level },
    });
    await this.logs.record(guildId, 'developer', {
      targetId: userId,
      data: { action: 'xp.set', total: total.toString() },
    });
  }

  async adminReset(guildId: string, userId: string): Promise<void> {
    await this.adminSetTotal(guildId, userId, 0n);
  }
}
