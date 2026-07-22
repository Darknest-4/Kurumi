import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed, baseEmbed } from '../../../utils/embeds';

/**
 * Generic runtime config editor. Because ALL gameplay values live in the DB,
 * this single command can tune XP rates, cooldowns, drop rates, prices,
 * colors, emojis and more — per guild, without a redeploy.
 */
export default defineCommand({
  module: 'core',
  permission: 'config',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View or change any Kurumi setting for this server.')
    .addSubcommand((s) =>
      s
        .setName('view')
        .setDescription('View all settings in a namespace.')
        .addStringOption((o) =>
          o
            .setName('namespace')
            .setDescription('e.g. economy, xp, vault, embed, cooldown')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set a setting (value is parsed as JSON, falling back to string).')
        .addStringOption((o) => o.setName('namespace').setDescription('Namespace').setRequired(true))
        .addStringOption((o) => o.setName('key').setDescription('Setting key').setRequired(true))
        .addStringOption((o) => o.setName('value').setDescription('New value').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('reset')
        .setDescription('Reset a setting back to its default.')
        .addStringOption((o) => o.setName('namespace').setDescription('Namespace').setRequired(true))
        .addStringOption((o) => o.setName('key').setDescription('Setting key').setRequired(true)),
    ),
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const ns = interaction.options.getString('namespace', true);
      const values = await client.config.getNamespace(guildId, ns);
      const entries = Object.entries(values);
      const body = entries.length
        ? entries.map(([k, v]) => `\`${k}\` = \`${JSON.stringify(v)}\``).join('\n').slice(0, 3800)
        : '_No settings in this namespace._';
      await interaction.reply({
        embeds: [baseEmbed().setTitle(`Config — ${ns}`).setDescription(body)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ns = interaction.options.getString('namespace', true);
    const key = interaction.options.getString('key', true);

    if (sub === 'reset') {
      await client.config.reset(guildId, ns, key);
      await interaction.reply({
        embeds: [successEmbed(`Reset \`${ns}.${key}\` to its default.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // set
    const raw = interaction.options.getString('value', true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw; // treat as plain string
    }
    if (typeof parsed === 'string' && parsed.trim() === '') {
      await interaction.reply({
        embeds: [errorEmbed('Value cannot be empty.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await client.config.set(guildId, ns, key, parsed);
    await client.logs.record(guildId, 'admin', {
      actorId: interaction.user.id,
      data: { action: 'config.set', namespace: ns, key, value: parsed },
    });
    await interaction.reply({
      embeds: [successEmbed(`Set \`${ns}.${key}\` = \`${JSON.stringify(parsed)}\`.`)],
      flags: MessageFlags.Ephemeral,
    });
  },
});
