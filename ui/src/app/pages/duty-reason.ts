import type { AstronautDuty } from '../api/models';
import { formatDate } from '../shared/dates';
import { isRetiredDuty } from './person-timeline';

export type ReasonKind = 'correction' | 'return' | 'future';

export interface ReasonRequirement {
  kind: ReasonKind;
  title: string;
  message: string;
  icon: string;
}

/** The duty with the latest start date (that is what the contract calls the latest duty). */
export function latestDuty(duties: readonly AstronautDuty[]): AstronautDuty | null {
  return duties.reduce<AstronautDuty | null>(
    (latest, duty) => (!latest || duty.dutyStartDate > latest.dutyStartDate ? duty : latest),
    null,
  );
}

/**
 * Why a new duty starting on `startDate` needs a reason, or null when it does not (contract: the start is before
 * the latest duty's start, the person's latest duty is RETIRED, or the start is after today in UTC).
 * Dates are `yyyy-MM-dd` strings, which compare correctly as text. An empty or unfinished date needs nothing yet.
 */
export function reasonRequirement(
  startDate: string,
  duties: readonly AstronautDuty[],
  todayUtc: string,
): ReasonRequirement | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return null;
  }
  const latest = latestDuty(duties);
  if (latest && startDate < latest.dutyStartDate) {
    return {
      kind: 'correction',
      title: 'Correcting an earlier date',
      message: `This start date is before the latest duty, which starts ${formatDate(latest.dutyStartDate)}. Explain the correction in the reason.`,
      icon: 'history',
    };
  }
  if (latest && isRetiredDuty(latest)) {
    return {
      kind: 'return',
      title: 'Returning from retirement',
      message:
        'This person is retired. Adding a duty returns them to service; say why in the reason.',
      icon: 'flight_land',
    };
  }
  if (startDate > todayUtc) {
    return {
      kind: 'future',
      title: 'Future-dated entry',
      message:
        'Starting in the future: this start date is after today (UTC), so a reason is required.',
      icon: 'schedule',
    };
  }
  return null;
}
