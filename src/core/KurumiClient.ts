import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { join } from 'node:path';
import { prisma } from './database/prisma';
import { redis } from './database/redis';
import { ConfigManager } from './managers/ConfigManager';
import { ModuleManager } from './managers/ModuleManager';
import { PermissionManager } from './managers/PermissionManager';
import { CooldownManager } from './managers/CooldownManager';
import { CommandManager } from './managers/CommandManager';
import { EventManager } from './managers/EventManager';
import { ComponentManager } from './managers/ComponentManager';
import { LogService } from '../services/LogService';
import { XpService } from '../services/XpService';
import { EconomyService } from '../services/EconomyService';
import { registerModules } from '../modules';
import { createLogger } from './logger/logger';

const log = createLogger('client');

/**
 * The Kurumi bot client. Owns all managers & services and wires up the
 * module system. Adding a feature never requires editing this file beyond
 * (optionally) nothing — modules self-register via `registerModules`.
 */
export class KurumiClient extends Client {
  readonly config = new ConfigManager();
  readonly permissions = new PermissionManager();
  readonly cooldowns = new CooldownManager();
  readonly modules = new ModuleManager(this.config);

  readonly logs: LogService;
  readonly xp: XpService;
  readonly economy: EconomyService;

  readonly commandManager: CommandManager;
  readonly eventManager: EventManager;
  readonly componentManager: ComponentManager;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
    });

    this.logs = new LogService(this);
    this.xp = new XpService(this.config, this.logs);
    this.economy = new EconomyService(this.config, this.cooldowns, this.xp);

    this.commandManager = new CommandManager(this);
    this.eventManager = new EventManager(this);
    this.componentManager = new ComponentManager(this);
  }

  /** Load modules, handlers and bind events. Call before `login`. */
  async init(): Promise<void> {
    registerModules(this.modules);

    const modulesRoot = join(__dirname, '..', 'modules');
    const eventsRoot = join(__dirname, '..', 'events');

    this.commandManager.load(modulesRoot);
    this.componentManager.load(modulesRoot);
    this.eventManager.load(modulesRoot, eventsRoot);

    log.info({ modules: this.modules.all().length }, 'client initialised');
  }

  /** Fire module onReady hooks (schedulers, etc.). */
  async runModuleReadyHooks(): Promise<void> {
    for (const mod of this.modules.all()) {
      if (mod.onReady) {
        try {
          await mod.onReady(this);
        } catch (err) {
          log.error({ err, module: mod.key }, 'module onReady failed');
        }
      }
    }
  }

  // ── Global state helpers (Redis-cached, DB-backed) ──────────────

  /** In-memory memo so we upsert each guild row at most once per process. */
  private readonly ensuredGuilds = new Set<string>();

  /**
   * Guarantee a guild row exists before any guild-scoped write. Cheap and
   * idempotent — covers guilds joined while the bot was offline (no
   * guildCreate event) so config/module/permission writes never FK-fail.
   */
  async ensureGuild(guildId: string, name?: string): Promise<void> {
    if (this.ensuredGuilds.has(guildId)) return;
    await prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, name },
      update: name ? { name } : {},
    });
    this.ensuredGuilds.add(guildId);
  }

  async isBlacklisted(userId: string): Promise<boolean> {
    const key = `bl:${userId}`;
    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached === '1';
    } catch {
      /* ignore */
    }
    const row = await prisma.blacklist.findUnique({ where: { userId } });
    const val = row ? '1' : '0';
    await redis.set(key, val, 'EX', 60).catch(() => undefined);
    return row != null;
  }

  async isMaintenance(): Promise<boolean> {
    try {
      const cached = await redis.get('maintenance');
      if (cached !== null) return cached === '1';
    } catch {
      /* ignore */
    }
    const state = await prisma.globalState.findUnique({ where: { id: 1 } });
    const val = state?.maintenance ? '1' : '0';
    await redis.set('maintenance', val, 'EX', 30).catch(() => undefined);
    return state?.maintenance ?? false;
  }
}
