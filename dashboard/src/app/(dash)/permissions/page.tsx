import { prisma } from '@/lib/prisma';
import { resolveGuildId } from '@/lib/guild';
import { MODULES } from '@/lib/modules';
import { addPermission, removePermission } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  const guildId = await resolveGuildId();
  if (!guildId) return <div className="card">Select a server first.</div>;

  const assignments = await prisma.permissionAssignment.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });

  const allNodes = Array.from(new Set(MODULES.flatMap((m) => m.permissions))).sort();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>
          <span className="gradient-text">Permissions</span>
        </h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Assign nodes to roles or users. DENY overrides ALLOW; wildcards like{' '}
          <code>economy.*</code> are supported.
        </p>
      </div>

      <div className="card">
        <h3>➕ Add assignment</h3>
        <form action={addPermission} className="row" style={{ gap: 8 }}>
          <input type="hidden" name="guildId" value={guildId} />
          <input name="node" placeholder="node (e.g. vault.start or economy.*)" list="nodes" style={{ flex: 1, minWidth: 200 }} />
          <datalist id="nodes">
            {allNodes.map((n) => (
              <option key={n} value={n} />
            ))}
            <option value="*" />
          </datalist>
          <select name="targetType" style={{ width: 'auto' }}>
            <option value="ROLE">Role</option>
            <option value="USER">User</option>
          </select>
          <input name="targetId" placeholder="role/user ID" style={{ maxWidth: 200 }} />
          <select name="effect" style={{ width: 'auto' }}>
            <option value="ALLOW">Allow</option>
            <option value="DENY">Deny</option>
          </select>
          <button className="btn small primary" type="submit">
            Add
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Current assignments</h3>
        {assignments.length === 0 ? (
          <p className="muted">
            None yet — every module works on its sensible default policy.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Effect</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.node}</td>
                    <td>{a.targetType}</td>
                    <td className="mono">{a.targetId}</td>
                    <td>
                      <span className={`pill ${a.effect === 'DENY' ? 'deny' : 'allow'}`}>{a.effect}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <form action={removePermission}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn small danger" type="submit">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
