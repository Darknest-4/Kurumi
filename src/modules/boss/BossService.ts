import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from 'discord.js';
import { EventState, type Boss } from '@prisma/client';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';
import { baseEmbed, DEFAULT_COLORS } from '../../utils/embeds';
import { buildCustomId } from '../../core/structures/Component';
import { formatNumber, progressBar } from '../../utils/format';
import { createLogger } from '../../core/logger/logger';

const log = createLogger('boss');

/**
 * Cooperative boss fights. Boss stats & drops are DB rows; damage, attack
 * cooldown are DB-driven config. XP rewards are split by damage contribution.
 */
export class BossService {
  static async spawn(
    client: KurumiClient,
    guildId: string,
    channelId: string,
    bossKey?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const active = await prisma.bossInstance.findFirst({
      where: { guildId, channelId, state: EventState.ACTIVE },
    });
    if (active) return { ok: false, reason: 'A boss is already active in this channel.' };

    const boss = bossKey
      ? await prisma.boss.findUnique({ where: { key: bossKey } })
      : await this.randomBoss();
    if (!boss || !boss.enabled) return { ok: false, reason: 'No such boss is available.' };

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return { ok: false, reason: 'Invalid channel.' };

    const instance = await prisma.bossInstance.create({
      data: { guildId, bossId: boss.id, channelId, maxHp: boss.baseHp, currentHp: boss.baseHp },
    });

    const message = await (channel as TextChannel).send({
      embeds: [this.buildEmbed(boss, boss.baseHp, boss.baseHp, 0)],
      components: [this.row(instance.id)],
    });
    await prisma.bossInstance.update({ where: { id: instance.id }, data: { messageId: message.id } });
    log.info({ guildId, boss: boss.key }, 'boss spawned');
    return { ok: true };
  }

  static async attack(
    client: KurumiClient,
    instanceId: string,
    userId: string,
    username?: string,
  ): Promise<{ ok: boolean; reason?: string; damage?: number; defeated?: boolean }> {
    const instance = await prisma.bossInstance.findUnique({
      where: { id: instanceId },
      include: { boss: true },
    });
    if (!instance || instance.state !== EventState.ACTIVE) {
      return { ok: false, reason: 'This boss is no longer active.' };
    }

    const cooldown = await client.config.getNumber(instance.guildId, 'boss', 'attack.cooldown', 10);
    if (await client.cooldowns.isOnCooldown(instance.guildId, userId, `boss.attack.${instanceId}`)) {
      return { ok: false, reason: 'Your attack is on cooldown.' };
    }

    const base = await client.config.getNumber(instance.guildId, 'boss', 'attack.baseDamage', 100);
    const damage = Math.max(1, Math.round(base * (0.75 + Math.random() * 0.5)));

    await client.cooldowns.set(instance.guildId, userId, `boss.attack.${instanceId}`, cooldown);
    await prisma.bossContribution.upsert({
      where: { instanceId_userId: { instanceId, userId } },
      create: { instanceId, userId, damage: BigInt(damage) },
      update: { damage: { increment: BigInt(damage) } },
    });

    const updated = await prisma.bossInstance.update({
      where: { id: instanceId },
      data: { currentHp: { decrement: BigInt(damage) } },
      include: { boss: true, contributors: true },
    });

    void username;
    if (updated.currentHp <= 0n) {
      await this.defeat(client, instanceId);
      return { ok: true, damage, defeated: true };
    }

    await this.refresh(client, instanceId);
    return { ok: true, damage, defeated: false };
  }

