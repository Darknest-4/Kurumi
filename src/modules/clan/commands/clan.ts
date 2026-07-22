import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, successEmbed, errorEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';
import { ClanService } from '../ClanService';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'clan',
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Clans: XP, levels and a shared vault.')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Found a clan (costs XP).')
        .addStringOption((o) => o.setName('name').setDescription('Clan name').setRequired(true))
        .addStringOption((o) => o.setName('tag').setDescription('Short tag').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('join')
        .setDescription('Join a clan by tag.')
        .addStringOption((o) => o.setName('tag').setDescription('Clan tag').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('leave').setDescription('Leave your clan.'))
    .addSubcommand((s) =>
      s
        .setName('info')
        .setDescription('Show clan info.')
        .addStringOption((o) => o.setName('tag').setDescription('Clan tag (yours if omitted)')),
    )
    .addSubcommand((s) =>
      s
        .setName('deposit')
        .setDescription('Deposit XP into your clan vault.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Top clans by XP.')),
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (sub) {
      case 'create': {
        const permission = interaction.inCachedGuild()
          ? await client.permissions.can(interaction.member, 'clan.create')
          : true;
        if (!permission) {
          await interaction.reply({ embeds: [errorEmbed('You need `clan.create`.')] });
          return;
        }
        const name = interaction.options.getString('name', true);
        const tag = interaction.options.getString('tag', true).toUpperCase().slice(0, 6);
        const res = await ClanService.create(client, guildId, userId, name, tag, interaction.user.username);
        await interaction.reply({
          embeds: [res.ok ? successEmbed(`Clan **${name}** [${tag}] founded! 🏰`) : errorEmbed(res.reason ?? 'Failed.')],
        });
        return;
      }
      case 'join': {
        const tag = interaction.options.getString('tag', true).toUpperCase();
        const res = await ClanService.join(client, guildId, userId, tag, interaction.user.username);
        await interaction.reply({
          embeds: [res.ok ? successEmbed(`Joined **[${tag}]**! 🏰`) : errorEmbed(res.reason ?? 'Failed.')],
        });
        return;
      }
      case 'leave': {
        const res = await ClanService.leave(guildId, userId);
        await interaction.reply({
          embeds: [res.ok ? successEmbed('You left your clan.') : errorEmbed(res.reason ?? 'Failed.')],
        });
        return;
      }
      case 'deposit': {
        const amount = BigInt(interaction.options.getInteger('amount', true));
        const res = await ClanService.deposit(client, guildId, userId, amount);
        await interaction.reply({
          embeds: [res.ok ? successEmbed(`Deposited **${formatNumber(amount)} XP** to the clan vault.`) : errorEmbed(res.reason ?? 'Failed.')],
        });
        return;
      }
      case 'list': {
        const clans = await prisma.clan.findMany({
          where: { guildId },
          orderBy: { xp: 'desc' },
          take: 10,
          include: { _count: { select: { members: true } } },
        });
        const lines = clans.map(
          (c, i) => `**${i + 1}.** ${c.emoji ?? '🏰'} **${c.name}** [${c.tag}] — Lv.${c.level} • ${formatNumber(c.xp)} XP • ${c._count.members} members`,
        );
        await interaction.reply({
          embeds: [baseEmbed().setTitle('🏰 Clans').setDescription(lines.join('\n') || '_No clans yet._')],
        });
        return;
      }
      default: {
        // info
        const tag = interaction.options.getString('tag');
        let clan;
        if (tag) {
          clan = await prisma.clan.findUnique({
            where: { guildId_tag: { guildId, tag: tag.toUpperCase() } },
            include: { members: { include: { member: true } } },
          });
        } else {
          const member = await prisma.member.findUnique({ where: { guildId_userId: { guildId, userId } } });
          const membership = member
            ? await prisma.clanMember.findUnique({ where: { memberId: member.id } })
            : null;
          clan = membership
            ? await prisma.clan.findUnique({
                where: { id: membership.clanId },
                include: { members: { include: { member: true } } },
              })
            : null;
        }
        if (!clan) {
          await interaction.reply({ embeds: [errorEmbed('Clan not found (are you in one?).')] });
          return;
        }
        const roster = clan.members
          .sort((a, b) => Number(b.contributed - a.contributed))
          .slice(0, 15)
          .map((m) => `${m.role === 'LEADER' ? '👑' : m.role === 'OFFICER' ? '⭐' : '•'} <@${m.member.userId}> — ${formatNumber(m.contributed)} XP`)
          .join('\n');
        await interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle(`${clan.emoji ?? '🏰'} ${clan.name} [${clan.tag}]`)
              .addFields(
                { name: 'Level', value: `${clan.level}`, inline: true },
                { name: 'Clan XP', value: formatNumber(clan.xp), inline: true },
                { name: 'Vault', value: `${formatNumber(clan.vault)} XP`, inline: true },
                { name: 'Members', value: roster || '—' },
              ),
          ],
        });
      }
    }
  },
});
