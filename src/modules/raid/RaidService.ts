import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from 'discord.js';
import { EventState } from '@prisma/client';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';
import { baseEmbed, DEFAULT_COLORS } from '../../utils/embeds';
import { buildCustomId } from '../../core/structures/Component';
import { formatNumber, progressBar } from '../../utils/format';
import { createLogger } from '../../core/logger/logger';

const log = createLogger('raid');

/**
 * Large-scale multi-phase raid. Hundreds of players can attack a shared boss
 * with a shield mechanic between phases and a stronger "special" attack on a
 * longer cooldown. HP, phase count and damage are DB-driven. XP is split by
 * damage contribution.
 */
export class RaidService {
  static async start(
    client: KurumiClient,
    guildId: string,
    channelId: string,
    bossKey?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const active = await prisma.raidInstance.findFirst({
      where: { guildId, channelId, state: EventState.ACTIVE },
    });
    if (active) return { ok: false, reason: 'A raid is already active here.' };

    const baseHp = await client.config.getNumber(guildId, 'raid', 'baseHp', 1_000_000);
    const key = bossKey ?? (await this.randomBossKey()) ?? 'raid-boss';

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return { ok: false, reason: 'Invalid channel.' };

    const instance = await prisma.raidInstance.create({
      data: { guildId, bossKey: key, channelId, maxHp: BigInt(baseHp), currentHp: BigInt(baseHp), phase: 1 },
    });
    const boss = await prisma.boss.findUnique({ where: { key } }).catch(() => null);

    const message = await (channel as TextChannel).send({
      content: '@here A raid boss has appeared!',
      embeds: [this.embed(boss?.name ?? key, boss?.emoji ?? '🐲', instance.currentHp, instance.maxHp, 1, 0n, 0)],
      components: [this.row(instance.id)],
    });
    await prisma.raidInstance.update({ where: { id: instance.id }, data: { messageId: message.id } });
    log.info({ guildId, key }, 'raid started');
    return { ok: true };
  }

  static async attack(
    client: KurumiClient,
    instanceId: string,
    userId: string,
    special = false,
  ): Promise<{ ok: boolean; reason?: string; damage?: number; defeated?: boolean }> {
    const instance = await prisma.raidInstance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.state !== EventState.ACTIVE) {
      return { ok: false, reason: 'This raid is over.' };
    }

    const action = special ? 'raid.special' : 'raid.attack';
    const cdKey = `${action}.${instanceId}`;
    if (await client.cooldowns.isOnCooldown(instance.guildId, userId, cdKey)) {
      return { ok: false, reason: 'That attack is on cooldown.' };
    }
    const cd = special
      ? await client.config.getNumber(instance.guildId, 'raid', 'special.cooldown', 60)
      : await client.config.getNumber(instance.guildId, 'raid', 'attack.cooldown', 5);
    await client.cooldowns.set(instance.guildId, userId, cdKey, cd);

    const base = await client.config.getNumber(instance.guildId, 'raid', 'attack.baseDamage', 250);
    const specialMult = await client.config.getNumber(instance.guildId, 'raid', 'special.multiplier', 4);
    const raw = Math.round(base * (0.8 + Math.random() * 0.4) * (special ? specialMult : 1));

    // Shield absorbs damage first.
    let shield = instance.shield;
    let hp = instance.currentHp;
    let remaining = BigInt(raw);
    if (shield > 0n) {
      const absorbed = remaining > shield ? shield : remaining;
      shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0n) hp -= remaining;

    // Phase advance + shield wall.
    const totalPhases = await client.config.getNumber(instance.guildId, 'raid', 'phases', 3);
    const shieldFactor = await client.config.getNumber(instance.guildId, 'raid', 'shield.factor', 0.2);
    let phase = instance.phase;
    const threshold = (instance.maxHp * BigInt(totalPhases - phase)) / BigInt(totalPhases);
    if (hp <= threshold && phase < totalPhases && shield <= 0n) {
      phase += 1;
      shield = BigInt(Math.round(Number(instance.maxHp) * shieldFactor));
    }

    await prisma.raidParticipant.upsert({
      where: { raidId_userId: { raidId: instanceId, userId } },
      create: { raidId: instanceId, userId, damage: BigInt(raw) },
      update: { damage: { increment: BigInt(raw) } },
    });

