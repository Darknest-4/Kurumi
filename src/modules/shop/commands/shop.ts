import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, successEmbed, errorEmbed } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';
import { ShopService } from '../ShopService';
import { prisma } from '../../../core/database/prisma';

export default defineCommand({
  module: 'shop',
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Spend XP in the server shop.')
    .addSubcommand((s) => s.setName('view').setDescription('Browse the shop.'))
    .addSubcommand((s) =>
      s
        .setName('buy')
        .setDescription('Buy an item with XP.')
        .addStringOption((o) =>
          o.setName('item').setDescription('Item key').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('seed')
        .setDescription('[Admin] Populate a default shop catalog.'),
    )
    .addSubcommand((s) =>
      s
        .setName('toggle')
        .setDescription('[Admin] Enable/disable a shop item.')
        .addStringOption((o) => o.setName('item').setDescription('Item key').setRequired(true)),
    ),
  async autocomplete(interaction, _client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const items = await prisma.shopItem.findMany({
      where: { guildId: interaction.guildId!, enabled: true },
      take: 25,
    });
    await interaction.respond(
      items
        .filter((i) => i.key.includes(focused) || i.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((i) => ({ name: `${i.name} — ${i.price} XP`, value: i.key })),
    );
  },
  async execute({ client, interaction, guildId }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const items = await prisma.shopItem.findMany({
        where: { guildId, enabled: true },
        orderBy: { price: 'asc' },
      });
      const lines = items.map(
        (i) =>
          `**${i.name}** — \`${i.key}\`\n💠 ${formatNumber(i.price)} XP${i.stock !== null ? ` • stock: ${i.stock}` : ''}`,
      );
      await interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle('🛒 XP Shop')
            .setDescription(
              lines.join('\n\n') || '_The shop is empty. An admin can run `/shop seed`._',
            )
            .setFooter({ text: 'Buy with /shop buy <item>' }),
        ],
      });
      return;
    }

    if (sub === 'buy') {
      const key = interaction.options.getString('item', true);
      const res = await ShopService.buy(client, guildId, interaction.user.id, key, interaction.user.username);
      await interaction.reply({
        embeds: [res.ok ? successEmbed(res.message ?? 'Purchased!') : errorEmbed(res.reason ?? 'Failed.')],
      });
      return;
    }

    // Admin subcommands require the shop.admin node.
    if (interaction.inCachedGuild()) {
      const ok = await client.permissions.can(interaction.member, 'shop.admin');
      if (!ok) {
        await interaction.reply({
          embeds: [errorEmbed('You need the `shop.admin` permission.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (sub === 'seed') {
      const created = await ShopService.seedDefaults(guildId);
      await interaction.reply({
        embeds: [successEmbed(`Added **${created}** default items to the shop.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'toggle') {
      const key = interaction.options.getString('item', true);
      const item = await prisma.shopItem.findUnique({ where: { guildId_key: { guildId, key } } });
      if (!item) {
        await interaction.reply({ embeds: [errorEmbed('Unknown item.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.shopItem.update({ where: { id: item.id }, data: { enabled: !item.enabled } });
      await interaction.reply({
        embeds: [successEmbed(`**${item.name}** is now **${!item.enabled ? 'enabled' : 'disabled'}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});
