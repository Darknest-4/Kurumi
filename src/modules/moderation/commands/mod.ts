import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type GuildMember,
} from 'discord.js';
import { ModerationAction } from '@prisma/client';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed, baseEmbed } from '../../../utils/embeds';
import { ModerationService } from '../ModerationService';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s
        .setName('warn')
        .setDescription('Warn a member.')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    )
    .addSubcommand((s) =>
      s
        .setName('kick')
        .setDescription('Kick a member.')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    )
    .addSubcommand((s) =>
      s
        .setName('ban')
        .setDescription('Ban a member.')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    )
    .addSubcommand((s) =>
      s
        .setName('timeout')
        .setDescription('Timeout a member for N minutes.')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1),
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    )
    .addSubcommand((s) =>
      s
        .setName('cases')
        .setDescription('List moderation cases for a member.')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
    ),
  async execute({ client, interaction, guildId }) {
    if (!interaction.inCachedGuild()) return;
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? undefined;

    const nodeFor: Record<string, string> = {
      warn: 'moderation.warn',
      kick: 'moderation.kick',
      ban: 'moderation.ban',
      timeout: 'moderation.timeout',
      cases: 'moderation.warn',
    };
    const allowed = await client.permissions.can(interaction.member, nodeFor[sub]);
    if (!allowed) {
      await interaction.reply({
        embeds: [errorEmbed(`You need the \`${nodeFor[sub]}\` permission.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'cases') {
      const cases = await prisma.moderationCase.findMany({
        where: { guildId, userId: target.id },
        orderBy: { caseNo: 'desc' },
        take: 15,
      });
      const lines = cases.map(
        (c) => `**#${c.caseNo}** ${c.action} • <t:${Math.floor(c.createdAt.getTime() / 1000)}:d> — ${c.reason ?? 'no reason'}`,
      );
      await interaction.reply({
        embeds: [
          baseEmbed()
            .setAuthor({ name: `Cases — ${target.username}`, iconURL: target.displayAvatarURL() })
            .setDescription(lines.join('\n') || '_No cases._'),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = (await interaction.guild.members.fetch(target.id).catch(() => null)) as GuildMember | null;

    try {
      let action: ModerationAction = ModerationAction.WARN;
      let expiresAt: Date | undefined;

      if (sub === 'warn') {
        action = ModerationAction.WARN;
        await target.send(`⚠️ You were warned in **${interaction.guild.name}**${reason ? `: ${reason}` : ''}.`).catch(() => undefined);
      } else if (sub === 'kick') {
        if (!member?.kickable) {
          await interaction.reply({ embeds: [errorEmbed('I cannot kick that member.')], flags: MessageFlags.Ephemeral });
          return;
        }
        action = ModerationAction.KICK;
        await member.kick(reason);
      } else if (sub === 'ban') {
        action = ModerationAction.BAN;
        await interaction.guild.members.ban(target.id, { reason });
      } else if (sub === 'timeout') {
        const minutes = interaction.options.getInteger('minutes', true);
        if (!member?.moderatable) {
          await interaction.reply({ embeds: [errorEmbed('I cannot timeout that member.')], flags: MessageFlags.Ephemeral });
          return;
        }
        action = ModerationAction.TIMEOUT;
        expiresAt = new Date(Date.now() + minutes * 60_000);
        await member.timeout(minutes * 60_000, reason);
      }

      const caseNo = await ModerationService.createCase(client, guildId, {
        userId: target.id,
        moderatorId: interaction.user.id,
        action,
        reason,
        expiresAt,
      });

      await interaction.reply({
        embeds: [successEmbed(`**${action}** applied to <@${target.id}> — case **#${caseNo}**.`)],
      });
    } catch (err) {
      await interaction.reply({
        embeds: [errorEmbed(`Action failed: ${(err as Error).message}`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});
