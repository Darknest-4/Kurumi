import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { GiveawayService } from '../GiveawayService';
import { successEmbed, errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'gwJoin',
  module: 'giveaway',
  async execute(interaction, client, args) {
    const [giveawayId] = args;
    const res = await GiveawayService.join(client, giveawayId, interaction.user.id);
    await interaction.reply({
      embeds: [res.ok ? successEmbed('You entered the giveaway! 🎉') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
