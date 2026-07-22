import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { VaultService } from '../VaultService';

export default defineCommand({
  module: 'vault',
  permission: 'vault.start',
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Start a Vault raffle event in this channel.'),
  async execute({ client, interaction, guildId }) {
    const res = await VaultService.start(client, guildId, interaction.channelId);
    await interaction.reply({
      embeds: [res.ok ? successEmbed('Vault event started! 💰') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
