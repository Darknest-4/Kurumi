/** Human-friendly number formatting helpers. */

export function formatNumber(value: number | bigint): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** Compact form, e.g. 1.2K, 3.4M — handy for XP totals. */
export function compact(value: number | bigint): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3_600_000) % 24;
  const d = Math.floor(ms / 86_400_000);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

/** Render a text progress bar of `size` cells for value/max. */
export function progressBar(value: number | bigint, max: number | bigint, size = 12): string {
  const v = Number(value);
  const m = Math.max(1, Number(max));
  const filled = Math.max(0, Math.min(size, Math.round((v / m) * size)));
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

/** BigInt-safe clamp to a minimum of zero. */
export function clampZero(value: bigint): bigint {
  return value < 0n ? 0n : value;
}
