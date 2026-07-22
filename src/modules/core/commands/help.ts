import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'core',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List Kurumi modules and whether they are enabled here.'),
  async execute({ client, interaction, guildId }) {
    const status = await client.modules.statusFor(guildId);
    const embed = baseEmbed()
      .setTitle('🌸 Kurumi — Modules')
      .setDescription('Anime community • RPG • **XP is the only currency**')
      .setFooter({ text: 'Admins can toggle modules with /module' });

    for (const mod of client.modules.all()) {
      const enabled = status[mod.key];
      embed.addFields({
        name: `${enabled ? '🟢' : '🔴'} ${mod.name}`,
        value: mod.description,
        inline: false,
      });
    }
    await interaction.reply({ embeds: [embed] });
  },
});
