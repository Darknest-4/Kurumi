import { type ButtonInteraction, type GuildChannel } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { baseEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'ticketClose',
  module: 'tickets',
  async execute(interaction, _client, _args) {
    if (!interaction.inCachedGuild()) return;
    await interaction.reply({
      embeds: [baseEmbed().setDescription('🔒 Closing this ticket in 5 seconds…')],
    });
    const channel = interaction.channel as GuildChannel | null;
    setTimeout(() => {
      channel?.delete().catch(() => undefined);
    }, 5000);
  },
});
