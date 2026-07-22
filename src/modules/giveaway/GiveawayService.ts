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
import { formatNumber } from '../../utils/format';
import { createLogger } from '../../core/logger/logger';

const log = createLogger('giveaway');

/** Timed giveaways. Optional XP entry fee; winners drawn at the end. */
export class GiveawayService {
  private static timers = new Map<string, NodeJS.Timeout>();

  static async start(
    client: KurumiClient,
    guildId: string,
    channelId: string,
    params: { prize: string; winners: number; durationSeconds: number; entryCost: number; createdBy: string },
  ): Promise<{ ok: boolean; reason?: string }> {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return { ok: false, reason: 'Invalid channel.' };

    const endsAt = new Date(Date.now() + params.durationSeconds * 1000);
    const giveaway = await prisma.giveaway.create({
      data: {
        guildId,
        channelId,
        prize: params.prize,
        winners: Math.max(1, params.winners),
        entryCost: BigInt(params.entryCost),
        createdBy: params.createdBy,
        endsAt,
      },
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('gwJoin', giveaway.id))
        .setLabel('Enter')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success),
    );
    const message = await (channel as TextChannel).send({
      embeds: [this.embed(params.prize, params.winners, params.entryCost, endsAt, 0)],
      components: [row],
    });
    await prisma.giveaway.update({ where: { id: giveaway.id }, data: { messageId: message.id } });

    this.schedule(client, giveaway.id, endsAt.getTime() - Date.now());
    return { ok: true };
  }

  static async join(
    client: KurumiClient,
    giveawayId: string,
    userId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const gw = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
    if (!gw || gw.state !== EventState.ACTIVE) return { ok: false, reason: 'This giveaway has ended.' };

    const existing = await prisma.giveawayEntry.findUnique({
      where: { giveawayId_userId: { giveawayId, userId } },
    });
    if (existing) return { ok: false, reason: 'You already entered.' };

    if (gw.entryCost > 0n) {
      const paid = await client.xp.spend(gw.guildId, userId, gw.entryCost);
      if (!paid) return { ok: false, reason: `You need ${formatNumber(gw.entryCost)} XP to enter.` };
    }
    await prisma.giveawayEntry.create({ data: { giveawayId, userId } });
    await this.refresh(client, giveawayId);
    return { ok: true };
  }

  static async finish(client: KurumiClient, giveawayId: string): Promise<void> {
    this.clearTimer(giveawayId);
    const gw = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: { entries: true },
    });
    if (!gw || gw.state !== EventState.ACTIVE) return;

    await prisma.giveaway.update({ where: { id: giveawayId }, data: { state: EventState.FINISHED } });

    const pool = [...gw.entries];
    const winners: string[] = [];
    for (let i = 0; i < gw.winners && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0].userId);
    }

    await client.logs.record(gw.guildId, 'admin', {
      data: { action: 'giveaway.end', prize: gw.prize, winners },
    });

    const text = winners.length
      ? `🎉 **${gw.prize}**\nWinners: ${winners.map((w) => `<@${w}>`).join(', ')}`
      : `🎉 **${gw.prize}**\nNo valid entries — no winner.`;
    await this.edit(client, gw.channelId, gw.messageId, text);

    const channel = await client.channels.fetch(gw.channelId).catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased() && winners.length) {
      await (channel as TextChannel)
        .send(`🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')} — you won **${gw.prize}**!`)
        .catch(() => undefined);
    }
    log.info({ giveawayId, winners: winners.length }, 'giveaway finished');
  }

  static async resume(client: KurumiClient): Promise<void> {
    const active = await prisma.giveaway.findMany({ where: { state: EventState.ACTIVE } });
    for (const gw of active) {
      const remaining = gw.endsAt.getTime() - Date.now();
      if (remaining <= 0) await this.finish(client, gw.id);
      else this.schedule(client, gw.id, remaining);
    }
    if (active.length) log.info({ count: active.length }, 'resumed giveaways');
  }

  private static schedule(client: KurumiClient, id: string, ms: number): void {
    this.clearTimer(id);
    this.timers.set(id, setTimeout(() => void this.finish(client, id).catch(() => undefined), Math.max(0, ms)));
  }

  private static clearTimer(id: string): void {
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
  }

  private static async refresh(client: KurumiClient, id: string): Promise<void> {
    const gw = await prisma.giveaway.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
    if (!gw?.messageId) return;
    const channel = await client.channels.fetch(gw.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await (channel as TextChannel).messages.fetch(gw.messageId).catch(() => null);
    if (!message) return;
    await message
      .edit({
        embeds: [this.embed(gw.prize, gw.winners, Number(gw.entryCost), gw.endsAt, gw._count.entries)],
      })
      .catch(() => undefined);
  }

  private static embed(prize: string, winners: number, entryCost: number, endsAt: Date, entries: number) {
    return baseEmbed(DEFAULT_COLORS.primary)
      .setTitle('🎉 GIVEAWAY')
      .setDescription(`**Prize:** ${prize}`)
      .addFields(
        { name: 'Winners', value: `${winners}`, inline: true },
        { name: 'Entry', value: entryCost > 0 ? `${formatNumber(entryCost)} XP` : 'Free', inline: true },
        { name: 'Entries', value: `${entries}`, inline: true },
        { name: 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
      );
  }

  private static async edit(
    client: KurumiClient,
    channelId: string,
    messageId: string | null,
    description: string,
  ): Promise<void> {
    if (!messageId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
    if (!message) return;
    await message
      .edit({
        embeds: [baseEmbed(DEFAULT_COLORS.success).setTitle('🎉 GIVEAWAY — Ended').setDescription(description)],
        components: [],
      })
      .catch(() => undefined);
  }
}
