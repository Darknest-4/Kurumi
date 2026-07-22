import { selectGuild } from '@/app/actions';

interface Guild {
  id: string;
  name: string | null;
}

export function GuildPicker({ guilds, selected }: { guilds: Guild[]; selected: string | null }) {
  if (guilds.length === 0) {
    return <span className="muted">No servers yet — invite the bot first.</span>;
  }
  return (
    <form action={selectGuild} className="row">
      <span className="muted">Server</span>
      <select name="guildId" defaultValue={selected ?? guilds[0].id} style={{ width: 'auto' }}>
        {guilds.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name ?? g.id}
          </option>
        ))}
      </select>
      <button className="btn small" type="submit">
        Switch
      </button>
    </form>
  );
}
