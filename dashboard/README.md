# 🌸 Kurumi Dashboard

A modern, **dark & anime-themed**, responsive web dashboard for the Kurumi bot.
It talks to the **same PostgreSQL** the bot uses (via Prisma) — so every change
you make here is picked up by the bot on its next config-cache expiry. No
bot-side API is required.

Built with **Next.js 14 (App Router)** + React server components + server
actions.

## Features

- **Overview** — member/XP/clan stats, global maintenance toggle, recent activity
- **Modules** — enable/disable every feature; **each module has its own page**
  with a live config editor and its permission nodes
- **Config** — raw per-guild override browser + set any `namespace.key = JSON`
- **Permissions** — assign nodes to roles/users (ALLOW/DENY, wildcards)
- **Logs** — audit trail with per-category filtering
- **Server switcher** — manage each guild independently
- Password login (HMAC-signed session cookie)

## Setup

```bash
cd dashboard
cp .env.example .env      # point DATABASE_URL at the bot's Postgres; set a
                          # DASHBOARD_SECRET and DASHBOARD_PASSWORD
npm install
npm run dev               # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

## Environment

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Same Postgres as the bot |
| `DASHBOARD_SECRET` | Signs the session cookie (use a long random string) |
| `DASHBOARD_PASSWORD` | Password required to sign in |

## Notes

- The module catalog in `src/lib/modules.ts` mirrors the bot's
  `src/modules/definitions.ts` (keys, names, default config, permission nodes)
  so the dashboard can render every module without importing bot code.
- Authentication here is a simple shared-password gate. For a public
  deployment, swap it for Discord OAuth (per-guild "Manage Server" checks) —
  the data layer and pages stay the same.
