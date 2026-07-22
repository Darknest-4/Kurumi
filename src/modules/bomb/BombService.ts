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

const log = createLogger('bomb');

/**
 * Bomb survival event. Members pay XP to join during a window; then one player
 * is eliminated every tick until a single survivor wins the pool. Entry cost,
 * tick interval and the join window are DB-driven.
 */
export class BombService {
  private static timers = new Map<string, NodeJS.Timeout>();

  static async start(
    client: KurumiClient,
    guildId: string,
    channelId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const active = await prisma.bombEvent.findFirst({
      where: { guildId, channelId, state: { in: [EventState.PENDING, EventState.ACTIVE] } },
    });
    if (active) return { ok: false, reason: 'A bomb game is already running here.' };

    const entryCost = await client.config.getNumber(guildId, 'bomb', 'entryCost', 100);
    const tick = await client.config.getNumber(guildId, 'bomb', 'tickSeconds', 15);
    const joinWindow = await client.config.getNumber(guildId, 'bomb', 'joinWindowSeconds', 30);

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return { ok: false, reason: 'Invalid channel.' };

    const event = await prisma.bombEvent.create({
      data: { guildId, channelId, entryCost: BigInt(entryCost), tickSeconds: tick, state: EventState.PENDING },
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('bombJoin', event.id))
        .setLabel('Join (pay XP)')
        .setEmoji('💣')
        .setStyle(ButtonStyle.Danger),
    );
    const message = await (channel as TextChannel).send({
      embeds: [this.lobbyEmbed(entryCost, joinWindow, [])],
      components: [row],
    });
    await prisma.bombEvent.update({ where: { id: event.id }, data: { messageId: message.id } });

    this.setTimer(event.id, () => void this.begin(client, event.id), joinWindow * 1000);
    log.info({ guildId, eventId: event.id }, 'bomb started (lobby)');
    return { ok: true };
  }

  static async join(
    client: KurumiClient,
    eventId: string,
    userId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const event = await prisma.bombEvent.findUnique({ where: { id: eventId } });
    if (!event || event.state !== EventState.PENDING) {
      return { ok: false, reason: 'The lobby is closed.' };
    }
    const existing = await prisma.bombParticipant.findUnique({
      where: { bombId_userId: { bombId: eventId, userId } },
    });
    if (existing) return { ok: false, reason: 'You already joined.' };

    const paid = await client.xp.spend(event.guildId, userId, event.entryCost);
    if (!paid) return { ok: false, reason: `You need ${formatNumber(event.entryCost)} XP to join.` };

    await prisma.bombParticipant.create({ data: { bombId: eventId, userId } });
    await prisma.bombEvent.update({
      where: { id: eventId },
      data: { prizePool: { increment: event.entryCost } },
    });
    await this.refreshLobby(client, eventId);
    return { ok: true };
  }

  private static async begin(client: KurumiClient, eventId: string): Promise<void> {
    const event = await prisma.bombEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event || event.state !== EventState.PENDING) return;

    if (event.participants.length < 2) {
      // Refund the lone participant, cancel.
      for (const p of event.participants) {
        await client.xp.grantBalance(event.guildId, p.userId, event.entryCost);
      }
      await prisma.bombEvent.update({
        where: { id: eventId },
        data: { state: EventState.CANCELLED, finishedAt: new Date() },
      });
      await this.announce(client, event.channelId, event.messageId, '💣 Not enough players — the bomb was defused. Entries refunded.');
      return;
    }

