import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, errorEmbed, DEFAULT_COLORS } from '../../../utils/embeds';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'pets',
  permission: 'pets.view',
  data: new SlashCommandBuilder()
    .setName('pets')
    .setDescription('View and manage your anime pets.')
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List owned pets.')
        .addUserOption((o) => o.setName('user').setDescription('Whose pets')),
    )
    .addSubcommand((s) =>
      s
        .setName('equip')
        .setDescription('Equip a pet (its passive applies and it shows on your profile).')
        .addStringOption((o) =>
          o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true),
        ),
    ),
  async autocomplete(interaction, _client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const pets = await prisma.userPet.findMany({
      where: { member: { guildId: interaction.guildId!, userId: interaction.user.id } },
      include: { species: true },
      take: 25,
    });
    await interaction.respond(
      pets
        .filter((p) => p.species.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((p) => ({ name: `${p.species.name}${p.nickname ? ` "${p.nickname}"` : ''}`, value: p.id })),
    );
  },
  async execute({ interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const pets = await prisma.userPet.findMany({
        where: { member: { guildId, userId: target.id } },
        include: { species: true },
      });
      const member = await prisma.member.findUnique({
        where: { guildId_userId: { guildId, userId: target.id } },
      });
      const lines = pets.map((p) => {
        const equipped = member?.activePetId === p.id ? ' ✅' : '';
        const stats = Object.entries(p.species.stats as Record<string, unknown>)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        return `${p.species.emoji ?? '🐾'} **${p.nickname ?? p.species.name}** — ${p.species.rarity} (${stats})${equipped}`;
      });
      await interaction.reply({
        embeds: [
          baseEmbed()
            .setAuthor({ name: `${target.username}'s Pets`, iconURL: target.displayAvatarURL() })
            .setDescription(lines.join('\n') || '_No pets yet. Get a Pet Egg from /shop._'),
        ],
      });
      return;
    }

    // equip
    const petId = interaction.options.getString('pet', true);
    const pet = await prisma.userPet.findFirst({
      where: { id: petId, member: { guildId, userId: interaction.user.id } },
      include: { species: true },
    });
    if (!pet) {
      await interaction.reply({ embeds: [errorEmbed('You do not own that pet.')] });
      return;
    }
    await prisma.member.update({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
      data: { activePetId: pet.id },
    });
    await interaction.reply({
      embeds: [
        baseEmbed(DEFAULT_COLORS.success).setDescription(
          `🐾 Equipped **${pet.nickname ?? pet.species.name}**.`,
        ),
      ],
    });
  },
});
