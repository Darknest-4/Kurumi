import { SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { successEmbed, errorEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';

export default defineCommand({
  module: 'economy',
  permission: 'economy.pay',
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer XP to another member.')
    .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1),
    ),
  async execute({ client, interaction, guildId }) {
    const target = interaction.options.getUser('user', true);
    const amount = BigInt(interaction.options.getInteger('amount', true));

    if (target.bot) {
      await interaction.reply({ embeds: [errorEmbed('You cannot pay a bot.')] });
      return;
    }

    const res = await client.economy.pay(guildId, interaction.user.id, target.id, amount);
    if (!res.ok) {
      await interaction.reply({ embeds: [errorEmbed(res.reason ?? 'Payment failed.')] });
      return;
    }
    await client.logs.record(guildId, 'pay', {
      actorId: interaction.user.id,
      targetId: target.id,
      data: { amount: amount.toString() },
    });
    await interaction.reply({
      embeds: [
        successEmbed(`Sent **${formatNumber(amount)} XP** to <@${target.id}>.`, '💸 Payment'),
      ],
    });
  },
});
