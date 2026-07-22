import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { GiveawayService } from '../GiveawayService';

/** Parse durations like "30s", "10m", "2h", "1d" into seconds. */
function parseDuration(input: string): number {
  const m = /^(\d+)\s*([smhd])$/i.exec(input.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return n * (unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400);
}

export default defineCommand({
  module: 'giveaway',
  permission: 'giveaway.start',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway.')
    .addStringOption((o) => o.setName('prize').setDescription('What to give away').setRequired(true))
    .addStringOption((o) =>
      o.setName('duration').setDescription('e.g. 30m, 2h, 1d').setRequired(true),
    )
    .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1))
    .addIntegerOption((o) => o.setName('entry_cost').setDescription('XP entry fee (default 0)').setMinValue(0)),
  async execute({ client, interaction, guildId }) {
    const prize = interaction.options.getString('prize', true);
    const durationSeconds = parseDuration(interaction.options.getString('duration', true));
    if (durationSeconds <= 0) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid duration. Use formats like `30m`, `2h`, `1d`.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const winners = interaction.options.getInteger('winners') ?? 1;
    const entryCost = interaction.options.getInteger('entry_cost') ?? 0;

    const res = await GiveawayService.start(client, guildId, interaction.channelId, {
      prize,
      winners,
      durationSeconds,
      entryCost,
      createdBy: interaction.user.id,
    });
    await interaction.reply({
      embeds: [res.ok ? successEmbed('Giveaway started! 🎉') : errorEmbed(res.reason ?? 'Failed.')],
      flags: MessageFlags.Ephemeral,
    });
  },
});
