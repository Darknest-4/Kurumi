import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, warningEmbed } from '../../../utils/embeds';
import { formatNumber, formatDuration } from '../../../utils/format';

export default defineCommand({
  module: 'economy',
  permission: 'economy.work',
  data: new SlashCommandBuilder().setName('work').setDescription('Do some work to earn XP.'),
  async execute({ client, interaction, guildId }) {
    const result = await client.economy.work(guildId, interaction.user.id, interaction.user.username);
    if ('ok' in result) {
      await interaction.reply({
        embeds: [
          warningEmbed(`You're tired. Come back in **${formatDuration(result.remainingMs)}**.`),
        ],
      });
      return;
    }
    const levelUp = result.leveledUp ? `\n🎉 You reached **level ${result.level}**!` : '';
    await interaction.reply({
      embeds: [
        successEmbed(
          `You worked hard and earned **${formatNumber(result.amount)} XP**.\nBalance: **${formatNumber(result.balance)} XP**${levelUp}`,
          '💼 Work',
        ),
      ],
    });
  },
});
