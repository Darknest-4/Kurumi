import { ShopItemType, type ShopItem } from '@prisma/client';
import { prisma } from '../../core/database/prisma';
import type { KurumiClient } from '../../core/KurumiClient';
import { EntityRepository } from '../../repositories/EntityRepository';
import { PetService } from '../pets/PetService';

const entities = new EntityRepository();

export interface BuyResult {
  ok: boolean;
  reason?: string;
  message?: string;
}

/**
 * Shop priced entirely in XP. Items are per-guild rows so each server sets its
 * own catalog and prices. `payload` carries type-specific data (boost mult &
 * duration, color hex, banner url, title/badge key, lootbox table).
 */
export class ShopService {
  static async buy(
    client: KurumiClient,
    guildId: string,
    userId: string,
    key: string,
    username?: string,
  ): Promise<BuyResult> {
    const item = await prisma.shopItem.findUnique({ where: { guildId_key: { guildId, key } } });
    if (!item || !item.enabled) return { ok: false, reason: 'That item is not available.' };
    if (item.stock !== null && item.stock <= 0) return { ok: false, reason: 'Out of stock.' };

    const paid = await client.xp.spend(guildId, userId, item.price);
    if (!paid) return { ok: false, reason: `You need ${item.price} XP to buy this.` };

    if (item.stock !== null) {
      await prisma.shopItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
    }

    const message = await this.applyEffect(guildId, userId, item, username);
    await client.logs.record(guildId, 'admin', {
      actorId: userId,
      data: { action: 'shop.buy', key, price: item.price.toString() },
    });
    return { ok: true, message };
  }

  private static async applyEffect(
    guildId: string,
    userId: string,
    item: ShopItem,
    username?: string,
  ): Promise<string> {
    const member = await entities.ensureMember(guildId, userId, username);
    const payload = (item.payload ?? {}) as Record<string, unknown>;

    switch (item.type) {
      case ShopItemType.TITLE: {
        const title = await prisma.title.findUnique({ where: { key: String(payload.titleKey) } });
        if (title) {
          await prisma.userTitle
            .create({ data: { memberId: member.id, titleId: title.id } })
            .catch(() => undefined);
          await prisma.member.update({ where: { id: member.id }, data: { activeTitleId: title.id } });
          return `🎖️ You unlocked the title **${title.text}**.`;
        }
        return 'Title granted.';
      }
      case ShopItemType.BADGE: {
        const badge = await prisma.badge.findUnique({ where: { key: String(payload.badgeKey) } });
        if (badge) {
          await prisma.userBadge
            .create({ data: { memberId: member.id, badgeId: badge.id } })
            .catch(() => undefined);
          return `🏆 You earned the **${badge.name}** badge.`;
        }
        return 'Badge granted.';
      }
      case ShopItemType.COLOR: {
        await prisma.member.update({ where: { id: member.id }, data: { color: String(payload.color) } });
        return `🎨 Profile color set to \`${payload.color}\`.`;
      }
      case ShopItemType.BANNER: {
        await prisma.member.update({ where: { id: member.id }, data: { bannerUrl: String(payload.url) } });
        return '🖼️ Profile banner updated.';
      }
      case ShopItemType.XP_BOOST: {
        const multiplier = Number(payload.multiplier ?? 2);
        const hours = Number(payload.durationHours ?? 1);
        await prisma.xpBoost.create({
          data: {
            memberId: member.id,
            multiplier,
            source: `shop:${item.key}`,
            expiresAt: new Date(Date.now() + hours * 3_600_000),
          },
        });
        return `⚡ **${multiplier}× XP boost** active for **${hours}h**.`;
      }
      case ShopItemType.PET_EGG: {
        const species = await PetService.hatchRandom(guildId, userId, username);
        return species
          ? `🥚 Your egg hatched into ${species.emoji ?? ''} **${species.name}** (${species.rarity})!`
          : 'No pet species are configured.';
      }
      default: {
        // Consumables: vault ticket, bomb shield, lootbox, avatar frame, custom.
        await prisma.inventoryItem.upsert({
          where: { memberId_itemKey: { memberId: member.id, itemKey: item.key } },
          create: {
            memberId: member.id,
            itemKey: item.key,
            itemType: item.type,
            quantity: 1,
            payload: item.payload ?? undefined,
          },
          update: { quantity: { increment: 1 } },
        });
        return `📦 Added **${item.name}** to your inventory.`;
      }
    }
  }

  /** Populate a guild with a sensible default XP shop. */
  static async seedDefaults(guildId: string): Promise<number> {
    const defaults = [
      { key: 'boost_2x_1h', name: '2× XP Boost (1h)', type: ShopItemType.XP_BOOST, price: 2000n, payload: { multiplier: 2, durationHours: 1 }, stock: null, enabled: true },
      { key: 'boost_3x_1h', name: '3× XP Boost (1h)', type: ShopItemType.XP_BOOST, price: 4000n, payload: { multiplier: 3, durationHours: 1 }, stock: null, enabled: true },
      { key: 'pet_egg', name: 'Pet Egg', type: ShopItemType.PET_EGG, price: 5000n, payload: {}, stock: null, enabled: true },
      { key: 'color_sakura', name: 'Sakura Profile Color', type: ShopItemType.COLOR, price: 3000n, payload: { color: '#ff5da2' }, stock: null, enabled: true },
      { key: 'vault_ticket', name: 'Vault Ticket', type: ShopItemType.VAULT_TICKET, price: 1500n, payload: {}, stock: null, enabled: true },
      { key: 'bomb_shield', name: 'Bomb Shield', type: ShopItemType.BOMB_SHIELD, price: 2500n, payload: {}, stock: null, enabled: true },
      { key: 'lootbox', name: 'Lootbox', type: ShopItemType.LOOTBOX, price: 3500n, payload: { table: 'standard' }, stock: null, enabled: true },
    ];
    let created = 0;
    for (const d of defaults) {
      await prisma.shopItem
        .create({ data: { guildId, ...d } })
        .then(() => created++)
        .catch(() => undefined);
    }
    return created;
  }
}
