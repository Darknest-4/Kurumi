import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'kurumi_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.DASHBOARD_SECRET ?? 'insecure-dev-secret';
}

function sign(payload: string): string {
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token: string): boolean {
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Validate the password against DASHBOARD_PASSWORD and set a session cookie. */
export function login(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  if (!expected || password !== expected) return false;
  const token = sign(`ok:${Date.now()}`);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  return true;
}

export function logout(): void {
  cookies().delete(COOKIE);
}

export function isAuthed(): boolean {
  const token = cookies().get(COOKIE)?.value;
  return token ? verify(token) : false;
}

// ── Selected guild (stored in a cookie) ─────────────────────────

const GUILD_COOKIE = 'kurumi_guild';

export function getSelectedGuild(): string | null {
  return cookies().get(GUILD_COOKIE)?.value ?? null;
}

export function setSelectedGuild(guildId: string): void {
  cookies().set(GUILD_COOKIE, guildId, { sameSite: 'lax', path: '/', maxAge: MAX_AGE });
}
