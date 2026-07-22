import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';

export default defineCommand({
  module: 'economy',
  permission: 'economy.gamble',
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Bet XP for a chance to win more. All chances are configurable.')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('XP to bet').setRequired(true).setMinValue(1),
    ),
  async execute({ client, interaction, guildId }) {
    const bet = BigInt(interaction.options.getInteger('amount', true));

    const min = await client.config.getNumber(guildId, 'economy', 'gamble.min', 10);
    const max = await client.config.getNumber(guildId, 'economy', 'gamble.max', 100_000);
    if (bet < BigInt(min) || bet > BigInt(max)) {
      await interaction.reply({
        embeds: [errorEmbed(`Bet must be between **${formatNumber(min)}** and **${formatNumber(max)}** XP.`)],
      });
      return;
    }

    const spent = await client.xp.spend(guildId, interaction.user.id, bet);
    if (!spent) {
      await interaction.reply({ embeds: [errorEmbed('Insufficient XP.')] });
      return;
    }

    const winChance = await client.config.getNumber(guildId, 'economy', 'gamble.winChance', 0.48);
    const payoutMult = await client.config.getNumber(guildId, 'economy', 'gamble.payoutMultiplier', 2);
    const won = Math.random() < winChance;

    if (won) {
      const winnings = BigInt(Math.floor(Number(bet) * payoutMult));
      await client.xp.grantBalance(guildId, interaction.user.id, winnings);
      const balance = await client.xp.getBalance(guildId, interaction.user.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            `🎰 You won **${formatNumber(winnings)} XP**!\nBalance: **${formatNumber(balance)} XP**`,
            'Gamble',
          ),
        ],
      });
    } else {
      const balance = await client.xp.getBalance(guildId, interaction.user.id);
      await interaction.reply({
        embeds: [
          errorEmbed(
            `🎰 You lost **${formatNumber(bet)} XP**.\nBalance: **${formatNumber(balance)} XP**`,
            'Gamble',
          ),
        ],
      });
    }
  },
});
