# Kurumi — Architecture

This document explains the design principles behind Kurumi so new features can
be added without rewriting existing systems.

## Design principles

1. **Nothing gameplay-related is hardcoded.** Every tunable value is resolved
   from the database at runtime via `ConfigManager`. Command logic reads values
   through `client.config.get*` and never contains literals for rates, prices,
   cooldowns, HP, colors or emojis.
2. **Modules are the unit of composition.** Every command/event/component
   declares the module it belongs to. A guild can toggle any module. Adding a
   feature is adding a module folder — no central wiring.
3. **Per-guild isolation.** Config, module state and permissions are all scoped
   to a guild id so the bot behaves independently on thousands of servers.
4. **Cache reads, persist writes.** Hot lookups (config, module-enabled,
   permissions, blacklist, maintenance) are read-through cached in Redis with
   short TTLs; writes invalidate the relevant keys.

## Request lifecycle (slash command)

```
Discord → interactionCreate (shared event)
        → CommandManager.handle
            1. blacklist check        (Redis-cached)
            2. maintenance check       (Redis-cached)
            3. guildOnly / developerOnly
            4. module enabled?         (ModuleManager, Redis-cached)
            5. permission node?        (PermissionManager)
            6. command cooldown?       (CooldownManager, Redis)
            7. command.execute(ctx)
            8. set cooldown from config
```

Components (buttons/modals/selects) run a similar, lighter gate
(module + permission) in `ComponentManager`, matched by customId prefix
(`<id>:<arg1>:<arg2>`).

## Configuration layers

| Layer | Table | Shape | Use |
|---|---|---|---|
| Generic settings | `GuildConfig` | `(namespace, key) → JSON` | rates, cooldowns, colors, emojis, prices |
| Module toggles | `GuildModule` | `(module) → bool` | enable/disable features |
| Permissions | `PermissionAssignment` | node → role/user, ALLOW/DENY | access control |
| Content | typed catalogs | rows | pets, gacha, bosses, badges, titles, quiz |
| Routing | `LogChannel` | `(category) → channelId` | per-category audit logging |

Defaults for generic settings live in each `ModuleDefinition.defaultConfig`
(`src/modules/definitions.ts`) and are registered with `ConfigManager` at boot.
Resolution is: **guild override → module default → caller fallback**.

## XP as the only currency

- `Member.totalXp` — lifetime XP earned; determines **level** (never decreases).
- `Member.xp` — spendable **balance** (the currency).
- Earning (`XpService.award`) increases both and applies
  `global × source-weight × active-boost` multipliers.
- Spending (`XpService.spend`) is atomic (`updateMany … where xp >= cost`) and
  only touches the balance, so buying/betting never lowers your level.

The level curve (`base`, `multiplier`, `exponent`) is per-guild config, resolved
by `LevelService`.

## Scaling notes

- All per-request DB lookups that repeat (config/module/permission/blacklist/
  maintenance) are Redis-cached with short TTLs and explicit invalidation.
- discord.js sharding is supported; set `SHARD_COUNT` and front the process with
  a `ShardingManager` for very large deployments. Redis is the cross-shard
  coordination point (cache + pub/sub connection is exposed via `getSubscriber`).
- Durable event scheduling (vault/bomb/raid timers) is re-armed on startup from
  DB state (`VaultService.resume`) so restarts don't drop in-flight events.

## Extending

- **New tunable:** just `client.config.set(guildId, ns, key, value)` — no
  migration. Add it to a module's `defaultConfig` to give it a default.
- **New content:** insert catalog rows (seed or dashboard). No code changes.
- **New command/event/component:** drop a file in the module folder; the
  filesystem loaders discover it.
- **New module:** append a `ModuleDefinition` + create the folder.

## Web dashboard (planned)

The dashboard is a separate Next.js app (dark, anime-themed, responsive) that
talks to the **same** Postgres via Prisma. Because all state is already in the
database (`GuildConfig`, `GuildModule`, `PermissionAssignment`, catalogs), the
dashboard needs no bot-side API: each module gets its own page that reads/writes
those tables, and the bot picks up changes on the next cache expiry (or via a
Redis pub/sub invalidation message).
