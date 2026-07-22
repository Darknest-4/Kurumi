import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';

export default defineCommand({
  module: 'economy',
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your (or another member\'s) XP balance.')
    .addUserOption((o) => o.setName('user').setDescription('Whose balance to check')),
  async execute({ client, interaction, guildId }) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const balance = await client.xp.getBalance(guildId, target.id);
    await interaction.reply({
      embeds: [
        baseEmbed()
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .setDescription(`💠 Balance: **${formatNumber(balance)} XP**`),
      ],
    });
  },
});
