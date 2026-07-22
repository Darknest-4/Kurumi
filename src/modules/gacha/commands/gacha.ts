import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, errorEmbed, DEFAULT_COLORS } from '../../../utils/embeds';
import { GachaService } from '../GachaService';
import { prisma } from '../../../core/database/prisma';
import { Rarity } from '@prisma/client';

const RARITY_COLOR: Record<Rarity, number> = {
  COMMON: 0x9aa0a6,
  RARE: 0x3ba7ff,
  EPIC: 0xa855f7,
  LEGENDARY: 0xf5a623,
  MYTHIC: 0xff4d6d,
  DIVINE: 0xffe066,
};

export default defineCommand({
  module: 'gacha',
  data: new SlashCommandBuilder()
    .setName('gacha')
    .setDescription('Summon anime characters with XP.')
    .addSubcommand((s) => s.setName('roll').setDescription('Spend XP to summon a character.'))
    .addSubcommand((s) =>
      s
        .setName('collection')
        .setDescription('View a summon collection.')
        .addUserOption((o) => o.setName('user').setDescription('Whose collection')),
    )
    .addSubcommand((s) =>
      s
        .setName('equip')
        .setDescription('Equip a character as your waifu (shown on your profile).')
        .addStringOption((o) =>
          o.setName('character').setDescription('Character key').setRequired(true).setAutocomplete(true),
        ),
    ),
  async autocomplete(interaction, _client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const owned = await prisma.userCharacter.findMany({
      where: { member: { guildId: interaction.guildId!, userId: interaction.user.id } },
      include: { character: true },
      take: 25,
    });
    await interaction.respond(
      owned
        .filter((c) => c.character.name.toLowerCase().includes(focused) || c.character.key.includes(focused))
        .slice(0, 25)
        .map((c) => ({ name: `${c.character.name} (${c.character.rarity})`, value: c.character.key })),
    );
  },
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'roll') {
      const res = await GachaService.roll(client, guildId, interaction.user.id, interaction.user.username);
      if (!res.ok || !res.character) {
        await interaction.reply({ embeds: [errorEmbed(res.reason ?? 'Roll failed.')] });
        return;
      }
      const c = res.character;
      await interaction.reply({
        embeds: [
          baseEmbed(RARITY_COLOR[c.rarity])
            .setTitle(`${c.emoji ?? '✨'} ${c.name}`)
            .setDescription(
              `**${c.rarity}**${c.anime ? ` • ${c.anime}` : ''}\n${c.passive ?? ''}\n\n${res.isNew ? '🆕 **New character!**' : `You now own **${res.copies}** copies.`}`,
            )
            .setImage(c.imageUrl ?? null),
        ],
      });
      return;
    }

    if (sub === 'collection') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const owned = await prisma.userCharacter.findMany({
        where: { member: { guildId, userId: target.id } },
        include: { character: true },
        orderBy: { character: { rarity: 'desc' } },
      });
      const lines = owned.map(
        (c) => `${c.character.emoji ?? '•'} **${c.character.name}** — ${c.character.rarity} ×${c.copies}`,
      );
      await interaction.reply({
        embeds: [
          baseEmbed()
            .setAuthor({ name: `${target.username}'s Summons`, iconURL: target.displayAvatarURL() })
            .setDescription(lines.join('\n') || '_No characters yet. Try /gacha roll._'),
        ],
      });
      return;
    }

    // equip
    const key = interaction.options.getString('character', true);
    const owned = await prisma.userCharacter.findFirst({
      where: { member: { guildId, userId: interaction.user.id }, character: { key } },
      include: { character: true },
    });
    if (!owned) {
      await interaction.reply({ embeds: [errorEmbed('You do not own that character.')] });
      return;
    }
    await prisma.member.update({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
      data: { activeWaifuId: owned.characterId },
    });
    await interaction.reply({
      embeds: [
        baseEmbed(DEFAULT_COLORS.success).setDescription(
          `💖 Equipped **${owned.character.name}** as your waifu.`,
        ),
      ],
    });
  },
});
