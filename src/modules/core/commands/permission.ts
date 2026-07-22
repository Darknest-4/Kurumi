import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { PermissionEffect, PermissionTargetType } from '@prisma/client';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'core',
  permission: 'permission',
  data: new SlashCommandBuilder()
    .setName('permission')
    .setDescription('Grant or deny permission nodes to roles or users.')
    .addSubcommand((s) =>
      s
        .setName('allow')
        .setDescription('Allow a node for a role or user.')
        .addStringOption((o) =>
          o.setName('node').setDescription('e.g. economy.work or vault.*').setRequired(true),
        )
        .addMentionableOption((o) =>
          o.setName('target').setDescription('Role or user').setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('deny')
        .setDescription('Deny a node for a role or user (overrides allows).')
        .addStringOption((o) => o.setName('node').setDescription('Permission node').setRequired(true))
        .addMentionableOption((o) =>
          o.setName('target').setDescription('Role or user').setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('clear')
        .setDescription('Remove a node assignment from a role or user.')
        .addStringOption((o) => o.setName('node').setDescription('Permission node').setRequired(true))
        .addMentionableOption((o) =>
          o.setName('target').setDescription('Role or user').setRequired(true),
        ),
    ),
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();
    const node = interaction.options.getString('node', true);
    const target = interaction.options.getMentionable('target', true) as {
      id: string;
      username?: string;
      user?: unknown;
    };

    // Roles have neither a `username` (User) nor a `user` (GuildMember).
    const isRole = !('username' in target) && !('user' in target);
    const targetType = isRole ? PermissionTargetType.ROLE : PermissionTargetType.USER;
    const targetId = target.id;

    if (sub === 'clear') {
      await client.permissions.unassign(guildId, node, targetType, targetId);
      await interaction.reply({
        embeds: [successEmbed(`Cleared \`${node}\` for <@${isRole ? '&' : ''}${targetId}>.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const effect = sub === 'deny' ? PermissionEffect.DENY : PermissionEffect.ALLOW;
    await client.permissions.assign(guildId, node, targetType, targetId, effect);
    await client.logs.record(guildId, 'admin', {
      actorId: interaction.user.id,
      data: { action: 'permission.set', node, targetType, targetId, effect },
    });
    await interaction.reply({
      embeds: [
        successEmbed(
          `**${effect}** \`${node}\` for ${isRole ? `<@&${targetId}>` : `<@${targetId}>`}.`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});
