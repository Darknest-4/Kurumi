import { Rarity, type GachaCharacter } from '@prisma/client';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';
import { EntityRepository } from '../../repositories/EntityRepository';

const entities = new EntityRepository();

const RARITIES: Rarity[] = [
  Rarity.COMMON,
  Rarity.RARE,
  Rarity.EPIC,
  Rarity.LEGENDARY,
  Rarity.MYTHIC,
  Rarity.DIVINE,
];

export interface RollResult {
  ok: boolean;
  reason?: string;
  character?: GachaCharacter;
  isNew?: boolean;
  copies?: number;
}

/**
 * Gacha summon system. Roll cost and per-rarity rates are DB-driven
 * (`gacha` namespace). Characters are catalog rows with passive abilities.
 */
export class GachaService {
  /** Weighted pick of a rarity from configured rates. */
  private static async pickRarity(client: KurumiClient, guildId: string): Promise<Rarity> {
    const weights: number[] = [];
    for (const r of RARITIES) {
      weights.push(await client.config.getNumber(guildId, 'gacha', `rate.${r}`, 0));
    }
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return Rarity.COMMON;
    let roll = Math.random() * total;
    for (let i = 0; i < RARITIES.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return RARITIES[i];
    }
    return Rarity.COMMON;
  }

  static async roll(
    client: KurumiClient,
    guildId: string,
    userId: string,
    username?: string,
  ): Promise<RollResult> {
    const cost = await client.config.getNumber(guildId, 'gacha', 'roll.cost', 500);
    const paid = await client.xp.spend(guildId, userId, cost);
    if (!paid) return { ok: false, reason: `You need ${cost} XP to roll.` };

    // Try the drawn rarity, then fall back to any rarity that has characters.
    let rarity = await this.pickRarity(client, guildId);
    let pool = await prisma.gachaCharacter.findMany({ where: { rarity, enabled: true } });
    if (pool.length === 0) {
      pool = await prisma.gachaCharacter.findMany({ where: { enabled: true } });
      if (pool.length === 0) {
        // refund — no content configured
        await client.xp.grantBalance(guildId, userId, cost);
        return { ok: false, reason: 'No gacha characters are configured.' };
      }
    }
    const character = pool[Math.floor(Math.random() * pool.length)];
    rarity = character.rarity;

    const memberRow = await entities.ensureMember(guildId, userId, username);

    const existing = await prisma.userCharacter.findUnique({
      where: { memberId_characterId: { memberId: memberRow.id, characterId: character.id } },
    });

    let isNew = false;
    let copies = 1;
    if (existing) {
      const updated = await prisma.userCharacter.update({
        where: { id: existing.id },
        data: { copies: { increment: 1 } },
      });
      copies = updated.copies;
    } else {
      isNew = true;
      await prisma.userCharacter.create({
        data: { memberId: memberRow.id, characterId: character.id },
      });
    }

    return { ok: true, character, isNew, copies };
  }
}
