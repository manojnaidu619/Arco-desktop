/**
 * Humanize UTC ISO message timestamps for display in the user's local timezone.
 *
 * Slack-style tiers (evaluated top to bottom):
 *
 *   | Tier        | Example output           |
 *   |-------------|--------------------------|
 *   | < 60 sec    | Just now                 |
 *   | Today       | 11:57 AM                 |
 *   | Yesterday   | Yesterday at 3:42 PM   |
 *   | This week   | Mon at 3:42 PM           |
 *   | This year   | May 26 at 3:42 PM        |
 *   | Prior year  | May 26, 2025             |
 *
 * Input is UTC ISO from SQLite; output uses the OS locale/timezone.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import {
  differenceInSeconds,
  format,
  getYear,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  subDays,
} from 'date-fns'

/** Messages younger than this show "Just now" instead of a clock time. */
const JUST_NOW_THRESHOLD_SEC = 60

/** Week boundaries match US calendar weeks (Sunday start). */
const WEEK_OPTS = { weekStartsOn: 0 as const }

/**
 * Humanize a UTC ISO message timestamp for display in the user's local timezone.
 *
 * @param isoUtc — e.g. "2026-06-26T18:57:46.123Z"
 * @param now — injectable for tests; defaults to `new Date()`
 * @returns e.g. "Just now", "11:57 AM", "May 26 at 3:42 PM"
 */
export function formatMessageTimestamp(isoUtc: string, now = new Date()): string {
  const date = new Date(isoUtc)
  if (Number.isNaN(date.getTime())) return ''

  // e.g. sent 30s ago → "Just now"
  if (differenceInSeconds(now, date) < JUST_NOW_THRESHOLD_SEC) {
    return 'Just now'
  }

  const time = format(date, 'h:mm a')

  // e.g. "2026-06-26T18:57:00Z" viewed same day → "11:57 AM"
  if (isSameDay(date, now)) return time

  // e.g. "2026-06-25T15:42:00Z" viewed next day → "Yesterday at 3:42 PM"
  if (isSameDay(date, subDays(now, 1))) return `Yesterday at ${time}`

  // Same calendar week but not today/yesterday — e.g. "Mon at 9:15 AM"
  if (
    isWithinInterval(date, {
      start: startOfWeek(now, WEEK_OPTS),
      end: endOfWeek(now, WEEK_OPTS),
    })
  ) {
    return format(date, "EEE 'at' h:mm a")
  }

  // Same year, older than this week — e.g. "May 26 at 3:42 PM" (not "05/26/2026")
  if (getYear(date) === getYear(now)) return format(date, "MMM d 'at' h:mm a")

  // Prior year — e.g. "May 26, 2025"
  return format(date, 'MMM d, yyyy')
}
