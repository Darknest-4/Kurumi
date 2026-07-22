import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed } from '../../../utils/embeds';
import { formatNumber, progressBar } from '../../../utils/format';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'level',
  permission: 'level.rank',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your level and XP progress.')
    .addUserOption((o) => o.setName('user').setDescription('Whose rank to show')),
  async execute({ client, interaction, guildId }) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await prisma.member.findUnique({
      where: { guildId_userId: { guildId, userId: target.id } },
    });
    if (!member) {
      await interaction.reply({
        embeds: [baseEmbed().setDescription(`**${target.username}** hasn't earned any XP yet.`)],
      });
      return;
    }

    const curve = await client.xp.levels.getCurve(guildId);
    const { level, intoLevel, needed } = client.xp.levels.resolve(member.totalXp, curve);
    const rank =
      (await prisma.member.count({ where: { guildId, totalXp: { gt: member.totalXp } } })) + 1;

    await interaction.reply({
      embeds: [
        baseEmbed(member.color ?? undefined)
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .addFields(
            { name: 'Rank', value: `#${formatNumber(rank)}`, inline: true },
            { name: 'Level', value: `${level}`, inline: true },
            { name: 'Lifetime XP', value: formatNumber(member.totalXp), inline: true },
            {
              name: 'Progress to next level',
              value: `${progressBar(intoLevel, needed)}\n${formatNumber(intoLevel)} / ${formatNumber(needed)} XP`,
            },
          ),
      ],
    });
  },
});
