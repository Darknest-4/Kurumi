import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { BossService } from '../BossService';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'boss',
  permission: 'boss.spawn',
  data: new SlashCommandBuilder()
    .setName('boss')
    .setDescription('Spawn an anime boss for the server to fight.')
    .addStringOption((o) =>
      o.setName('boss').setDescription('Specific boss (random if omitted)').setAutocomplete(true),
    ),
  async autocomplete(interaction, _client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const bosses = await prisma.boss.findMany({ where: { enabled: true }, take: 25 });
    await interaction.respond(
      bosses
        .filter((b) => b.key.includes(focused) || b.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((b) => ({ name: b.name, value: b.key })),
    );
  },
  async execute({ client, interaction, guildId }) {
    const bossKey = interaction.options.getString('boss') ?? undefined;
    const res = await BossService.spawn(client, guildId, interaction.channelId, bossKey);
    await interaction.reply({
      embeds: [res.ok ? successEmbed('Boss spawned! ⚔️') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
