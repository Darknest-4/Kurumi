# 🌸 Kurumi

**Anime Community • RPG • XP Economy** Discord bot.

Kurumi is a modular, enterprise-grade Discord bot built to compete with MEE6,
Arcane, Sapphire, Tatsu and Karuta — but fully anime-themed and running on a
**single currency: XP**. There is no money economy. Everything you earn, spend,
bet, gift or win is XP.

> Every gameplay value lives in the database and is editable **per server at
> runtime** — XP rates, cooldowns, drop rates, boss HP, prices, colors, emojis,
> log channels, prefixes and more. Nothing gameplay-related is hardcoded.

---

## ✨ Highlights

- **Fully modular** — every feature is a module that can be enabled/disabled per
  server. Adding a feature never requires rewriting existing code.
- **100% database-driven config** — a generic per-guild key/value store plus
  typed content catalogs. Tune anything with `/config` or the dashboard.
- **Node-based permissions** — every command has its own node
  (`economy.work`, `vault.start`, …) assignable to roles or users, with
  wildcards and `DENY`-over-`ALLOW` resolution.
- **XP is the only currency** — earn it from messages, voice, bosses, raids,
  dungeons, quizzes, daily, work, vault, bomb, achievements, clans and events.
- **Scales to thousands of servers** — Redis-cached config/permission/module
  lookups, per-guild isolation, sharding-ready.

## 🧱 Tech stack

Node.js 20+ · TypeScript · discord.js v14 · PostgreSQL · Prisma ORM · Redis ·
Docker · PM2 · pino.

---

## 🚀 Quick start

### With Docker (recommended)

```bash
cp .env.example .env         # fill in DISCORD_TOKEN & DISCORD_CLIENT_ID
docker compose up -d --build # starts postgres, redis and the bot
```

The bot container runs `prisma migrate deploy` then boots under PM2.

### Manual / local dev

```bash
cp .env.example .env         # configure token, client id, DB & Redis URLs
npm install
npm run prisma:generate
npm run prisma:migrate       # create the schema
npm run db:seed              # load anime content (pets, gacha, bosses, quiz…)
npm run dev                  # hot-reload via tsx
```

Deploy slash commands without a full boot:

```bash
npm run deploy:commands
```

---

## ⚙️ Configuration model

There are **two layers**, both in the database:

1. **`GuildConfig`** — a generic `(namespace, key) → JSON value` store. Modules
   register their defaults (see `src/modules/definitions.ts`); a guild's stored
   overrides win. This is how XP rates, cooldowns, drop rates, prices, colors
   and emojis are tuned without a redeploy.
2. **Content catalogs** — typed tables (`PetSpecies`, `GachaCharacter`, `Boss`,
   `ShopItem`, `Badge`, `Title`, `Achievement`, `QuizQuestion`). These are DB
   rows too; the code ships zero content, the seed populates it.

Change anything at runtime:

```
/config view namespace:economy
/config set  namespace:economy key:work.max value:250
/config set  namespace:vault   key:entryCost value:250
/config reset namespace:economy key:work.max
```

The only things in `.env` are **infrastructure & secrets** (token, DB/Redis
URLs, bootstrap owner ids). No gameplay values ever live there.

---

## 🔐 Permissions

Every command declares a permission **node**. Nodes are assigned to roles or
users per guild:

```
/permission allow node:economy.gamble target:@Gamblers
/permission deny  node:vault.start     target:@Muted
/permission clear node:economy.gamble  target:@Gamblers
```

Resolution order: developers/owners → explicit `DENY` → explicit `ALLOW` →
default policy. Wildcards are supported (`economy.*`, `*`). Admin-class nodes
(`config`, `module`, `vault.start`, `boss.spawn`, `moderation.*`, …) default to
requiring Discord *Manage Server / Administrator*; gameplay nodes are open by
default and can be `DENY`-ed.

---

## 🧩 Modules

All modules are individually toggleable with `/module`:

| Module | Key | Default |
|---|---|---|
| Core (ping/help/config/module/permission) | `core` | on |
| Leveling (message & voice XP) | `level` | on |
| Economy (work/daily/pay/gamble) | `economy` | on |
| Profile | `profile` | on |
| Leaderboard | `leaderboard` | on |
| Shop | `shop` | on |
| Pets | `pets` | on |
| Gacha | `gacha` | on |
| Boss | `boss` | on |
| Vault event | `vault` | on |
| Bomb event | `bomb` | on |
| Raid | `raid` | on |
| Clan | `clan` | on |
| Anime Quiz | `quiz` | on |
| Moderation | `moderation` | on |
| Logging | `logging` | on |
| Developer | `developer` | on |
| Reaction Roles | `reactionroles` | off |
| Tickets | `tickets` | off |
| Giveaway | `giveaway` | off |
| Welcome | `welcome` | off |

```
/module list
/module disable module:gacha
/module enable  module:gacha
```

---

## 🗂️ Architecture

