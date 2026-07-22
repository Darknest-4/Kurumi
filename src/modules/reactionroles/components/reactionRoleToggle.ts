import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { defineComponent } from '../../../core/structures/Component';
import { errorEmbed, successEmbed } from '../../../utils/embeds';

export default defineComponent<ButtonInteraction>({
  kind: 'button',
  id: 'rr',
  module: 'reactionroles',
  async execute(interaction, _client, args) {
    if (!interaction.inCachedGuild()) return;
    const [roleId] = args;
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      await interaction.reply({ embeds: [errorEmbed('That role no longer exists.')], flags: MessageFlags.Ephemeral });
      return;
    }

    // Refuse roles the bot cannot manage (hierarchy / permissions).
    const me = interaction.guild.members.me;
    if (!me || role.position >= me.roles.highest.position) {
      await interaction.reply({ embeds: [errorEmbed('I cannot assign that role (hierarchy).')], flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.member;
    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.reply({ embeds: [successEmbed(`Removed **${role.name}**.`)], flags: MessageFlags.Ephemeral });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({ embeds: [successEmbed(`Added **${role.name}**.`)], flags: MessageFlags.Ephemeral });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed('Failed to update your roles.')], flags: MessageFlags.Ephemeral });
    }
  },
});
