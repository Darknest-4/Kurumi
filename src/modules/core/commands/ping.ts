import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { infoEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'core',
  guildOnly: false,
  data: new SlashCommandBuilder().setName('ping').setDescription('Check if Kurumi is alive.'),
  async execute({ client, interaction }) {
    const sent = await interaction.reply({
      embeds: [infoEmbed('Pinging…')],
      withResponse: true,
    });
    const rtt =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [
        infoEmbed(
          `🏓 **Pong!**\nGateway: **${Math.round(client.ws.ping)}ms**\nRound-trip: **${rtt}ms**`,
          'Kurumi',
        ),
      ],
    });
  },
});
