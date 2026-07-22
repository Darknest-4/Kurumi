import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed } from '../../../utils/embeds';
import { formatNumber, progressBar } from '../../../utils/format';
import { prisma } from '../../../core/database/prisma';

/**
 * Anime-style profile card: level, XP, rank, clan, pet, waifu, badges,
 * title, banner, stats and achievements.
 */
export default defineCommand({
  module: 'profile',
  permission: 'profile.view',
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show an anime-style profile card.')
    .addUserOption((o) => o.setName('user').setDescription('Whose profile to show')),
  async execute({ client, interaction, guildId }) {
    const target = interaction.options.getUser('user') ?? interaction.user;

    const member = await prisma.member.findUnique({
      where: { guildId_userId: { guildId, userId: target.id } },
      include: {
        clanMember: { include: { clan: true } },
        pets: { include: { species: true }, take: 1 },
        characters: { include: { character: true }, orderBy: { level: 'desc' }, take: 1 },
        _count: { select: { badges: true, achievements: true } },
      },
    });

    if (!member) {
      await interaction.reply({
        embeds: [baseEmbed().setDescription(`**${target.username}** has no profile yet.`)],
      });
      return;
    }

    const curve = await client.xp.levels.getCurve(guildId);
    const { level, intoLevel, needed } = client.xp.levels.resolve(member.totalXp, curve);

    // Server rank by lifetime XP.
    const rank =
      (await prisma.member.count({ where: { guildId, totalXp: { gt: member.totalXp } } })) + 1;

    const activeTitle = member.activeTitleId
      ? await prisma.title.findUnique({ where: { id: member.activeTitleId } })
      : null;

    const pet = member.pets[0];
    const waifu = member.characters[0];
    const color = member.color ?? undefined;

    const embed = baseEmbed(color)
      .setAuthor({ name: `${target.username}'s Profile`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setDescription(member.bio ?? '_No bio set. Use /profile-edit._')
      .addFields(
        { name: '🏅 Rank', value: `#${formatNumber(rank)}`, inline: true },
        { name: '⭐ Level', value: `${level}`, inline: true },
        { name: '💠 XP Balance', value: `${formatNumber(member.xp)}`, inline: true },
        {
          name: '📈 Progress',
          value: `${progressBar(intoLevel, needed)} ${formatNumber(intoLevel)}/${formatNumber(needed)}`,
          inline: false,
        },
        { name: '🏰 Clan', value: member.clanMember?.clan.name ?? '—', inline: true },
        {
          name: '🐾 Pet',
          value: pet ? `${pet.species.emoji ?? ''} ${pet.nickname ?? pet.species.name}` : '—',
          inline: true,
        },
        {
          name: '💖 Waifu',
          value: waifu ? `${waifu.character.emoji ?? ''} ${waifu.character.name}` : '—',
          inline: true,
        },
        { name: '🎖️ Title', value: activeTitle?.text ?? '—', inline: true },
        { name: '🏆 Badges', value: `${member._count.badges}`, inline: true },
        { name: '✅ Achievements', value: `${member._count.achievements}`, inline: true },
        { name: '💬 Messages', value: formatNumber(member.messages), inline: true },
      );

    if (member.bannerUrl) embed.setImage(member.bannerUrl);
    await interaction.reply({ embeds: [embed] });
  },
});
