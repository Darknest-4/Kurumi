import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { BombService } from '../BombService';
import { successEmbed, errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'bombJoin',
  module: 'bomb',
  permission: 'bomb.join',
  async execute(interaction, client, args) {
    const [eventId] = args;
    const res = await BombService.join(client, eventId, interaction.user.id);
    await interaction.reply({
      embeds: [res.ok ? successEmbed('You joined the bomb game! 💣') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
