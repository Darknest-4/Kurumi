import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { VaultService } from '../VaultService';
import { successEmbed, errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'vaultJoin',
  module: 'vault',
  permission: 'vault.join',
  async execute(interaction, client, args) {
    const [eventId] = args;
    const res = await VaultService.join(client, eventId, interaction.user.id);
    await interaction.reply({
      embeds: [
        res.ok ? successEmbed('You joined the vault! 💰') : errorEmbed(res.reason ?? 'Failed.'),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});
