import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';
import { prisma } from '../../../core/database/prisma';

const MEDALS = ['🥇', '🥈', '🥉'];

export default defineCommand({
  module: 'leaderboard',
  permission: 'leaderboard.view',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top members by lifetime XP.')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Ranking metric')
        .addChoices(
          { name: 'XP', value: 'xp' },
          { name: 'Level', value: 'level' },
          { name: 'Messages', value: 'messages' },
        ),
    ),
  async execute({ client, interaction, guildId }) {
    const type = (interaction.options.getString('type') ?? 'xp') as 'xp' | 'level' | 'messages';
    const pageSize = await client.config.getNumber(guildId, 'leaderboard', 'pageSize', 10);

    const orderBy =
      type === 'messages'
        ? { messages: 'desc' as const }
        : type === 'level'
          ? { totalXp: 'desc' as const }
          : { totalXp: 'desc' as const };

    const members = await prisma.member.findMany({
      where: { guildId },
      orderBy,
      take: pageSize,
    });

    const lines = members.map((m, i) => {
      const pos = MEDALS[i] ?? `**${i + 1}.**`;
      const metric =
        type === 'messages'
          ? `${formatNumber(m.messages)} msgs`
          : type === 'level'
            ? `level ${m.level}`
            : `${formatNumber(m.totalXp)} XP`;
      return `${pos} <@${m.userId}> — ${metric}`;
    });

    await interaction.reply({
      embeds: [
        baseEmbed()
          .setTitle(`🏆 Leaderboard — ${type.toUpperCase()}`)
          .setDescription(lines.join('\n') || '_No data yet._'),
      ],
    });
  },
});
