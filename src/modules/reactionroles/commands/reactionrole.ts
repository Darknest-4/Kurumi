import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, successEmbed } from '../../../utils/embeds';
import { buildCustomId } from '../../../core/structures/Component';

export default defineCommand({
  module: 'reactionroles',
  permission: 'reactionroles.manage',
  data: (() => {
    const b = new SlashCommandBuilder()
      .setName('reactionrole')
      .setDescription('Post a self-assignable role panel (buttons).')
      .addRoleOption((o) => o.setName('role1').setDescription('Role 1').setRequired(true));
    for (let i = 2; i <= 5; i++) {
      b.addRoleOption((o) => o.setName(`role${i}`).setDescription(`Role ${i}`));
    }
    b.addStringOption((o) => o.setName('title').setDescription('Panel title'));
    return b;
  })(),
  async execute({ interaction, guildId }) {
    void guildId;
    const roles = [];
    for (let i = 1; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roles.push(role);
    }
    const title = interaction.options.getString('title') ?? '🎭 Pick your roles';

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      roles.map((r) =>
        new ButtonBuilder()
          .setCustomId(buildCustomId('rr', r.id))
          .setLabel(r.name)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    const channel = interaction.channel as TextChannel;
    await channel.send({
      embeds: [baseEmbed().setTitle(title).setDescription('Click a button to toggle a role.')],
      components: [row],
    });
    await interaction.reply({
      embeds: [successEmbed('Reaction-role panel posted.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
