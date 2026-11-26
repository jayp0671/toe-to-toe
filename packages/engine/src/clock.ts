import { DateTime, Duration, type DurationLike } from 'luxon';
import { toInstant } from './time.ts';

/**
 * The only source of "now" (CLAUDE.md golden rule 2, docs/PLAN.md Appendix A8).
 * Engine functions never read a clock; callers pass `clock.now()` in.
 */
export interface Clock {
  /** The current instant, in UTC. */
  now(): DateTime<true>;
}

/** Real time. Use in production code paths; tests and the simulator use FakeClock. */
export const systemClock: Clock = {
  now: () => DateTime.utc(),
};

/** A clock that only moves when told to, so a whole season can run in seconds. */
export class FakeClock implements Clock {
  private current: DateTime<true>;

  /** @param iso an ISO 8601 instant with an explicit offset or `Z`. */
  constructor(iso: string) {
    this.current = toInstant(iso);
  }

  now(): DateTime<true> {
    return this.current;
  }

  /** Jump to an instant (forwards or backwards). */
  set(iso: string): void {
    this.current = toInstant(iso);
  }

  /** Move forward by real elapsed time (e.g. `{ hours: 1 }` is always 60 minutes, even across DST). */
  advance(duration: DurationLike): void {
    const d = Duration.fromDurationLike(duration);
    if (!d.isValid || d.toMillis() < 0) {
      throw new RangeError(
        `FakeClock.advance needs a non-negative duration, got ${d.toISO() ?? 'invalid'}`,
      );
    }
    this.current = this.current.plus(d);
  }
}
