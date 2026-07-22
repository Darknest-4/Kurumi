import { prisma } from '@/lib/prisma';
import { resolveGuildId } from '@/lib/guild';
import { MODULES } from '@/lib/modules';
import { setMaintenance } from '../actions';

export const dynamic = 'force-dynamic';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export default async function OverviewPage() {
  const guildId = await resolveGuildId();

  if (!guildId) {
    return (
      <div className="card">
        <h2>Welcome to Kurumi 🌸</h2>
        <p className="muted">
          No servers found yet. Invite the bot to a server and it will appear here.
        </p>
      </div>
    );
  }

  const [memberCount, clanCount, xpAgg, moduleRows, global, recentLogs] = await Promise.all([
    prisma.member.count({ where: { guildId } }),
    prisma.clan.count({ where: { guildId } }),
    prisma.member.aggregate({ where: { guildId }, _sum: { totalXp: true } }),
    prisma.guildModule.findMany({ where: { guildId } }),
    prisma.globalState.findUnique({ where: { id: 1 } }),
    prisma.logEntry.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  const overrides = new Map(moduleRows.map((m) => [m.module, m.enabled]));
  const enabledCount = MODULES.filter((m) => overrides.get(m.key) ?? m.defaultEnabled).length;
  const totalXp = xpAgg._sum.totalXp ?? 0n;

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>
          <span className="gradient-text">Overview</span>
        </h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Server <code>{guildId}</code>
        </p>
      </div>

      <div className="grid cols-3">
        <Stat value={memberCount.toLocaleString()} label="Members" />
        <Stat value={Number(totalXp).toLocaleString()} label="Total XP" />
        <Stat value={clanCount.toLocaleString()} label="Clans" />
        <Stat value={`${enabledCount}/${MODULES.length}`} label="Modules on" />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>🛠️ Maintenance mode</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Global: when on, only developers can use the bot.
          </p>
          <form action={setMaintenance} className="grid" style={{ gap: 10 }}>
            <input name="note" placeholder="Note shown to users" defaultValue={global?.maintenanceNote ?? ''} />
            <div className="row">
              <input type="hidden" name="maintenance" value={global?.maintenance ? 'false' : 'true'} />
              <button className={`btn ${global?.maintenance ? 'danger' : 'primary'}`} type="submit">
                {global?.maintenance ? 'Turn maintenance OFF' : 'Turn maintenance ON'}
              </button>
              <span className={`pill ${global?.maintenance ? 'deny' : 'on'}`}>
                {global?.maintenance ? 'ACTIVE' : 'off'}
              </span>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>📜 Recent activity</h3>
          {recentLogs.length === 0 ? (
            <p className="muted">No activity logged yet.</p>
          ) : (
            <div>
              {recentLogs.map((l) => (
                <div key={l.id} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="pill">{l.category}</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