    await prisma.bombEvent.update({ where: { id: eventId }, data: { state: EventState.ACTIVE } });
    await this.announce(client, event.channelId, event.messageId, `💣 The game begins with **${event.participants.length}** players! One is eliminated every ${event.tickSeconds}s.`);
    this.setTimer(eventId, () => void this.tick(client, eventId), event.tickSeconds * 1000);
  }

  private static async tick(client: KurumiClient, eventId: string): Promise<void> {
    const event = await prisma.bombEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event || event.state !== EventState.ACTIVE) return;

    const alive = event.participants.filter((p) => p.eliminatedAt === null);
    if (alive.length <= 1) return void this.finish(client, eventId);

    const victim = alive[Math.floor(Math.random() * alive.length)];
    const placement = alive.length; // eliminated now → placed at current count
    await prisma.bombParticipant.update({
      where: { id: victim.id },
      data: { eliminatedAt: new Date(), placement },
    });

    const remaining = alive.length - 1;
    const channel = await client.channels.fetch(event.channelId).catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel)
        .send(`💥 <@${victim.userId}> was eliminated! **${remaining}** left.`)
        .catch(() => undefined);
    }

    if (remaining <= 1) return void this.finish(client, eventId);
    this.setTimer(eventId, () => void this.tick(client, eventId), event.tickSeconds * 1000);
  }

  private static async finish(client: KurumiClient, eventId: string): Promise<void> {
    this.clearTimer(eventId);
    const event = await prisma.bombEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event || event.state !== EventState.ACTIVE) return;

    const survivor = event.participants.find((p) => p.eliminatedAt === null);
    await prisma.bombEvent.update({
      where: { id: eventId },
      data: { state: EventState.FINISHED, survivorId: survivor?.userId, finishedAt: new Date() },
    });
    if (survivor) {
      await prisma.bombParticipant.update({ where: { id: survivor.id }, data: { placement: 1 } });
      await client.xp.grantBalance(event.guildId, survivor.userId, event.prizePool);
      await client.logs.record(event.guildId, 'bomb', {
        targetId: survivor.userId,
        data: { prize: event.prizePool.toString(), players: event.participants.length },
      });
      await this.announce(
        client,
        event.channelId,
        event.messageId,
        `🏆 <@${survivor.userId}> survived and won **${formatNumber(event.prizePool)} XP**!`,
      );
    }
    log.info({ eventId, survivor: survivor?.userId }, 'bomb finished');
  }

  /** Continue any bomb events interrupted by a restart. */
  static async resume(client: KurumiClient): Promise<void> {
    const pending = await prisma.bombEvent.findMany({
      where: { state: { in: [EventState.PENDING, EventState.ACTIVE] } },
    });
    for (const e of pending) {
      if (e.state === EventState.PENDING) this.setTimer(e.id, () => void this.begin(client, e.id), 5000);
      else this.setTimer(e.id, () => void this.tick(client, e.id), e.tickSeconds * 1000);
    }
    if (pending.length) log.info({ count: pending.length }, 'resumed bomb events');
  }

  private static async refreshLobby(client: KurumiClient, eventId: string): Promise<void> {
    const event = await prisma.bombEvent.findUnique({
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
          this.lobbyEmbed(
            Number(event.entryCost),
            0,
            event.participants.map((p) => p.userId),
            Number(event.prizePool),
          ),
        ],
      })
      .catch(() => undefined);
  }

  private static lobbyEmbed(entryCost: number, joinWindow: number, players: string[], pool = 0) {
    return baseEmbed(DEFAULT_COLORS.warning)
      .setTitle('💣 BOMB GAME')
      .setDescription(
        `Pay **${formatNumber(entryCost)} XP** to join. When the lobby closes, one player is eliminated every tick until one survivor takes the pool.` +
          (joinWindow ? `\nLobby closes <t:${Math.floor((Date.now() + joinWindow * 1000) / 1000)}:R>.` : ''),
      )
      .addFields(
        { name: 'Players', value: `${players.length}`, inline: true },
        { name: 'Prize Pool', value: `${formatNumber(pool)} XP`, inline: true },
        { name: 'Entrants', value: players.map((id) => `<@${id}>`).join(', ').slice(0, 1024) || '_none yet_' },
      );
  }

  private static async announce(
    client: KurumiClient,
    channelId: string,
    messageId: string | null,
    content: string,
  ): Promise<void> {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    if (messageId) {
      const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
      if (message) {
        await message
          .edit({
            embeds: [baseEmbed(DEFAULT_COLORS.info).setTitle('💣 BOMB GAME').setDescription(content)],
            components: [],
          })
          .catch(() => undefined);
      }
    }
    await (channel as TextChannel).send(content).catch(() => undefined);
  }

  private static setTimer(eventId: string, fn: () => void, ms: number): void {
    this.clearTimer(eventId);
    this.timers.set(eventId, setTimeout(fn, Math.max(0, ms)));
  }

  private static clearTimer(eventId: string): void {
    const t = this.timers.get(eventId);
    if (t) clearTimeout(t);
    this.timers.delete(eventId);
  }
}
