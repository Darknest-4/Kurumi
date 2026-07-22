import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, warningEmbed } from '../../../utils/embeds';
import { formatNumber, formatDuration } from '../../../utils/format';

export default defineCommand({
  module: 'economy',
  permission: 'economy.daily',
  data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily XP reward.'),
  async execute({ client, interaction, guildId }) {
    const result = await client.economy.daily(guildId, interaction.user.id, interaction.user.username);
    if ('ok' in result) {
      await interaction.reply({
        embeds: [
          warningEmbed(`Already claimed. Next daily in **${formatDuration(result.remainingMs)}**.`),
        ],
      });
      return;
    }
    const levelUp = result.leveledUp ? `\n🎉 You reached **level ${result.level}**!` : '';
    await interaction.reply({
      embeds: [
        successEmbed(
          `You claimed **${formatNumber(result.amount)} XP**.\nBalance: **${formatNumber(result.balance)} XP**${levelUp}`,
          '🎁 Daily',
        ),
      ],
    });
  },
});
