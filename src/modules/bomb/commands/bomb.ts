import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { BombService } from '../BombService';

export default defineCommand({
  module: 'bomb',
  permission: 'bomb.start',
  data: new SlashCommandBuilder()
    .setName('bomb')
    .setDescription('Start a Bomb survival game in this channel.'),
  async execute({ client, interaction, guildId }) {
    const res = await BombService.start(client, guildId, interaction.channelId);
    await interaction.reply({
      embeds: [res.ok ? successEmbed('Bomb game started! 💣') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
