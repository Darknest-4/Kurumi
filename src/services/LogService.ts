import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { prisma } from '../core/database/prisma';
import { createLogger } from '../core/logger/logger';
import { DEFAULT_COLORS } from '../utils/embeds';

const log = createLogger('logs');

/** Categories that can each be routed to their own channel per guild. */
export type LogCategory =
  | 'xp'
  | 'pay'
  | 'vault'
  | 'bomb'
  | 'boss'
  | 'raid'
  | 'clan'
  | 'warn'
  | 'ban'
  | 'kick'
  | 'developer'
  | 'admin';

export interface LogPayload {
  actorId?: string;
  targetId?: string;
  data: Record<string, unknown>;
  embed?: EmbedBuilder;
}

/**
 * Persists an audit entry and, if the guild routes that category to a channel,
 * mirrors it there. Routing is fully DB-driven (`log_channels`).
 */
export class LogService {
  constructor(private readonly client: Client) {}

  async record(guildId: string, category: LogCategory, payload: LogPayload): Promise<void> {
    await prisma.logEntry.create({
      data: {
        guildId,
        category,
        actorId: payload.actorId,
        targetId: payload.targetId,
        data: payload.data as never,
      },
    });

    try {
      const route = await prisma.logChannel.findUnique({
        where: { guildId_category: { guildId, category } },
      });
      if (!route?.enabled) return;

      const channel = await this.client.channels.fetch(route.channelId).catch(() => null);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

      const embed =
        payload.embed ??
        new EmbedBuilder()
          .setColor(DEFAULT_COLORS.info)
          .setTitle(`Log — ${category}`)
          .setDescription('```json\n' + JSON.stringify(payload.data, null, 2).slice(0, 1900) + '\n```')
          .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      log.warn({ err, guildId, category }, 'failed to mirror log to channel');
    }
  }
}
