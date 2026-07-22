import { EmbedBuilder, type ColorResolvable } from 'discord.js';

/**
 * Fallback UI palette. These are ONLY used when a guild has not configured
 * its own colors. Per-guild colors live in the `embed` config namespace and
 * are read at call sites via ConfigManager, then passed to `baseEmbed`.
 */
export const DEFAULT_COLORS = {
  primary: 0xff5da2, // Kurumi pink
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
} as const;

export function baseEmbed(
  color: ColorResolvable | string | null | undefined = DEFAULT_COLORS.primary,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor((color ?? DEFAULT_COLORS.primary) as ColorResolvable)
    .setTimestamp();
}

export function successEmbed(description: string, title?: string): EmbedBuilder {
  const e = baseEmbed(DEFAULT_COLORS.success).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function errorEmbed(description: string, title = '❌ Error'): EmbedBuilder {
  return baseEmbed(DEFAULT_COLORS.error).setTitle(title).setDescription(description);
}

export function infoEmbed(description: string, title?: string): EmbedBuilder {
  const e = baseEmbed(DEFAULT_COLORS.info).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function warningEmbed(description: string, title = '⚠️ Warning'): EmbedBuilder {
  return baseEmbed(DEFAULT_COLORS.warning).setTitle(title).setDescription(description);
}
