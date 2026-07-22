import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { BossService } from '../BossService';
import { errorEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'bossAtk',
  module: 'boss',
  permission: 'boss.attack',
  async execute(interaction, client, args) {
    const [instanceId] = args;
    const res = await BossService.attack(client, instanceId, interaction.user.id, interaction.user.username);
    if (!res.ok) {
      await interaction.reply({ embeds: [errorEmbed(res.reason ?? 'Failed.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      content: res.defeated
        ? `💥 You struck the final blow for **${res.damage}** damage!`
        : `⚔️ You hit for **${res.damage}** damage!`,
      flags: MessageFlags.Ephemeral,
    });
  },
});
