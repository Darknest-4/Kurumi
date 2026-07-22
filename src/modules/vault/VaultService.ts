import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from 'discord.js';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';
import { EventState } from '@prisma/client';
import { baseEmbed, DEFAULT_COLORS } from '../../utils/embeds';
import { buildCustomId } from '../../core/structures/Component';
import { formatNumber } from '../../utils/format';
import { createLogger } from '../../core/logger/logger';

const log = createLogger('vault');

/**
 * Vault raffle event. Members pay an XP entry fee to join; when the timer
 * ends a random participant wins the whole pool. Entry cost, duration and the
 * reaction emoji are all DB-driven per guild.
 */
export class VaultService {
  /** in-process timers keyed by event id (rebuilt on startup via resume()). */
  private static timers = new Map<string, NodeJS.Timeout>();

  static async start(
    client: KurumiClient,
    guildId: string,
    channelId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const active = await prisma.vaultEvent.findFirst({
      where: { guildId, channelId, state: EventState.ACTIVE },
    });
    if (active) return { ok: false, reason: 'A vault event is already running in this channel.' };

    const entryCost = await client.config.getNumber(guildId, 'vault', 'entryCost', 100);
    const duration = await client.config.getNumber(guildId, 'vault', 'durationSeconds', 60);
    const emoji = await client.config.getString(guildId, 'vault', 'reactionEmoji', '💰');

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      return { ok: false, reason: 'Invalid channel.' };
    }

    const endsAt = new Date(Date.now() + duration * 1000);
    const event = await prisma.vaultEvent.create({
      data: {
        guildId,
        channelId,
        entryCost: BigInt(entryCost),
        state: EventState.ACTIVE,
        endsAt,
      },
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('vaultJoin', event.id))
        .setLabel('Join the Vault')
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Success),
    );

    const message = await (channel as TextChannel).send({
      embeds: [this.buildEmbed(entryCost, 0, endsAt, [])],
      components: [row],
    });
    await message.react(emoji).catch(() => undefined);

    await prisma.vaultEvent.update({
      where: { id: event.id },
      data: { messageId: message.id },
    });

    this.schedule(client, event.id, endsAt.getTime() - Date.now());
    log.info({ guildId, eventId: event.id }, 'vault started');
    return { ok: true };
  }

  static async join(
    client: KurumiClient,
    eventId: string,
    userId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const event = await prisma.vaultEvent.findUnique({ where: { id: eventId } });
    if (!event || event.state !== EventState.ACTIVE) {
      return { ok: false, reason: 'This vault is no longer open.' };
    }

    const existing = await prisma.vaultParticipant.findUnique({
      where: { vaultId_userId: { vaultId: eventId, userId } },
    });
    if (existing) return { ok: false, reason: 'You already joined.' };

    const paid = await client.xp.spend(event.guildId, userId, event.entryCost);
    if (!paid) return { ok: false, reason: `You need ${formatNumber(event.entryCost)} XP to join.` };

    await prisma.vaultParticipant.create({ data: { vaultId: eventId, userId } });
    await prisma.vaultEvent.update({
      where: { id: eventId },
      data: { prizePool: { increment: event.entryCost } },
    });
    await this.refreshMessage(client, eventId);
    return { ok: true };
  }

  static async finalize(client: KurumiClient, eventId: string): Promise<void> {
    this.clearTimer(eventId);
    const event = await prisma.vaultEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event || event.state !== EventState.ACTIVE) return;

    if (event.participants.length === 0) {
      await prisma.vaultEvent.update({
        where: { id: eventId },
        data: { state: EventState.CANCELLED, finishedAt: new Date() },
      });
      await this.editFinal(client, event.channelId, event.messageId, '💰 The vault expired with no participants.');
      return;
    }

    const winner = event.participants[Math.floor(Math.random() * event.participants.length)];
    await client.xp.grantBalance(event.guildId, winner.userId, event.prizePool);
    await prisma.vaultEvent.update({
      where: { id: eventId },
      data: { state: EventState.FINISHED, winnerId: winner.userId, finishedAt: new Date() },
    });

    await client.logs.record(event.guildId, 'vault', {
      targetId: winner.userId,
      data: {
        prize: event.prizePool.toString(),
        participants: event.participants.length,
      },
    });

    await this.editFinal(
      client,
      event.channelId,
      event.messageId,
      `💰 <@${winner.userId}> won the vault of **${formatNumber(event.prizePool)} XP**! (${event.participants.length} entrants)`,
    );
    log.info({ eventId, winner: winner.userId }, 'vault finished');
  }

  /** Re-arm timers for events still ACTIVE after a restart. */
  static async resume(client: KurumiClient): Promise<void> {
    const active = await prisma.vaultEvent.findMany({ where: { state: EventState.ACTIVE } });
    for (const event of active) {
      const remaining = (event.endsAt?.getTime() ?? Date.now()) - Date.now();
      if (remaining <= 0) await this.finalize(client, event.id);
      else this.schedule(client, event.id, remaining);
    }
    if (active.length) log.info({ count: active.length }, 'resumed active vaults');
  }

  private static schedule(client: KurumiClient, eventId: string, ms: number): void {
    this.clearTimer(eventId);
    this.timers.set(
      eventId,
      setTimeout(() => void this.finalize(client, eventId).catch(() => undefined), Math.max(0, ms)),
    );
  }

  private static clearTimer(eventId: string): void {
    const t = this.timers.get(eventId);
    if (t) clearTimeout(t);
    this.timers.delete(eventId);
  }

  private static async refreshMessage(client: KurumiClient, eventId: string): Promise<void> {
    const event = await prisma.vaultEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event?.messageId) return;
    const channel = await client.channels.fetch(event.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await (channel as TextChannel).messages.fetch(event.messageId).catch(() => null);
    if (!message) return;
    await message
      .edit({
        embeds: [
          this.buildEmbed(
            Number(event.entryCost),
            Number(event.prizePool),
            event.endsAt ?? new Date(),
            event.participants.map((p) => p.userId),
          ),
        ],
      })
      .catch(() => undefined);
  }

  private static buildEmbed(
    entryCost: number,
    prizePool: number,
    endsAt: Date,
    participants: string[],
  ) {
    const list = participants.length
      ? participants.map((id) => `<@${id}>`).join(', ').slice(0, 1024)
      : '_No one yet — be the first!_';
    return baseEmbed(DEFAULT_COLORS.warning)
      .setTitle('💰 VAULT EVENT')
      .setDescription(
        `Click **Join the Vault** or react to enter!\nEntry fee: **${formatNumber(entryCost)} XP**\nOne winner takes the whole pool.`,
      )
      .addFields(
        { name: 'Prize Pool', value: `**${formatNumber(prizePool)} XP**`, inline: true },
        { name: 'Entrants', value: `**${participants.length}**`, inline: true },
        { name: 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: 'Participants', value: list },
      );
  }

  private static async editFinal(
    client: KurumiClient,
    channelId: string,
    messageId: string | null,
    content: string,
  ): Promise<void> {
    if (!messageId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
    if (!message) return;
    await message
      .edit({
        embeds: [baseEmbed(DEFAULT_COLORS.success).setTitle('💰 VAULT — Finished').setDescription(content)],
        components: [],
      })
      .catch(() => undefined);
  }
}
