import type { DayRow, SyncStatus } from './use-debug-data.ts';
import { formatSteps, formatSyncTime } from './debug-format.ts';

/** Today's and yesterday's counted steps, last sync and sources, as RLS returns them. */
export function StepsPanel({ status, days }: { status: SyncStatus; days: DayRow[] }) {
  const rows = [
    { label: 'Today', date: status.today },
    { label: 'Yesterday', date: status.yesterday },
  ];
  return (
    <section>
      <h2>Counted steps</h2>
      <p>
        Home zone: {status.home_tz}. Last sync:{' '}
        <span data-testid="last-sync">{formatSyncTime(status.last_sync_at, status.home_tz)}</span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Steps</th>
            <th>Status</th>
            <th>Sources</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, date }) => {
            const day = days.find((d) => d.local_date === date);
            return (
              <tr key={date}>
                <td>
                  {label} ({date})
                </td>
                <td aria-label={`${label} counted steps`}>{day ? formatSteps(day.steps) : '0'}</td>
                <td>{day?.status ?? 'no data'}</td>
                <td>{day && day.sources.length > 0 ? day.sources.join(', ') : 'none'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
