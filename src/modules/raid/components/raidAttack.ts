import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { RaidService } from '../RaidService';
import { errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'raidAtk',
  module: 'raid',
  permission: 'raid.attack',
  async execute(interaction, client, args) {
    const [instanceId] = args;
    const res = await RaidService.attack(client, instanceId, interaction.user.id, false);
    if (!res.ok) {
      await interaction.reply({ embeds: [errorEmbed(res.reason ?? 'Failed.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      content: res.defeated
        ? `💥 Final blow! You dealt **${res.damage}** damage!`
        : `⚔️ Hit for **${res.damage}** damage!`,
      flags: MessageFlags.Ephemeral,
    });
  },
});
