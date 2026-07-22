import { SlashCommandBuilder, type Message } from 'discord.js';
import { QuizType } from '@prisma/client';
import { defineCommand } from '../../../core/structures/Command';
import { baseEmbed, errorEmbed, DEFAULT_COLORS } from '../../../utils/embeds';
import { formatNumber } from '../../../utils/format';
import { prisma } from '../../../core/database/prisma';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default defineCommand({
  module: 'quiz',
  permission: 'quiz.play',
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Answer an anime quiz for XP — first correct answer wins.')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Question category')
        .addChoices(
          { name: 'Character', value: QuizType.CHARACTER },
          { name: 'Anime', value: QuizType.ANIME },
          { name: 'Opening', value: QuizType.OPENING },
          { name: 'Voice', value: QuizType.VOICE },
          { name: 'Manga', value: QuizType.MANGA },
          { name: 'Logo', value: QuizType.LOGO },
          { name: 'Studio', value: QuizType.STUDIO },
        ),
    ),
  async execute({ client, interaction, guildId }) {
    const type = interaction.options.getString('type') as QuizType | null;

    const pool = await prisma.quizQuestion.findMany({
      where: { enabled: true, ...(type ? { type } : {}) },
    });
    if (pool.length === 0) {
      await interaction.reply({ embeds: [errorEmbed('No quiz questions are configured.')] });
      return;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];

    const seconds = await client.config.getNumber(guildId, 'quiz', 'answerSeconds', 20);
    const reward = await client.config.getNumber(guildId, 'quiz', 'rewardXp', 200);

    const embed = baseEmbed()
      .setTitle(`🧠 Anime Quiz — ${q.type}`)
      .setDescription(`${q.prompt}\n\n_Type your answer! You have **${seconds}s**._`);
    if (q.mediaUrl) embed.setImage(q.mediaUrl);
    await interaction.reply({ embeds: [embed] });

    const channel = interaction.channel;
    if (!channel || !('createMessageCollector' in channel)) return;

    const accepted = new Set([normalize(q.answer), ...q.aliases.map(normalize)]);
    const collector = channel.createMessageCollector({
      time: seconds * 1000,
      filter: (m: Message) => !m.author.bot,
    });

    let solved = false;
    collector.on('collect', async (m: Message) => {
      if (!accepted.has(normalize(m.content))) return;
      solved = true;
      collector.stop('solved');
      const award = await client.xp.award(guildId, m.author.id, reward, 'quiz', m.author.username);
      await client.logs.record(guildId, 'xp', {
        targetId: m.author.id,
        data: { source: 'quiz', reward: award.gained.toString() },
      });
      await channel.send({
        embeds: [
          baseEmbed(DEFAULT_COLORS.success)
            .setDescription(`✅ <@${m.author.id}> got it! The answer was **${q.answer}**.\n+**${formatNumber(award.gained)} XP**`),
        ],
      });
    });

    collector.on('end', async () => {
      if (!solved) {
        await channel
          .send({
            embeds: [baseEmbed(DEFAULT_COLORS.error).setDescription(`⏱️ Time's up! The answer was **${q.answer}**.`)],
          })
          .catch(() => undefined);
      }
    });
  },
});