  private static async defeat(client: KurumiClient, instanceId: string): Promise<void> {
    const instance = await prisma.bossInstance.findUnique({
      where: { id: instanceId },
      include: { boss: true, contributors: true },
    });
    if (!instance || instance.state !== EventState.ACTIVE) return;

    await prisma.bossInstance.update({
      where: { id: instanceId },
      data: { state: EventState.FINISHED, currentHp: 0n, defeatedAt: new Date() },
    });

    const drops = (instance.boss.drops ?? {}) as { xp?: number };
    const totalDamage = instance.contributors.reduce((a, c) => a + c.damage, 0n) || 1n;
    const xpPool = BigInt(Math.round(Number(drops.xp ?? Number(instance.maxHp) / 10)));

    const ranked = [...instance.contributors].sort((a, b) => Number(b.damage - a.damage));
    for (const c of ranked) {
      const share = (xpPool * c.damage) / totalDamage;
      if (share > 0n) await client.xp.award(instance.guildId, c.userId, share, 'boss');
    }

    // Top damager badge/title drop.
    const top = ranked[0];
    if (top) {
      const badge = await prisma.badge.findUnique({ where: { key: `slayer_${instance.boss.key}` } });
      if (badge) {
        const member = await prisma.member.findUnique({
          where: { guildId_userId: { guildId: instance.guildId, userId: top.userId } },
        });
        if (member)
          await prisma.userBadge
            .create({ data: { memberId: member.id, badgeId: badge.id } })
            .catch(() => undefined);
      }
    }

    await client.logs.record(instance.guildId, 'boss', {
      data: { boss: instance.boss.key, contributors: instance.contributors.length, xpPool: xpPool.toString() },
    });

    const board = ranked
      .slice(0, 5)
      .map((c, i) => `**${i + 1}.** <@${c.userId}> — ${formatNumber(c.damage)} dmg`)
      .join('\n');
    await this.edit(client, instance.channelId, instance.messageId, [
      baseEmbed(DEFAULT_COLORS.success)
        .setTitle(`${instance.boss.emoji ?? '⚔️'} ${instance.boss.name} — DEFEATED`)
        .setDescription(`The boss has fallen! **${formatNumber(xpPool)} XP** shared by damage.\n\n${board}`),
    ]);
    log.info({ boss: instance.boss.key }, 'boss defeated');
  }

  private static async refresh(client: KurumiClient, instanceId: string): Promise<void> {
    const instance = await prisma.bossInstance.findUnique({
      where: { id: instanceId },
      include: { boss: true, contributors: true },
    });
    if (!instance?.messageId) return;
    await this.edit(
      client,
      instance.channelId,
      instance.messageId,
      [this.buildEmbed(instance.boss, instance.currentHp, instance.maxHp, instance.contributors.length)],
      [this.row(instanceId)],
    );
  }

  private static async randomBoss(): Promise<Boss | null> {
    const all = await prisma.boss.findMany({ where: { enabled: true } });
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  }

  private static row(instanceId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('bossAtk', instanceId))
        .setLabel('Attack!')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger),
    );
  }

  private static buildEmbed(boss: Boss, hp: bigint, maxHp: bigint, fighters: number) {
    const pct = Number(hp < 0n ? 0n : hp);
    return baseEmbed(DEFAULT_COLORS.error)
      .setTitle(`${boss.emoji ?? '👹'} ${boss.name}`)
      .setDescription(`${boss.anime ? `*${boss.anime}*\n` : ''}A boss appeared! Click **Attack** to fight.`)
      .addFields(
        {
          name: 'HP',
          value: `${progressBar(pct, maxHp, 16)}\n${formatNumber(hp < 0n ? 0n : hp)} / ${formatNumber(maxHp)}`,
        },
        { name: 'Fighters', value: `${fighters}`, inline: true },
      )
      .setThumbnail(boss.imageUrl ?? null);
  }

  private static async edit(
    client: KurumiClient,
    channelId: string,
    messageId: string | null,
    embeds: ReturnType<typeof baseEmbed>[],
    components: ActionRowBuilder<ButtonBuilder>[] = [],
  ): Promise<void> {
    if (!messageId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
    if (!message) return;
    await message.edit({ embeds, components }).catch(() => undefined);
  }
}
