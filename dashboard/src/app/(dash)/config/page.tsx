import { prisma } from '@/lib/prisma';
import { resolveGuildId } from '@/lib/guild';
import { setConfigValue, resetConfigValue } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const guildId = await resolveGuildId();
  if (!guildId) return <div className="card">Select a server first.</div>;

  const rows = await prisma.guildConfig.findMany({
    where: { guildId },
    orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
  });

  type Row = (typeof rows)[number];
  const byNs = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byNs.has(r.namespace)) byNs.set(r.namespace, []);
    byNs.get(r.namespace)!.push(r);
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>
          <span className="gradient-text">Config</span>
        </h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Every stored override for this server. All bot values are database-driven.
        </p>
      </div>

      <div className="card">
        <h3>➕ Set any value</h3>
        <form action={setConfigValue} className="row" style={{ gap: 8 }}>
          <input type="hidden" name="guildId" value={guildId} />
          <input name="namespace" placeholder="namespace (e.g. economy)" style={{ maxWidth: 200 }} />
          <input name="key" placeholder="key (e.g. work.max)" style={{ maxWidth: 200 }} />
          <input name="value" placeholder='value JSON (e.g. 250)' style={{ flex: 1 }} />
          <button className="btn small primary" type="submit">
            Save
          </button>
        </form>
      </div>

      {byNs.size === 0 && (
        <div className="card">
          <p className="muted">No overrides stored yet — the bot is running on module defaults.</p>
        </div>
      )}

      {[...byNs.entries()].map(([ns, items]) => (
        <div key={ns} className="card">
          <h3 className="mono">{ns}</h3>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r: Row) => (
                  <tr key={r.id}>
                    <td className="mono">{r.key}</td>
                    <td className="mono">{JSON.stringify(r.value)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <form action={resetConfigValue}>
                        <input type="hidden" name="guildId" value={guildId} />
                        <input type="hidden" name="namespace" value={ns} />
                        <input type="hidden" name="key" value={r.key} />
                        <button className="btn small danger" type="submit">
                          Reset
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
