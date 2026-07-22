import type { ConfigManager } from '../core/managers/ConfigManager';

export interface LevelCurve {
  base: number;
  multiplier: number;
  exponent: number;
}

/**
 * Level ↔ XP conversion. The curve is fully DB-driven per guild (namespace
 * `level`): `base`, `multiplier`, `exponent`. Total XP determines the level;
 * XP is the only currency, so a member's level is derived, never stored as a
 * separate resource.
 */
export class LevelService {
  constructor(private readonly config: ConfigManager) {}

  async getCurve(guildId: string): Promise<LevelCurve> {
    const cfg = await this.config.getNamespace(guildId, 'level');
    return {
      base: Number(cfg.base ?? 100),
      multiplier: Number(cfg.multiplier ?? 55),
      exponent: Number(cfg.exponent ?? 1.5),
    };
  }

  /** XP required to advance FROM `level` to `level + 1`. */
  xpToNext(level: number, curve: LevelCurve): number {
    return Math.round(curve.base + curve.multiplier * Math.pow(level, curve.exponent));
  }

  /** Cumulative XP required to reach `level` from 0. */
  totalXpForLevel(level: number, curve: LevelCurve): number {
    let sum = 0;
    for (let l = 0; l < level; l++) sum += this.xpToNext(l, curve);
    return sum;
  }

  /** Resolve level + progress within the level from a lifetime XP total. */
  resolve(
    totalXp: bigint,
    curve: LevelCurve,
  ): { level: number; intoLevel: number; needed: number } {
    const total = Number(totalXp);
    let level = 0;
    let consumed = 0;
    // Guard against pathological loops with a generous ceiling.
    while (level < 100_000) {
      const need = this.xpToNext(level, curve);
      if (consumed + need > total) break;
      consumed += need;
      level++;
    }
    return { level, intoLevel: total - consumed, needed: this.xpToNext(level, curve) };
  }

  async levelFromTotal(guildId: string, totalXp: bigint): Promise<number> {
    return this.resolve(totalXp, await this.getCurve(guildId)).level;
  }
}