```
src/
├── index.ts                  # entrypoint: connect, init, deploy, login
├── config/                   # bootstrap env (secrets only)
├── core/
│   ├── KurumiClient.ts        # owns managers & services, wires modules
│   ├── database/              # prisma + redis singletons
│   ├── logger/                # pino
│   ├── structures/            # Command / Event / Component / Module contracts
│   └── managers/              # Config, Permission, Module, Cooldown, loaders
├── services/                  # Xp, Level, Economy, Log (business logic)
├── repositories/              # data-access helpers (entity ensure, XP ops)
├── events/                    # shared gateway events (interaction router, ready)
├── modules/
│   ├── definitions.ts         # every module's metadata + DEFAULT config
│   └── <module>/
│       ├── commands/          # slash commands (auto-loaded)
│       ├── events/            # module events (auto-loaded)
│       ├── components/        # buttons/modals/selects (auto-loaded)
│       └── <Module>Service.ts # optional module business logic
└── utils/                     # embeds, formatting, filesystem loaders
```

Commands, events and components are **discovered from the filesystem** by the
loaders — no central registration list to maintain.

### Adding a new module (zero rewrites)

1. Append a `ModuleDefinition` to `src/modules/definitions.ts` (key, name,
   default enabled, permission nodes, default config).
2. Create `src/modules/<key>/commands/*.ts` (and optionally `events/`,
   `components/`, a `*Service.ts`).
3. Read every tunable value via `client.config.get*` — never hardcode.

That's it. The loaders pick it up on next boot; `/module` can toggle it and
`/config` can tune it.

### Anatomy of a command

```ts
export default defineCommand({
  module: 'economy',
  permission: 'economy.work',
  data: new SlashCommandBuilder().setName('work').setDescription('Earn XP.'),
  async execute({ client, interaction, guildId }) {
    const result = await client.economy.work(guildId, interaction.user.id);
    // ...
  },
});
```

The `CommandManager` runs every command through a gate chain:
blacklist → maintenance → module enabled → guild/dev only → permission →
cooldown → execute.

---

## 💰 Featured event: Vault

A fully-implemented reference event showing the module pattern end-to-end:

- `/vault` starts a raffle (entry fee, duration and emoji are all DB-driven).
- Members join via a **button** or the **💰 reaction**; the entry fee is spent
  in XP and the participant list updates live.
- When the timer ends, a random participant wins the whole pool. Active events
  are re-armed after a restart (`VaultService.resume`).

`Bomb`, `Boss` and `Raid` share the same schema + config scaffolding and follow
this exact pattern.

---

## 🛠️ Developer tools

Developers (DB-registered, plus `BOOTSTRAP_OWNER_IDS`) bypass blacklist &
maintenance and get `/dev`:

```
/dev xp add user:@x amount:1000
/dev xp reset user:@x
/dev maintenance on note:"upgrading"
/dev blacklist add user:@x reason:"abuse"
```

## 📜 Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | hot-reload dev server |
| `npm run build` / `start` | compile & run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | create/apply migrations |
| `npm run db:seed` | seed anime content |
| `npm run deploy:commands` | register slash commands |

---

## 🗺️ Status & roadmap

**Implemented end-to-end (28 slash commands, 9 components, event resume):**

- **Core** — ping, help, module toggle, config editor, permission assignment
- **Leveling** — message XP + level-up, `/rank`
- **Economy** — work, daily, pay, balance, gamble (all XP)
- **Profile / Leaderboard** — anime profile card, XP/level/message boards
- **Shop** — `/shop view|buy|seed|toggle`, XP purchases apply real effects
  (titles, colors, boosts, pet eggs, consumables)
- **Pets** — list & equip; pet eggs hatch weighted-random species
- **Gacha** — `/gacha roll|collection|equip`, rarity-weighted summons w/ passives
- **Boss** — `/boss` spawn + Attack button, HP bar, damage-weighted XP drops,
  slayer badge to top damager
- **Vault** — raffle: command + join button + 💰 reaction + restart resume
- **Bomb** — lobby → tick elimination → last survivor wins the pool (resumable)
- **Raid** — multi-phase boss w/ shield, normal & special attacks, damage board
- **Clan** — create/join/leave/info/deposit/list, clan XP, level & shared vault
- **Anime Quiz** — `/quiz` with first-correct-answer message collector
- **Moderation** — warn/kick/ban/timeout + numbered cases + mass-mention AutoMod
- **Welcome** — configurable join messages with placeholders
- **Reaction Roles** — button role panels (self-assign, hierarchy-safe)
- **Tickets** — panel → private channel → close
- **Giveaway** — timed draws with optional XP entry, resumable
- **Developer** — global XP ops, maintenance mode, blacklist
- **Logging** — per-category audit logging to channels

Plus the full database schema, initial migration and anime content seed.

**Planned:** the web dashboard — a separate Next.js app (dark, anime-themed,
responsive) talking to the same Postgres/Prisma models and `GuildConfig`, so it
needs no bot-side API. See `docs/ARCHITECTURE.md` for the design.
