import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed, baseEmbed } from '../../../utils/embeds';

export default defineCommand({
  module: 'core',
  permission: 'module',
  data: new SlashCommandBuilder()
    .setName('module')
    .setDescription('Enable or disable Kurumi modules for this server.')
    .addSubcommand((s) => s.setName('list').setDescription('Show every module and its state.'))
    .addSubcommand((s) =>
      s
        .setName('enable')
        .setDescription('Enable a module.')
        .addStringOption((o) =>
          o.setName('module').setDescription('Module key').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('disable')
        .setDescription('Disable a module.')
        .addStringOption((o) =>
          o.setName('module').setDescription('Module key').setRequired(true).setAutocomplete(true),
        ),
    ),
  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = client.modules
      .all()
      .filter((m) => m.key.includes(focused) || m.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((m) => ({ name: `${m.name} (${m.key})`, value: m.key }));
    await interaction.respond(choices);
  },
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const status = await client.modules.statusFor(guildId);
      const lines = client.modules
        .all()
        .map((m) => `${status[m.key] ? '🟢' : '🔴'} \`${m.key}\` — ${m.name}`);
      await interaction.reply({
        embeds: [baseEmbed().setTitle('Modules').setDescription(lines.join('\n'))],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const key = interaction.options.getString('module', true);
    const def = client.modules.get(key);
    if (!def) {
      await interaction.reply({
        embeds: [errorEmbed(`Unknown module \`${key}\`.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const enable = sub === 'enable';
    await client.modules.setEnabled(guildId, key, enable);
    await client.logs.record(guildId, 'admin', {
      actorId: interaction.user.id,
      data: { action: 'module.toggle', module: key, enabled: enable },
    });
    await interaction.reply({
      embeds: [
        successEmbed(`Module **${def.name}** is now **${enable ? 'enabled' : 'disabled'}**.`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});
