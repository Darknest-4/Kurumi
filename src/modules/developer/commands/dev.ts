import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { prisma } from '../../../core/database/prisma';
import { redis } from '../../../core/database/redis';
import { formatNumber } from '../../../utils/format';

/**
 * Global developer console. Developers are stored in the DB (plus bootstrap
 * owners from env) and bypass blacklist/maintenance. Guild-scoped so XP ops
 * apply to the current server.
 */
export default defineCommand({
  module: 'developer',
  developerOnly: true,
  guildOnly: false,
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('Developer tools.')
    .addSubcommandGroup((g) =>
      g
        .setName('xp')
        .setDescription('XP operations (current server).')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add XP to a user.')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
            .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove XP from a user.')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
            .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('reset')
            .setDescription('Reset a user\'s XP to zero.')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('maintenance')
        .setDescription('Global maintenance mode.')
        .addSubcommand((s) =>
          s
            .setName('on')
            .setDescription('Enable maintenance mode.')
            .addStringOption((o) => o.setName('note').setDescription('Reason shown to users')),
        )
        .addSubcommand((s) => s.setName('off').setDescription('Disable maintenance mode.')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('blacklist')
        .setDescription('Global blacklist.')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Blacklist a user.')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
            .addStringOption((o) => o.setName('reason').setDescription('Reason')),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a user from the blacklist.')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true)),
        ),
    ),
  async execute({ client, interaction, guildId }) {
    const group = interaction.options.getSubcommandGroup(true);
    const sub = interaction.options.getSubcommand(true);

    if (group === 'xp') {
      const user = interaction.options.getUser('user', true);
      if (sub === 'reset') {
        await client.xp.adminReset(guildId, user.id);
        await interaction.reply({ embeds: [successEmbed(`Reset XP for <@${user.id}>.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const amount = interaction.options.getInteger('amount', true);
      if (sub === 'add') {
        const res = await client.xp.award(guildId, user.id, amount, 'admin', user.username);
        await interaction.reply({
          embeds: [successEmbed(`Added **${formatNumber(amount)} XP** to <@${user.id}>. New balance: ${formatNumber(res.balance)}.`)],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const current = await client.xp.getBalance(guildId, user.id);
        const newTotal = current - BigInt(amount);
        await client.xp.adminSetTotal(guildId, user.id, newTotal > 0n ? newTotal : 0n);
        await interaction.reply({
          embeds: [successEmbed(`Removed **${formatNumber(amount)} XP** from <@${user.id}>.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (group === 'maintenance') {
      const on = sub === 'on';
      const note = interaction.options.getString('note') ?? undefined;
      await prisma.globalState.upsert({
        where: { id: 1 },
        create: { id: 1, maintenance: on, maintenanceNote: note },
        update: { maintenance: on, maintenanceNote: note },
      });
      await redis.del('maintenance').catch(() => undefined);
      await interaction.reply({
        embeds: [successEmbed(`Maintenance mode **${on ? 'enabled' : 'disabled'}**.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (group === 'blacklist') {
      const user = interaction.options.getUser('user', true);
      if (sub === 'add') {
        const reason = interaction.options.getString('reason') ?? undefined;
        await prisma.user.upsert({ where: { id: user.id }, create: { id: user.id }, update: {} });
        await prisma.blacklist.upsert({
          where: { userId: user.id },
          create: { userId: user.id, reason, addedBy: interaction.user.id },
          update: { reason },
        });
        await redis.del(`bl:${user.id}`).catch(() => undefined);
        await interaction.reply({ embeds: [successEmbed(`Blacklisted <@${user.id}>.`)], flags: MessageFlags.Ephemeral });
      } else {
        await prisma.blacklist.delete({ where: { userId: user.id } }).catch(() => undefined);
        await redis.del(`bl:${user.id}`).catch(() => undefined);
        await interaction.reply({ embeds: [successEmbed(`Removed <@${user.id}> from the blacklist.`)], flags: MessageFlags.Ephemeral });
      }
      return;
    }

    await interaction.reply({ embeds: [errorEmbed('Unknown subcommand.')], flags: MessageFlags.Ephemeral });
  },
});