    if (hp <= 0n) {
      await prisma.raidInstance.update({
        where: { id: instanceId },
        data: { currentHp: 0n, shield: 0n, phase },
      });
      await this.finish(client, instanceId);
      return { ok: true, damage: raw, defeated: true };
    }

    await prisma.raidInstance.update({
      where: { id: instanceId },
      data: { currentHp: hp, shield, phase },
    });
    await this.refresh(client, instanceId);
    return { ok: true, damage: raw, defeated: false };
  }

  private static async finish(client: KurumiClient, instanceId: string): Promise<void> {
    const instance = await prisma.raidInstance.findUnique({
      where: { id: instanceId },
      include: { participants: true },
    });
    if (!instance || instance.state !== EventState.ACTIVE) return;

    await prisma.raidInstance.update({
      where: { id: instanceId },
      data: { state: EventState.FINISHED, finishedAt: new Date() },
    });

    const totalDamage = instance.participants.reduce((a, p) => a + p.damage, 0n) || 1n;
    const xpPool = BigInt(Math.round(Number(instance.maxHp) / 5));
    const ranked = [...instance.participants].sort((a, b) => Number(b.damage - a.damage));
    for (const p of ranked) {
      const share = (xpPool * p.damage) / totalDamage;
      if (share > 0n) await client.xp.award(instance.guildId, p.userId, share, 'raid');
    }
    await client.logs.record(instance.guildId, 'raid', {
      data: { boss: instance.bossKey, players: instance.participants.length, xpPool: xpPool.toString() },
    });

    const board = ranked
      .slice(0, 10)
      .map((p, i) => `**${i + 1}.** <@${p.userId}> — ${formatNumber(p.damage)} dmg`)
      .join('\n');
    await this.edit(client, instance.channelId, instance.messageId, [
      baseEmbed(DEFAULT_COLORS.success)
        .setTitle(`🐲 ${instance.bossKey} — RAID CLEARED`)
        .setDescription(`Raid defeated by **${instance.participants.length}** players!\n**${formatNumber(xpPool)} XP** split by damage.\n\n${board}`),
    ]);
    log.info({ raid: instance.bossKey }, 'raid cleared');
  }

  static async resume(client: KurumiClient): Promise<void> {
    // Raids have no timers; nothing to re-arm. Method kept for symmetry.
    void client;
  }

  private static async refresh(client: KurumiClient, instanceId: string): Promise<void> {
    const instance = await prisma.raidInstance.findUnique({
      where: { id: instanceId },
      include: { participants: true },
    });
    if (!instance?.messageId) return;
    const boss = await prisma.boss.findUnique({ where: { key: instance.bossKey } }).catch(() => null);
    await this.edit(
      client,
      instance.channelId,
      instance.messageId,
      [
        this.embed(
          boss?.name ?? instance.bossKey,
          boss?.emoji ?? '🐲',
          instance.currentHp,
          instance.maxHp,
          instance.phase,
          instance.shield,
          instance.participants.length,
        ),
      ],
      [this.row(instanceId)],
    );
  }

  private static async randomBossKey(): Promise<string | null> {
    const all = await prisma.boss.findMany({ where: { enabled: true } });
    return all.length ? all[Math.floor(Math.random() * all.length)].key : null;
  }

  private static row(instanceId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('raidAtk', instanceId))
        .setLabel('Attack')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(buildCustomId('raidSpecial', instanceId))
        .setLabel('Special')
        .setEmoji('💥')
        .setStyle(ButtonStyle.Primary),
    );
  }

  private static embed(
    name: string,
    emoji: string,
    hp: bigint,
    maxHp: bigint,
    phase: number,
    shield: bigint,
    fighters: number,
  ) {
    const safeHp = hp < 0n ? 0n : hp;
    return baseEmbed(DEFAULT_COLORS.error)
      .setTitle(`${emoji} ${name} — RAID`)
      .setDescription('Attack together to bring the boss down! Break the shield between phases.')
      .addFields(
        { name: `HP (Phase ${phase})`, value: `${progressBar(safeHp, maxHp, 18)}\n${formatNumber(safeHp)} / ${formatNumber(maxHp)}` },
        { name: '🛡️ Shield', value: shield > 0n ? formatNumber(shield) : 'down', inline: true },
        { name: 'Raiders', value: `${fighters}`, inline: true },
      );
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
